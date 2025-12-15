// Pareto distribution chart for Dissertations Explorer
// Shows school concentration with cumulative line - updates with year range

const ParetoChart = {
    svg: null,
    margin: { top: 20, right: 60, bottom: 60, left: 60 },

    init() {
        State.on('dataLoaded', () => this.render());
        State.on('yearRangeChange', () => this.render());
        window.addEventListener('resize', () => this.render());
    },

    calculateSchoolTotalsForRange() {
        const schoolTimeseries = State.data.schoolTimeseries;
        if (!schoolTimeseries) return null;

        const [minYear, maxYear] = State.yearRange;
        const schoolTotals = [];

        Object.keys(schoolTimeseries).forEach(school => {
            const yearData = schoolTimeseries[school];
            let total = 0;

            yearData.forEach(d => {
                if (d.year >= minYear && d.year <= maxYear) {
                    total += d.count;
                }
            });

            if (total > 0) {
                schoolTotals.push({ name: school, count: total });
            }
        });

        // Also include schools not in timeseries (smaller schools)
        // by filtering from schools.json based on year range
        const allSchools = State.data.schools?.schools || [];
        allSchools.forEach(school => {
            if (!schoolTimeseries[school.name]) {
                // Estimate based on year overlap
                if (school.min_year && school.max_year) {
                    const overlapStart = Math.max(school.min_year, minYear);
                    const overlapEnd = Math.min(school.max_year, maxYear);
                    if (overlapEnd >= overlapStart) {
                        const totalYears = school.max_year - school.min_year + 1;
                        const overlapYears = overlapEnd - overlapStart + 1;
                        const estimatedCount = Math.round(school.count * (overlapYears / totalYears));
                        if (estimatedCount > 0) {
                            schoolTotals.push({ name: school.name, count: estimatedCount });
                        }
                    }
                }
            }
        });

        return schoolTotals.sort((a, b) => b.count - a.count);
    },

    render() {
        const container = document.getElementById('pareto-chart');
        if (!container) return;

        // Calculate school totals for current year range
        let schools = this.calculateSchoolTotalsForRange();

        // Fallback to static data if timeseries not available
        if (!schools || schools.length === 0) {
            schools = State.data.schools?.schools;
        }

        if (!schools || schools.length === 0) return;

        // Calculate Pareto data
        const paretoData = DataTransforms.calculatePareto(schools);
        const displayData = paretoData.slice(0, 50); // Top 50 for visualization

        // Clear previous
        container.innerHTML = '';

        // Get dimensions
        const width = container.clientWidth;
        const height = 280;
        const innerWidth = width - this.margin.left - this.margin.right;
        const innerHeight = height - this.margin.top - this.margin.bottom;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Scales
        const x = d3.scaleBand()
            .domain(displayData.map((_, i) => i))
            .range([0, innerWidth])
            .padding(0.1);

        const yBar = d3.scaleLinear()
            .domain([0, d3.max(displayData, d => d.count)])
            .range([innerHeight, 0]);

        const yLine = d3.scaleLinear()
            .domain([0, 1])
            .range([innerHeight, 0]);

        // Draw bars
        g.selectAll('.pareto-bar')
            .data(displayData)
            .enter()
            .append('rect')
            .attr('class', 'pareto-bar')
            .attr('x', (d, i) => x(i))
            .attr('y', d => yBar(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => innerHeight - yBar(d.count))
            .attr('fill', (d, i) => {
                // Highlight top 10 and 25%
                if (i < 10) return CONFIG.COLORS.primary;
                if (i < paretoData.length * 0.25) return CONFIG.COLORS.secondary;
                return CONFIG.COLORS.muted;
            });

        // Draw cumulative line
        const line = d3.line()
            .x((d, i) => x(i) + x.bandwidth() / 2)
            .y(d => yLine(d.cumulativePercentage))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(displayData)
            .attr('class', 'pareto-line')
            .attr('fill', 'none')
            .attr('stroke', CONFIG.COLORS.tertiary)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Add dots on line
        g.selectAll('.pareto-dot')
            .data(displayData.filter((_, i) => i % 5 === 0 || i === displayData.length - 1))
            .enter()
            .append('circle')
            .attr('class', 'pareto-dot')
            .attr('cx', d => x(d.rank - 1) + x.bandwidth() / 2)
            .attr('cy', d => yLine(d.cumulativePercentage))
            .attr('r', 4)
            .attr('fill', CONFIG.COLORS.tertiary);

        // Reference lines for 80-20
        const rule80 = displayData.find(d => d.cumulativePercentage >= 0.8);
        if (rule80) {
            g.append('line')
                .attr('class', 'reference-line')
                .attr('x1', 0)
                .attr('x2', x(rule80.rank - 1) + x.bandwidth() / 2)
                .attr('y1', yLine(0.8))
                .attr('y2', yLine(0.8))
                .attr('stroke', CONFIG.COLORS.muted)
                .attr('stroke-dasharray', '4,4');

            g.append('line')
                .attr('class', 'reference-line')
                .attr('x1', x(rule80.rank - 1) + x.bandwidth() / 2)
                .attr('x2', x(rule80.rank - 1) + x.bandwidth() / 2)
                .attr('y1', yLine(0.8))
                .attr('y2', innerHeight)
                .attr('stroke', CONFIG.COLORS.muted)
                .attr('stroke-dasharray', '4,4');

            g.append('text')
                .attr('class', 'reference-label')
                .attr('x', 5)
                .attr('y', yLine(0.8) - 5)
                .attr('fill', CONFIG.COLORS.muted)
                .text(`80% (${rule80.rank} schools)`);
        }

        // X-axis
        g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x)
                .tickValues(displayData.filter((_, i) => i % 10 === 0).map((_, i) => i * 10))
                .tickFormat(i => `#${i + 1}`))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .attr('text-anchor', 'end');

        // Y-axis left (count)
        g.append('g')
            .attr('class', 'axis y-axis')
            .call(d3.axisLeft(yBar).ticks(5));

        // Y-axis right (percentage)
        g.append('g')
            .attr('class', 'axis y-axis-right')
            .attr('transform', `translate(${innerWidth}, 0)`)
            .call(d3.axisRight(yLine)
                .ticks(5)
                .tickFormat(d => Formatters.percent(d, 0)));

        // Axis labels
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -45)
            .attr('x', -innerHeight / 2)
            .attr('text-anchor', 'middle')
            .text('Dissertations');

        g.append('text')
            .attr('class', 'axis-label')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 45)
            .attr('text-anchor', 'middle')
            .text('School Rank');

        // Year range indicator
        const [minYear, maxYear] = State.yearRange;
        g.append('text')
            .attr('class', 'axis-label')
            .attr('x', innerWidth)
            .attr('y', -5)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', CONFIG.COLORS.muted)
            .text(`${minYear}–${maxYear}`);

        // Tooltip
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);

        g.selectAll('.pareto-bar')
            .on('mouseover', (event, d) => {
                d3.select(event.target)
                    .attr('opacity', 0.8);

                tooltip
                    .style('opacity', 1)
                    .style('left', `${event.offsetX + 10}px`)
                    .style('top', `${event.offsetY - 10}px`)
                    .html(`
                        <strong>#${d.rank}: ${d.name}</strong><br>
                        ${Formatters.number(d.count)} dissertations<br>
                        ${Formatters.percent(d.percentage)} of total<br>
                        Cumulative: ${Formatters.percent(d.cumulativePercentage)}
                    `);
            })
            .on('mouseout', (event) => {
                d3.select(event.target)
                    .attr('opacity', 1);
                tooltip.style('opacity', 0);
            });
    }
};
