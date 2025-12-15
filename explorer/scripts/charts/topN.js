// Top N vs Rest chart for Dissertations Explorer
// Compares top 10 / top 25% / top 50% against the rest

const TopNChart = {
    svg: null,
    margin: { top: 20, right: 30, bottom: 40, left: 60 },

    init() {
        State.on('dataLoaded', () => this.render());
        State.on('topNModeChange', () => this.render());
        window.addEventListener('resize', () => this.render());
    },

    render() {
        const schools = State.data.schools?.schools;
        if (!schools || schools.length === 0) return;

        const container = document.getElementById('topn-chart');
        if (!container) return;

        // Calculate comparison data
        const comparison = DataTransforms.calculateTopNComparison(schools, State.topNMode);
        if (!comparison) return;

        // Clear previous
        container.innerHTML = '';

        // Get dimensions
        const width = container.clientWidth;
        const height = 250;
        const innerWidth = width - this.margin.left - this.margin.right;
        const innerHeight = height - this.margin.top - this.margin.bottom;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Data for bars
        const data = [
            {
                label: comparison.label,
                count: comparison.top.count,
                percentage: comparison.top.percentage,
                schools: comparison.top.schools,
                color: CONFIG.COLORS.primary
            },
            {
                label: 'Rest',
                count: comparison.rest.count,
                percentage: comparison.rest.percentage,
                schools: comparison.rest.schools,
                color: CONFIG.COLORS.muted
            }
        ];

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([0, innerWidth])
            .padding(0.4);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count) * 1.1])
            .range([innerHeight, 0]);

        // Draw bars
        const bars = g.selectAll('.topn-bar')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'topn-bar-group');

        bars.append('rect')
            .attr('class', 'topn-bar')
            .attr('x', d => x(d.label))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => innerHeight - y(d.count))
            .attr('fill', d => d.color)
            .attr('rx', 4);

        // Add labels on bars
        bars.append('text')
            .attr('class', 'bar-label')
            .attr('x', d => x(d.label) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 25)
            .attr('text-anchor', 'middle')
            .html(d => Formatters.number(d.count));

        bars.append('text')
            .attr('class', 'bar-percentage')
            .attr('x', d => x(d.label) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 8)
            .attr('text-anchor', 'middle')
            .attr('fill', CONFIG.COLORS.muted)
            .text(d => Formatters.percent(d.percentage));

        // Add school counts below
        bars.append('text')
            .attr('class', 'bar-schools')
            .attr('x', d => x(d.label) + x.bandwidth() / 2)
            .attr('y', innerHeight + 30)
            .attr('text-anchor', 'middle')
            .attr('fill', CONFIG.COLORS.muted)
            .text(d => `(${Formatters.number(d.schools)} schools)`);

        // X-axis
        g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x));

        // Y-axis
        g.append('g')
            .attr('class', 'axis y-axis')
            .call(d3.axisLeft(y).ticks(5));

        // Y-axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -45)
            .attr('x', -innerHeight / 2)
            .attr('text-anchor', 'middle')
            .text('Dissertations');

        // Summary text
        const summary = g.append('g')
            .attr('class', 'summary')
            .attr('transform', `translate(${innerWidth / 2}, ${-5})`);

        const topPct = comparison.top.schools / comparison.totalSchools;
        summary.append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'summary-text')
            .attr('fill', CONFIG.COLORS.tertiary)
            .text(`${Formatters.percent(topPct, 0)} of schools produce ${Formatters.percent(comparison.top.percentage)} of dissertations`);
    }
};
