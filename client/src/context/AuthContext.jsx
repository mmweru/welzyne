import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Domain priority configuration
const DOMAIN_CONFIG = {
  primary: 'https://welzyne.com/api',
  fallback: 'https://welzyne.onrender.com/api',
  local: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  healthCheckEndpoint: '/health'
};

// Persistent storage helper
const persistentStorage = {
  saveUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('lastApiEndpoint', window.location.origin + '/api');
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
      localStorage.removeItem('token');
      localStorage.removeItem('lastApiEndpoint');
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
  },
  
  getLastApiEndpoint: () => {
    try {
      return localStorage.getItem('lastApiEndpoint');
    } catch (error) {
      console.error('Failed to retrieve last API endpoint:', error);
      return null;
    }
  }
};

// Health check function
const checkDomainAvailability = async (baseUrl) => {
  try {
    const response = await axios.get(`${baseUrl}${DOMAIN_CONFIG.healthCheckEndpoint}`, { 
      timeout: 3000 
    });
    return response.status === 200;
  } catch (error) {
    console.warn(`Health check failed for ${baseUrl}:`, error.message);
    return false;
  }
};

// Determine the best base URL to use
const determineBaseURL = async () => {
  if (process.env.NODE_ENV !== 'production') {
    return DOMAIN_CONFIG.local;
  }

  // Check if we have a cached endpoint that worked recently
  const lastWorkingEndpoint = persistentStorage.getLastApiEndpoint();
  if (lastWorkingEndpoint) {
    const isStillAvailable = await checkDomainAvailability(lastWorkingEndpoint);
    if (isStillAvailable) {
      return lastWorkingEndpoint;
    }
  }

  // Check primary domain first
  const isPrimaryAvailable = await checkDomainAvailability(DOMAIN_CONFIG.primary);
  if (isPrimaryAvailable) {
    return DOMAIN_CONFIG.primary;
  }

  // Fall back to render.com if primary is unavailable
  const isFallbackAvailable = await checkDomainAvailability(DOMAIN_CONFIG.fallback);
  if (isFallbackAvailable) {
    return DOMAIN_CONFIG.fallback;
  }

  // If both are down, default to primary (will fail gracefully)
  return DOMAIN_CONFIG.primary;
};

// Create axios instance with dynamic baseURL
const createApiInstance = async () => {
  const baseURL = await determineBaseURL();
  console.log(`Using API endpoint: ${baseURL}`);
  
  return axios.create({
    baseURL,
    withCredentials: true,
    timeout: 10000
  });
};

// Initialize api instance
let api = createApiInstance();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(persistentStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiInitialized, setApiInitialized] = useState(false);

  // Custom setter that persists to localStorage
  const setUserWithPersistence = useCallback((userData) => {
    setUser(userData);
    persistentStorage.saveUser(userData);
  }, []);

  // Initialize API and check endpoint on component mount
  useEffect(() => {
    let isMounted = true;
    
    const initializeApi = async () => {
      try {
        const apiInstance = await createApiInstance();
        if (isMounted) {
          setApiEndpoint(apiInstance.defaults.baseURL);
          setApiInitialized(true);
        }

        // Set up interceptors
        const requestInterceptor = apiInstance.interceptors.request.use(config => {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
          return config;
        });

        const responseInterceptor = apiInstance.interceptors.response.use(
          response => {
            const newToken = response.headers['x-new-token'];
            if (newToken) {
              localStorage.setItem('token', newToken);
              apiInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            }
            return response;
          },
          async (error) => {
            if (error.response && error.response.status === 401) {
              console.log('401 error detected, but not logging out');
            }
            
            // If the error is due to the endpoint being down, try to switch
            if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
              console.log('Endpoint might be down, attempting to switch...');
              try {
                const newApiInstance = await createApiInstance();
                api = newApiInstance;
                if (isMounted) {
                  setApiEndpoint(newApiInstance.defaults.baseURL);
                }
              } catch (switchError) {
                console.error('Failed to switch API endpoint:', switchError);
              }
            }
            
            return Promise.reject(error);
          }
        );

        // Store the api instance
        api = apiInstance;

        return () => {
          apiInstance.interceptors.request.eject(requestInterceptor);
          apiInstance.interceptors.response.eject(responseInterceptor);
        };
      } catch (error) {
        console.error('Failed to initialize API:', error);
        if (isMounted) {
          setApiInitialized(false);
        }
      }
    };

    initializeApi();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check authentication status after API is initialized
  useEffect(() => {
    if (!apiInitialized) return;

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
  }, [apiInitialized, setUserWithPersistence]);

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
      
      if (profileData instanceof FormData) {
        formDataToSend = profileData;
        headers['Content-Type'] = 'multipart/form-data';
      } else {
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

  const switchApiEndpoint = async () => {
    try {
      const newApiInstance = await createApiInstance();
      api = newApiInstance;
      setApiEndpoint(newApiInstance.defaults.baseURL);
      return true;
    } catch (error) {
      console.error('Failed to switch API endpoint:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      initialized,
      authError,
      apiEndpoint,
      apiInitialized,
      login,
      register,
      logout,
      updateProfile,
      hasRole,
      validateToken,
      saveLastVisitedRoute,
      getLastVisitedRoute,
      switchApiEndpoint,
      setUser: setUserWithPersistence
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