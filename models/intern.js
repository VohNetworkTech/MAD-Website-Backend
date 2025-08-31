const mongoose = require('mongoose');

const internSchema = new mongoose.Schema({
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
  internshipArea: {
    type: String,
    required: [true, 'Internship area is required'],
    enum: ['Research & Policy', 'Content Development', 'Event Coordination', 'Social Media', 'Assistive Technology', 'More'],
  },
  education: {
    type: String,
    trim: true,
    maxlength: [1000, 'Education background must be less than 1000 characters'],
  },
  motivation: {
    type: String,
    required: [true, 'Motivation is required'],
    trim: true,
    minlength: [20, 'Motivation must be at least 20 characters long'],
    maxlength: [1000, 'Motivation must be less than 1000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'interview-scheduled', 'accepted', 'rejected', 'completed'],
    default: 'pending',
  },
  duration: {
    type: String,
    enum: ['1-month', '3-months', '6-months', 'flexible'],
    default: 'flexible',
  },
  source: {
    type: String,
    default: 'website-internship-form',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  internReference: {
    type: String,
    unique: true,
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
  interviewDate: {
    type: Date,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes must be less than 1000 characters'],
  },
  mentor: {
    type: String,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate intern reference
internSchema.pre('save', function(next) {
  if (!this.internReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.internReference = `INT-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
internSchema.index({ email: 1 });
internSchema.index({ createdAt: -1 });
internSchema.index({ status: 1 });
internSchema.index({ internReference: 1 });
internSchema.index({ internshipArea: 1 });

module.exports = mongoose.model('Intern', internSchema);