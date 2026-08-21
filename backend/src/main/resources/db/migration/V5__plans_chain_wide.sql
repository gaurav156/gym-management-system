-- Membership plans are now chain-wide rather than per-branch, so a plan created at one
-- branch is recognized everywhere - required for members/trainers to keep valid access
-- after being assigned to additional or different branches.

DO $$
DECLARE
con_name text;
BEGIN
SELECT conname INTO con_name
FROM pg_constraint
WHERE conrelid = 'membership_plans'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%branch_id%';

IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE membership_plans DROP CONSTRAINT %I', con_name);
END IF;
END $$;

ALTER TABLE membership_plans DROP COLUMN IF EXISTS branch_id;