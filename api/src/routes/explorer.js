const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/db');
const { authenticateToken, requireEditor } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Path to explorer data directory
const EXPLORER_DATA_PATH = path.join(__dirname, '../../../explorer/data');

// GET /api/explorer/snapshot/meta - Get snapshot metadata
router.get('/snapshot/meta', authenticateToken, async (req, res) => {
    try {
        const metaPath = path.join(EXPLORER_DATA_PATH, 'meta.json');
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        res.json(meta);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Snapshot not found. Please generate snapshots first.' });
        } else {
            console.error('Error reading snapshot meta:', error);
            res.status(500).json({ error: 'Failed to read snapshot metadata' });
        }
    }
});

// POST /api/explorer/refresh-snapshot - Regenerate all snapshots
router.post('/refresh-snapshot', authenticateToken, requireEditor, async (req, res) => {
    try {
        // Ensure data directory exists
        await fs.mkdir(EXPLORER_DATA_PATH, { recursive: true });

        // Get all non-deleted dissertations using pagination
        let allDissertations = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('dissertations')
                .select('year, school, subject_broad, department_broad')
                .eq('is_deleted', false)
                .range(from, from + pageSize - 1);

            if (error) throw error;
            allDissertations = allDissertations.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        const dissertations = allDissertations;

        // Generate timeline data
        const timeline = generateTimelineData(dissertations);

        // Generate schools data
        const schools = generateSchoolsData(dissertations);

        // Generate statistics
        const statistics = generateStatistics(dissertations, schools);

        // Generate school timeseries for racing bar chart and map (top 50 schools)
        const schoolTimeseries = generateSchoolTimeseries(dissertations, schools.schools.slice(0, 50));

        // Generate meta
        const meta = {
            generated_at: new Date().toISOString(),
            record_count: dissertations.length,
            year_range: [statistics.year_range[0], statistics.year_range[1]],
            school_count: schools.schools.length
        };

        // Write all files
        await Promise.all([
            fs.writeFile(
                path.join(EXPLORER_DATA_PATH, 'timeline.json'),
                JSON.stringify(timeline, null, 2)
            ),
            fs.writeFile(
                path.join(EXPLORER_DATA_PATH, 'schools.json'),
                JSON.stringify(schools, null, 2)
            ),
            fs.writeFile(
                path.join(EXPLORER_DATA_PATH, 'statistics.json'),
                JSON.stringify(statistics, null, 2)
            ),
            fs.writeFile(
                path.join(EXPLORER_DATA_PATH, 'meta.json'),
                JSON.stringify(meta, null, 2)
            ),
            fs.writeFile(
                path.join(EXPLORER_DATA_PATH, 'school_timeseries.json'),
                JSON.stringify(schoolTimeseries, null, 2)
            )
        ]);

        res.json({
            success: true,
            ...meta
        });
    } catch (error) {
        console.error('Error refreshing snapshots:', error);
        res.status(500).json({ error: 'Failed to refresh snapshots: ' + error.message });
    }
});

