// models/Newsletter.js
const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'unsubscribed'],
    default: 'active',
  },
  source: {
    type: String,
    default: 'website-subscription',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  unsubscribedAt: {
    type: Date,
  },
  unsubscribeToken: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for faster queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ createdAt: -1 });

module.exports = mongoose.model('News', newsletterSchema);