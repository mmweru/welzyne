import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading, initialized, hasRole, saveLastVisitedRoute } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Save current path on mount and when it changes
  useEffect(() => {
    if (location.pathname !== '/unauthorized' && location.pathname !== '/login') {
      saveLastVisitedRoute(location.pathname);
      console.log('Saved last route:', location.pathname);
    }
  }, [location.pathname, saveLastVisitedRoute]);

  useEffect(() => {
    // Function to check if the user is allowed to access this route
    const checkAuthorization = () => {
      // Check if we have a token (for authentication)
      const hasToken = !!localStorage.getItem('token');
      
      // If no token, clearly not authorized
      if (!hasToken) {
        setIsAuthorized(false);
        setAuthChecked(true);
        return;
      }
      
      // If we have user data, check role-based access
      if (user) {
        // Check if user has the required role
        const authorized = hasRole(roles);
        setIsAuthorized(authorized);
        setAuthChecked(true);
        return;
      }
      
      // If we have a token but user data is still loading, we'll wait
      if (hasToken && loading) {
        setIsAuthorized(false); // Don't assume authorized while loading
        setAuthChecked(false); // We haven't finished checking yet
        return;
      }
      
      // Default to not authorized if we can't confirm
      setIsAuthorized(false);
      setAuthChecked(true);
    };

    // Only run authorization check when initialized
    if (initialized) {
      checkAuthorization();
    }
  }, [initialized, user, roles, hasRole, loading]);

  // Show loading during initialization or when checking auth
  if (loading || !initialized || !authChecked) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Verifying your access...</p>
      </div>
    );
  }

  // Handle authorization result
  if (!isAuthorized) {
    // No token found, redirect to login
    if (!localStorage.getItem('token')) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    // Token exists but user doesn't have required role, redirect to unauthorized
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // User is authorized
  return children;
};

export default ProtectedRoute;