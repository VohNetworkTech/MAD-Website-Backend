const express = require('express');
const router = express.Router();
const {
  applyInternship,
  getAllInterns,
  updateInternStatus,
} = require('../controllers/internController');

// Public routes
router.post('/apply', applyInternship);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/all', protect, adminOnly, getAllInterns);
// router.patch('/:id/status', protect, adminOnly, updateInternStatus);

// For testing without auth:
router.get('/all', getAllInterns);
router.patch('/:id/status', updateInternStatus);

module.exports = router;