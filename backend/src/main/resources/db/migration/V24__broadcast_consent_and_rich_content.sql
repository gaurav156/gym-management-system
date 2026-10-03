-- Marketing consent. Existing users are set to TRUE (implied consent from their existing gym
-- relationship) so promotional broadcasts work immediately. To require everyone to opt in
-- instead, change the first line's DEFAULT TRUE to DEFAULT FALSE BEFORE this migration runs.
-- New accounts always get an explicit value from the app (registration checkbox, default off).
ALTER TABLE users ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN marketing_consent SET DEFAULT FALSE;
ALTER TABLE users ADD COLUMN marketing_consent_updated_at TIMESTAMP;

ALTER TABLE broadcasts ADD COLUMN type VARCHAR NOT NULL DEFAULT 'ANNOUNCEMENT'
    CHECK (type IN ('ANNOUNCEMENT', 'PROMOTIONAL'));
ALTER TABLE broadcasts ADD COLUMN content_format VARCHAR NOT NULL DEFAULT 'PLAIN'
    CHECK (content_format IN ('PLAIN', 'DESIGNER', 'HTML'));
ALTER TABLE broadcasts ADD COLUMN banner_key TEXT;
ALTER TABLE broadcasts ADD COLUMN cta_label VARCHAR;
ALTER TABLE broadcasts ADD COLUMN cta_url VARCHAR;
ALTER TABLE broadcasts ADD COLUMN accent_color VARCHAR;
ALTER TABLE broadcasts ADD COLUMN opted_out_count INTEGER NOT NULL DEFAULT 0;

-- Every stored file a broadcast references (banner, inline images in custom HTML, attachments).
-- OrphanImageCleanupJob treats these as referenced, so sent emails never lose their images.
CREATE TABLE broadcast_assets (
                                  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
                                  asset_key    TEXT NOT NULL
);
CREATE INDEX idx_broadcast_assets_broadcast ON broadcast_assets(broadcast_id);

CREATE TABLE broadcast_attachments (
                                       broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
                                       sort_order   INTEGER NOT NULL,
                                       asset_key    TEXT NOT NULL,
                                       filename     VARCHAR NOT NULL,
                                       PRIMARY KEY (broadcast_id, sort_order)
);