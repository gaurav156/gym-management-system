package com.gymapp.account;

import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// AFTER_COMMIT + @Async: fires only once the creating transaction has actually committed
// (so the User row is visible to this new thread's own read), and runs off-thread so a
// slow or failing mail server never delays or fails the create-account/register response -
// AuthService has already returned by the time this runs. Mirrors InvoicePurchaseListener.
@Component
public class AccountCreatedListener {

    private final UserRepository userRepository;
    private final AccountCreatedEmailService accountCreatedEmailService;

    public AccountCreatedListener(UserRepository userRepository, AccountCreatedEmailService accountCreatedEmailService) {
        this.userRepository = userRepository;
        this.accountCreatedEmailService = accountCreatedEmailService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountCreated(AccountCreatedEvent event) {
        try {
            userRepository.findById(event.userId())
                    .ifPresent(accountCreatedEmailService::sendAccountCreatedEmail);
        } catch (Exception e) {
            // Fire-and-forget by design - a failed welcome email must never surface to the
            // Owner or the new user as an account-creation failure. Logged so it's still visible.
            System.err.println("Failed to send account-created email for user " + event.userId() + ": " + e.getMessage());
        }
    }
}