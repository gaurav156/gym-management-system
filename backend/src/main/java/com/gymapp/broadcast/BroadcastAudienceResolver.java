package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastAudience;
import com.gymapp.entity.MembershipStatus;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// Single source of truth for "who is in this audience". Always excludes deactivated accounts,
// and Trainers/Managers whose leftDate has passed (same rule as login/check-in).
@Component
public class BroadcastAudienceResolver {

    private final UserRepository userRepository;

    public BroadcastAudienceResolver(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<User> resolve(BroadcastAudience audience) {
        LocalDate today = LocalDate.now();

        List<User> users = switch (audience) {
            case ALL_USERS -> userRepository.findActiveByRoleIn(EnumSet.allOf(Role.class));
            case ALL_MEMBERS -> userRepository.findActiveByRoleIn(EnumSet.of(Role.MEMBER));
            case ACTIVE_MEMBERS -> userRepository.findActiveMembersWithUsablePlan(
                    Role.MEMBER, MembershipStatus.ACTIVE, today);
            case INACTIVE_MEMBERS -> {
                Set<UUID> activeIds = userRepository.findActiveMembersWithUsablePlan(
                                Role.MEMBER, MembershipStatus.ACTIVE, today).stream()
                        .map(User::getId).collect(Collectors.toSet());
                yield userRepository.findActiveByRoleIn(EnumSet.of(Role.MEMBER)).stream()
                        .filter(u -> !activeIds.contains(u.getId())).toList();
            }
            case ALL_STAFF -> userRepository.findActiveByRoleIn(EnumSet.of(Role.OWNER, Role.MANAGER, Role.TRAINER));
            case ALL_TRAINERS -> userRepository.findActiveByRoleIn(EnumSet.of(Role.TRAINER));
            case ALL_MANAGERS -> userRepository.findActiveByRoleIn(EnumSet.of(Role.MANAGER));
            case ALL_OWNERS -> userRepository.findActiveByRoleIn(EnumSet.of(Role.OWNER));
        };

        return users.stream().filter(u -> !hasLeft(u, today)).toList();
    }

    private boolean hasLeft(User u, LocalDate today) {
        return (u.getRole() == Role.TRAINER || u.getRole() == Role.MANAGER)
                && u.getLeftDate() != null && !u.getLeftDate().isAfter(today);
    }
}