-- Optional Google Maps link for a branch, used by the landing page map/directions.
-- Null = landing page falls back to searching by gym name + branch name + address.
ALTER TABLE branches ADD COLUMN map_url TEXT;