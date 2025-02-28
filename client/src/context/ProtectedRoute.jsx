import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole, validateToken } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Only attempt token validation if we're initialized but don't have a user
    // and there's a token in localStorage
    if (initialized && !user && !loading && localStorage.getItem('token')) {
      validateToken();
    }
  }, [initialized, user, loading, validateToken]);

  // Show loading state during initial load or token validation
  if (loading || !initialized) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Verifying your access...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if roles are specified
  if (roles && !hasRole(roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized, render the protected content
  return children;
};

export default ProtectedRoute;