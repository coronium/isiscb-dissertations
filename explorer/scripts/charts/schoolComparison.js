// School comparison chart for Dissertations Explorer
// Shows overlapping time series for selected schools with absolute/percentage toggle

const SchoolComparisonChart = {
    svg: null,
    margin: { top: 20, right: 120, bottom: 40, left: 60 },
    displayMode: 'absolute', // 'absolute' or 'percentage'

    init() {
        State.on('dataLoaded', () => this.render());
        State.on('schoolsChange', () => this.render());
        State.on('granularityChange', () => this.render());
        State.on('yearRangeChange', () => this.render());

        window.addEventListener('resize', () => this.render());
    },

    createToggle(container) {
        // Check if toggle already exists
        let toggleContainer = container.parentElement.querySelector('.comparison-toggle');
        if (!toggleContainer) {
            toggleContainer = document.createElement('div');
            toggleContainer.className = 'comparison-toggle';
            toggleContainer.innerHTML = `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-sm ${this.displayMode === 'absolute' ? 'btn-active' : ''}" data-mode="absolute">Count</button>
                    <button class="btn btn-sm ${this.displayMode === 'percentage' ? 'btn-active' : ''}" data-mode="percentage">% of Total</button>
                </div>
            `;
            // Insert before the chart container
            container.parentElement.insertBefore(toggleContainer, container);

            // Bind events
            toggleContainer.addEventListener('click', (e) => {
                if (e.target.matches('[data-mode]')) {
                    const mode = e.target.dataset.mode;
                    if (mode !== this.displayMode) {
                        this.displayMode = mode;
                        toggleContainer.querySelectorAll('.btn').forEach(btn => {
                            btn.classList.toggle('btn-active', btn.dataset.mode === mode);
                        });
                        this.render();
                    }
                }
            });
        }
    },

    getSchoolData(schools) {
        const schoolTimeseries = State.data.schoolTimeseries;
        const timeline = State.data.timeline;
        if (!schoolTimeseries || !timeline) return [];

        const [minYear, maxYear] = State.yearRange;

        // Get total dissertations per year for percentage calculation
        const totalByYear = {};
        timeline.by_year.forEach(d => {
            totalByYear[d.year] = d.count;
        });

        return schools.map(schoolName => {
            const yearData = schoolTimeseries[schoolName];
            if (!yearData) return { name: schoolName, data: [] };

            // Create year map
            const yearMap = {};
            yearData.forEach(d => {
                yearMap[d.year] = d.count;
            });

            // Generate data points for each year in range
            const data = [];
            for (let year = minYear; year <= maxYear; year++) {
                const count = yearMap[year] || 0;
                const total = totalByYear[year] || 1;
                data.push({
                    year,
                    count,
                    percentage: count / total
                });
            }

            // Aggregate by granularity
            const aggregated = this.aggregateData(data, State.timeGranularity);

            return { name: schoolName, data: aggregated };
        });
    },

    aggregateData(data, granularity) {
        if (granularity === 'year') return data;

        const interval = granularity === '5year' ? 5 : 10;
        const groups = {};

        data.forEach(d => {
            const start = Math.floor(d.year / interval) * interval;
            if (!groups[start]) {
                groups[start] = { start, count: 0, totalForPct: 0 };
            }
            groups[start].count += d.count;
            groups[start].totalForPct += d.count / d.percentage || 0;
        });

        return Object.values(groups)
            .sort((a, b) => a.start - b.start)
            .map(g => ({
                year: g.start,
                start: g.start,
                count: g.count,
                percentage: g.totalForPct > 0 ? g.count / g.totalForPct : 0
            }));
    },

    render() {
        const container = document.getElementById('school-comparison-chart');
        if (!container) return;

        const schools = State.selectedSchools;

        // Create toggle if needed
        this.createToggle(container);

        if (schools.length === 0) {
            container.innerHTML = `
                <div class="chart-empty">
                    <p class="text-muted">Select schools from the list above to compare their dissertation output over time.</p>
                </div>
            `;
            return;
        }

        // Get comparison data
        const schoolData = this.getSchoolData(schools);

        if (!schoolData || schoolData.length === 0 || schoolData.every(s => s.data.length === 0)) {
            container.innerHTML = `<div class="chart-empty">No data available for selected schools</div>`;
            return;
        }

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

        // Get value accessor based on mode
        const getValue = this.displayMode === 'percentage'
            ? d => d.percentage
            : d => d.count;

        // Flatten data for scales
        const allPoints = schoolData.flatMap(s => s.data);
        const [minYear, maxYear] = State.yearRange;

        // Scales
        const x = d3.scaleLinear()
            .domain([minYear, maxYear])
            .range([0, innerWidth]);

        const maxValue = d3.max(allPoints, getValue) || (this.displayMode === 'percentage' ? 0.1 : 10);
        const y = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([innerHeight, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year || d.start))
            .y(d => y(getValue(d)))
            .curve(d3.curveMonotoneX);

        // Draw lines for each school
        schoolData.forEach((school, i) => {
            const color = CONFIG.COLORS.schools[i];
            const filteredData = school.data.filter(d => {
                const year = d.year || d.start;
                return year >= minYear && year <= maxYear;
            });

            if (filteredData.length === 0) return;

            g.append('path')
                .datum(filteredData)
                .attr('class', 'comparison-line')
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 2.5)
                .attr('d', line);

            // Add dots
            g.selectAll(`.dot-${i}`)
                .data(filteredData)
                .enter()
                .append('circle')
                .attr('class', `comparison-dot dot-${i}`)
                .attr('cx', d => x(d.year || d.start))
                .attr('cy', d => y(getValue(d)))
                .attr('r', 3)
                .attr('fill', color);
        });

        // Axes
        const xAxis = d3.axisBottom(x)
            .tickFormat(d => d.toString())
            .ticks(Math.min(10, (maxYear - minYear) / 10));

        g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        const yAxisFormat = this.displayMode === 'percentage'
            ? d => `${(d * 100).toFixed(0)}%`
            : d3.format('d');

        g.append('g')
            .attr('class', 'axis y-axis')
            .call(d3.axisLeft(y).ticks(5).tickFormat(yAxisFormat));

        // Y-axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -45)
            .attr('x', -innerHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#64748b')
            .text(this.displayMode === 'percentage' ? '% of All Dissertations' : 'Dissertations');

        // Legend
        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - this.margin.right + 10}, ${this.margin.top})`);

        schoolData.forEach((school, i) => {
            const color = CONFIG.COLORS.schools[i];
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 22})`);

            legendRow.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 5)
                .attr('y2', 5)
                .attr('stroke', color)
                .attr('stroke-width', 2);

            legendRow.append('text')
                .attr('x', 25)
                .attr('y', 9)
                .attr('class', 'legend-text')
                .text(Formatters.schoolName(school.name, 15));
        });

        // Tooltip
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);

        // Hover interaction
        g.selectAll('circle')
            .on('mouseover', (event, d) => {
                const schoolIndex = event.target.classList[1].split('-')[1];
                const school = schoolData[schoolIndex];

                d3.select(event.target)
                    .attr('r', 6);

                const valueText = this.displayMode === 'percentage'
                    ? `${(d.percentage * 100).toFixed(1)}% of total`
                    : `${Formatters.number(d.count)} dissertations`;

                tooltip
                    .style('opacity', 1)
                    .style('left', `${event.offsetX + 10}px`)
                    .style('top', `${event.offsetY - 10}px`)
                    .html(`
                        <strong>${school.name}</strong><br>
                        ${Formatters.periodLabel(d, State.timeGranularity)}: ${valueText}
                    `);
            })
            .on('mouseout', (event) => {
                d3.select(event.target)
                    .attr('r', 3);
                tooltip.style('opacity', 0);
            });
    }
};