// GET /api/explorer/schools/compare - Get time series for selected schools
router.get('/schools/compare', authenticateToken, async (req, res) => {
    try {
        const { schools } = req.query;
        if (!schools) {
            return res.status(400).json({ error: 'Schools parameter required' });
        }

        const schoolList = schools.split(',').slice(0, 5); // Max 5 schools

        const { data, error } = await supabase.rpc('get_school_timeseries', {
            school_names: schoolList
        });

        if (error) throw error;

        // Group by school
        const result = {};
        schoolList.forEach(s => {
            result[s] = [];
        });

        data.forEach(row => {
            if (result[row.school]) {
                result[row.school].push({
                    year: row.year,
                    count: parseInt(row.count)
                });
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error getting school comparison:', error);
        res.status(500).json({ error: 'Failed to get school comparison data' });
    }
});

// Helper functions for generating snapshot data

function generateTimelineData(dissertations) {
    // Count by year
    const yearCounts = {};
    dissertations.forEach(d => {
        if (d.year) {
            yearCounts[d.year] = (yearCounts[d.year] || 0) + 1;
        }
    });

    // Fill in missing years
    const years = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const minYear = years[0] || 1878;
    const maxYear = years[years.length - 1] || 2025;

    const byYear = [];
    for (let year = minYear; year <= maxYear; year++) {
        byYear.push({ year, count: yearCounts[year] || 0 });
    }

    // Aggregate by 5-year periods
    const by5year = aggregateByInterval(byYear, 5);

    // Aggregate by decade
    const byDecade = aggregateByInterval(byYear, 10);

    return { by_year: byYear, by_5year: by5year, by_decade: byDecade };
}

function aggregateByInterval(yearData, interval) {
    const groups = {};

    yearData.forEach(item => {
        const start = Math.floor(item.year / interval) * interval;
        if (!groups[start]) {
            groups[start] = { start, count: 0 };
        }
        groups[start].count += item.count;
    });

    return Object.values(groups)
        .sort((a, b) => a.start - b.start)
        .map(g => ({
            period: interval === 10 ? `${g.start}s` : `${g.start}-${g.start + interval - 1}`,
            start: g.start,
            count: g.count
        }));
}

function generateSchoolsData(dissertations) {
    // Count by school with year range
    const schoolData = {};

    dissertations.forEach(d => {
        if (d.school) {
            if (!schoolData[d.school]) {
                schoolData[d.school] = { count: 0, minYear: Infinity, maxYear: -Infinity };
            }
            schoolData[d.school].count++;
            if (d.year) {
                schoolData[d.school].minYear = Math.min(schoolData[d.school].minYear, d.year);
                schoolData[d.school].maxYear = Math.max(schoolData[d.school].maxYear, d.year);
            }
        }
    });

    // Convert to array and sort
    const schools = Object.entries(schoolData)
        .map(([name, data]) => ({
            name,
            count: data.count,
            min_year: data.minYear === Infinity ? null : data.minYear,
            max_year: data.maxYear === -Infinity ? null : data.maxYear
        }))
        .sort((a, b) => b.count - a.count);

    // Calculate Pareto statistics
    const total = schools.reduce((sum, s) => sum + s.count, 0);
    const counts = schools.map(s => s.count);

    // Gini coefficient
    const gini = calculateGini(counts);

    // Top N shares
    const top10Count = schools.slice(0, 10).reduce((sum, s) => sum + s.count, 0);
    const top25Idx = Math.ceil(schools.length * 0.25);
    const top25Count = schools.slice(0, top25Idx).reduce((sum, s) => sum + s.count, 0);

    return {
        schools,
        pareto: {
            top_10_count: top10Count,
            top_10_percent: top10Count / total,
            top_25_percent_count: top25Count,
            top_25_percent: top25Count / total,
            gini
        }
    };
}

function generateStatistics(dissertations, schoolsData) {
    const years = dissertations.filter(d => d.year).map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // Count per year
    const yearCounts = {};
    years.forEach(year => {
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    const countValues = Object.values(yearCounts);

    // Mean and median per year
    const mean = countValues.reduce((a, b) => a + b, 0) / countValues.length;
    const sorted = [...countValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    // HHI
    const schoolCounts = schoolsData.schools.map(s => s.count);
    const total = schoolCounts.reduce((a, b) => a + b, 0);
    const hhi = schoolCounts.reduce((sum, c) => sum + Math.pow(c / total, 2), 0);

    // Growth rates by decade
    const decadeData = aggregateByInterval(
        Object.entries(yearCounts).map(([year, count]) => ({ year: parseInt(year), count })),
        10
    );
    const growthRates = {};
    for (let i = 1; i < decadeData.length; i++) {
        const prev = decadeData[i - 1];
        const curr = decadeData[i];
        if (prev.count > 0) {
            const key = `${prev.start}s_to_${curr.start}s`;
            growthRates[key] = (curr.count - prev.count) / prev.count;
        }
    }

    // Top shares
    const top10Count = schoolsData.schools.slice(0, 10).reduce((sum, s) => sum + s.count, 0);
    const top25Idx = Math.ceil(schoolsData.schools.length * 0.25);
    const top25Count = schoolsData.schools.slice(0, top25Idx).reduce((sum, s) => sum + s.count, 0);

    return {
        total_dissertations: dissertations.length,
        total_schools: schoolsData.schools.length,
        year_range: [minYear, maxYear],
        mean_per_year: mean,
        median_per_year: median,
        growth_rates: growthRates,
        hhi,
        gini: schoolsData.pareto.gini,
        top_10_share: top10Count / total,
        top_25_share: top25Count / total
    };
}

function generateSchoolTimeseries(dissertations, topSchools) {
    // Get list of top school names
    const topSchoolNames = topSchools.map(s => s.name);

    // Build year-by-year counts for each school
    const timeseries = {};

    topSchoolNames.forEach(schoolName => {
        timeseries[schoolName] = [];

        // Count dissertations by year for this school
        const yearCounts = {};
        dissertations.forEach(d => {
            if (d.school === schoolName && d.year) {
                yearCounts[d.year] = (yearCounts[d.year] || 0) + 1;
            }
        });

        // Convert to array
        Object.keys(yearCounts)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach(year => {
                timeseries[schoolName].push({
                    year,
                    count: yearCounts[year]
                });
            });
    });

    return timeseries;
}

function calculateGini(values) {
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((sum, v) => sum + v, 0);

    if (total === 0) return 0;

    let sumOfProducts = 0;
    for (let i = 0; i < n; i++) {
        sumOfProducts += (i + 1) * sorted[i];
    }

    return (2 * sumOfProducts) / (n * total) - (n + 1) / n;
}

module.exports = router;
