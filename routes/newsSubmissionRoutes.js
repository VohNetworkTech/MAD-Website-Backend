const express = require('express');
const router = express.Router();
const {
  submitNewsUpdate,
  getAllSubmissions,
  updateSubmissionStatus,
} = require('../controllers/newsSubmissionController');

// Public routes
router.post('/submit', submitNewsUpdate);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/submissions', protect, adminOnly, getAllSubmissions);
// router.patch('/:id/status', protect, adminOnly, updateSubmissionStatus);

// For testing without auth:
router.get('/submissions', getAllSubmissions);
router.patch('/:id/status', updateSubmissionStatus);

module.exports = router;