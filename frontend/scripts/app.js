// Main application entry point

const App = {
    async init() {
        // Check authentication
        const isAuthenticated = await Auth.init();

        if (isAuthenticated) {
            this.showApp();
        } else {
            this.showLogin();
        }

        this.bindLoginEvents();
    },

    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app-page').classList.add('hidden');
        document.getElementById('editor-page').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-page').classList.remove('hidden');

        // Update UI based on user type
        const isEditor = Auth.isEditor();
        const username = Auth.getUsername();

        document.getElementById('user-display').textContent =
            isEditor ? username : 'Viewer';

        // Show/hide editor-only elements
        document.querySelectorAll('.editor-only').forEach(el => {
            el.classList.toggle('hidden', !isEditor);
        });

        // Initialize search and editor
        Search.init();
        Editor.init();
    },

    bindLoginEvents() {
        // Viewer login
        document.getElementById('viewer-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const accessCode = document.getElementById('access-code').value;

            try {
                await Auth.loginViewer(accessCode);
                this.showApp();
            } catch (error) {
                this.showLoginError(error.error || 'Invalid access code');
            }
        });

        // Editor login
        document.getElementById('editor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                await Auth.loginEditor(username, password);
                this.showApp();
            } catch (error) {
                this.showLoginError(error.error || 'Invalid credentials');
            }
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await Auth.logout();
            this.showLogin();
        });
    },

    showLoginError(message) {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
