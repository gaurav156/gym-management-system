package com.gymapp.config;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// Creates the single master OWNER account on first startup, if one doesn't already
// exist. There is deliberately no public "register as owner" endpoint - this is the
// only way an OWNER account gets created, matching the "one master account" requirement.
@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.owner-email}")
    private String ownerEmail;

    @Value("${app.seed.owner-password}")
    private String ownerPassword;

    @Value("${app.seed.owner-name}")
    private String ownerName;

    public DataSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.findByEmail(ownerEmail).isEmpty()) {
            User owner = User.builder()
                    .name(ownerName)
                    .email(ownerEmail)
                    .passwordHash(passwordEncoder.encode(ownerPassword))
                    .role(Role.OWNER)
                    .active(true)
                    .build();
            userRepository.save(owner);
            System.out.println("Seeded OWNER account: " + ownerEmail);
        }
    }
}
