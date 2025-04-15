import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '@/config/api';

// Create axios instance with proper base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(request => {
  console.log('Auth Service Request:', {
    url: request.url,
    baseURL: request.baseURL,
    method: request.method,
    headers: request.headers,
    data: request.data
  });
  return request;
});

// Check if token is expired (or will expire soon)
export const isTokenExpiring = () => {
  const token = localStorage.getItem('token');
  if (!token) return true;
  
  try {
    // Decode the JWT token (without verification)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    
    // Check if token expires in less than 1 hour
    const currentTime = Math.floor(Date.now() / 1000);
    const bufferTime = 60 * 60; // 1 hour buffer
    
    const isExpiring = payload.exp < (currentTime + bufferTime);
    
    // Log expiration details for debugging
    if (isExpiring) {
      const expiryDate = new Date(payload.exp * 1000);
      const timeUntilExpiry = Math.floor((payload.exp - currentTime) / 60); // minutes
      console.log(`Token expires on ${expiryDate.toISOString()}, in ${timeUntilExpiry} minutes`);
    }
    
    return isExpiring;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

// Refresh token by using current user info
export const refreshToken = async () => {
  try {
    // Only proceed if there's a token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token to refresh');
    }
    
    console.log('Attempting to refresh token');
    // Call a refresh token endpoint (needs to be implemented on server)
    const response = await api.post('/api/auth/refresh', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data.token) {
      // Update token in localStorage
      localStorage.setItem('token', response.data.token);
      console.log('Token refreshed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    // Don't automatically remove token here
    return false;
  }
};

export const login = async (emailOrUsername: string, password: string) => {
  try {
    console.log('Login attempt:', {
      url: '/api/auth/login',
      data: { login: emailOrUsername }
    });

    const response = await api.post('/api/auth/login', { 
      login: emailOrUsername,
      password 
    });

    console.log('Login response:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });

    const { token, ...user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error) {
    console.error('Login error details:', {
      error: error instanceof AxiosError ? {
        config: error.config,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      } : error
    });

    if (error instanceof AxiosError && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Login failed. Please try again.');
  }
};

export const register = async (username: string, email: string, password: string) => {
  try {
    const response = await api.post('/api/auth/register', { username, email, password });
    const { token, ...user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Registration failed. Please try again.');
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  return null;
};