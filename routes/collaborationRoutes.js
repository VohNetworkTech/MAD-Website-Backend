const express = require('express');
const router = express.Router();
const {
  submitCollaborationRequest,
  getAllCollaborations,
  updateCollaborationStatus,
} = require('../controllers/collaborationController');

// Public routes
router.post('/submit', submitCollaborationRequest);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/all', protect, adminOnly, getAllCollaborations);
// router.patch('/:id/status', protect, adminOnly, updateCollaborationStatus);

// For testing without auth:
router.get('/all', getAllCollaborations);
router.patch('/:id/status', updateCollaborationStatus);

module.exports = router;