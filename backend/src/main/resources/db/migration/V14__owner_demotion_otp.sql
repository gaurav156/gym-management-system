-- Confirms demoting an existing OWNER. Emailed to the primary Owner address (OWNER_EMAIL),
-- not to whoever is acting - requested_by is recorded so a code can only be used by the
-- Owner who asked for it, and target_user_id binds it to one specific account. Both FKs
-- cascade like the rest of a user's self-owned data (see V9), so deleting the demoted
-- account afterwards cleans these rows up too.
CREATE TABLE owner_demotion_otp (
                                    id             UUID PRIMARY KEY,
                                    requested_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                    otp_hash       VARCHAR NOT NULL,
                                    destination    VARCHAR NOT NULL,
                                    expires_at     TIMESTAMP NOT NULL,
                                    consumed_at    TIMESTAMP,
                                    attempt_count  INTEGER NOT NULL DEFAULT 0,
                                    created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_owner_demotion_otp_requester_target ON owner_demotion_otp(requested_by, target_user_id);