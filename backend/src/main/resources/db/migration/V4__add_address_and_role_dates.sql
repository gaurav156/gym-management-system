-- address applies to any user; enrollment_date is member-specific (set on first purchase),
-- joining_date/left_date are trainer-specific (set on creation / by staff respectively).
-- All nullable since they don't all apply to every role - simplest option without splitting
-- User into per-role tables.

ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN enrollment_date DATE;
ALTER TABLE users ADD COLUMN joining_date DATE;
ALTER TABLE users ADD COLUMN left_date DATE;