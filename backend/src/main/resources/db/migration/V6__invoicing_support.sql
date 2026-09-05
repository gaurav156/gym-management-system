-- Invoice numbering: DB-assigned sequence, immune to race conditions from concurrent purchases
CREATE SEQUENCE IF NOT EXISTS invoice_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE payments ADD COLUMN invoice_seq BIGINT;
ALTER TABLE payments ALTER COLUMN invoice_seq SET DEFAULT nextval('invoice_seq');

WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM payments
    WHERE invoice_seq IS NULL
)
UPDATE payments p SET invoice_seq = numbered.rn
    FROM numbered WHERE p.id = numbered.id;

SELECT setval('invoice_seq', GREATEST((SELECT COALESCE(MAX(invoice_seq), 0) FROM payments), 1));

ALTER TABLE payments ALTER COLUMN invoice_seq SET NOT NULL;
CREATE UNIQUE INDEX idx_payments_invoice_seq ON payments(invoice_seq);

-- Branch phone, shown on the invoice header
ALTER TABLE branches ADD COLUMN phone VARCHAR(20);