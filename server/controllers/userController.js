// controllers/userController.js
import User from '../models/userModel.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the base URL for serving images
const getBaseUrl = (req) => {
  return process.env.NODE_ENV === 'production'
    ? `${req.protocol}://${req.get('host')}`
    : process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      // Remove uploaded file if user doesn't exist
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update profile fields if provided
    const { username, email, phone, bio, address } = req.body;
    
    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (address !== undefined) user.address = address;
    
    // Handle profile photo upload
    if (req.file) {
      // Get base URL for the image
      const baseUrl = getBaseUrl(req);
      
      // If user already has a photo, delete the old one
      if (user.photoUrl) {
        try {
          // Extract filename from photoUrl
          const oldPhotoPath = user.photoUrl.split('/').pop();
          const fullPath = path.join(__dirname, '../uploads', oldPhotoPath);
          
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.error('Error deleting old profile photo:', err);
          // Continue with update even if deletion fails
        }
      }
      
      // Set new photo URL
      user.photoUrl = `${baseUrl}/uploads/${req.file.filename}`;
    }
    
    // Save updated user
    await user.save();
    
    // Return updated user without password
    const updatedUser = user.toObject();
    delete updatedUser.password;
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    // Remove uploaded file if update fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile', 
      error: error.message 
    });
  }
};