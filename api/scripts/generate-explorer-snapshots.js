#!/usr/bin/env node
/**
 * Generate explorer data snapshots
 *
 * Usage: node scripts/generate-explorer-snapshots.js
 *
 * This script queries the Supabase database and generates JSON snapshot files
 * for the explorer visualization app.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const EXPLORER_DATA_PATH = path.join(__dirname, '../../explorer/data');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function main() {
    console.log('Generating explorer data snapshots...\n');

    try {
        // Ensure data directory exists
        await fs.mkdir(EXPLORER_DATA_PATH, { recursive: true });

        // Fetch all non-deleted dissertations using pagination
        console.log('Fetching dissertations from database...');
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
            console.log(`  Fetched ${data.length} records (total: ${allDissertations.length})`);

            if (data.length < pageSize) break;
            from += pageSize;
        }

        const dissertations = allDissertations;
        console.log(`Found ${dissertations.length} dissertations total\n`);

        // Generate timeline data
        console.log('Generating timeline data...');
        const timeline = generateTimelineData(dissertations);
        await fs.writeFile(
            path.join(EXPLORER_DATA_PATH, 'timeline.json'),
            JSON.stringify(timeline, null, 2)
        );
        console.log('  - timeline.json created');

        // Generate schools data
        console.log('Generating schools data...');
        const schools = generateSchoolsData(dissertations);
        await fs.writeFile(
            path.join(EXPLORER_DATA_PATH, 'schools.json'),
            JSON.stringify(schools, null, 2)
        );
        console.log('  - schools.json created');

        // Generate statistics
        console.log('Generating statistics...');
        const statistics = generateStatistics(dissertations, schools);
        await fs.writeFile(
            path.join(EXPLORER_DATA_PATH, 'statistics.json'),
            JSON.stringify(statistics, null, 2)
        );
        console.log('  - statistics.json created');

        // Generate school timeseries for racing bar chart and map (top 50)
        console.log('Generating school timeseries for charts...');
        const schoolTimeseries = generateSchoolTimeseries(dissertations, schools.schools.slice(0, 50));
        await fs.writeFile(
            path.join(EXPLORER_DATA_PATH, 'school_timeseries.json'),
            JSON.stringify(schoolTimeseries, null, 2)
        );
        console.log('  - school_timeseries.json created');

        // Generate meta
        const meta = {
            generated_at: new Date().toISOString(),
            record_count: dissertations.length,
            year_range: [statistics.year_range[0], statistics.year_range[1]],
            school_count: schools.schools.length
        };
        await fs.writeFile(
            path.join(EXPLORER_DATA_PATH, 'meta.json'),
            JSON.stringify(meta, null, 2)
        );
        console.log('  - meta.json created');

        console.log('\nSnapshot generation complete!');
        console.log(`Files written to: ${EXPLORER_DATA_PATH}`);
    } catch (error) {
        console.error('Error generating snapshots:', error);
        process.exit(1);
    }
}

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

main();
