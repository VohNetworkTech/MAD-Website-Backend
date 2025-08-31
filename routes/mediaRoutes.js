const express = require('express');
const router = express.Router();
const {
  submitMediaUpload,
  getAllSubmissions,
  updateSubmissionStatus,
} = require('../controllers/mediaController');

// Public routes
router.post('/submit', submitMediaUpload);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/submissions', protect, adminOnly, getAllSubmissions);
// router.patch('/:id/status', protect, adminOnly, updateSubmissionStatus);

// For testing without auth:
router.get('/submissions', getAllSubmissions);
router.patch('/:id/status', updateSubmissionStatus);

module.exports = router;