const express = require('express');
const router = express.Router();
const {
  submitContactForm,
  getAllContacts,
  updateContactStatus,
} = require('../controllers/contactController');

// You'll need to create auth middleware for admin routes
// const { protect, adminOnly } = require('../middleware/auth');

// Public routes
router.post('/submit', submitContactForm);

// Admin routes (uncomment when you have auth middleware)
// router.get('/all', protect, adminOnly, getAllContacts);
// router.patch('/:id/status', protect, adminOnly, updateContactStatus);

// For now, if you want to test admin routes without auth:
router.get('/all', getAllContacts);
router.patch('/:id/status', updateContactStatus);

module.exports = router;
