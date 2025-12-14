// API client

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

    async loginEditor(username, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    async logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
    },

    async getMe() {
        return this.request('/api/auth/me');
    },

    // Dissertations
    async searchDissertations(params = {}) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '' && value !== null) {
                query.append(key, value);
            }
        }
        return this.request(`/api/dissertations?${query.toString()}`);
    },

    async getDissertation(id) {
        return this.request(`/api/dissertations/${encodeURIComponent(id)}`);
    },

    async createDissertation(data) {
        return this.request('/api/dissertations', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateDissertation(id, data) {
        return this.request(`/api/dissertations/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteDissertation(id, reason) {
        return this.request(`/api/dissertations/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            body: JSON.stringify({ reason })
        });
    },

    async getChangelog(id) {
        return this.request(`/api/dissertations/${encodeURIComponent(id)}/changelog`);
    },

    async suggestSchools(q) {
        return this.request(`/api/dissertations/schools/suggest?q=${encodeURIComponent(q)}`);
    },

    // Authorities
    async searchPersons(q) {
        return this.request(`/api/authorities/persons?q=${encodeURIComponent(q)}`);
    },

    async createPerson(data) {
        return this.request('/api/authorities/persons', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getPersonDissertations(id) {
        return this.request(`/api/authorities/persons/${encodeURIComponent(id)}/dissertations`);
    },

    async searchInstitutions(q) {
        return this.request(`/api/authorities/institutions?q=${encodeURIComponent(q)}`);
    },

    async createInstitution(data) {
        return this.request('/api/authorities/institutions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // Export
    async exportAll() {
        const token = this.getToken();
        const response = await fetch(`${CONFIG.API_URL}/api/export/csv`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response;
    },

    async exportFiltered(filters) {
        const token = this.getToken();
        const response = await fetch(`${CONFIG.API_URL}/api/export/csv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ filters })
        });
        return response;
    }
};
