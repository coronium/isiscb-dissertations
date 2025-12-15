// Main application entry point for Dissertations Explorer

const App = {
    async init() {
        // Check authentication
        const isAuth = await Auth.init();

        if (isAuth) {
            this.showApp();
        } else {
            this.showLogin();
        }

        this.bindLoginEvents();
    },

    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app-page').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-page').classList.remove('hidden');

        // Update user display
        const userDisplay = document.getElementById('user-display');
        if (userDisplay) {
            const userType = Auth.getUserType();
            userDisplay.textContent = userType === 'editor' ? `Editor: ${Auth.getUsername()}` : 'Viewer';
        }

        // Show/hide editor-only elements
        const editorElements = document.querySelectorAll('.editor-only');
        editorElements.forEach(el => {
            if (Auth.isEditor()) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        // Initialize components and load data
        this.initializeApp();
    },

    async initializeApp() {
        // Initialize controls
        Controls.init();

        // Initialize components
        SchoolSelector.init();

        // Initialize charts
        TimelineChart.init();
        SchoolComparisonChart.init();
        ParetoChart.init();
        TopShareChart.init();
        BumpChart.init();
        Streamgraph.init();
        GeoMap.init();
        RacingBarChart.init();

        // Bind logout
        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            await Auth.logout();
            window.location.reload();
        });

        // Load data
        try {
            await State.loadAllData();
            this.showVisualizations();
            // Trigger initial render after visualizations are visible
            // (charts need non-zero container dimensions)
            State.emit('dataLoaded', State.data);
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showDataError(error);
        }
    },

    showVisualizations() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('visualizations').classList.remove('hidden');
    },

    showDataError(error) {
        document.getElementById('loading').innerHTML = `
            <div class="error-state">
                <p class="text-error">Failed to load visualization data</p>
                <p class="text-muted text-small">${error.message || 'Unknown error'}</p>
                <p class="text-muted text-small mt-2">
                    Make sure the data snapshots have been generated.<br>
                    Editors can use the "Refresh Data" button after logging in.
                </p>
            </div>
        `;
    },

    bindLoginEvents() {
        const viewerForm = document.getElementById('viewer-form');
        const errorDiv = document.getElementById('login-error');

        viewerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.classList.add('hidden');

            const accessCode = document.getElementById('access-code').value;

            try {
                await Auth.loginViewer(accessCode);
                this.showApp();
            } catch (error) {
                errorDiv.textContent = error.error || 'Invalid access code';
                errorDiv.classList.remove('hidden');
            }
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
