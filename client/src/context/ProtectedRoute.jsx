import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Adjust the path as needed

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole, validateToken } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateAuth = async () => {
      if (initialized && !user && localStorage.getItem('token')) {
        await validateToken();
      }
      setIsValidating(false);
    };

    validateAuth();
  }, [initialized, user, validateToken]);

  // Show loading state during initial load or token validation
  if (loading || isValidating) {
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
  else if (roles && !hasRole(roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized, render the protected content
  return children;
};

export default ProtectedRoute;