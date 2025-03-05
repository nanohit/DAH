'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/auth';

interface User {
  _id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  badge?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setUser: (user: User | null) => void;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  setUser: () => {},
  login: async () => {},
  logout: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // Function to fetch user data
  const fetchUserData = async (token: string) => {
    try {
      console.log('Fetching user data with token:', token);
      const response = await api.get('/auth/me');
      
      console.log('Received user data:', response.data);
      if (!response.data.error) {
        setUser(response.data);
        console.log('User data set successfully');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  // Handle storage events (for cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          fetchUserData(e.newValue);
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initial auth check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserData(token);
    }
  }, []);

  const login = async (login: string, password: string) => {
    try {
      console.log('Attempting login...');
      const response = await api.post('/auth/login', { login, password });
      const data = response.data;
      
      console.log('Login response:', data);
      
      if (!data.token) {
        console.error('No token in response');
        throw new Error('No token received');
      }

      // Save token first
      localStorage.setItem('token', data.token);
      console.log('Token saved to localStorage');

      // Then fetch fresh user data
      await fetchUserData(data.token);

      // Dispatch storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'token',
        newValue: data.token
      }));
      console.log('Storage event dispatched');
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('token');
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    
    // Dispatch storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'token',
      newValue: null
    }));
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
    setUser,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};