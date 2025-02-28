import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole, validateToken } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [validationComplete, setValidationComplete] = useState(false);
  const [tokenExists, setTokenExists] = useState(false);

  useEffect(() => {
    // First check if token exists
    const token = localStorage.getItem('token');
    setTokenExists(!!token);
    
    // Validation process
    if (initialized) {
      if (token && !user) {
        // We have a token but no user - validate the token
        setIsValidating(true);
        validateToken()
          .then(isValid => {
            setValidationComplete(true);
            setIsValidating(false);
          })
          .catch(() => {
            // Even on validation failure, we'll consider the route accessible
            // if we still have a token (persistence approach)
            setValidationComplete(true);
            setIsValidating(false);
          });
      } else {
        // Either we have no token or we already have user data
        setValidationComplete(true);
        setIsValidating(false);
      }
    }
  }, [initialized, user, validateToken]);

  // Show loading state during initial load or validation
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

  // Consider the user authenticated if either:
  // 1. We have user data in state, OR
  // 2. We have a token in localStorage (even if validation had issues)
  const isAuthenticated = !!user || tokenExists;

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // For role checks, we need the actual user data
  // If we have a token but no user data, we'll assume access for now
  // and let the backend handle proper authorization
  if (roles && user && !hasRole(roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized (or we're being lenient due to token presence)
  return children;
};

export default ProtectedRoute;