import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Homepage from './homepage';
import WhoWeAre from './whoweare';
import TrackPackage from './TrackPackage';
import Login from './login';
import Signup from './signup';
import ProtectedRoute from './context/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import UserDashboard from './UserDashboard';
import AdminDashboard from './AdminDashboard';
import Unauthorized from './Unauthorized';
import './style.css';

// This component handles route restoration after refresh
const RouteHandler = ({ children }) => {
  const { user, loading, initialized, getLastVisitedRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only do this if we're on the unauthorized page and we came from a refresh
    if (location.pathname === '/unauthorized' && 
        !location.state?.fromDirectNavigation && 
        initialized && !loading) {
      
      const lastVisitedRoute = getLastVisitedRoute();
      const hasToken = !!localStorage.getItem('token');
      
      // If we have a token and we're not at login/unauthorized by user choice,
      // try to restore the last route
      if (hasToken && lastVisitedRoute && lastVisitedRoute !== '/unauthorized') {
        console.log('Attempting to restore route:', lastVisitedRoute);
        // Use a short timeout to allow the auth context to fully initialize
        setTimeout(() => {
          navigate(lastVisitedRoute, { replace: true });
        }, 100);
      }
    }
  }, [navigate, initialized, loading, location, getLastVisitedRoute]);

  return children;
};

const AppContent = () => {
  return (
    <RouteHandler>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/whoweare" element={<WhoWeAre />} />
        <Route path="/track" element={<TrackPackage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute roles={['user', 'admin']}>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/unauthorized" 
          element={<Unauthorized />}
        />
      </Routes>
    </RouteHandler>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;
