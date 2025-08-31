// models/Donation.js
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name must be less than 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid mobile number'],
  },
  donationAmount: {
    type: Number,
    required: [true, 'Donation amount is required'],
    min: [1, 'Donation amount must be at least 1'],
    max: [10000000, 'Donation amount cannot exceed 1 crore'],
  },
  donationType: {
    type: String,
    required: [true, 'Donation type is required'],
    enum: ['One-Time', 'Monthly', 'Sponsor a Program', 'Corporate Donation'],
  },
  message: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message must be less than 1000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  source: {
    type: String,
    default: 'website-donation-form',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  donationReference: {
    type: String,
    unique: true,
  },
  contactedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate donation reference
donationSchema.pre('save', function(next) {
  if (!this.donationReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.donationReference = `DON-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
donationSchema.index({ email: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ status: 1 });
donationSchema.index({ donationReference: 1 });

module.exports = mongoose.model('Donation', donationSchema);