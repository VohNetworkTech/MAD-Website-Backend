const mongoose = require('mongoose');

const contactUsSchema = new mongoose.Schema({
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
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: ['general-inquiry', 'volunteering', 'internship', 'partnership', 'donation', 'other'],
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters long'],
    maxlength: [1500, 'Message must be less than 1500 characters'],
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed'],
    default: 'new',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  source: {
    type: String,
    default: 'website-contact-us',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  ticketReference: {
    type: String,
    unique: true,
  },
  assignedTo: {
    type: String,
  },
  resolvedAt: {
    type: Date,
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes must be less than 1000 characters'],
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate ticket reference
contactUsSchema.pre('save', function(next) {
  if (!this.ticketReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketReference = `TICKET-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
contactUsSchema.index({ email: 1 });
contactUsSchema.index({ createdAt: -1 });
contactUsSchema.index({ status: 1 });
contactUsSchema.index({ subject: 1 });
contactUsSchema.index({ ticketReference: 1 });

module.exports = mongoose.model('ContactUs', contactUsSchema);