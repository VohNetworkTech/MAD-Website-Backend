const mongoose = require('mongoose');

const newsSubmissionSchema = new mongoose.Schema({
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
  newsUpdate: {
    type: String,
    required: [true, 'News update is required'],
    trim: true,
    minlength: [10, 'News update must be at least 10 characters long'],
    maxlength: [2000, 'News update must be less than 2000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'published', 'rejected'],
    default: 'pending',
  },
  category: {
    type: String,
    enum: ['announcement', 'event', 'achievement', 'accessibility', 'inclusion', 'other'],
    default: 'other',
  },
  source: {
    type: String,
    default: 'website-news-form',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  submissionReference: {
    type: String,
    unique: true,
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
  publishedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate submission reference
newsSubmissionSchema.pre('save', function(next) {
  if (!this.submissionReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.submissionReference = `NEWS-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
newsSubmissionSchema.index({ email: 1 });
newsSubmissionSchema.index({ createdAt: -1 });
newsSubmissionSchema.index({ status: 1 });
newsSubmissionSchema.index({ submissionReference: 1 });

module.exports = mongoose.model('NewsSubmission', newsSubmissionSchema);