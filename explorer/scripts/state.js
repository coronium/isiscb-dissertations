// Centralized state management for Dissertations Explorer

const State = {
    // Current control values
    timeGranularity: CONFIG.DEFAULT_GRANULARITY,  // 'year', '5year', 'decade'
    yearRange: [CONFIG.MIN_YEAR, CONFIG.MAX_YEAR],
    selectedSchools: [],  // Up to 5 for comparison
    topNMode: '10',       // '10', '25', '50' (percent)

    // Filters (placeholders for future)
    filters: {
        department_broad: null,
        subject_broad: null
    },

    // Loaded data
    data: {
        timeline: null,
        schools: null,
        statistics: null,
        meta: null,
        schoolTimeseries: null  // For racing bar chart
    },

    // Event system
    listeners: {},

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    },

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    },

    // State updates
    setTimeGranularity(value) {
        if (this.timeGranularity !== value) {
            this.timeGranularity = value;
            this.emit('granularityChange', value);
        }
    },

    setYearRange(min, max) {
        if (this.yearRange[0] !== min || this.yearRange[1] !== max) {
            this.yearRange = [min, max];
            this.emit('yearRangeChange', this.yearRange);
        }
    },

    toggleSchool(schoolName) {
        const index = this.selectedSchools.indexOf(schoolName);
        if (index === -1) {
            if (this.selectedSchools.length < CONFIG.MAX_SCHOOLS_COMPARE) {
                this.selectedSchools.push(schoolName);
                this.emit('schoolsChange', this.selectedSchools);
            }
        } else {
            this.selectedSchools.splice(index, 1);
            this.emit('schoolsChange', this.selectedSchools);
        }
    },

    clearSelectedSchools() {
        this.selectedSchools = [];
        this.emit('schoolsChange', this.selectedSchools);
    },

    setTopNMode(value) {
        if (this.topNMode !== value) {
            this.topNMode = value;
            this.emit('topNModeChange', value);
        }
    },

    // Data loading
    async loadAllData() {
        try {
            const [timeline, schools, statistics, meta, schoolTimeseries] = await Promise.all([
                API.loadTimeline(),
                API.loadSchools(),
                API.loadStatistics(),
                API.loadMeta(),
                API.loadSchoolTimeseries()
            ]);

            this.data.timeline = timeline;
            this.data.schools = schools;
            this.data.statistics = statistics;
            this.data.meta = meta;
            this.data.schoolTimeseries = schoolTimeseries;

            this.emit('dataLoaded', this.data);
            return this.data;
        } catch (error) {
            console.error('Failed to load data:', error);
            this.emit('dataError', error);
            throw error;
        }
    },

    // Get filtered timeline data based on current settings
    getFilteredTimeline() {
        if (!this.data.timeline) return null;

        const granularityKey = {
            'year': 'by_year',
            '5year': 'by_5year',
            'decade': 'by_decade'
        }[this.timeGranularity];

        const data = this.data.timeline[granularityKey];
        if (!data) return null;

        // Filter by year range
        return data.filter(d => {
            const year = d.year || d.start;
            return year >= this.yearRange[0] && year <= this.yearRange[1];
        });
    },

    // Get filtered schools based on current year range
    getFilteredSchools() {
        if (!this.data.schools) return null;

        // For now, return all schools (year filtering would require per-school year data)
        return this.data.schools.schools;
    },

    // Get school color by index
    getSchoolColor(schoolName) {
        const index = this.selectedSchools.indexOf(schoolName);
        if (index === -1) return CONFIG.COLORS.muted;
        return CONFIG.COLORS.schools[index % CONFIG.COLORS.schools.length];
    }
};
