const mongoose = require('mongoose');

const collaborationSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name must be less than 100 characters'],
  },
  organizationName: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    minlength: [2, 'Organization name must be at least 2 characters long'],
    maxlength: [200, 'Organization name must be less than 200 characters'],
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
  areaOfInterest: {
    type: String,
    required: [true, 'Area of interest is required'],
    enum: ['Education', 'Employment', 'Skill Development', 'Livelihood', 'Assistive Technology', 'Healthcare & Rehabilitation', 'Advocacy', 'Accessibility', 'Policy Development', 'Research & Innovation', 'Other'],
  },
  message: {
    type: String,
    trim: true,
    maxlength: [2000, 'Message must be less than 2000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'meeting-scheduled', 'in-discussion', 'approved', 'active-partnership', 'declined', 'on-hold'],
    default: 'pending',
  },
  organizationType: {
    type: String,
    enum: ['ngo', 'corporate', 'government', 'institution', 'individual', 'startup', 'other'],
    default: 'other',
  },
  partnershipType: {
    type: String,
    enum: ['project-based', 'long-term', 'funding', 'resource-sharing', 'knowledge-exchange', 'advocacy', 'other'],
  },
  source: {
    type: String,
    default: 'website-collaborate-form',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  collaborationReference: {
    type: String,
    unique: true,
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
  meetingDate: {
    type: Date,
  },
  partnershipStartDate: {
    type: Date,
  },
  declineReason: {
    type: String,
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes must be less than 1000 characters'],
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate collaboration reference
collaborationSchema.pre('save', function(next) {
  if (!this.collaborationReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.collaborationReference = `COLLAB-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
collaborationSchema.index({ email: 1 });
collaborationSchema.index({ organizationName: 1 });
collaborationSchema.index({ createdAt: -1 });
collaborationSchema.index({ status: 1 });
collaborationSchema.index({ collaborationReference: 1 });
collaborationSchema.index({ areaOfInterest: 1 });

module.exports = mongoose.model('Collaboration', collaborationSchema);