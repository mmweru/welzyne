import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Adjust path as needed

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Simple function to check if the user is allowed to access this route
    const checkAuthorization = () => {
      // First check if we have a token (for authentication)
      const hasToken = !!localStorage.getItem('token');
      
      // If no token, clearly not authorized
      if (!hasToken) {
        setIsAuthorized(false);
        return;
      }
      
      // If we have a token but no specific roles required, the user is authorized
      if (!roles) {
        setIsAuthorized(true);
        return;
      }
      
      // If we have roles to check and we have user data, check role-based access
      if (user) {
        setIsAuthorized(hasRole(roles));
        return;
      }
      
      // If we have a token but no user data yet, assume authorized
      // (this handles the refresh case where token exists but user data not loaded yet)
      setIsAuthorized(true);
    };

    if (initialized) {
      checkAuthorization();
    }
  }, [initialized, user, roles, hasRole]);

  // Show loading during initialization
  if (loading || !initialized) {
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
    
    // Has token but role check failed
    if (roles && user) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authorized, render the protected content
  return children;
};

export default ProtectedRoute;