-- Migration: Explorer aggregation functions
-- Date: 2025-01-15
-- Description: Add PostgreSQL functions for dissertation explorer visualizations

-- Get dissertation counts by year
CREATE OR REPLACE FUNCTION get_dissertations_by_year()
RETURNS TABLE(year INTEGER, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.year, COUNT(*) as count
    FROM dissertations d
    WHERE d.is_deleted = FALSE AND d.year IS NOT NULL
    GROUP BY d.year
    ORDER BY d.year;
END;
$$ LANGUAGE plpgsql;

-- Get dissertation counts by school with year range
CREATE OR REPLACE FUNCTION get_dissertations_by_school()
RETURNS TABLE(school VARCHAR, count BIGINT, min_year INTEGER, max_year INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT d.school, COUNT(*) as count, MIN(d.year), MAX(d.year)
    FROM dissertations d
    WHERE d.is_deleted = FALSE AND d.school IS NOT NULL AND d.school != ''
    GROUP BY d.school
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get time series for specific schools (for comparison chart)
CREATE OR REPLACE FUNCTION get_school_timeseries(school_names VARCHAR[])
RETURNS TABLE(school VARCHAR, year INTEGER, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.school, d.year, COUNT(*) as count
    FROM dissertations d
    WHERE d.is_deleted = FALSE
      AND d.year IS NOT NULL
      AND d.school = ANY(school_names)
    GROUP BY d.school, d.year
    ORDER BY d.school, d.year;
END;
$$ LANGUAGE plpgsql;

-- Get subject distribution
CREATE OR REPLACE FUNCTION get_dissertations_by_subject()
RETURNS TABLE(subject_broad VARCHAR, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.subject_broad, COUNT(*) as count
    FROM dissertations d
    WHERE d.is_deleted = FALSE AND d.subject_broad IS NOT NULL AND d.subject_broad != ''
    GROUP BY d.subject_broad
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get department distribution
CREATE OR REPLACE FUNCTION get_dissertations_by_department()
RETURNS TABLE(department_broad VARCHAR, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.department_broad, COUNT(*) as count
    FROM dissertations d
    WHERE d.is_deleted = FALSE AND d.department_broad IS NOT NULL AND d.department_broad != ''
    GROUP BY d.department_broad
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get overall statistics
CREATE OR REPLACE FUNCTION get_dissertation_stats()
RETURNS TABLE(
    total_count BIGINT,
    total_schools BIGINT,
    min_year INTEGER,
    max_year INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT school) as total_schools,
        MIN(year) as min_year,
        MAX(year) as max_year
    FROM dissertations
    WHERE is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;
