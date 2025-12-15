// Timeline chart for Dissertations Explorer
// Shows dissertations over time with granularity toggle

const TimelineChart = {
    svg: null,
    margin: { top: 20, right: 30, bottom: 40, left: 60 },

    init() {
        State.on('dataLoaded', () => this.render());
        State.on('granularityChange', () => this.render());
        State.on('yearRangeChange', () => this.render());

        // Handle window resize
        window.addEventListener('resize', () => this.render());
    },

    render() {
        const data = State.getFilteredTimeline();
        if (!data || data.length === 0) return;

        const container = document.getElementById('timeline-chart');
        if (!container) return;

        // Clear previous
        container.innerHTML = '';

        // Get dimensions
        const width = container.clientWidth;
        const height = 300;
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
        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year || d.start))
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count) * 1.1])
            .range([innerHeight, 0]);

        // Area generator
        const area = d3.area()
            .x(d => x(d.year || d.start))
            .y0(innerHeight)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year || d.start))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Add gradient
        const gradient = this.svg.append('defs')
            .append('linearGradient')
            .attr('id', 'timeline-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', CONFIG.COLORS.primary)
            .attr('stop-opacity', 0.3);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', CONFIG.COLORS.primary)
            .attr('stop-opacity', 0.05);

        // Add area
        g.append('path')
            .datum(data)
            .attr('class', 'timeline-area')
            .attr('fill', 'url(#timeline-gradient)')
            .attr('d', area);

        // Add line
        g.append('path')
            .datum(data)
            .attr('class', 'timeline-line')
            .attr('fill', 'none')
            .attr('stroke', CONFIG.COLORS.primary)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Add dots for interaction
        const dots = g.selectAll('.timeline-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'timeline-dot')
            .attr('cx', d => x(d.year || d.start))
            .attr('cy', d => y(d.count))
            .attr('r', 4)
            .attr('fill', CONFIG.COLORS.primary)
            .attr('opacity', 0);

        // Add axes
        const xAxis = d3.axisBottom(x)
            .tickFormat(d => d.toString())
            .ticks(Math.min(data.length, 10));

        const yAxis = d3.axisLeft(y)
            .ticks(5);

        g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'axis y-axis')
            .call(yAxis);

        // Y-axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -45)
            .attr('x', -innerHeight / 2)
            .attr('text-anchor', 'middle')
            .text('Dissertations');

        // Tooltip
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);

        // Hover interaction
        const bisect = d3.bisector(d => d.year || d.start).left;

        const hoverLine = g.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .style('opacity', 0);

        const hoverDot = g.append('circle')
            .attr('class', 'hover-dot')
            .attr('r', 6)
            .attr('fill', CONFIG.COLORS.primary)
            .style('opacity', 0);

        const overlay = g.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('pointer-events', 'all');

        overlay.on('mousemove', (event) => {
            const [mouseX] = d3.pointer(event);
            const x0 = x.invert(mouseX);
            const i = bisect(data, x0, 1);
            const d0 = data[i - 1];
            const d1 = data[i];
            const d = d1 && (x0 - (d0.year || d0.start) > (d1.year || d1.start) - x0) ? d1 : d0;

            if (!d) return;

            const xPos = x(d.year || d.start);
            const yPos = y(d.count);

            hoverLine
                .attr('x1', xPos)
                .attr('x2', xPos)
                .style('opacity', 0.3);

            hoverDot
                .attr('cx', xPos)
                .attr('cy', yPos)
                .style('opacity', 1);

            tooltip
                .style('opacity', 1)
                .style('left', `${xPos + this.margin.left + 10}px`)
                .style('top', `${yPos + this.margin.top - 10}px`)
                .html(`
                    <strong>${Formatters.periodLabel(d, State.timeGranularity)}</strong><br>
                    ${Formatters.number(d.count)} dissertations
                `);
        });

        overlay.on('mouseleave', () => {
            hoverLine.style('opacity', 0);
            hoverDot.style('opacity', 0);
            tooltip.style('opacity', 0);
        });

        // Update meta
        const meta = document.getElementById('timeline-meta');
        if (meta) {
            const total = data.reduce((sum, d) => sum + d.count, 0);
            meta.textContent = `${Formatters.number(total)} dissertations in range`;
        }
    }
};
