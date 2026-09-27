-- Adds partial-payment support to memberships (pay less than the full plan price now,
-- track a balance + due date, auto-pause on missed payment) and discount/coupon support
-- to membership plans, mirroring the existing product-catalog discount/coupon model.

ALTER TABLE membership_plans ADD COLUMN discount_price NUMERIC;
ALTER TABLE membership_plans ADD COLUMN discount_starts_at TIMESTAMP;
ALTER TABLE membership_plans ADD COLUMN discount_ends_at TIMESTAMP;

-- Coupons can now be scoped to products, memberships, or both. Existing rows default to
-- PRODUCT, which is all they were ever used for until now, so nothing changes for them.
ALTER TABLE coupons ADD COLUMN applies_to VARCHAR NOT NULL DEFAULT 'PRODUCT'
    CHECK (applies_to IN ('PRODUCT', 'MEMBERSHIP', 'BOTH'));

ALTER TABLE memberships ADD COLUMN total_amount NUMERIC;
ALTER TABLE memberships ADD COLUMN amount_paid NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN payment_status VARCHAR NOT NULL DEFAULT 'PAID'
    CHECK (payment_status IN ('PAID', 'PARTIAL'));
ALTER TABLE memberships ADD COLUMN balance_due_date DATE;
ALTER TABLE memberships ADD COLUMN paused_reason VARCHAR
    CHECK (paused_reason IN ('MANUAL', 'NONPAYMENT'));
ALTER TABLE memberships ADD COLUMN coupon_id UUID REFERENCES coupons(id);
ALTER TABLE memberships ADD COLUMN discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Backfill: every membership purchased before this feature existed was paid in full -
-- total_amount is reconstructed from the sum of its own payments, the only historical
-- record of what it actually cost.
UPDATE memberships m
SET total_amount = COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.membership_id = m.id), 0),
    amount_paid  = COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.membership_id = m.id), 0)
WHERE total_amount IS NULL;

ALTER TABLE memberships ALTER COLUMN total_amount SET NOT NULL;

-- Every pre-existing PAUSED row was manager/owner-initiated - tag it MANUAL so the new
-- nonpayment auto-pause path (MembershipDueJob) never confuses the two.
UPDATE memberships SET paused_reason = 'MANUAL' WHERE status = 'PAUSED' AND paused_reason IS NULL;