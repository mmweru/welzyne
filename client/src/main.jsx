import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css'; // Optional, for global styles if needed
import { AuthProvider } from './context/AuthContext';



// Create the root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the app
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
