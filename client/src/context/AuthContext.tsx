'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';
import * as authService from '@/services/auth';

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
      const response = await api.get('/api/auth/me');
      
      console.log('Received user data:', response.data);
      if (!response.data.error) {
        setUser(response.data);
        console.log('User data set successfully');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Check if we're on a Maps page - don't remove token automatically if so
      if (typeof window !== 'undefined' && window.location.pathname.includes('/maps')) {
        console.log('Error fetching user data while on Maps page - preserving token');
        // Keep the token but clear user state
        setUser(null);
      } else {
        // Not on Maps page, handle normally by removing token
        localStorage.removeItem('token');
        setUser(null);
      }
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

  const login = async (emailOrUsername: string, password: string) => {
    try {
      console.log('Attempting login...');
      const userData = await authService.login(emailOrUsername, password);
      console.log('Login successful:', userData);
      
      // Token is already saved by auth service
      // Fetch fresh user data
      const token = localStorage.getItem('token');
      if (token) {
        await fetchUserData(token);
      }

      // Dispatch storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'token',
        newValue: token
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
    authService.logout();
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