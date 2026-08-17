-- Baseline schema. On a brand-new database this creates everything from scratch.
-- On the existing dev database, Flyway's baseline-on-migrate skips actually running
-- this script (the tables already exist) and just records V1 as applied.

CREATE TABLE users (
                       id             UUID PRIMARY KEY,
                       name           VARCHAR NOT NULL,
                       email          VARCHAR NOT NULL UNIQUE,
                       phone          VARCHAR,
                       password_hash  VARCHAR NOT NULL,
                       role           VARCHAR NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER')),
                       checkin_pin    VARCHAR(4),
                       qr_token       VARCHAR UNIQUE,
                       active         BOOLEAN NOT NULL DEFAULT TRUE,
                       created_at     TIMESTAMP
);

CREATE TABLE branches (
                          id         UUID PRIMARY KEY,
                          name       VARCHAR NOT NULL,
                          address    VARCHAR,
                          created_at TIMESTAMP
);

CREATE TABLE branch_assignments (
                                    id          UUID PRIMARY KEY,
                                    user_id     UUID NOT NULL REFERENCES users(id),
                                    branch_id   UUID NOT NULL REFERENCES branches(id),
                                    assigned_at TIMESTAMP,
                                    UNIQUE (user_id, branch_id)
);

CREATE TABLE membership_plans (
                                  id                UUID PRIMARY KEY,
                                  branch_id         UUID NOT NULL REFERENCES branches(id),
                                  name              VARCHAR NOT NULL,
                                  duration_months   INTEGER NOT NULL,
                                  price             NUMERIC NOT NULL,
                                  active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE memberships (
                             id         UUID PRIMARY KEY,
                             member_id  UUID NOT NULL REFERENCES users(id),
                             plan_id    UUID NOT NULL REFERENCES membership_plans(id),
                             branch_id  UUID NOT NULL REFERENCES branches(id),
                             start_date DATE NOT NULL,
                             end_date   DATE NOT NULL,
                             status     VARCHAR NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED')),
                             paused_at  DATE
);

CREATE TABLE attendance (
                            id              UUID PRIMARY KEY,
                            member_id       UUID NOT NULL REFERENCES users(id),
                            branch_id       UUID NOT NULL REFERENCES branches(id),
                            check_in_time   TIMESTAMP NOT NULL,
                            check_out_time  TIMESTAMP,
                            method          VARCHAR NOT NULL CHECK (method IN ('PIN', 'QR', 'BIOMETRIC'))
);

CREATE TABLE payments (
                          id            UUID PRIMARY KEY,
                          member_id     UUID NOT NULL REFERENCES users(id),
                          branch_id     UUID NOT NULL REFERENCES branches(id),
                          recorded_by   UUID NOT NULL REFERENCES users(id),
                          membership_id UUID REFERENCES memberships(id),
                          amount        NUMERIC NOT NULL,
                          type          VARCHAR NOT NULL CHECK (type IN ('MEMBERSHIP', 'PRODUCT')),
                          mode          VARCHAR NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE')),
                          created_at    TIMESTAMP
);