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

  // Set up axios interceptor to handle token refresh
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => {
        // Check if the server sent us a new token
        const newToken = response.headers['x-new-token'];
        if (newToken) {
          console.log('Received new token from server, updating local storage');
          localStorage.setItem('token', newToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        }
        return response;
      },
      error => {
        // Don't automatically logout on validation endpoint errors
        if (error.response && error.response.status === 401 && 
            error.config.url !== '/auth/validate') {
          console.log('401 error detected on non-validation endpoint, logging out');
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
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
          
          // Only clear token on specific authentication errors
          // Keep the token for network errors or server errors
          if (error.response && error.response.status === 401) {
            // Check if it's a specific token error that should log out the user
            const errorMsg = error.response.data?.message || '';
            const forceLogout = 
              errorMsg.includes('invalid signature') || 
              errorMsg.includes('malformed');
            
            if (forceLogout) {
              console.log('Critical token error, removing token');
              localStorage.removeItem('token');
              delete api.defaults.headers.common['Authorization'];
              setUser(null);
            } else {
              console.log('Non-critical validation error, keeping session');
              // Keep the existing token for now, user might still be valid
            }
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
      
      // Be more selective about when to remove the token
      if (error.response && error.response.status === 401) {
        const errorMsg = error.response.data?.message || '';
        
        // Only remove token for specific critical errors
        if (errorMsg.includes('invalid signature') || 
            errorMsg.includes('malformed') || 
            errorMsg.includes('User not found')) {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
        }
      }
      
      // For temporary issues like network errors, don't invalidate the session
      return error.response?.status !== 401;
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