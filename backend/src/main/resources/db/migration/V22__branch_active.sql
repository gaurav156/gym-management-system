-- Lets the Owner retire a branch without deleting it. Branches with recorded purchases,
-- expenses or attendance can never be hard-deleted (see BranchService.delete), only deactivated.
ALTER TABLE branches ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;