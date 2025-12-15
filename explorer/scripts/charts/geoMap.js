// Geographic Map - Animated dissertation output by location
// Shows bubbles on US/Canada map that grow/shrink over time

const GeoMap = {
    svg: null,
    projection: null,
    path: null,
    isPlaying: false,
    currentYear: 1950,
    animationTimer: null,
    speed: 400,
    startYear: 1950,
    endYear: 2020,
    windowSize: 10,
    schoolAverages: null,
    usStatesData: null,

    init() {
        State.on('dataLoaded', () => this.onDataLoaded());
    },

    onDataLoaded() {
        if (State.data.schoolTimeseries) {
            this.calculateAllAverages();
            this.render();
        }
    },

    calculateAllAverages() {
        const schoolData = State.data.schoolTimeseries;
        this.schoolAverages = {};

        Object.keys(schoolData).forEach(school => {
            if (!SCHOOL_LOCATIONS[school] || SCHOOL_LOCATIONS[school].exclude) return;

            const yearMap = {};
            schoolData[school].forEach(d => {
                yearMap[d.year] = d.count;
            });

            this.schoolAverages[school] = {};
            for (let year = this.startYear; year <= this.endYear; year++) {
                let sum = 0;
                for (let y = year - this.windowSize + 1; y <= year; y++) {
                    sum += yearMap[y] || 0;
                }
                this.schoolAverages[school][year] = sum / this.windowSize;
            }
        });
    },

    render() {
        const container = document.getElementById('geo-map-chart');
        if (!container || !this.schoolAverages) return;

        container.innerHTML = '';

        // Create controls
        const controls = document.createElement('div');
        controls.className = 'geo-controls';
        controls.innerHTML = `
            <div class="racing-controls-row">
                <button id="geo-play-btn" class="btn btn-primary btn-sm">
                    <span class="play-icon">▶</span> Play
                </button>
                <button id="geo-reset-btn" class="btn btn-secondary btn-sm">Reset</button>
                <div class="speed-control">
                    <label class="control-label">Speed</label>
                    <input type="range" id="geo-speed-slider" min="100" max="800" value="${900 - this.speed}" step="50">
                </div>
                <div class="racing-year-display">
                    <span id="geo-current-year">${this.currentYear}</span>
                </div>
            </div>
        `;
        container.appendChild(controls);

        // Create map container
        const mapContainer = document.createElement('div');
        mapContainer.id = 'geo-map-svg';
        mapContainer.className = 'geo-map-container';
        container.appendChild(mapContainer);

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip geo-tooltip';
        tooltip.style.opacity = '0';
        container.appendChild(tooltip);

        this.bindControls();
        this.drawMap(mapContainer);
    },

    bindControls() {
        document.getElementById('geo-play-btn')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('geo-reset-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('geo-speed-slider')?.addEventListener('input', (e) => {
            this.speed = 900 - parseInt(e.target.value);
        });
    },

    async drawMap(container) {
        const width = container.clientWidth || 900;
        const height = 520;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Background
        this.svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', '#f8fafc');

        // Set up projection - Albers USA for continental US
        this.projection = d3.geoAlbersUsa()
            .scale(1100)
            .translate([width / 2, height / 2]);

        this.path = d3.geoPath().projection(this.projection);

        // Load US states TopoJSON
        try {
            const response = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
            const us = await response.json();
            this.usStatesData = topojson.feature(us, us.objects.states);

            // Draw states
            this.svg.append('g')
                .attr('class', 'states')
                .selectAll('path')
                .data(this.usStatesData.features)
                .enter()
                .append('path')
                .attr('d', this.path)
                .attr('fill', '#e2e8f0')
                .attr('stroke', '#cbd5e1')
                .attr('stroke-width', 0.5);

            // Draw state borders
            this.svg.append('path')
                .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
                .attr('fill', 'none')
                .attr('stroke', '#94a3b8')
                .attr('stroke-width', 0.5)
                .attr('d', this.path);

        } catch (error) {
            console.warn('Could not load US map, using fallback:', error);
            this.drawFallbackMap(width, height);
        }

        // Add Canada (Toronto area) - simple rectangle
        this.svg.append('rect')
            .attr('x', width * 0.7)
            .attr('y', 5)
            .attr('width', 120)
            .attr('height', 60)
            .attr('fill', '#e2e8f0')
            .attr('stroke', '#94a3b8')
            .attr('rx', 4);

        this.svg.append('text')
            .attr('x', width * 0.7 + 60)
            .attr('y', 35)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#64748b')
            .text('Canada');

        // Create bubbles group
        this.svg.append('g').attr('class', 'bubbles');

        // Add legend
        this.addLegend(width, height);

        // Draw initial bubbles
        this.updateBubbles();
    },

    drawFallbackMap(width, height) {
        // Simple US outline as fallback
        const mapGroup = this.svg.append('g').attr('class', 'fallback-map');

        // Approximate continental US boundary
        mapGroup.append('ellipse')
            .attr('cx', width / 2)
            .attr('cy', height / 2)
            .attr('rx', width * 0.42)
            .attr('ry', height * 0.38)
            .attr('fill', '#e2e8f0')
            .attr('stroke', '#94a3b8');
    },

    projectSchool(school) {
        const loc = SCHOOL_LOCATIONS[school];
        if (!loc || loc.exclude) return null;

        // Use D3 projection for US schools
        const projected = this.projection([loc.lng, loc.lat]);

        // If projection fails (outside US), use manual positioning for Canada
        if (!projected) {
            if (loc.city && loc.city.includes('Canada')) {
                const container = document.getElementById('geo-map-svg');
                const width = container?.clientWidth || 900;
                // Position in Canada box
                if (school === 'University of Toronto') {
                    return [width * 0.7 + 40, 40];
                } else if (school === 'York University (Canada)') {
                    return [width * 0.7 + 80, 40];
                }
            }
            return null;
        }

        return projected;
    },

    updateBubbles() {
        if (!this.svg || !this.schoolAverages) return;

        let bubblesGroup = this.svg.select('.bubbles');
        if (bubblesGroup.empty()) {
            bubblesGroup = this.svg.append('g').attr('class', 'bubbles');
        }

        // Ensure bubbles are always on top of map elements
        bubblesGroup.raise();

        // Get data for current year
        const data = Object.keys(this.schoolAverages)
            .map(school => {
                const pos = this.projectSchool(school);
                if (!pos) return null;

                const value = this.schoolAverages[school][this.currentYear] || 0;
                return {
                    school,
                    x: pos[0],
                    y: pos[1],
                    value,
                    color: CONFIG.SCHOOL_COLORS[school] || '#2892d7',
                    city: SCHOOL_LOCATIONS[school]?.city || ''
                };
            })
            .filter(d => d && d.value > 0);

        // Scale for bubble size
        const maxValue = d3.max(data, d => d.value) || 1;
        const sizeScale = d3.scaleSqrt()
            .domain([0, maxValue])
            .range([4, 35]);

        // Data join
        const bubbles = bubblesGroup.selectAll('.school-bubble')
            .data(data, d => d.school);

        // Exit
        bubbles.exit()
            .transition()
            .duration(this.speed * 0.3)
            .attr('r', 0)
            .remove();

        // Enter
        const enter = bubbles.enter()
            .append('circle')
            .attr('class', 'school-bubble')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .attr('fill', d => d.color)
            .attr('fill-opacity', 0.7)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.9)
            .style('cursor', 'pointer');

        // Update
        bubbles.merge(enter)
            .on('mouseenter', (event, d) => this.showTooltip(event, d))
            .on('mouseleave', () => this.hideTooltip())
            .transition()
            .duration(this.speed * 0.7)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => sizeScale(d.value))
            .attr('fill', d => d.color)
            .attr('stroke', d => d.color);
    },

    showTooltip(event, d) {
        const tooltip = document.querySelector('#geo-map-chart .geo-tooltip');
        if (!tooltip) return;

        const container = document.getElementById('geo-map-chart');
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        tooltip.innerHTML = `
            <strong style="color: ${d.color}">${d.school}</strong><br>
            <span style="color: #64748b">${d.city}</span><br>
            10-yr avg: <strong>${d.value.toFixed(1)}</strong>/yr
        `;
        tooltip.style.opacity = '1';
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y - 10}px`;

        // Highlight bubble
        this.svg.selectAll('.school-bubble')
            .filter(b => b.school === d.school)
            .attr('stroke-width', 4);
    },

    hideTooltip() {
        const tooltip = document.querySelector('#geo-map-chart .geo-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
        }

        // Reset bubble stroke
        this.svg.selectAll('.school-bubble')
            .attr('stroke-width', 2);
    },

    addLegend(width, height) {
        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(20, ${height - 100})`);

        legend.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#374151')
            .text('Avg. dissertations/yr');

        const sizes = [1, 5, 10];
        const sizeScale = d3.scaleSqrt().domain([0, 12]).range([4, 35]);

        sizes.forEach((size, i) => {
            const cy = 25 + i * 28;
            legend.append('circle')
                .attr('cx', 20)
                .attr('cy', cy)
                .attr('r', sizeScale(size))
                .attr('fill', '#2892d7')
                .attr('fill-opacity', 0.5)
                .attr('stroke', '#2892d7')
                .attr('stroke-width', 1.5);

            legend.append('text')
                .attr('x', 50)
                .attr('y', cy + 4)
                .attr('font-size', '10px')
                .attr('fill', '#64748b')
                .text(size);
        });
    },

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    play() {
        if (this.currentYear >= this.endYear) {
            this.currentYear = this.startYear;
        }

        this.isPlaying = true;
        const playBtn = document.getElementById('geo-play-btn');
        if (playBtn) {
            playBtn.innerHTML = '<span class="pause-icon">⏸</span> Pause';
        }

        this.animate();
    },

    pause() {
        this.isPlaying = false;
        const playBtn = document.getElementById('geo-play-btn');
        if (playBtn) {
            playBtn.innerHTML = '<span class="play-icon">▶</span> Play';
        }

        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
    },

    reset() {
        this.pause();
        this.currentYear = this.startYear;
        this.updateYearDisplay();
        this.updateBubbles();
    },

    animate() {
        if (!this.isPlaying) return;

        this.currentYear++;
        this.updateYearDisplay();
        this.updateBubbles();

        if (this.currentYear >= this.endYear) {
            this.pause();
            return;
        }

        this.animationTimer = setTimeout(() => this.animate(), this.speed);
    },

    updateYearDisplay() {
        const yearEl = document.getElementById('geo-current-year');
        if (yearEl) {
            yearEl.textContent = this.currentYear;
        }
    }
};
