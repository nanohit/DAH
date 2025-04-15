import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the JWT token to requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Only handle errors in browser environment
    if (typeof window !== 'undefined') {
      // Only handle 401 errors from actual API requests (not from auth endpoints)
      const isAuthEndpoint = error.config?.url?.includes('/api/auth/');
      
      if (error.response?.status === 401 && !isAuthEndpoint) {
        console.log('401 error detected in API response but not removing token');
        
        // Don't automatically remove the token for 401 errors in Maps
        if (!window.location.pathname.includes('/maps')) {
          // For non-Maps routes, we can handle 401 normally
          console.log('Non-maps route, handling 401 normally');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } else {
          console.log('Maps route detected, preserving token despite 401');
          // Optional: you could refresh the token here if you implement that feature
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;