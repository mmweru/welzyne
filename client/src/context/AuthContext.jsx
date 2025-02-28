import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : import.meta.env.VITE_API_URL,
  withCredentials: true
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Set up axios interceptor to handle token expiration
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          // Only logout if it's truly an authentication error
          // and not just a validation error during initial load
          if (error.config.url !== '/auth/validate') {
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      // Clean up interceptor on unmount
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await api.get('/auth/validate');
          setUser(response.data);
        } catch (error) {
          console.error("Token validation failed:", error);
          // Only remove token if there's a clear authentication error
          if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
          }
        }
      }
      setLoading(false);
      setInitialized(true);
    };
    
    checkAuthStatus();
  }, []);

  const validateToken = async () => {
    try {
      const response = await api.get('/auth/validate');
      setUser(response.data);
      return true;
    } catch (error) {
      console.error("Token validation error:", error.response?.data || error.message);
      // Important: Only remove token if there's a clear authentication error
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
      }
      return false;
    }
  };

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const hasRole = (requiredRoles) => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      initialized,
      login,
      register,
      logout,
      hasRole,
      validateToken
    }}>
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