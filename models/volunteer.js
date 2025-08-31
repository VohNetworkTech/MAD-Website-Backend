const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
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
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid mobile number'],
  },
  expertise: [{
    type: String,
    enum: ['Education', 'Skill Development', 'Content Creation', 'Advocacy', 'Event Coordination', 'Research & Policy', 'More'],
  }],
  howToHelp: {
    type: String,
    required: [true, 'Please describe how you would like to help'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [1000, 'Description must be less than 1000 characters'],
  },
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message must be less than 500 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'active', 'inactive', 'rejected'],
    default: 'pending',
  },
  availability: {
    type: String,
    enum: ['part-time', 'full-time', 'weekends', 'flexible'],
    default: 'flexible',
  },
  source: {
    type: String,
    default: 'website-volunteer-form',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  volunteerReference: {
    type: String,
    unique: true,
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
  approvedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes must be less than 1000 characters'],
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate volunteer reference
volunteerSchema.pre('save', function(next) {
  if (!this.volunteerReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.volunteerReference = `VOL-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
volunteerSchema.index({ email: 1 });
volunteerSchema.index({ createdAt: -1 });
volunteerSchema.index({ status: 1 });
volunteerSchema.index({ volunteerReference: 1 });
volunteerSchema.index({ expertise: 1 });

module.exports = mongoose.model('Volunteer', volunteerSchema);