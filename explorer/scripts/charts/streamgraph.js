// Streamgraph - School Output Over Time
// Shows relative contribution of top schools as flowing streams

const Streamgraph = {
    topN: 15,
    windowSize: 5, // Smoother with 5-year window for streamgraph
    startYear: 1945,
    endYear: 2020,

    init() {
        State.on('dataLoaded', () => this.render());
    },

    prepareData() {
        if (!State.data.schoolTimeseries) return null;

        const schoolData = State.data.schoolTimeseries;

        // Get top N schools by total count
        const schoolTotals = Object.keys(schoolData).map(school => {
            const total = schoolData[school].reduce((sum, d) => sum + d.count, 0);
            return { school, total };
        });
        schoolTotals.sort((a, b) => b.total - a.total);
        const topSchools = schoolTotals.slice(0, this.topN).map(s => s.school);

        // Create year maps for each school
        const schoolYearMaps = {};
        topSchools.forEach(school => {
            schoolYearMaps[school] = {};
            schoolData[school].forEach(d => {
                schoolYearMaps[school][d.year] = d.count;
            });
        });

        // Build data array for D3 stack
        const data = [];
        for (let year = this.startYear; year <= this.endYear; year++) {
            const row = { year };

            topSchools.forEach(school => {
                // Use rolling average for smoother streams
                let sum = 0;
                for (let y = year - this.windowSize + 1; y <= year; y++) {
                    sum += schoolYearMaps[school][y] || 0;
                }
                row[school] = sum / this.windowSize;
            });

            data.push(row);
        }

        return { data, schools: topSchools };
    },

    getSchoolColor(school, index) {
        return CONFIG.SCHOOL_COLORS[school] || CONFIG.FALLBACK_SCHOOL_COLORS[index % CONFIG.FALLBACK_SCHOOL_COLORS.length];
    },

    render() {
        const container = document.getElementById('streamgraph-chart');
        if (!container || !State.data.schoolTimeseries) return;

        const prepared = this.prepareData();
        if (!prepared) return;

        const { data, schools } = prepared;

        // Clear existing
        container.innerHTML = '';

        const margin = { top: 20, right: 180, bottom: 40, left: 50 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        if (width <= 0) return;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Stack generator with wiggle offset for streamgraph effect
        const stack = d3.stack()
            .keys(schools)
            .offset(d3.stackOffsetWiggle)
            .order(d3.stackOrderInsideOut);

        const series = stack(data);

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([
                d3.min(series, s => d3.min(s, d => d[0])),
                d3.max(series, s => d3.max(s, d => d[1]))
            ])
            .range([height, 0]);

        // Area generator
        const area = d3.area()
            .x(d => x(d.data.year))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]))
            .curve(d3.curveBasis);

        // Color scale
        const color = (school, idx) => this.getSchoolColor(school, idx);

        // Draw streams
        const streams = svg.selectAll('.stream')
            .data(series)
            .enter()
            .append('path')
            .attr('class', 'stream')
            .attr('d', area)
            .attr('fill', (d, i) => color(d.key, i))
            .attr('fill-opacity', 0.85)
            .attr('stroke', 'white')
            .attr('stroke-width', 0.5);

        // Add legend on the right
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 10}, 0)`);

        // Sort schools by their position at the end of the chart
        const lastData = series.map(s => ({
            key: s.key,
            mid: (s[s.length - 1][0] + s[s.length - 1][1]) / 2
        }));
        lastData.sort((a, b) => a.mid - b.mid);

        const legendSpacing = Math.min(22, height / schools.length);

        lastData.forEach((d, i) => {
            const schoolIdx = schools.indexOf(d.key);
            const g = legend.append('g')
                .attr('transform', `translate(0, ${i * legendSpacing})`);

            g.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('rx', 2)
                .attr('fill', color(d.key, schoolIdx));

            g.append('text')
                .attr('x', 16)
                .attr('y', 10)
                .attr('font-size', '10px')
                .attr('fill', '#374151')
                .text(this.truncateName(d.key));
        });

        // X axis
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(10));

        // Add tooltip
        this.addTooltip(container, svg, streams, series, x, y, data, color);
    },

    truncateName(name) {
        return name
            .replace('University of ', 'U. ')
            .replace('University', 'U.')
            .replace(', Madison', '')
            .replace(', Berkeley', '')
            .replace(', Los Angeles', '')
            .replace(', Urbana-Champaign', '')
            .replace(', Chapel Hill', '');
    },

    addTooltip(container, svg, streams, series, x, y, data, colorFn) {
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0)
            .style('max-width', '250px');

        const bisect = d3.bisector(d => d.year).left;

        // Highlight on hover
        streams
            .on('mouseover', function(event, d) {
                // Dim other streams
                streams.attr('fill-opacity', 0.3);
                d3.select(this).attr('fill-opacity', 1);
            })
            .on('mousemove', function(event, d) {
                const [mx] = d3.pointer(event, svg.node());
                const year = Math.round(x.invert(mx));
                const idx = bisect(data, year);
                const yearData = data[Math.min(idx, data.length - 1)];

                if (yearData) {
                    const value = yearData[d.key];
                    const schoolIdx = series.findIndex(s => s.key === d.key);

                    tooltip
                        .style('opacity', 1)
                        .style('left', `${event.offsetX + 15}px`)
                        .style('top', `${event.offsetY}px`)
                        .html(`
                            <strong style="color: ${colorFn(d.key, schoolIdx)}">${d.key}</strong><br>
                            Year: ${yearData.year}<br>
                            5-yr avg: <strong>${value.toFixed(1)}</strong> dissertations/yr
                        `);
                }
            })
            .on('mouseout', function() {
                streams.attr('fill-opacity', 0.85);
                tooltip.style('opacity', 0);
            });
    }
};
