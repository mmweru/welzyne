import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InitialLoadingState from './InitialLoadingState';

// Lazy load your components for better performance
const Homepage = React.lazy(() => import('./homepage'));
const WhoWeAre = React.lazy(() => import('./whoweare'));
const TrackPackage = React.lazy(() => import('./TrackPackage'));
const Login = React.lazy(() => import('./login'));
const Signup = React.lazy(() => import('./signup'));
const UserDashboard = React.lazy(() => import('./UserDashboard'));
const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const Unauthorized = React.lazy(() => import('./Unauthorized'));

import ProtectedRoute from './context/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './style.css';

const App = () => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Remove initial loading state after a short delay
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 2500); // Slightly longer than the loading animation

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {isInitialLoad && <InitialLoadingState />}
      
      <AuthProvider>
        <Router>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {/* Your existing routes remain the same */}
              <Route path="/" element={<Homepage />} />
              <Route path="/who-we-are" element={<WhoWeAre />} />
              <Route path="/track-a-package" element={<TrackPackage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Admin only route */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
                
              {/* User route - accessible by users and admins */}
              <Route 
                path="/user" 
                element={
                  <ProtectedRoute roles={['user', 'admin']}>
                    <UserDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Protected guest route */}
              <Route path='/guest' element={
                <ProtectedRoute roles={['guest', 'user', 'admin']}>
                  <Homepage />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </>
  );
};

export default App;