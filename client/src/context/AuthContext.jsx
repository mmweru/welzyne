import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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
  },
  saveLastVisitedRoute: (route) => {
    localStorage.setItem('lastVisitedRoute', route);
  },
  getLastVisitedRoute: () => {
    return localStorage.getItem('lastVisitedRoute') || '/';
  }
};

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : import.meta.env.VITE_API_URL,
  withCredentials: true
});

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage - this is key to persist through refreshes
  const [user, setUser] = useState(persistentStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Set up axios request interceptor to always include the token
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

  // Set up axios response interceptor to handle errors
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      response => {
        // Check if there's a new token in the headers
        const newToken = response.headers['x-new-token'];
        if (newToken) {
          localStorage.setItem('token', newToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        }
        return response;
      },
      error => {
        // Don't automatically log out on auth errors
        if (error.response && error.response.status === 401) {
          console.log('401 error detected, but not logging out');
          // We're not automatically logging out anymore
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Custom setter that also persists to localStorage
  const setUserWithPersistence = useCallback((userData) => {
    setUser(userData);
    if (userData) {
      persistentStorage.saveUser(userData);
    } else {
      persistentStorage.clearUser();
    }
  }, []);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const savedUser = persistentStorage.getUser();
        
        if (!token) {
          // No token, clear any stale user data
          setUserWithPersistence(null);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        // Set API authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // If we have saved user data, use it immediately
        if (savedUser) {
          setUserWithPersistence(savedUser);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        // If no saved user data but we have token, try to validate token
        try {
          const response = await api.get('/auth/validate');
          if (response.data && !response.data.temporaryAccess) {
            setUserWithPersistence(response.data);
          }
        } catch (error) {
          console.log('Token validation error:', error);
          // If validation fails, clear the token 
          localStorage.removeItem('token');
          setUserWithPersistence(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    checkAuthStatus();
  }, [setUserWithPersistence]);

  const validateToken = useCallback(async () => {
    try {
      const response = await api.get('/auth/validate');
      
      if (response.data && !response.data.temporaryAccess) {
        setUserWithPersistence(response.data);
      }
      return true;
    } catch (error) {
      console.log('Token validation error:', error.response?.data || error.message);
      return false;
    }
  }, [setUserWithPersistence]);

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserWithPersistence(user);
      setAuthError(null);
      return { success: true, user };
    } catch (error) {
      setAuthError(error.response?.data?.message || 'Login failed');
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
      setAuthError(null);
      return { success: true };
    } catch (error) {
      setAuthError(error.response?.data?.message || 'Registration failed');
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
    setAuthError(null);
  };

  const hasRole = useCallback((requiredRoles) => {
    if (!user) return false;
    
    // If no roles are required, return true
    if (!requiredRoles || requiredRoles.length === 0) return true;
    
    // Admin role has access to everything
    if (user.role === 'admin') return true;
    
    // Check if user's role is in the required roles
    return Array.isArray(requiredRoles) 
      ? requiredRoles.includes(user.role) 
      : user.role === requiredRoles;
  }, [user]);

  const saveLastVisitedRoute = useCallback((route) => {
    persistentStorage.saveLastVisitedRoute(route);
  }, []);

  const getLastVisitedRoute = useCallback(() => {
    return persistentStorage.getLastVisitedRoute();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      initialized,
      authError,
      login,
      register,
      logout,
      hasRole,
      validateToken,
      saveLastVisitedRoute,
      getLastVisitedRoute
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