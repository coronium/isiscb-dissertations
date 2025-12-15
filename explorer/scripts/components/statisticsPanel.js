// Statistics panel component for Dissertations Explorer

const StatisticsPanel = {
    init() {
        State.on('dataLoaded', () => this.render());
        State.on('yearRangeChange', () => this.render());
    },

    render() {
        const baseStats = State.data.statistics;
        const meta = State.data.meta;
        const panel = document.getElementById('statistics-panel');
        const metaEl = document.getElementById('stats-meta');
        const timestampEl = document.getElementById('data-timestamp');

        if (!baseStats || !panel) return;

        // Calculate filtered statistics based on year range
        const stats = this.calculateFilteredStats();

        // Update meta info
        if (metaEl && meta) {
            const isFiltered = State.yearRange[0] !== CONFIG.MIN_YEAR || State.yearRange[1] !== CONFIG.MAX_YEAR;
            metaEl.textContent = isFiltered
                ? `${Formatters.number(stats.total_dissertations)} of ${Formatters.number(meta.record_count)} records`
                : `${Formatters.number(meta.record_count)} records`;
        }

        // Update timestamp
        if (timestampEl && meta) {
            timestampEl.textContent = `Data last updated: ${Formatters.date(meta.generated_at)}`;
        }

        // Render statistics grid
        panel.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${Formatters.number(stats.total_dissertations)}</div>
                <div class="stat-label">Total Dissertations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.number(baseStats.total_schools)}</div>
                <div class="stat-label">Unique Schools</div>
                <div class="stat-hint">All years</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.yearRange(State.yearRange[0], State.yearRange[1])}</div>
                <div class="stat-label">Selected Range</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.decimal(stats.mean_per_year, 1)}</div>
                <div class="stat-label">Mean / Year</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.decimal(stats.median_per_year, 1)}</div>
                <div class="stat-label">Median / Year</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.gini(baseStats.gini)}</div>
                <div class="stat-label">Gini Coefficient</div>
                <div class="stat-hint">${Formatters.concentrationLabel(baseStats.gini)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.hhi(baseStats.hhi)}</div>
                <div class="stat-label">HHI</div>
                <div class="stat-hint">All years</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Formatters.percent(baseStats.top_10_share)}</div>
                <div class="stat-label">Top 10 Share</div>
                <div class="stat-hint">All years</div>
            </div>
            ${this.renderGrowthRates(stats.growth_rates)}
        `;
    },

    calculateFilteredStats() {
        const timeline = State.data.timeline;
        const baseStats = State.data.statistics;

        if (!timeline || !timeline.by_year) {
            return baseStats;
        }

        // Filter timeline by year range
        const filteredYears = timeline.by_year.filter(d =>
            d.year >= State.yearRange[0] && d.year <= State.yearRange[1]
        );

        if (filteredYears.length === 0) {
            return {
                ...baseStats,
                total_dissertations: 0,
                mean_per_year: 0,
                median_per_year: 0,
                growth_rates: {}
            };
        }

        // Calculate filtered stats
        const counts = filteredYears.map(d => d.count);
        const total = counts.reduce((sum, c) => sum + c, 0);
        const { mean, median } = DataTransforms.calculateStats(counts);

        // Calculate growth rates for decades in range
        const filteredDecades = timeline.by_decade.filter(d =>
            d.start >= State.yearRange[0] && d.start <= State.yearRange[1]
        );

        const growthRates = {};
        for (let i = 1; i < filteredDecades.length; i++) {
            const prev = filteredDecades[i - 1];
            const curr = filteredDecades[i];
            if (prev.count > 0) {
                const key = `${prev.start}s_to_${curr.start}s`;
                growthRates[key] = (curr.count - prev.count) / prev.count;
            }
        }

        return {
            ...baseStats,
            total_dissertations: total,
            mean_per_year: mean,
            median_per_year: median,
            growth_rates: growthRates
        };
    },

    renderGrowthRates(rates) {
        if (!rates || Object.keys(rates).length === 0) return '';

        // Get recent growth rates (last 3 decades in range)
        const entries = Object.entries(rates).slice(-3);

        return entries.map(([period, rate]) => {
            const label = period.replace(/_/g, ' ').replace('to', '→');
            return `
                <div class="stat-card stat-card-growth">
                    <div class="stat-value ${rate > 0 ? 'positive' : rate < 0 ? 'negative' : ''}">${Formatters.growthRate(rate)}</div>
                    <div class="stat-label">${label}</div>
                </div>
            `;
        }).join('');
    }
};
