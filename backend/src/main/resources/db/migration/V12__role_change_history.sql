-- Audit trail for Owner-initiated role changes (e.g. Manager/Trainer -> Member when
-- someone leaves staff, or Member -> Trainer when someone joins). user_id cascades on
-- delete like the rest of a user's self-owned data (see V9). changed_by deliberately has
-- no ON DELETE clause (defaults to RESTRICT) - same pattern as payments.recorded_by -
-- but since only the Owner can ever be changed_by and the Owner can never be deleted,
-- this is never actually reachable; it's just consistent with the existing convention.
CREATE TABLE role_change_history (
                                     id            UUID PRIMARY KEY,
                                     user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                     previous_role VARCHAR NOT NULL,
                                     new_role      VARCHAR NOT NULL,
                                     changed_by    UUID NOT NULL REFERENCES users(id),
                                     changed_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_change_history_user_id ON role_change_history(user_id);