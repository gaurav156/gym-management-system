-- Branch-specific expense records (salary, utilities, rent, equipment, etc.). recorded_by
-- mirrors payments.recorded_by - no ON DELETE clause (defaults to RESTRICT), checked
-- explicitly in UserManagementService before any staff delete, so removing a Manager who
-- logged expenses can't silently corrupt that branch's expense history.

CREATE TABLE expenses (
                          id            UUID PRIMARY KEY,
                          branch_id     UUID NOT NULL REFERENCES branches(id),
                          recorded_by   UUID NOT NULL REFERENCES users(id),
                          category      VARCHAR NOT NULL CHECK (category IN ('SALARY', 'UTILITY', 'RENT', 'EQUIPMENT', 'MAINTENANCE', 'OTHER')),
                          amount        NUMERIC NOT NULL,
                          expense_date  DATE NOT NULL,
                          remark        TEXT,
                          bill_key      TEXT,
                          created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);