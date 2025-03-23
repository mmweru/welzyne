import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { roleMiddleware, authorizeRoles } from '../middleware/roleMiddleware.js';
import User from '../models/userModel.js';
import { broadcast } from '../server.js';
import { getUserProfile, updateUserProfile } from '../controllers/userController.js';
import upload from '../middleware/fileUpload.js';


const router = express.Router();

// Get all users (admin only)
router.get("/", verifyToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

// Update user status (admin only)
router.patch("/:id/status", verifyToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Broadcast status update
        broadcast({
            type: 'USER_UPDATED',
            user
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error updating user status" });
    }
});
// Get user profile
router.get('/profile', verifyToken, getUserProfile);

// Update user profile - with file upload middleware
router.put('/profile', verifyToken, upload.single('profilePhoto'), updateUserProfile);

// Delete user (admin only)
router.delete("/:id", verifyToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Broadcast user deletion
        broadcast({
            type: 'USER_DELETED',
            userId: req.params.id
        });

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user" });
    }
});

// Admin route - using roleMiddleware
router.get("/admin", 
    verifyToken, 
    roleMiddleware(['admin']), 
    (req, res) => {
      res.json({ message: "Welcome Admin" });
  });
  
  // Alternative using authorizeRoles
  // router.get("/admin", verifyToken, authorizeRoles("admin"), (req, res) => {
  //   res.json({ message: "Welcome Admin" });
  // });
  
  // User route - using roleMiddleware
  router.get("/user", 
    verifyToken, 
    roleMiddleware(['admin', 'user']), 
    (req, res) => {
      res.json({ message: "Welcome User" });
  });
  
  // Alternative using authorizeRoles
  // router.get("/user", verifyToken, authorizeRoles("admin", "user"), (req, res) => {
  //   res.json({ message: "Welcome User" });
  // });
  
  // Guest route - using roleMiddleware
  router.get("/guest", 
    verifyToken, 
    roleMiddleware(['admin', 'user', 'guest']), 
    (req, res) => {
      res.json({ message: "Welcome Guest" });
  });
  
  // Alternative using authorizeRoles
  // router.get("/guest", verifyToken, authorizeRoles("admin", "user", "guest"), (req, res) => {
  //   res.json({ message: "Welcome Guest" });
  // });

export default router;