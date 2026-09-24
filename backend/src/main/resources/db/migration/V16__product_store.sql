-- Product catalog, coupons, and front-desk product orders. Mirrors the membership_plans /
-- payments pattern: products are chain-wide (Owner-managed, visible/purchasable at any
-- branch), orders are branch-scoped for pickup only (no home delivery yet - see spec).
--
-- Stock is decremented at order creation (not at a later "completed" step) so an order
-- freezes its stock the moment it's recorded - this covers both the manual cash flow
-- (handed over immediately, so CONFIRMED == COMPLETED) and the future online-payment flow
-- (CONFIRMED but not yet picked up), without two different decrement paths to keep in sync.

CREATE SEQUENCE IF NOT EXISTS product_order_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE products (
                          id                  UUID PRIMARY KEY,
                          name                VARCHAR NOT NULL,
                          description         TEXT,
                          price               NUMERIC NOT NULL,
                          discount_price      NUMERIC,
                          discount_starts_at  TIMESTAMP,
                          discount_ends_at    TIMESTAMP,
                          stock_quantity      INTEGER NOT NULL DEFAULT 0,
                          active              BOOLEAN NOT NULL DEFAULT TRUE,
                          created_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- Ordered list of images per product (same object-storage keys as avatars/signatures -
-- see ImagePurpose.PRODUCT). display_order preserves the order they were uploaded in.
CREATE TABLE product_images (
                                product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                display_order   INTEGER NOT NULL,
                                image_key       TEXT NOT NULL,
                                PRIMARY KEY (product_id, display_order)
);

CREATE TABLE coupons (
                         id                      UUID PRIMARY KEY,
                         code                    VARCHAR NOT NULL UNIQUE,
                         description             TEXT,
                         discount_type           VARCHAR NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
                         discount_value          NUMERIC NOT NULL,
                         starts_at               TIMESTAMP,
                         ends_at                 TIMESTAMP,
                         active                  BOOLEAN NOT NULL DEFAULT TRUE,
                         first_time_buyers_only  BOOLEAN NOT NULL DEFAULT FALSE,
                         max_redemptions         INTEGER,
                         times_redeemed          INTEGER NOT NULL DEFAULT 0,
                         created_at              TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_orders (
                                id              UUID PRIMARY KEY,
                                member_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Pickup branch, selected before purchase per the "no home delivery yet" requirement.
                                branch_id       UUID NOT NULL REFERENCES branches(id),
    -- The manager/owner who recorded a manual cash sale. Nullable so a future
    -- self-service online purchase (no staff involved) fits without a schema change.
    -- Deliberately NOT cascade-delete - same audit-integrity reasoning as
    -- payments.recorded_by (see V9): checked explicitly in UserManagementService.
                                recorded_by     UUID REFERENCES users(id),
                                coupon_id       UUID REFERENCES coupons(id),
                                subtotal        NUMERIC NOT NULL,
                                discount_amount NUMERIC NOT NULL DEFAULT 0,
                                total_amount    NUMERIC NOT NULL,
                                mode            VARCHAR NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE')),
                                status          VARCHAR NOT NULL CHECK (status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')),
                                invoice_seq     BIGINT NOT NULL DEFAULT nextval('product_order_seq'),
                                created_at      TIMESTAMP NOT NULL DEFAULT now(),
                                completed_at    TIMESTAMP,
                                cancelled_at    TIMESTAMP,
                                refund_amount   NUMERIC,
                                refunded_by     UUID REFERENCES users(id),
                                refund_mode     VARCHAR CHECK (refund_mode IN ('CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE')),
                                refund_note     TEXT
);
CREATE UNIQUE INDEX idx_product_orders_invoice_seq ON product_orders(invoice_seq);
CREATE INDEX idx_product_orders_member_id ON product_orders(member_id);
CREATE INDEX idx_product_orders_branch_id ON product_orders(branch_id);

-- product_name_snapshot/unit_price freeze what was actually charged, so a later price or
-- name change on the product never rewrites historical invoices - same reasoning as
-- MembershipDtos.MembershipAdminResponse keeping plan details out of live joins alone.
CREATE TABLE product_order_items (
                                     id                      UUID PRIMARY KEY,
                                     order_id                UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
                                     product_id              UUID NOT NULL REFERENCES products(id),
                                     product_name_snapshot   VARCHAR NOT NULL,
                                     quantity                INTEGER NOT NULL,
                                     unit_price              NUMERIC NOT NULL,
                                     line_total              NUMERIC NOT NULL
);
CREATE INDEX idx_product_order_items_order_id ON product_order_items(order_id);