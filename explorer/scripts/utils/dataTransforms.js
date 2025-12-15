// Data transformation utilities for Dissertations Explorer

const DataTransforms = {
    // Aggregate timeline data by granularity
    aggregateByGranularity(data, granularity) {
        if (!data) return [];

        switch (granularity) {
            case 'year':
                return data;
            case '5year':
                return this.groupByInterval(data, 5);
            case 'decade':
                return this.groupByInterval(data, 10);
            default:
                return data;
        }
    },

    // Group year data into intervals
    groupByInterval(data, interval) {
        const groups = {};

        data.forEach(item => {
            const start = Math.floor(item.year / interval) * interval;
            if (!groups[start]) {
                groups[start] = { start, count: 0 };
            }
            groups[start].count += item.count;
        });

        return Object.values(groups).sort((a, b) => a.start - b.start);
    },

    // Filter data by year range
    filterByYearRange(data, minYear, maxYear) {
        return data.filter(d => {
            const year = d.year || d.start;
            return year >= minYear && year <= maxYear;
        });
    },

    // Calculate cumulative percentages for Pareto chart
    calculatePareto(schools) {
        if (!schools || schools.length === 0) return [];

        // Sort by count descending
        const sorted = [...schools].sort((a, b) => b.count - a.count);
        const total = sorted.reduce((sum, s) => sum + s.count, 0);

        let cumulative = 0;
        return sorted.map((school, index) => {
            cumulative += school.count;
            return {
                ...school,
                rank: index + 1,
                percentage: school.count / total,
                cumulativePercentage: cumulative / total,
                schoolPercentile: (index + 1) / sorted.length
            };
        });
    },

    // Get top N schools
    getTopSchools(schools, n) {
        if (!schools) return [];
        return [...schools]
            .sort((a, b) => b.count - a.count)
            .slice(0, n);
    },

    // Calculate top N vs rest comparison
    calculateTopNComparison(schools, mode) {
        if (!schools || schools.length === 0) return null;

        const sorted = [...schools].sort((a, b) => b.count - a.count);
        const total = sorted.reduce((sum, s) => sum + s.count, 0);

        // Mode is now a fixed number (10, 25, 50, 100)
        let topN = parseInt(mode, 10);
        if (isNaN(topN) || topN < 1) topN = 10;

        // Cap at total schools available
        topN = Math.min(topN, sorted.length);
        const label = `Top ${topN}`;

        const topSchools = sorted.slice(0, topN);
        const restSchools = sorted.slice(topN);

        const topCount = topSchools.reduce((sum, s) => sum + s.count, 0);
        const restCount = restSchools.reduce((sum, s) => sum + s.count, 0);

        return {
            mode,
            label,
            topN,
            totalSchools: sorted.length,
            top: {
                count: topCount,
                percentage: topCount / total,
                schools: topN
            },
            rest: {
                count: restCount,
                percentage: restCount / total,
                schools: sorted.length - topN
            }
        };
    },

    // Calculate Gini coefficient
    calculateGini(values) {
        if (!values || values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const total = sorted.reduce((sum, v) => sum + v, 0);

        if (total === 0) return 0;

        let sumOfProducts = 0;
        for (let i = 0; i < n; i++) {
            sumOfProducts += (i + 1) * sorted[i];
        }

        const gini = (2 * sumOfProducts) / (n * total) - (n + 1) / n;
        return gini;
    },

    // Calculate HHI (Herfindahl-Hirschman Index)
    calculateHHI(values) {
        if (!values || values.length === 0) return 0;

        const total = values.reduce((sum, v) => sum + v, 0);
        if (total === 0) return 0;

        const shares = values.map(v => v / total);
        return shares.reduce((sum, s) => sum + s * s, 0);
    },

    // Calculate growth rates between periods
    calculateGrowthRates(data, periods) {
        const rates = {};

        for (let i = 1; i < periods.length; i++) {
            const prevPeriod = periods[i - 1];
            const currPeriod = periods[i];

            const prevData = data.find(d => d.start === prevPeriod || d.period === `${prevPeriod}s`);
            const currData = data.find(d => d.start === currPeriod || d.period === `${currPeriod}s`);

            if (prevData && currData && prevData.count > 0) {
                const rate = (currData.count - prevData.count) / prevData.count;
                rates[`${prevPeriod}s_to_${currPeriod}s`] = rate;
            }
        }

        return rates;
    },

    // Calculate mean and median
    calculateStats(values) {
        if (!values || values.length === 0) {
            return { mean: 0, median: 0 };
        }

        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((s, v) => s + v, 0);
        const mean = sum / sorted.length;

        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

        return { mean, median };
    }
};
