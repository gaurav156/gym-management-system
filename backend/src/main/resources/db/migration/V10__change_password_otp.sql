-- Separate from password_reset_otp on purpose: this flow is authenticated (the caller
-- already has a valid JWT) and the code is always emailed to the caller's OWN address on
-- file, never a client-supplied identifier - so there's no account-enumeration concern
-- and no need for the generic-response dance PasswordResetService uses. user_id cascades
-- on delete, same as the rest of a user's self-owned data (see V9).
CREATE TABLE change_password_otp (
                                     id            UUID PRIMARY KEY,
                                     user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                     otp_hash      VARCHAR NOT NULL,
                                     destination   VARCHAR NOT NULL,
                                     expires_at    TIMESTAMP NOT NULL,
                                     consumed_at   TIMESTAMP,
                                     attempt_count INTEGER NOT NULL DEFAULT 0,
                                     created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_password_otp_user_id ON change_password_otp(user_id);