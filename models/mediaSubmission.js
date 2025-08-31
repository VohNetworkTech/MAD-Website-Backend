const mongoose = require('mongoose');

const mediaSubmissionSchema = new mongoose.Schema({
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
  mediaUrl: {
    type: String,
    required: [true, 'Media URL is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description must be less than 1000 characters'],
    default: '',
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'unknown'],
    default: 'unknown',
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'featured', 'rejected'],
    default: 'pending',
  },
  category: {
    type: String,
    enum: ['event', 'initiative', 'testimonial', 'achievement', 'other'],
    default: 'other',
  },
  source: {
    type: String,
    default: 'website-media-form',
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
  featuredAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate submission reference and detect media type
mediaSubmissionSchema.pre('save', function(next) {
  if (!this.submissionReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.submissionReference = `MED-${timestamp}-${random}`;
  }
  
  // Auto-detect media type from URL if not already set
  if (this.mediaType === 'unknown' && this.mediaUrl) {
    const url = this.mediaUrl.toLowerCase();
    if (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || 
        url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') || 
        url.includes('.wmv') || url.includes('.flv') || url.includes('.webm') || 
        url.includes('.mkv')) {
      this.mediaType = 'video';
    } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || 
               url.includes('.gif') || url.includes('.webp') || url.includes('.bmp') ||
               url.includes('imgur')) {
      this.mediaType = 'image';
    }
  }
  
  next();
});

// Index for faster queries
mediaSubmissionSchema.index({ email: 1 });
mediaSubmissionSchema.index({ createdAt: -1 });
mediaSubmissionSchema.index({ status: 1 });
mediaSubmissionSchema.index({ submissionReference: 1 });
mediaSubmissionSchema.index({ mediaType: 1 });

module.exports = mongoose.model('MediaSubmission', mediaSubmissionSchema);