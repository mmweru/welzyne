import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './homepage';
import WhoWeAre from './whoweare';
import TrackPackage from './TrackPackage';
import Login from './login';
import Signup from './signup';
import ProtectedRoute from './context/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import UserDashboard from './UserDashboard';
import AdminDashboard from './AdminDashboard';
import Unauthorized from './Unauthorized';
import './style.css';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes accessible to everyone */}
          <Route path="/" element={<Homepage />} />
          <Route path="/who-we-are" element={<WhoWeAre />} />
          <Route path="/track-a-package" element={<TrackPackage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin Dashboard - only accessible by admin (Welzyne) */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* User Dashboard - accessible by both admin and regular users */}
          <Route 
            path="/user" 
            element={
              <ProtectedRoute roles={['user', 'admin']}>
                <UserDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Guest route - accessible by admin, user, and guest roles */}
          <Route 
            path="/guest" 
            element={
              <ProtectedRoute roles={['admin', 'user', 'guest']}>
                <Homepage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;