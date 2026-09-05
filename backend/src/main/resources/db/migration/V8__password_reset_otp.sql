-- Stores OTPs for the "forgot password" flow. One row per OTP sent; a fresh request
-- always inserts a new row rather than overwriting an old one, so attempt/expiry history
-- stays auditable. otp_hash is a bcrypt hash (same PasswordEncoder used for login
-- passwords) - the raw code is never persisted anywhere.
CREATE TABLE password_reset_otp (
                                    id            UUID PRIMARY KEY,
                                    user_id       UUID NOT NULL REFERENCES users(id),
                                    otp_hash      VARCHAR NOT NULL,
                                    channel       VARCHAR NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'WHATSAPP')),
                                    destination   VARCHAR NOT NULL,
                                    expires_at    TIMESTAMP NOT NULL,
                                    consumed_at   TIMESTAMP,
                                    attempt_count INTEGER NOT NULL DEFAULT 0,
                                    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_otp_user_id ON password_reset_otp(user_id);