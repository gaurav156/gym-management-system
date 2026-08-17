-- Adds TRAINER to users.role, and a photo column for profile pictures.

ALTER TABLE users ADD COLUMN photo TEXT;

DO $$
DECLARE
con_name text;
BEGIN
SELECT conname INTO con_name
FROM pg_constraint
WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%';

IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', con_name);
END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER', 'TRAINER'));