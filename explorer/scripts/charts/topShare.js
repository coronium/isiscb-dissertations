// Top Share Over Time Chart
// Shows percentage of dissertations produced by top X schools over time

const TopShareChart = {
    svg: null,
    topN: 10,
    windowSize: 10, // 10-year rolling window

    init() {
        this.bindControls();
        State.on('dataLoaded', () => this.render());
        State.on('granularityChange', () => this.render());
    },

    bindControls() {
        const toggle = document.getElementById('topshare-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                if (e.target.matches('[data-value]')) {
                    toggle.querySelectorAll('.btn').forEach(btn => btn.classList.remove('btn-active'));
                    e.target.classList.add('btn-active');
                    this.topN = parseInt(e.target.dataset.value);
                    this.render();
                }
            });
        }
    },

    calculateTopShareOverTime() {
        if (!State.data.schoolTimeseries || !State.data.timeline) return null;

        const timeline = State.data.timeline.by_year;
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

        // Calculate rolling averages and shares for each year
        const results = [];
        const startYear = 1945;
        const endYear = 2020;

        for (let year = startYear; year <= endYear; year++) {
            // Calculate 10-year rolling total for each school
            const schoolTotals = [];
            allSchools.forEach(school => {
                let total = 0;
                for (let y = year - this.windowSize + 1; y <= year; y++) {
                    total += schoolYearMaps[school][y] || 0;
                }
                if (total > 0) {
                    schoolTotals.push({ school, total });
                }
            });

            // Sort by total and get top N
            schoolTotals.sort((a, b) => b.total - a.total);

            // Calculate total dissertations in window
            let windowTotal = 0;
            for (let y = year - this.windowSize + 1; y <= year; y++) {
                const yearData = timeline.find(d => d.year === y);
                if (yearData) windowTotal += yearData.count;
            }

            if (windowTotal > 0) {
                // Calculate shares for different top N values
                const shares = {};
                [5, 10, 15, 20].forEach(n => {
                    const topNTotal = schoolTotals.slice(0, n).reduce((sum, s) => sum + s.total, 0);
                    shares[`top${n}`] = topNTotal / windowTotal;
                });

                results.push({
                    year,
                    ...shares,
                    totalInWindow: windowTotal
                });
            }
        }

        return results;
    },

    render() {
        const container = document.getElementById('topshare-chart');
        if (!container || !State.data.schoolTimeseries) return;

        const data = this.calculateTopShareOverTime();
        if (!data || data.length === 0) return;

        // Clear existing
        container.innerHTML = '';

        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        if (width <= 0) return;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, 1])
            .range([height, 0]);

        // Area generator
        const area = d3.area()
            .x(d => x(d.year))
            .y0(height)
            .y1(d => y(d[`top${this.topN}`]))
            .curve(d3.curveMonotoneX);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d[`top${this.topN}`]))
            .curve(d3.curveMonotoneX);

        // Draw area
        svg.append('path')
            .datum(data)
            .attr('class', 'share-area')
            .attr('fill', CONFIG.COLORS.primary)
            .attr('fill-opacity', 0.2)
            .attr('d', area);

        // Draw line
        svg.append('path')
            .datum(data)
            .attr('class', 'share-line')
            .attr('fill', 'none')
            .attr('stroke', CONFIG.COLORS.primary)
            .attr('stroke-width', 2.5)
            .attr('d', line);

        // Add reference lines at 25%, 50%, 75%
        [0.25, 0.5, 0.75].forEach(val => {
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', y(val))
                .attr('y2', y(val))
                .attr('stroke', '#e2e8f0')
                .attr('stroke-dasharray', '4,4');

            svg.append('text')
                .attr('x', width + 5)
                .attr('y', y(val))
                .attr('dy', '0.35em')
                .attr('font-size', '10px')
                .attr('fill', '#94a3b8')
                .text(`${val * 100}%`);
        });

        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(10));

        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y).tickFormat(d => `${(d * 100).toFixed(0)}%`).ticks(5));

        // Y-axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -40)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#64748b')
            .text(`Share of Top ${this.topN} Schools`);

        // Add tooltip
        this.addTooltip(svg, data, x, y, width, height);

        // Add current value annotation
        const lastPoint = data[data.length - 1];
        const lastValue = lastPoint[`top${this.topN}`];

        svg.append('circle')
            .attr('cx', x(lastPoint.year))
            .attr('cy', y(lastValue))
            .attr('r', 5)
            .attr('fill', CONFIG.COLORS.primary);

        svg.append('text')
            .attr('x', x(lastPoint.year) - 10)
            .attr('y', y(lastValue) - 12)
            .attr('text-anchor', 'end')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('fill', CONFIG.COLORS.tertiary)
            .text(`${(lastValue * 100).toFixed(1)}%`);
    },

    addTooltip(svg, data, x, y, width, height) {
        const tooltip = d3.select('#topshare-chart')
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);

        const bisect = d3.bisector(d => d.year).left;

        const focusLine = svg.append('line')
            .attr('class', 'focus-line')
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#94a3b8')
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);

        const focusCircle = svg.append('circle')
            .attr('r', 5)
            .attr('fill', CONFIG.COLORS.primary)
            .style('opacity', 0);

        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const year = Math.round(x.invert(mx));
                const idx = bisect(data, year);
                const d = data[Math.min(idx, data.length - 1)];

                if (d) {
                    const val = d[`top${this.topN}`];
                    focusLine
                        .attr('x1', x(d.year))
                        .attr('x2', x(d.year))
                        .style('opacity', 1);

                    focusCircle
                        .attr('cx', x(d.year))
                        .attr('cy', y(val))
                        .style('opacity', 1);

                    tooltip
                        .style('opacity', 1)
                        .style('left', `${x(d.year) + 60}px`)
                        .style('top', `${y(val) + 20}px`)
                        .html(`
                            <strong>${d.year}</strong><br>
                            Top ${this.topN}: <strong>${(val * 100).toFixed(1)}%</strong>
                        `);
                }
            })
            .on('mouseout', () => {
                focusLine.style('opacity', 0);
                focusCircle.style('opacity', 0);
                tooltip.style('opacity', 0);
            });
    }
};
