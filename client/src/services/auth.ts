import axios, { AxiosError } from 'axios';

// Create axios instance with relative base URL
const api = axios.create({
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