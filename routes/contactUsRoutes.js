const express = require('express');
const router = express.Router();
const {
  submitContactUs,
  getAllContactUs,
  updateContactUsStatus,
} = require('../controllers/contactUsController');

// Public routes
router.post('/submit', submitContactUs);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/all', protect, adminOnly, getAllContactUs);
// router.patch('/:id/status', protect, adminOnly, updateContactUsStatus);

// For testing without auth:
router.get('/all', getAllContactUs);
router.patch('/:id/status', updateContactUsStatus);

module.exports = router;