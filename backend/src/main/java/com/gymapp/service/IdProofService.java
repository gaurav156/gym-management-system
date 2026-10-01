package com.gymapp.service;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Who may view an ID proof: the person themself, the Owner (anyone), or a Manager (Members and
// Trainers only - a Manager's own proof is Owner-only, mirroring who may edit a Manager).
@Service
public class IdProofService {

    private final UserRepository userRepository;
    private final StorageService storage;

    public IdProofService(UserRepository userRepository, StorageService storage) {
        this.userRepository = userRepository;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public StorageService.StoredFile load(UUID targetId, UUID callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean self = caller.getId().equals(target.getId());
        boolean owner = caller.getRole() == Role.OWNER;
        boolean managerForNonManager = caller.getRole() == Role.MANAGER
                && (target.getRole() == Role.MEMBER || target.getRole() == Role.TRAINER);
        if (!(self || owner || managerForNonManager)) {
            throw new IllegalArgumentException("You are not allowed to view this ID proof");
        }
        if (target.getIdProofKey() == null) {
            throw new IllegalArgumentException("No ID proof has been uploaded");
        }
        return storage.get(target.getIdProofKey());
    }
}