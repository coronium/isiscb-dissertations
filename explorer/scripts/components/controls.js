// Controls component for Dissertations Explorer

const Controls = {
    slider: null,

    init() {
        this.initGranularityToggle();
        this.initYearSlider();
        this.initTopNToggle();
        this.initRefreshButton();
    },

    initGranularityToggle() {
        const toggle = document.getElementById('granularity-toggle');
        if (!toggle) return;

        const buttons = toggle.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                buttons.forEach(b => b.classList.remove('btn-active'));
                btn.classList.add('btn-active');

                // Update state
                State.setTimeGranularity(btn.dataset.value);
            });
        });
    },

    initYearSlider() {
        const sliderEl = document.getElementById('year-slider');
        if (!sliderEl) return;

        this.slider = noUiSlider.create(sliderEl, {
            start: [CONFIG.MIN_YEAR, CONFIG.MAX_YEAR],
            connect: true,
            step: 1,
            range: {
                'min': CONFIG.MIN_YEAR,
                'max': CONFIG.MAX_YEAR
            },
            format: {
                to: value => Math.round(value),
                from: value => Math.round(value)
            }
        });

        const display = document.getElementById('year-range-display');

        this.slider.on('update', (values) => {
            const [min, max] = values.map(v => parseInt(v));
            if (display) {
                display.textContent = `${min} – ${max}`;
            }
        });

        this.slider.on('change', (values) => {
            const [min, max] = values.map(v => parseInt(v));
            State.setYearRange(min, max);
        });
    },

    initTopNToggle() {
        const toggle = document.getElementById('topn-toggle');
        if (!toggle) return;

        const buttons = toggle.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                buttons.forEach(b => b.classList.remove('btn-active'));
                btn.classList.add('btn-active');

                // Update state
                State.setTopNMode(btn.dataset.value);
            });
        });
    },

    initRefreshButton() {
        const refreshBtn = document.getElementById('refresh-btn');
        const modal = document.getElementById('refresh-modal');
        const confirmBtn = document.getElementById('confirm-refresh');

        if (!refreshBtn || !modal) return;

        refreshBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });

        // Close modal handlers
        modal.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Refreshing...';

                try {
                    await API.refreshSnapshot();
                    modal.classList.add('hidden');
                    // Reload data
                    await State.loadAllData();
                    alert('Data snapshots refreshed successfully. Remember to commit and push the changes.');
                } catch (error) {
                    console.error('Failed to refresh:', error);
                    alert('Failed to refresh data: ' + (error.message || 'Unknown error'));
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Refresh Now';
                }
            });
        }
    },

    // Update slider to match state
    updateSlider(yearRange) {
        if (this.slider) {
            this.slider.set(yearRange);
        }
    }
};
