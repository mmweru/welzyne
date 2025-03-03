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
        // Only handle critical authentication errors
        // DON'T handle validation endpoint errors
        if (error.response && 
            error.response.status === 401 && 
            error.config.url !== '/auth/validate' &&
            !error.config.url.includes('/auth')) {
          console.log('Critical 401 error detected, but not logging out');
          // We're not automatically logging out anymore
          setAuthError('Authentication failed, but your session will be maintained.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Custom setter that also persists to localStorage
  const setUserWithPersistence = (userData) => {
    setUser(userData);
    if (userData) {
      persistentStorage.saveUser(userData);
    } else {
      persistentStorage.clearUser();
    }
  };

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const savedUser = persistentStorage.getUser();
      
      // If we have both token and saved user data, set the user immediately
      if (token && savedUser) {
        setUser(savedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Try to validate in the background, but don't wait for it
        validateToken().catch(err => {
          console.log('Background validation error:', err);
          // Don't log out automatically, just log the error
        });
      } else if (token) {
        // We have token but no saved user data, try to get user data
        try {
          const response = await api.get('/auth/validate');
          if (response.data && !response.data.temporaryAccess) {
            setUserWithPersistence(response.data);
          } else {
            // If we got temporary access or empty data, still use the token
            console.log('Using token with temporary access');
          }
        } catch (error) {
          console.log('Token validation error, but keeping token:', error);
          // Don't remove token automatically
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
      
      // If response is successful, update user data
      if (response.data && !response.data.temporaryAccess) {
        setUserWithPersistence(response.data);
      }
      return true;
    } catch (error) {
      console.log('Token validation error:', error.response?.data || error.message);
      // Don't automatically remove token or log out the user
      // Return true to maintain the session
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

  const hasRole = (requiredRoles) => {
    if (!user) return false;
    
    // If no roles are required, return true
    if (!requiredRoles || requiredRoles.length === 0) return true;
    
    // Admin role has access to everything
    if (user.role === 'admin') return true;
    
    // Check if user's role is in the required roles
    return Array.isArray(requiredRoles) ? requiredRoles.includes(user.role) : user.role === requiredRoles;
  };

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
      saveLastVisitedRoute: persistentStorage.saveLastVisitedRoute,
      getLastVisitedRoute: persistentStorage.getLastVisitedRoute
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