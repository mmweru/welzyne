import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Adjust the path as needed

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole, validateToken } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [validationComplete, setValidationComplete] = useState(false);

  useEffect(() => {
    // Only try to validate if we're initialized but not authenticated yet
    if (initialized && !user && localStorage.getItem('token')) {
      setIsValidating(true);
      validateToken()
        .then(() => {
          setValidationComplete(true);
          setIsValidating(false);
        })
        .catch(() => {
          setValidationComplete(true);
          setIsValidating(false);
        });
    } else {
      setValidationComplete(true);
      setIsValidating(false);
    }
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

  // Wait until validation is complete before making access decisions
  if (!validationComplete) {
    return null;
  }

  // Redirect to login if not authenticated (only after initialized and validation complete)
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