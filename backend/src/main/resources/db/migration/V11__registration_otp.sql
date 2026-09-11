-- Verifies a new member's email is real/reachable before the account is created. Keyed
-- by email (not user_id) since no user row exists yet at request-OTP time - the same
-- shape as password_reset_otp/change_password_otp otherwise. A fresh request always
-- inserts a new row rather than overwriting, same reasoning as those tables.
CREATE TABLE registration_otp (
                                  id            UUID PRIMARY KEY,
                                  email         VARCHAR NOT NULL,
                                  otp_hash      VARCHAR NOT NULL,
                                  expires_at    TIMESTAMP NOT NULL,
                                  consumed_at   TIMESTAMP,
                                  attempt_count INTEGER NOT NULL DEFAULT 0,
                                  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_registration_otp_email ON registration_otp(email);