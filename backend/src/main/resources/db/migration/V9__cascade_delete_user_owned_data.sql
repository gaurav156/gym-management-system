-- Enables "delete account entirely" for Owners. branch_assignments, attendance, and a
-- member's own memberships/payments are all data that belongs 1:1 to that person's
-- identity, so they cascade-delete along with the user row. payments.recorded_by
-- deliberately does NOT get this treatment here - deleting a manager who has recorded
-- payments for OTHER members would corrupt those members' invoice history, so that FK
-- stays RESTRICT and is checked explicitly in UserManagementService before any delete.

DO $$
DECLARE con_name text;
BEGIN
SELECT conname INTO con_name FROM pg_constraint
WHERE conrelid = 'branch_assignments'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%user_id%REFERENCES users%';
IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE branch_assignments DROP CONSTRAINT %I', con_name);
END IF;
END $$;
ALTER TABLE branch_assignments ADD CONSTRAINT branch_assignments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
DECLARE con_name text;
BEGIN
SELECT conname INTO con_name FROM pg_constraint
WHERE conrelid = 'attendance'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%member_id%REFERENCES users%';
IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE attendance DROP CONSTRAINT %I', con_name);
END IF;
END $$;
ALTER TABLE attendance ADD CONSTRAINT attendance_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
DECLARE con_name text;
BEGIN
SELECT conname INTO con_name FROM pg_constraint
WHERE conrelid = 'memberships'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%member_id%REFERENCES users%';
IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE memberships DROP CONSTRAINT %I', con_name);
END IF;
END $$;
ALTER TABLE memberships ADD CONSTRAINT memberships_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
DECLARE con_name text;
BEGIN
SELECT conname INTO con_name FROM pg_constraint
WHERE conrelid = 'payments'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%member_id%REFERENCES users%';
IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', con_name);
END IF;
END $$;
ALTER TABLE payments ADD CONSTRAINT payments_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;

-- payments.recorded_by is left untouched (default RESTRICT) - deleting a staff member
-- who has recorded payments for others must be blocked at the application layer instead.