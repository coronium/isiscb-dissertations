-- Migration: 002_relax_constraints
-- Applied: 2024-12-14
-- Purpose: Remove NOT NULL constraints to allow legacy data import
--
-- These constraints were removed because the source CSV data had many records
-- with missing values in these fields. Validation is now enforced at the API
-- level for new records instead of at the database level.

ALTER TABLE dissertations ALTER COLUMN subject_broad DROP NOT NULL;
ALTER TABLE dissertations ALTER COLUMN root_dissertation DROP NOT NULL;
ALTER TABLE dissertations ALTER COLUMN source_notes DROP NOT NULL;
ALTER TABLE dissertations ALTER COLUMN title DROP NOT NULL;
-- author_name was already nullable in the deployed schema
