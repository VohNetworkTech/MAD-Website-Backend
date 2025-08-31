const express = require('express');
const router = express.Router();
const {
  registerVolunteer,
  getAllVolunteers,
  updateVolunteerStatus,
} = require('../controllers/volunteerController');

// Public routes
router.post('/register', registerVolunteer);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/all', protect, adminOnly, getAllVolunteers);
// router.patch('/:id/status', protect, adminOnly, updateVolunteerStatus);

// For testing without auth:
router.get('/all', getAllVolunteers);
router.patch('/:id/status', updateVolunteerStatus);

module.exports = router;