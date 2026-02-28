// ============================================
// SafeLink – Frontend API Client
// ============================================
const SafeLinkAPI = (function () {
    const BASE = '/api';
    let token = localStorage.getItem('safelink_token') || null;
    let currentUser = JSON.parse(localStorage.getItem('safelink_user') || 'null');

    function headers() {
        const h = { 'Content-Type': 'application/json' };
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    }

    async function request(method, path, body) {
        const opts = { method, headers: headers() };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${BASE}${path}`, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    function setAuth(t, u) {
        token = t;
        currentUser = u;
        localStorage.setItem('safelink_token', t);
        localStorage.setItem('safelink_user', JSON.stringify(u));
    }

    function clearAuth() {
        token = null;
        currentUser = null;
        localStorage.removeItem('safelink_token');
        localStorage.removeItem('safelink_user');
    }

    return {
        getToken: () => token,
        getUser: () => currentUser,
        isLoggedIn: () => !!token,

        // Auth
        register: async (email, password, name, phone) => {
            const data = await request('POST', '/auth/register', { email, password, name, phone });
            setAuth(data.token, data.user);
            return data;
        },
        login: async (email, password) => {
            const data = await request('POST', '/auth/login', { email, password });
            setAuth(data.token, data.user);
            return data;
        },
        logout: () => { clearAuth(); },

        // User
        getMe: () => request('GET', '/users/me'),
        updateMe: (data) => request('PUT', '/users/me', data),

        // Rides
        createRide: (data) => request('POST', '/rides', data),
        getRide: (id) => request('GET', `/rides/${id}`),
        updateLocation: (id, lat, lng, speed, heading) =>
            request('POST', `/rides/${id}/location`, { lat, lng, speed, heading }),
        endRide: (id) => request('POST', `/rides/${id}/end`),
        getSafetyScore: (id) => request('GET', `/rides/${id}/safety-score`),
        getAlerts: (id) => request('GET', `/rides/${id}/alerts`),

        // Utilities
        getNearbyUtilities: (lat, lng, type) =>
            request('GET', `/utilities/nearby?lat=${lat}&lng=${lng}${type ? `&type=${type}` : ''}`),

        // Incidents
        createIncident: (data) => request('POST', '/incidents', data),
        getMyIncidents: () => request('GET', '/incidents'),

        // Admin
        getAnalytics: () => request('GET', '/admin/analytics'),

        // Family
        getFamily: () => request('GET', '/family'),
        addFamily: (data) => request('POST', '/family', data),
        deleteFamily: (id) => request('DELETE', `/family/${id}`),
    };
})();
