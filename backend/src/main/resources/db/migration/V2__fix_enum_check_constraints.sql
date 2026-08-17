-- Fixes CHECK constraints left stale by Hibernate's ddl-auto: update, which adds new
-- columns/tables but never widens or drops an existing CHECK constraint. payments.mode
-- was created back when PaymentMode only had CASH/ONLINE; memberships.status was created
-- before PAUSED existed. This looks up each constraint by column (rather than hardcoding
-- a guessed name) so it works regardless of exactly what Hibernate happened to name it.
-- On a brand-new database this is a no-op-equivalent: V1 already created the constraints
-- with the correct final values, so this just drops and re-adds an identical constraint.

DO $$
DECLARE
con_name text;
BEGIN
SELECT conname INTO con_name
FROM pg_constraint
WHERE conrelid = 'payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%mode%';

IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', con_name);
END IF;
END $$;

ALTER TABLE payments ADD CONSTRAINT payments_mode_check
    CHECK (mode IN ('CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'));

DO $$
DECLARE
con_name text;
BEGIN
SELECT conname INTO con_name
FROM pg_constraint
WHERE conrelid = 'memberships'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%';

IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE memberships DROP CONSTRAINT %I', con_name);
END IF;
END $$;

ALTER TABLE memberships ADD CONSTRAINT memberships_status_check
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED'));