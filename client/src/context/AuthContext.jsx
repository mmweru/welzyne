import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Persistent storage helper
const persistentStorage = {
  saveUser: (user) => {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
  },
  getUser: () => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  },
  clearUser: () => {
    localStorage.removeItem('currentUser');
  },
  saveToken: (token) => {
    localStorage.setItem('token', token);
  },
  getToken: () => {
    return localStorage.getItem('token');
  },
  clearToken: () => {
    localStorage.removeItem('token');
  },
};

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : import.meta.env.VITE_API_URL,
  withCredentials: true
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(persistentStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Set up axios request interceptor to include the token
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(config => {
      const token = persistentStorage.getToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  // Custom setter to persist user data
  const setUserWithPersistence = useCallback((userData) => {
    setUser(userData);
    persistentStorage.saveUser(userData);
  }, []);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      const token = persistentStorage.getToken();
      const savedUser = persistentStorage.getUser();

      if (token && savedUser) {
        // Set user immediately if token and saved user exist
        setUserWithPersistence(savedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Validate token in the background
        try {
          const response = await api.get('/auth/validate');
          if (response.data) {
            setUserWithPersistence(response.data);
          }
        } catch (error) {
          console.error('Token validation error:', error);
        }
      } else if (token) {
        // If only token exists, fetch user data
        try {
          const response = await api.get('/auth/validate');
          if (response.data) {
            setUserWithPersistence(response.data);
          }
        } catch (error) {
          console.error('Token validation error:', error);
        }
      } else {
        // No token, clear user data
        setUserWithPersistence(null);
      }

      setLoading(false);
      setInitialized(true);
    };

    checkAuthStatus();
  }, [setUserWithPersistence]);

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;

      persistentStorage.saveToken(token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserWithPersistence(user);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const logout = () => {
    persistentStorage.clearToken();
    persistentStorage.clearUser();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const hasRole = useCallback((requiredRoles) => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialized,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};