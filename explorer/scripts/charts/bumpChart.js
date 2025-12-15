// Bump Chart - School Rankings Over Time
// Shows how top 15 schools' ranks change over time

const BumpChart = {
    topN: 15,
    windowSize: 10,
    startYear: 1950,
    endYear: 2020,
    yearStep: 5, // Show every 5 years for clarity

    init() {
        State.on('dataLoaded', () => this.render());
    },

    calculateRankingsOverTime() {
        if (!State.data.schoolTimeseries) return null;

        const schoolData = State.data.schoolTimeseries;
        const allSchools = Object.keys(schoolData);

        // Create year maps for each school
        const schoolYearMaps = {};
        allSchools.forEach(school => {
            schoolYearMaps[school] = {};
            schoolData[school].forEach(d => {
                schoolYearMaps[school][d.year] = d.count;
            });
        });

        // Track which schools ever appear in top N
        const topSchoolsEver = new Set();
        const yearlyRankings = [];

        // Calculate rankings for each year
        for (let year = this.startYear; year <= this.endYear; year += this.yearStep) {
            const schoolTotals = [];

            allSchools.forEach(school => {
                let total = 0;
                for (let y = year - this.windowSize + 1; y <= year; y++) {
                    total += schoolYearMaps[school][y] || 0;
                }
                schoolTotals.push({ school, total });
            });

            // Sort and rank
            schoolTotals.sort((a, b) => b.total - a.total);

            const rankings = {};
            schoolTotals.slice(0, this.topN).forEach((s, i) => {
                rankings[s.school] = i + 1;
                topSchoolsEver.add(s.school);
            });

            yearlyRankings.push({ year, rankings, totals: schoolTotals.slice(0, this.topN) });
        }

        // Build series data for each school that appears in top N
        const series = [];
        topSchoolsEver.forEach(school => {
            const points = yearlyRankings.map(yr => ({
                year: yr.year,
                rank: yr.rankings[school] || null,
                total: yr.totals.find(t => t.school === school)?.total || 0
            })).filter(p => p.rank !== null);

            if (points.length > 0) {
                series.push({ school, points });
            }
        });

        // Sort series by most recent rank (or best rank if not ranked recently)
        const lastYear = yearlyRankings[yearlyRankings.length - 1];
        series.sort((a, b) => {
            const aRank = lastYear.rankings[a.school] || 100;
            const bRank = lastYear.rankings[b.school] || 100;
            return aRank - bRank;
        });

        return { series: series.slice(0, this.topN), years: yearlyRankings.map(y => y.year) };
    },

    getSchoolColor(school) {
        return CONFIG.SCHOOL_COLORS[school] || CONFIG.FALLBACK_SCHOOL_COLORS[0];
    },

    render() {
        const container = document.getElementById('bump-chart');
        if (!container || !State.data.schoolTimeseries) return;

        const data = this.calculateRankingsOverTime();
        if (!data || data.series.length === 0) return;

        // Clear existing
        container.innerHTML = '';

        const margin = { top: 30, right: 180, bottom: 40, left: 50 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        if (width <= 0) return;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scalePoint()
            .domain(data.years)
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([1, this.topN])
            .range([0, height]);

        // Line generator
        const line = d3.line()
            .defined(d => d.rank !== null)
            .x(d => x(d.year))
            .y(d => y(d.rank))
            .curve(d3.curveMonotoneX);

        // Draw grid lines for ranks
        for (let rank = 1; rank <= this.topN; rank++) {
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', y(rank))
                .attr('y2', y(rank))
                .attr('stroke', rank === 1 ? '#fbbf24' : '#e2e8f0')
                .attr('stroke-width', rank === 1 ? 2 : 1)
                .attr('stroke-dasharray', rank === 1 ? 'none' : '2,2');

            // Rank labels on left
            svg.append('text')
                .attr('x', -10)
                .attr('y', y(rank))
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('font-size', '10px')
                .attr('fill', '#94a3b8')
                .text(rank);
        }

        // Draw lines for each school
        data.series.forEach((schoolData, idx) => {
            const color = this.getSchoolColor(schoolData.school);

            // Draw path
            svg.append('path')
                .datum(schoolData.points)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 2.5)
                .attr('stroke-opacity', 0.8)
                .attr('d', line);

            // Draw circles at each point
            svg.selectAll(`.dot-${idx}`)
                .data(schoolData.points)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.rank))
                .attr('r', 4)
                .attr('fill', color)
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5);

            // Label at end (right side)
            const lastPoint = schoolData.points[schoolData.points.length - 1];
            if (lastPoint && lastPoint.year === this.endYear) {
                svg.append('text')
                    .attr('x', width + 8)
                    .attr('y', y(lastPoint.rank))
                    .attr('dy', '0.35em')
                    .attr('font-size', '11px')
                    .attr('font-weight', '500')
                    .attr('fill', color)
                    .text(this.truncateName(schoolData.school));
            }
        });

        // X axis
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height + 10})`)
            .call(d3.axisBottom(x).tickFormat(d3.format('d')));

        // Title for Y axis
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -40)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#64748b')
            .text('Rank (by 10-year rolling output)');

        // Add tooltip
        this.addTooltip(container, svg, data, x, y);
    },

    truncateName(name) {
        return name
            .replace('University of ', 'U. ')
            .replace('University', 'U.')
            .replace(', Madison', '')
            .replace(', Berkeley', '')
            .replace(', Los Angeles', '')
            .replace(', Urbana-Champaign', '');
    },

    addTooltip(container, svg, data, x, y) {
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);

        // Add hover areas for each point
        data.series.forEach((schoolData) => {
            const color = this.getSchoolColor(schoolData.school);

            svg.selectAll(`.hover-${schoolData.school.replace(/\s/g, '-')}`)
                .data(schoolData.points)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.rank))
                .attr('r', 12)
                .attr('fill', 'transparent')
                .attr('cursor', 'pointer')
                .on('mouseover', (event, d) => {
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${event.offsetX + 10}px`)
                        .style('top', `${event.offsetY - 10}px`)
                        .html(`
                            <strong style="color: ${color}">${schoolData.school}</strong><br>
                            Year: ${d.year}<br>
                            Rank: <strong>#${d.rank}</strong><br>
                            10yr total: ${d.total}
                        `);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });
        });
    }
};
