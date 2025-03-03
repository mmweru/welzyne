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
      
      // Find user by id from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found, authorization denied' });
      }

      // Add user to request
      req.user = user;
      next();
    } catch (tokenError) {
      // Token verification failed
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired, please log in again' });
      }
      
      // For '/auth/validate' endpoint, be lenient to prevent logouts on refresh
      if (req.path === '/auth/validate' || req.path.includes('/validate')) {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          try {
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
              return res.json(user);
            }
          } catch (err) {
            console.error('Error finding user:', err);
          }
        }
      }
      
      // If not the validation endpoint or couldn't find user, proceed with error
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ message: 'Token verification failed' });
  }
};

export default verifyToken;