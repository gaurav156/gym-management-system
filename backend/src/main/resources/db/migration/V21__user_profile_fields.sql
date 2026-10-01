-- Personal details + ID proof. self_edit_used backs the "Member/Trainer/Manager may update
-- their own details once" rule; existing users start unused so they each get one edit.
ALTER TABLE users ADD COLUMN gender VARCHAR CHECK (gender IN ('MALE', 'FEMALE', 'OTHER'));
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN id_proof_key TEXT;
ALTER TABLE users ADD COLUMN self_edit_used BOOLEAN NOT NULL DEFAULT FALSE;