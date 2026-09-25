-- Branch-specific stock: a product's availability now varies by branch (Branch A might
-- have 10 units, Branch B 0). Replaces the single products.stock_quantity column, which
-- wrongly implied one shared pool across every branch.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE product_branch_stock (
                                      id              UUID PRIMARY KEY,
                                      product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                      branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                                      stock_quantity  INTEGER NOT NULL DEFAULT 0,
                                      UNIQUE (product_id, branch_id)
);
CREATE INDEX idx_product_branch_stock_product ON product_branch_stock(product_id);
CREATE INDEX idx_product_branch_stock_branch ON product_branch_stock(branch_id);

-- Backfill: give every existing branch the product's old shared count, so nothing
-- silently drops to zero for products created before this migration.
INSERT INTO product_branch_stock (id, product_id, branch_id, stock_quantity)
SELECT gen_random_uuid(), p.id, b.id, p.stock_quantity
FROM products p CROSS JOIN branches b;

ALTER TABLE products DROP COLUMN stock_quantity;