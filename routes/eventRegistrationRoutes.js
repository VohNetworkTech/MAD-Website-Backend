const express = require('express');
const router = express.Router();
const {
  registerForEvent,
  getAllRegistrations,
  getEventStats,
  updateRegistrationStatus,
} = require('../controllers/eventRegistrationController');

// Public routes
router.post('/register', registerForEvent);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/registrations', protect, adminOnly, getAllRegistrations);
// router.get('/:eventId/stats', protect, adminOnly, getEventStats);
// router.patch('/registration/:id/status', protect, adminOnly, updateRegistrationStatus);

// For testing without auth:
router.get('/registrations', getAllRegistrations);
router.get('/:eventId/stats', getEventStats);
router.patch('/registration/:id/status', updateRegistrationStatus);

module.exports = router;