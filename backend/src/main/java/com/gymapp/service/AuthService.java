package com.gymapp.service;

import com.gymapp.dto.AuthDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                        BranchRepository branchRepository,
                        BranchAssignmentRepository branchAssignmentRepository,
                        PasswordEncoder passwordEncoder,
                        JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public AuthResponse registerMember(RegisterMemberRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        User member = User.builder()
                .name(req.name())
                .email(req.email())
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
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        User manager = User.builder()
                .name(req.name())
                .email(req.email())
                .phone(req.phone())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(Role.MANAGER)
                .active(true)
                .build();
        manager = userRepository.save(manager);

        branchAssignmentRepository.save(BranchAssignment.builder()
                .user(manager)
                .branch(branch)
                .build());

        String token = jwtUtil.generateToken(manager.getEmail(), manager.getRole().name(), manager.getId().toString());
        return new AuthResponse(token, manager.getId().toString(), manager.getName(), manager.getEmail(), manager.getRole().name());
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
}
