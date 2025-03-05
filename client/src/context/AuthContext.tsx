'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch user data, status:', response.status);
        throw new Error('Failed to fetch user data');
      }
      
      const data = await response.json();
      console.log('Received user data:', data);
      if (!data.error) {
        setUser(data);
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
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password })
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        console.error('Login response not OK:', errorData);
        throw new Error(errorData.message || 'Failed to login');
      }

      const data = await loginResponse.json();
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