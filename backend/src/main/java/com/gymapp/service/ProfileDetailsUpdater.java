package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.entity.User;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Objects;

// One place that applies the "personal details" fields, so self-service edits and the
// Owner/Manager on-behalf edits can't drift apart. It only reports WHETHER anything changed -
// the permission/lock decision stays with the caller (ProfileService for self-edits).
@Component
public class ProfileDetailsUpdater {

    private static final int MAX_AGE_YEARS = 120;

    private final ImageRefs imageRefs;

    public ProfileDetailsUpdater(ImageRefs imageRefs) {
        this.imageRefs = imageRefs;
    }

    // Null request field = leave as is. Returns true only if a value actually changed, so
    // a form that echoes back unchanged values never counts as an edit.
    public boolean applyDetails(User u, UpdateProfileRequest req) {
        boolean changed = false;

        if (req.name() != null && !req.name().isBlank() && !req.name().trim().equals(u.getName())) {
            u.setName(req.name().trim());
            changed = true;
        }
        if (req.phone() != null && !Objects.equals(blankToNull(req.phone()), blankToNull(u.getPhone()))) {
            u.setPhone(blankToNull(req.phone()));
            changed = true;
        }
        if (req.address() != null && !Objects.equals(blankToNull(req.address()), blankToNull(u.getAddress()))) {
            u.setAddress(blankToNull(req.address()));
            changed = true;
        }
        if (req.gender() != null && req.gender() != u.getGender()) {
            u.setGender(req.gender());
            changed = true;
        }
        if (req.dateOfBirth() != null && !req.dateOfBirth().equals(u.getDateOfBirth())) {
            validateDateOfBirth(req.dateOfBirth());
            u.setDateOfBirth(req.dateOfBirth());
            changed = true;
        }

        String newPhoto = imageRefs.resolveForSave(u.getPhoto(), req.photo(), ImagePurpose.PHOTO);
        if (!Objects.equals(newPhoto, u.getPhoto())) {
            u.setPhoto(newPhoto);
            changed = true;
        }
        return changed;
    }

    // idProof: null = leave as is, blank = clear, otherwise the key returned by the upload.
    // selfService=true means the person is changing their OWN proof: allowed only while none
    // has been submitted yet. Owner/Manager edits pass false.
    public void applyIdProof(User u, UpdateProfileRequest req, boolean selfService) {
        String incoming = req.idProof();
        if (incoming == null) return;

        String current = u.getIdProofKey();
        if (current == null && incoming.isBlank()) return;
        if (current != null && incoming.equals(current)) return;

        if (selfService && current != null) {
            throw new IllegalArgumentException(
                    "Your ID proof has already been submitted - only the Owner or a Manager can change it");
        }
        u.setIdProofKey(imageRefs.resolveForSave(current, incoming, ImagePurpose.ID_PROOF));
    }

    public void validateDateOfBirth(LocalDate dob) {
        LocalDate today = LocalDate.now();
        if (dob.isAfter(today)) {
            throw new IllegalArgumentException("Date of birth cannot be in the future");
        }
        if (dob.isBefore(today.minusYears(MAX_AGE_YEARS))) {
            throw new IllegalArgumentException("Please enter a valid date of birth");
        }
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}