// Racing Bar Chart for Dissertations Explorer
// Shows top 15 schools competing over time with 10-year running average

const RacingBarChart = {
    svg: null,
    isPlaying: false,
    currentYear: 1945,
    animationTimer: null,
    speed: 500, // ms per frame
    topN: 15,
    startYear: 1945,
    endYear: 2020,
    windowSize: 10, // 10-year running average
    schoolTimeseries: null,
    runningAverages: null,

    init() {
        this.createChart();
        State.on('dataLoaded', () => this.onDataLoaded());
    },

    onDataLoaded() {
        // Check if we have school timeseries data
        if (State.data.schoolTimeseries) {
            this.schoolTimeseries = State.data.schoolTimeseries;
            this.calculateRunningAverages();
            this.render();
        }
    },

    calculateRunningAverages() {
        // Calculate 10-year running average for each school
        this.runningAverages = {};

        Object.keys(this.schoolTimeseries).forEach(school => {
            const yearData = this.schoolTimeseries[school];
            this.runningAverages[school] = {};

            // Create year->count map
            const yearMap = {};
            yearData.forEach(d => {
                yearMap[d.year] = d.count;
            });

            // Calculate running average for each year (sum of last N years / N)
            for (let year = this.startYear; year <= this.endYear; year++) {
                let sum = 0;
                for (let y = year - this.windowSize + 1; y <= year; y++) {
                    sum += yearMap[y] || 0;
                }
                this.runningAverages[school][year] = sum / this.windowSize;
            }
        });
    },

    createChart() {
        const container = document.getElementById('racing-bar-chart');
        if (!container) return;

        // Clear existing
        container.innerHTML = '';

        // Create controls
        const controls = document.createElement('div');
        controls.className = 'racing-controls';
        controls.innerHTML = `
            <div class="racing-controls-row">
                <button id="racing-play-btn" class="btn btn-primary btn-sm">
                    <span class="play-icon">▶</span> Play
                </button>
                <button id="racing-reset-btn" class="btn btn-secondary btn-sm">Reset</button>
                <div class="speed-control">
                    <label class="control-label">Speed</label>
                    <input type="range" id="racing-speed-slider" min="100" max="1000" value="${1100 - this.speed}" step="50">
                </div>
                <div class="racing-year-display">
                    <span id="racing-current-year">${this.startYear}</span>
                </div>
            </div>
        `;
        container.appendChild(controls);

        // Create SVG container
        const svgContainer = document.createElement('div');
        svgContainer.id = 'racing-bar-svg';
        svgContainer.className = 'racing-bar-svg-container';
        container.appendChild(svgContainer);

        // Bind control events
        this.bindControls();
    },

    bindControls() {
        const playBtn = document.getElementById('racing-play-btn');
        const resetBtn = document.getElementById('racing-reset-btn');
        const speedSlider = document.getElementById('racing-speed-slider');

        playBtn?.addEventListener('click', () => this.togglePlay());
        resetBtn?.addEventListener('click', () => this.reset());
        speedSlider?.addEventListener('input', (e) => {
            // Invert so right = slow, left = fast
            this.speed = 1100 - parseInt(e.target.value);
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
        const playBtn = document.getElementById('racing-play-btn');
        if (playBtn) {
            playBtn.innerHTML = '<span class="pause-icon">⏸</span> Pause';
        }

        this.animate();
    },

    pause() {
        this.isPlaying = false;
        const playBtn = document.getElementById('racing-play-btn');
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
        this.render();
    },

    animate() {
        if (!this.isPlaying) return;

        this.currentYear++;
        this.updateYearDisplay();
        this.render();

        if (this.currentYear >= this.endYear) {
            this.pause();
            return;
        }

        this.animationTimer = setTimeout(() => this.animate(), this.speed);
    },

    updateYearDisplay() {
        const yearEl = document.getElementById('racing-current-year');
        if (yearEl) {
            yearEl.textContent = this.currentYear;
        }
    },

    getSchoolColor(schoolName, index) {
        // Check if we have an official color for this school
        if (CONFIG.SCHOOL_COLORS[schoolName]) {
            return CONFIG.SCHOOL_COLORS[schoolName];
        }
        // Use fallback color based on index
        return CONFIG.FALLBACK_SCHOOL_COLORS[index % CONFIG.FALLBACK_SCHOOL_COLORS.length];
    },

    render() {
        const container = document.getElementById('racing-bar-svg');
        if (!container || !this.runningAverages) return;

        // Get current rankings
        const rankings = this.getRankingsForYear(this.currentYear);
        if (rankings.length === 0) return;

        const margin = { top: 10, right: 120, bottom: 30, left: 10 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = Math.max(400, this.topN * 35);
        const barHeight = (height - margin.top - margin.bottom) / this.topN - 5;

        // Create or update SVG
        let svg = d3.select(container).select('svg');
        if (svg.empty()) {
            svg = d3.select(container)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            svg.append('g')
                .attr('class', 'bars-group')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            svg.append('g')
                .attr('class', 'axis-group')
                .attr('transform', `translate(${margin.left},${height})`);
        } else {
            svg.attr('width', width + margin.left + margin.right)
               .attr('height', height + margin.top + margin.bottom);
        }

        const barsGroup = svg.select('.bars-group');

        // X scale based on max value
        const maxValue = d3.max(rankings, d => d.value) || 1;
        const x = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([0, width]);

        // Update axis
        svg.select('.axis-group')
            .transition()
            .duration(this.speed * 0.8)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d => d.toFixed(1)));

        // Data join for bar groups
        const barGroups = barsGroup.selectAll('.bar-group')
            .data(rankings, d => d.school);

        // Enter new bars
        const enterGroups = barGroups.enter()
            .append('g')
            .attr('class', 'bar-group')
            .attr('transform', (d, i) => `translate(0, ${i * (barHeight + 5)})`);

        enterGroups.append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', barHeight)
            .attr('width', 0)
            .attr('rx', 3)
            .attr('fill', (d, i) => this.getSchoolColor(d.school, i));

        enterGroups.append('text')
            .attr('class', 'bar-label')
            .attr('x', 5)
            .attr('y', barHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', '500');

        enterGroups.append('text')
            .attr('class', 'bar-value')
            .attr('y', barHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', '#333')
            .attr('font-size', '12px')
            .attr('font-weight', '600');

        // Update all bars
        const allGroups = barsGroup.selectAll('.bar-group')
            .data(rankings, d => d.school);

        allGroups.transition()
            .duration(this.speed * 0.8)
            .ease(d3.easeLinear)
            .attr('transform', (d, i) => `translate(0, ${i * (barHeight + 5)})`);

        allGroups.select('.bar')
            .transition()
            .duration(this.speed * 0.8)
            .ease(d3.easeLinear)
            .attr('width', d => Math.max(0, x(d.value)))
            .attr('fill', (d, i) => this.getSchoolColor(d.school, i));

        allGroups.select('.bar-label')
            .text(d => this.truncateSchoolName(d.school, x(d.value)));

        allGroups.select('.bar-value')
            .transition()
            .duration(this.speed * 0.8)
            .ease(d3.easeLinear)
            .attr('x', d => x(d.value) + 5)
            .text(d => d.value.toFixed(1));

        // Remove exiting bars
        barGroups.exit()
            .transition()
            .duration(this.speed * 0.5)
            .style('opacity', 0)
            .remove();
    },

    truncateSchoolName(name, barWidth) {
        // Truncate school name based on bar width
        if (barWidth < 50) return '';
        if (barWidth < 100) {
            // Very short - just initials
            return name.split(' ')
                .filter(w => w.length > 2 && w !== 'of' && w !== 'the')
                .map(w => w[0])
                .join('');
        }
        if (barWidth < 180) {
            // Medium - abbreviated
            return name
                .replace('University of ', 'U. ')
                .replace('University', 'U.')
                .replace(', Madison', '')
                .replace(', Berkeley', '')
                .replace(', Los Angeles', '')
                .replace(', Urbana-Champaign', '');
        }
        // Full name but maybe shortened
        if (name.length > 30) {
            return name
                .replace('University of ', 'U. ')
                .replace('University', 'U.');
        }
        return name;
    },

    getRankingsForYear(year) {
        if (!this.runningAverages) return [];

        const rankings = Object.keys(this.runningAverages)
            .map(school => ({
                school,
                value: this.runningAverages[school][year] || 0
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, this.topN);

        return rankings;
    }
};
