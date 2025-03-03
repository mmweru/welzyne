import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Adjust path as needed

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
    // Simple function to check if the user is allowed to access this route
    const checkAuthorization = () => {
      // First check if we have a token (for authentication)
      const hasToken = !!localStorage.getItem('token');
      
      // If no token, clearly not authorized
      if (!hasToken) {
        setIsAuthorized(false);
        setAuthChecked(true);
        return;
      }
      
      // If we have a token but no specific roles required, the user is authorized
      if (!roles || roles.length === 0) {
        setIsAuthorized(true);
        setAuthChecked(true);
        return;
      }
      
      // If we have roles to check and we have user data, check role-based access
      if (user) {
        // Use the hasRole function which has proper role checking logic
        const authorized = hasRole(roles);
        setIsAuthorized(authorized);
        setAuthChecked(true);
        return;
      }
      
      // If we have a token but no user data yet, be very lenient
      // This is especially important during page refreshes
      setIsAuthorized(true);
      setAuthChecked(true);
    };

    if (initialized) {
      checkAuthorization();
    }
  }, [initialized, user, roles, hasRole]);

  // Show loading during initialization
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
    
    // Has token but role check failed - only redirect if we have user data
    // and have explicitly determined they don't have the required role
    // This is much more lenient during page refreshes
    if (roles && roles.length > 0 && user && !hasRole(roles)) {
      console.log("Redirecting to unauthorized: User role doesn't match required roles");
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authorized or we're being lenient during initial load
  return children;
};

export default ProtectedRoute;