const express = require('express');
const router = express.Router();
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getAllSubscribers,
} = require('../controllers/newsController');

// Public routes
router.post('/subscribe', subscribeNewsletter);
router.get('/unsubscribe/:token', unsubscribeNewsletter);

// Admin routes (uncomment when you have auth middleware)
// const { protect, adminOnly } = require('../middleware/auth');
// router.get('/subscribers', protect, adminOnly, getAllSubscribers);

// For testing without auth:
router.get('/subscribers', getAllSubscribers);

module.exports = router;
