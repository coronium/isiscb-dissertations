// Authentication module for Dissertations Explorer

const Auth = {
    user: null,

    async init() {
        const token = API.getToken();
        if (token) {
            try {
                this.user = await API.getMe();
                return true;
            } catch (error) {
                API.setToken(null);
                return false;
            }
        }
        return false;
    },

    isAuthenticated() {
        return this.user !== null;
    },

    isEditor() {
        return this.user && this.user.userType === 'editor';
    },

    getUsername() {
        return this.user ? this.user.username : null;
    },

    getUserType() {
        return this.user ? this.user.userType : null;
    },

    async loginViewer(accessCode) {
        const result = await API.loginViewer(accessCode);
        API.setToken(result.token);
        this.user = { userType: result.userType };
        return result;
    },

    async logout() {
        await API.logout();
        API.setToken(null);
        this.user = null;
    }
};
