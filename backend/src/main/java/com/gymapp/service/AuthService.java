package com.gymapp.service;

import com.gymapp.dto.AuthDtos.*;
import com.gymapp.entity.*;
import com.gymapp.otp.OtpDeliveryRouter;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.RegistrationOtpRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {

    // Same shape as the other OTP flows - kept as separate literals rather than shared,
    // consistent with how PasswordResetService/ProfileService each define their own.
    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RegistrationOtpRepository registrationOtpRepository;
    private final OtpDeliveryRouter otpDeliveryRouter;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    @Value("${app.mail.gym-name}")
    private String gymName;

    public AuthService(UserRepository userRepository,
                       BranchRepository branchRepository,
                       BranchAssignmentRepository branchAssignmentRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       RegistrationOtpRepository registrationOtpRepository,
                       OtpDeliveryRouter otpDeliveryRouter) {
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.registrationOtpRepository = registrationOtpRepository;
        this.otpDeliveryRouter = otpDeliveryRouter;
    }

    // Step 1 of self-registration. Unlike PasswordResetService's request-otp (which
    // always returns a generic message to avoid account enumeration), this DOES tell the
    // caller directly if the email is already registered - registration is a context
    // where "is this email available" is expected, ordinary information (the register
    // form itself reveals it on submit either way), not a security leak.
    @Transactional
    public RequestRegistrationOtpResponse requestRegistrationOtp(RequestRegistrationOtpRequest req) {
        String email = req.email().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("An account with this email already exists");
        }

        registrationOtpRepository.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email)
                .filter(existing -> existing.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Please wait a minute before requesting another code");
                });

        String otp = generateOtp();
        RegistrationOtp record = RegistrationOtp.builder()
                .email(email)
                .otpHash(passwordEncoder.encode(otp))
                .expiresAt(LocalDateTime.now().plusMinutes(expiryMinutes))
                .attemptCount(0)
                .build();
        registrationOtpRepository.save(record);

        // No User row exists yet to pass as the "user" parameter EmailOtpDeliveryService
        // expects for its greeting - a lightweight placeholder with just enough to render
        // "Hi there," is enough; the template only ever reads getName().
        User placeholder = User.builder().name("there").build();
        try {
            otpDeliveryRouter.forChannel(OtpChannel.EMAIL).send(placeholder, email, otp);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to send the verification code - please try again.");
        }

        return new RequestRegistrationOtpResponse(
                "A verification code has been sent to " + email + " - it expires in " + expiryMinutes + " minutes.");
    }

    @Transactional
    public AuthResponse registerMember(RegisterMemberRequest req) {
        String email = req.email().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        RegistrationOtp record = registrationOtpRepository
                .findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new IllegalArgumentException("Please request a verification code for this email first"));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code expired - please request a new one");
        }
        if (record.getAttemptCount() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("Too many attempts - please request a new code");
        }
        if (!passwordEncoder.matches(req.otp().trim(), record.getOtpHash())) {
            record.setAttemptCount(record.getAttemptCount() + 1);
            registrationOtpRepository.save(record);
            throw new IllegalArgumentException("Incorrect verification code");
        }
        record.setConsumedAt(LocalDateTime.now());
        registrationOtpRepository.save(record);

        User member = User.builder()
                .name(req.name())
                .email(email)
                .phone(req.phone())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(Role.MEMBER)
                .checkinPin(generatePin())
                .qrToken(UUID.randomUUID().toString())
                .active(true)
                .build();
        member = userRepository.save(member);

        branchAssignmentRepository.save(BranchAssignment.builder()
                .user(member)
                .branch(branch)
                .build());

        String token = jwtUtil.generateToken(member.getEmail(), member.getRole().name(), member.getId().toString());
        return new AuthResponse(token, member.getId().toString(), member.getName(), member.getEmail(), member.getRole().name());
    }

    @Transactional
    public AuthResponse createManager(CreateManagerRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        List<Branch> branches = resolveBranches(req.branchIds());

        User manager = User.builder()
                .name(req.name())
                .email(req.email())
                .phone(req.phone())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(Role.MANAGER)
                .active(true)
                .build();
        manager = userRepository.save(manager);
        assignToBranches(manager, branches);

        String token = jwtUtil.generateToken(manager.getEmail(), manager.getRole().name(), manager.getId().toString());
        return new AuthResponse(token, manager.getId().toString(), manager.getName(), manager.getEmail(), manager.getRole().name());
    }

    // Trainers get a checkin PIN/QR token just like members - they're staff, but their
    // attendance still needs to be logged via the same PIN/QR kiosk flow.
    @Transactional
    public AuthResponse createTrainer(CreateTrainerRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        List<Branch> branches = resolveBranches(req.branchIds());

        User trainer = User.builder()
                .name(req.name())
                .email(req.email())
                .phone(req.phone())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(Role.TRAINER)
                .checkinPin(generatePin())
                .qrToken(UUID.randomUUID().toString())
                .joiningDate(LocalDate.now())
                .active(true)
                .build();
        trainer = userRepository.save(trainer);
        assignToBranches(trainer, branches);

        String token = jwtUtil.generateToken(trainer.getEmail(), trainer.getRole().name(), trainer.getId().toString());
        return new AuthResponse(token, trainer.getId().toString(), trainer.getName(), trainer.getEmail(), trainer.getRole().name());
    }

    private List<Branch> resolveBranches(List<UUID> branchIds) {
        List<Branch> branches = branchRepository.findAllById(branchIds);
        if (branches.size() != branchIds.size()) {
            throw new IllegalArgumentException("One or more branches not found");
        }
        return branches;
    }

    private void assignToBranches(User user, List<Branch> branches) {
        for (Branch branch : branches) {
            branchAssignmentRepository.save(BranchAssignment.builder()
                    .user(user)
                    .branch(branch)
                    .build());
        }
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        if (!user.isActive()) {
            throw new IllegalArgumentException("This account has been deactivated");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId().toString());
        return new AuthResponse(token, user.getId().toString(), user.getName(), user.getEmail(), user.getRole().name());
    }

    private String generatePin() {
        SecureRandom random = new SecureRandom();
        return String.format("%04d", random.nextInt(10000));
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, OTP_LENGTH);
        return String.format("%0" + OTP_LENGTH + "d", random.nextInt(max));
    }
}