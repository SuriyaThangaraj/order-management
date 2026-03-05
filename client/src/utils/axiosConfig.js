import axios from 'axios';

// Create an instance or configure the default instance
// For simplicity and to affect all direct axios calls, we configure the default.

axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Request Interceptor
axios.interceptors.request.use(
    (config) => {
        // Get user info from localStorage
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            const { token } = JSON.parse(userInfo);
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor (Optional: Handle 401s globally)
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Optional: Auto-logout or redirect
            // console.error("Unauthorized! Redirecting to login...");
        }
        return Promise.reject(error);
    }
);

export default axios;
