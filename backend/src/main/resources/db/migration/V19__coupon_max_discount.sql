-- backend/src/main/resources/db/migration/V19__coupon_max_discount.sql

-- Caps how much an absolute amount a PERCENTAGE coupon can take off (e.g. "20% off, up to
-- Rs. 500") - null means uncapped, same nullable-means-unbounded convention as
-- startsAt/endsAt. Meaningless for FIXED coupons (their discountValue already IS the cap),
-- so it's simply ignored there rather than constrained at the DB level.
ALTER TABLE coupons ADD COLUMN max_discount_amount NUMERIC;