-- Confirms an Owner-initiated promotion to OWNER. Emailed to the ACTING owner (owner_id),
-- and bound to one specific target_user_id so a code issued for one person can never be
-- used to promote someone else. Both FKs cascade like the rest of a user's self-owned
-- data (see V9).
CREATE TABLE owner_promotion_otp (
                                     id             UUID PRIMARY KEY,
                                     owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                     target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                     otp_hash       VARCHAR NOT NULL,
                                     destination    VARCHAR NOT NULL,
                                     expires_at     TIMESTAMP NOT NULL,
                                     consumed_at    TIMESTAMP,
                                     attempt_count  INTEGER NOT NULL DEFAULT 0,
                                     created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_owner_promotion_otp_owner_target ON owner_promotion_otp(owner_id, target_user_id);