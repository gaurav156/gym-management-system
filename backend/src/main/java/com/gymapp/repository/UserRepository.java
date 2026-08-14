package com.gymapp.repository;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByQrToken(String qrToken);
    boolean existsByEmail(String email);
    List<User> findByRole(Role role);
}
