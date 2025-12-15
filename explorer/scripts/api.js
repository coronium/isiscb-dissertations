// API client for Dissertations Explorer

const API = {
    token: null,

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    },

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('auth_token');
        }
        return this.token;
    },

    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle 401 - unauthorized
            if (response.status === 401) {
                this.setToken(null);
                window.location.reload();
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            console.error('API error:', error);
            throw error;
        }
    },

    // Auth
    async loginViewer(accessCode) {
        return this.request('/api/auth/viewer', {
            method: 'POST',
            body: JSON.stringify({ accessCode })
        });
    },

    async logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
    },

    async getMe() {
        return this.request('/api/auth/me');
    },

    // Explorer endpoints
    async getSnapshotMeta() {
        return this.request('/api/explorer/snapshot/meta');
    },

    async refreshSnapshot() {
        return this.request('/api/explorer/refresh-snapshot', {
            method: 'POST'
        });
    },

    async getSchoolComparison(schools) {
        const query = new URLSearchParams();
        query.append('schools', schools.join(','));
        return this.request(`/api/explorer/schools/compare?${query.toString()}`);
    },

    // Load static snapshot files
    async loadSnapshot(filename) {
        const url = `${CONFIG.DATA_PATH}/${filename}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}`);
            }
            return response.json();
        } catch (error) {
            console.error(`Error loading snapshot ${filename}:`, error);
            throw error;
        }
    },

    async loadTimeline() {
        return this.loadSnapshot('timeline.json');
    },

    async loadSchools() {
        return this.loadSnapshot('schools.json');
    },

    async loadStatistics() {
        return this.loadSnapshot('statistics.json');
    },

    async loadMeta() {
        return this.loadSnapshot('meta.json');
    },

    async loadSchoolTimeseries() {
        return this.loadSnapshot('school_timeseries.json');
    }
};
