import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading, initialized, hasRole, saveLastVisitedRoute } = useAuth();
  const location = useLocation();

  // Save current path on mount and when it changes
  useEffect(() => {
    if (location.pathname !== '/unauthorized' && location.pathname !== '/login') {
      saveLastVisitedRoute(location.pathname);
      console.log('Saved last route:', location.pathname);
    }
  }, [location.pathname, saveLastVisitedRoute]);

  // Show loading indicator during initialization or when loading user data
  if (!initialized || loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Verifying your access...</p>
      </div>
    );
  }

  // Handle authorization after loading is complete
  const hasToken = !!localStorage.getItem('token');

  // No token, redirect to login
  if (!hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Has token but no user data (shouldn't happen after loading completes)
  if (!user) {
    // This could happen if token exists but user data couldn't be retrieved
    // We could either show loading again or redirect to login
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Retrieving your profile...</p>
      </div>
    );
  }

  // Check role-based authorization
  if (!hasRole(roles)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // User is authorized
  return children;
};

export default ProtectedRoute;