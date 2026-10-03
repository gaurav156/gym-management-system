-- Owner-initiated bulk messages. broadcast_recipients is a SNAPSHOT of who the message was
-- addressed to at send time (name/destination copied), so history stays accurate even if the
-- user is later edited or deleted. created_by / user_id use SET NULL, not cascade, so a
-- deleted account never erases the broadcast record.
CREATE TABLE broadcasts (
                            id               UUID PRIMARY KEY,
                            created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
                            created_by_name  VARCHAR NOT NULL,
                            channel          VARCHAR NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'WHATSAPP')),
                            audience         VARCHAR NOT NULL CHECK (audience IN ('ALL_USERS', 'ALL_MEMBERS', 'ACTIVE_MEMBERS',
                                                                                  'INACTIVE_MEMBERS', 'ALL_STAFF', 'ALL_TRAINERS',
                                                                                  'ALL_MANAGERS', 'ALL_OWNERS')),
                            subject          VARCHAR,
                            body             TEXT NOT NULL,
                            status           VARCHAR NOT NULL CHECK (status IN ('SENDING', 'COMPLETED', 'FAILED')),
                            total_recipients INTEGER NOT NULL DEFAULT 0,
                            sent_count       INTEGER NOT NULL DEFAULT 0,
                            failed_count     INTEGER NOT NULL DEFAULT 0,
                            skipped_count    INTEGER NOT NULL DEFAULT 0,
                            created_at       TIMESTAMP NOT NULL DEFAULT now(),
                            completed_at     TIMESTAMP
);
CREATE INDEX idx_broadcasts_created_at ON broadcasts(created_at);

CREATE TABLE broadcast_recipients (
                                      id             UUID PRIMARY KEY,
                                      broadcast_id   UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
                                      user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
                                      recipient_name VARCHAR NOT NULL,
                                      destination    VARCHAR NOT NULL,
                                      status         VARCHAR NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
                                      error_message  TEXT,
                                      sent_at        TIMESTAMP
);
CREATE INDEX idx_broadcast_recipients_broadcast_status ON broadcast_recipients(broadcast_id, status);