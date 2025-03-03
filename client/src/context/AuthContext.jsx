import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Create a persistent user storage helper
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
  }
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

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(config => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.response && 
            error.response.status === 401 && 
            error.config.url !== '/auth/validate' &&
            !error.config.url.includes('/auth')) {
          console.log('Critical 401 error detected, may need to log out');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const setUserWithPersistence = (userData) => {
    setUser(userData);
    if (userData) {
      persistentStorage.saveUser(userData);
    } else {
      persistentStorage.clearUser();
    }
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const savedUser = persistentStorage.getUser();
      
      if (token && savedUser) {
        setUser(savedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        validateToken().catch(err => {
          console.log('Background validation error:', err);
        });
      } else if (token) {
        try {
          const response = await api.get('/auth/validate');
          setUserWithPersistence(response.data);
        } catch (error) {
          console.log('Token validation error, but keeping token:', error);
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
      setUserWithPersistence(response.data);
      return true;
    } catch (error) {
      console.log('Token validation error:', error.response?.data || error.message);
      return true;
    }
  };

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserWithPersistence(user);
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
      setUserWithPersistence(user);
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
    persistentStorage.clearUser();
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