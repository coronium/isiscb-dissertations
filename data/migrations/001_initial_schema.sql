-- IsisCB Dissertations Database Schema
-- Migration: 001_initial_schema
-- Run this in Supabase SQL Editor
--
-- NOTE: This schema was deployed on 2024-12-14.
-- Several NOT NULL constraints were subsequently removed to allow legacy data import.
-- See 002_relax_constraints.sql for the ALTER statements.

-- ============================================
-- Enable extensions FIRST (before tables)
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Table: dissertations
-- ============================================
-- NOTE: Most fields are nullable to allow importing legacy data.
-- Validation is enforced at the API level for new records.
CREATE TABLE dissertations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(20) UNIQUE NOT NULL,  -- COMB_XXXXXX format
    original_cb_id VARCHAR(20),              -- CBB... if from IsisCB
    original_vieth_id VARCHAR(50),

    -- Author
    author_name VARCHAR(255),                -- Nullable for legacy import
    author_id VARCHAR(20),                   -- CBA, AX-, or NULL for [unknown]
    author_years VARCHAR(50),                -- e.g., "1917-1995"

    -- Dissertation
    title TEXT,                              -- Nullable for legacy import
    year INTEGER,
    date_free_text VARCHAR(100),              -- For uncertain dates, e.g., "1953 or 54", "ca. 1960"
    degree_type VARCHAR(50) DEFAULT 'PhD',    -- PhD, MD, MLIS, BPhil, ScD, etc.

    -- Institution
    school VARCHAR(255),
    school_id VARCHAR(20),
    department_free_text VARCHAR(255),
    department_broad VARCHAR(100),

    -- Classification
    subject_broad VARCHAR(100),              -- Nullable for legacy import
    root_dissertation VARCHAR(10),           -- Nullable for legacy import; 'Yes', 'No'
    category TEXT,                           -- From IsisCB only, read-only
    category_id VARCHAR(20),

    -- Advisors (JSONB array for flexibility)
    advisors JSONB DEFAULT '[]',
    -- Format: [{"name": "...", "id": "...", "role": "Advisor|Committee Member"}, ...]

    -- Metadata
    source_notes TEXT,                       -- Nullable for legacy import
    description TEXT,
    language_code VARCHAR(10),
    pages VARCHAR(50),
    dataset VARCHAR(100),

    -- Vieth-specific metadata
    vieth_url TEXT,
    vieth_abstract TEXT,
    vieth_place VARCHAR(255),
    vieth_extra TEXT,
    vieth_metadata TEXT,

    -- Record management
    merged_from_ids TEXT,
    change_log JSONB DEFAULT '[]',

    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(50),
    deleted_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(50)
);

-- Indexes for dissertations
CREATE INDEX idx_dissertations_author ON dissertations(author_name);
CREATE INDEX idx_dissertations_author_id ON dissertations(author_id);
CREATE INDEX idx_dissertations_year ON dissertations(year);
CREATE INDEX idx_dissertations_school ON dissertations(school);
CREATE INDEX idx_dissertations_school_id ON dissertations(school_id);
CREATE INDEX idx_dissertations_subject ON dissertations(subject_broad);
CREATE INDEX idx_dissertations_root ON dissertations(root_dissertation);
CREATE INDEX idx_dissertations_deleted ON dissertations(is_deleted);
CREATE INDEX idx_dissertations_advisors ON dissertations USING GIN(advisors);
CREATE INDEX idx_dissertations_record_id ON dissertations(record_id);

-- ============================================
-- Table: authorities_persons
-- ============================================
CREATE TABLE authorities_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id VARCHAR(20) UNIQUE NOT NULL,  -- CBA..., AX-1000, SPW-1001, etc.
    name VARCHAR(255) NOT NULL,
    birth_year INTEGER,
    death_year INTEGER,
    source VARCHAR(50),  -- 'isiscb', 'manual'
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50)
);

-- Indexes for authorities_persons
CREATE INDEX idx_persons_name ON authorities_persons(name);
CREATE INDEX idx_persons_authority ON authorities_persons(authority_id);
CREATE INDEX idx_persons_name_trgm ON authorities_persons USING GIN(name gin_trgm_ops);

-- ============================================
-- Table: authorities_institutions
-- ============================================
CREATE TABLE authorities_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id VARCHAR(20) UNIQUE NOT NULL,  -- CBA..., AX-INST-1000, etc.
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50),  -- 'isiscb', 'manual'
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50)
);

-- Indexes for authorities_institutions
CREATE INDEX idx_institutions_name ON authorities_institutions(name);
CREATE INDEX idx_institutions_authority ON authorities_institutions(authority_id);
CREATE INDEX idx_institutions_name_trgm ON authorities_institutions USING GIN(name gin_trgm_ops);

-- ============================================
-- Table: audit_log
-- ============================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- 'create', 'update', 'delete'
    editor VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    changes JSONB,  -- {field: {old: "...", new: "..."}, ...}
    reason TEXT     -- For deletions
);

-- Indexes for audit_log
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_editor ON audit_log(editor);

-- ============================================
-- Table: authority_sequences
-- ============================================
CREATE TABLE authority_sequences (
    prefix VARCHAR(20) PRIMARY KEY,  -- 'AX', 'SPW', 'Vieth', 'AX-INST', 'SPW-INST', 'Vieth-INST'
    next_value INTEGER DEFAULT 1000
);

-- Initialize sequences (starting at 1000 to avoid conflicts with existing AX- IDs)
INSERT INTO authority_sequences (prefix, next_value) VALUES
    ('AX', 1000), ('SPW', 1000), ('Vieth', 1000),
    ('AX-INST', 1000), ('SPW-INST', 1000), ('Vieth-INST', 1000);

-- ============================================
-- Function: Get next authority ID
-- ============================================
CREATE OR REPLACE FUNCTION get_next_authority_id(p_prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_next INTEGER;
    v_id VARCHAR;
BEGIN
    -- Lock the row and increment
    UPDATE authority_sequences
    SET next_value = next_value + 1
    WHERE prefix = p_prefix
    RETURNING next_value - 1 INTO v_next;

    -- Build the ID
    IF p_prefix LIKE '%-INST' THEN
        v_id := REPLACE(p_prefix, '-INST', '') || '-INST-' || v_next::VARCHAR;
    ELSE
        v_id := p_prefix || '-' || v_next::VARCHAR;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Generate next COMB ID for dissertations
-- ============================================
CREATE OR REPLACE FUNCTION generate_comb_id()
RETURNS VARCHAR AS $$
DECLARE
    v_max INTEGER;
    v_next INTEGER;
BEGIN
    -- Get max existing COMB number
    SELECT COALESCE(MAX(CAST(SUBSTRING(record_id FROM 6) AS INTEGER)), 0)
    INTO v_max
    FROM dissertations
    WHERE record_id LIKE 'COMB_%';

    v_next := v_max + 1;

    RETURN 'COMB_' || LPAD(v_next::VARCHAR, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dissertations_updated_at
    BEFORE UPDATE ON dissertations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
