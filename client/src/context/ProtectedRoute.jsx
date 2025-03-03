import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, initialized, hasRole } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = () => {
      const hasToken = !!localStorage.getItem('token');
      
      if (!hasToken) {
        setIsAuthorized(false);
        return;
      }
      
      if (!roles) {
        setIsAuthorized(true);
        return;
      }
      
      if (user) {
        setIsAuthorized(hasRole(roles));
        return;
      }
      
      setIsAuthorized(true);
    };

    if (initialized) {
      checkAuthorization();
    }
  }, [initialized, user, roles, hasRole]);

  if (loading || !initialized) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Verifying your access...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    if (!localStorage.getItem('token')) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    if (roles && user) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;