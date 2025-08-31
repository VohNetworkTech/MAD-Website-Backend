const express = require('express');
const router = express.Router();
const {
  submitDonationForm,
  getAllDonations,
  updateDonationStatus,
} = require('../controllers/donationController');

// Public routes
router.post('/submit', submitDonationForm);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/all', protect, adminOnly, getAllDonations);
// router.patch('/:id/status', protect, adminOnly, updateDonationStatus);

// For testing without auth:
router.get('/all', getAllDonations);
router.patch('/:id/status', updateDonationStatus);

module.exports = router;