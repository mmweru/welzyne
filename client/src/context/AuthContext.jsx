// AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Create a persistent user storage helper
const persistentStorage = {
  saveUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to save user to localStorage:', error);
    }
  },
  getUser: () => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error('Failed to retrieve user from localStorage:', error);
      return null;
    }
  },
  clearUser: () => {
    try {
      localStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Failed to clear user from localStorage:', error);
    }
  },
  saveLastVisitedRoute: (route) => {
    try {
      localStorage.setItem('lastVisitedRoute', route);
    } catch (error) {
      console.error('Failed to save last visited route:', error);
    }
  },
  getLastVisitedRoute: () => {
    try {
      return localStorage.getItem('lastVisitedRoute') || '/';
    } catch (error) {
      console.error('Failed to retrieve last visited route:', error);
      return '/';
    }
  }
};

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://courier-mrh5.onrender.com/' 
    : import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(persistentStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Set up axios request interceptor to include the token
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
        const newToken = response.headers['x-new-token'];
        if (newToken) {
          localStorage.setItem('token', newToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        }
        return response;
      },
      error => {
        if (error.response && error.response.status === 401) {
          console.log('401 error detected, but not logging out');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Custom setter that persists to localStorage
  const setUserWithPersistence = useCallback((userData) => {
    setUser(userData);
    persistentStorage.saveUser(userData);
  }, []);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const savedUser = persistentStorage.getUser();
        
        if (!token) {
          setUserWithPersistence(null);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        if (savedUser) {
          setUserWithPersistence(savedUser);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        try {
          const response = await api.get('/auth/validate');
          if (response.data && !response.data.temporaryAccess) {
            setUserWithPersistence(response.data);
          }
        } catch (error) {
          console.log('Token validation error:', error);
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

  // Updated updateProfile to handle FormData and photo uploads
  const updateProfile = async (profileData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found. Please log in again.'
        };
      }
      
      let formDataToSend;
      let headers = { Authorization: `Bearer ${token}` };
      
      // If profileData is already FormData (for photo uploads), use it directly
      if (profileData instanceof FormData) {
        formDataToSend = profileData;
        headers['Content-Type'] = 'multipart/form-data';
      } else {
        // Basic validations for regular profile updates
        const { username, email, phone } = profileData;
        
        if (!username || username.length < 2) {
          return {
            success: false,
            error: 'Username must be at least 2 characters long.'
          };
        }
    
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
          return {
            success: false,
            error: 'Please provide a valid email address.'
          };
        }
    
        if (phone && !/^\+?[\d\s()-]{10,}$/.test(phone)) {
          return {
            success: false,
            error: 'Please provide a valid phone number.'
          };
        }
        
        formDataToSend = profileData;
      }
      
      // Make API request - notice we're using /users/profile (not /api/users/profile)
      const response = await api.put('/users/profile', formDataToSend, { headers });
      
      if (response.data && response.data.user) {
        const updatedUser = response.data.user;
        const mergedUser = { ...user, ...updatedUser };
        
        setUserWithPersistence(mergedUser);
        
        return { 
          success: true, 
          message: 'Profile updated successfully',
          user: mergedUser
        };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
        'Failed to update profile. Please check your connection and try again.';
      
      console.error('Profile update error:', error.response || errorMessage);
      
      return {
        success: false,
        error: errorMessage
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
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (user.role === 'admin') return true;
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
      updateProfile,
      hasRole,
      validateToken,
      saveLastVisitedRoute,
      getLastVisitedRoute,
      setUser: setUserWithPersistence // Export the setUser function to update context after profile changes
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