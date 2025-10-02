const express = require("express");
const router = express.Router();
const { 
  signup, 
  login, 
  forgotPassword,
  getAllUsers 
} = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

// Protected route - verify token
router.get("/verify", protect, (req, res) => {
  res.json({
    success: true,
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      role: req.user.role,
    }
  });
});

// Get current user profile
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      role: req.user.role,
    }
  });
});

// Admin only routes
router.get("/users", protect, adminOnly, getAllUsers);

module.exports = router;