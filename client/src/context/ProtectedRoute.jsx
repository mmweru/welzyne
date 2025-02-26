// src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Make sure the path is correct

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, hasRole, validateToken } = useAuth();
  const location = useLocation();
  const [validating, setValidating] = useState(false);

  // This effect runs when the component mounts
  // It ensures we have the latest user data on route changes
  useEffect(() => {
    const checkAuth = async () => {
      if (!user && localStorage.getItem('token')) {
        setValidating(true);
        await validateToken();
        setValidating(false);
      }
    };
    
    checkAuth();
  }, [validateToken, user, location.pathname]);

  // Show loading state while authentication is being verified
  if (loading || validating) {
    return <div className="auth-loading">
      <div className="spinner"></div>
      <p>Verifying your access...</p>
    </div>;
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