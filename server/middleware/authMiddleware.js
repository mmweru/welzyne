// Improved authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const verifyToken = async (req, res, next) => {
  try {
    // Get token from authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded); // Debug decoded token
      
      // Find user by id from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.log('User not found but token was valid');
        // Instead of immediately returning 401, we could be more lenient here
        // For example, if the user was deleted but token is still valid
        return res.status(401).json({ message: 'User not found' });
      }

      // Add user to request
      req.user = user;
      console.log('User set on request:', {
        id: user._id,
        username: user.username,
        role: user.role
      });
      
      next();
    } catch (tokenError) {
      // Check if it's a token expiration error
      if (tokenError.name === 'TokenExpiredError') {
        console.log('Token expired, checking if we should extend session');
        
        // Try to decode without verification to get the user ID
        const decodedWithoutVerification = jwt.decode(token);
        
        if (decodedWithoutVerification && decodedWithoutVerification.id) {
          // Find user by ID
          const user = await User.findById(decodedWithoutVerification.id).select('-password');
          
          if (user) {
            // Option 1: Auto-refresh the token (create a new one)
            // This could be considered a security trade-off for better UX
            // You may want to limit this to a certain time window after expiration
            const newToken = jwt.sign(
              { id: user._id },
              process.env.JWT_SECRET,
              { expiresIn: '1d' } // Use your desired expiration
            );
            
            // Set the new token in the response headers
            res.setHeader('X-New-Token', newToken);
            
            // Add user to request
            req.user = user;
            console.log('Auto-refreshed expired token for user:', user.username);
            
            return next();
          }
        }
      }
      
      // If we get here, token verification failed and couldn't be auto-refreshed
      throw tokenError;
    }
  } catch (error) {
    console.error('Token verification error:', error);
    // Send a more detailed error message for debugging
    res.status(401).json({ 
      message: 'Token is not valid',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default verifyToken;