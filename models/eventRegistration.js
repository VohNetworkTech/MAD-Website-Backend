const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
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
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid mobile number'],
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City name must be less than 100 characters'],
  },
  occupation: {
    type: String,
    trim: true,
    maxlength: [100, 'Occupation must be less than 100 characters'],
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [200, 'Organization name must be less than 200 characters'],
  },
  isPersonWithDisability: {
    type: String,
    required: [true, 'Please specify if you are a person with disability'],
    enum: ['Yes', 'No'],
  },
  disabilityType: {
    type: String,
    enum: [
      'Visual Impairment',
      'Hearing Impairment', 
      'Locomotor Disability',
      'Intellectual Disability',
      'Speech & Language Disability',
      'Multiple Disabilities',
      'Other (please specify)',
      ''
    ],
    validate: {
      validator: function(value) {
        // If person has disability, disability type is required
        if (this.isPersonWithDisability === 'Yes' && !value) {
          return false;
        }
        return true;
      },
      message: 'Disability type is required when person with disability is Yes'
    }
  },
  otherDisabilityText: {
    type: String,
    trim: true,
    maxlength: [200, 'Disability description must be less than 200 characters'],
    validate: {
      validator: function(value) {
        // If "Other" is selected, description is required
        if (this.disabilityType === 'Other (please specify)' && !value) {
          return false;
        }
        return true;
      },
      message: 'Please specify your disability type when "Other" is selected'
    }
  },
  eventId: {
    type: Number,
    required: [true, 'Event ID is required'],
  },
  eventTitle: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
  },
  registrationReference: {
    type: String,
    unique: true,
  },
  registrationStatus: {
    type: String,
    enum: ['confirmed', 'waitlist', 'cancelled'],
    default: 'confirmed',
  },
  source: {
    type: String,
    default: 'website-event-registration',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  confirmationSent: {
    type: Boolean,
    default: false,
  },
  remindersSent: {
    type: Number,
    default: 0,
  },
  attendanceStatus: {
    type: String,
    enum: ['registered', 'attended', 'no-show'],
    default: 'registered',
  },
  specialAccommodations: {
    type: String,
    trim: true,
    maxlength: [500, 'Special accommodations must be less than 500 characters'],
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes must be less than 1000 characters'],
  }
}, {
  timestamps: true,
});

// Pre-save middleware to generate registration reference
eventRegistrationSchema.pre('save', function(next) {
  if (!this.registrationReference) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.registrationReference = `REG-${timestamp}-${random}`;
  }
  next();
});

// Index for faster queries
eventRegistrationSchema.index({ email: 1, eventId: 1 }, { unique: true }); // Prevent duplicate registrations
eventRegistrationSchema.index({ registrationReference: 1 });
eventRegistrationSchema.index({ eventId: 1 });
eventRegistrationSchema.index({ registrationStatus: 1 });
eventRegistrationSchema.index({ createdAt: -1 });

// Instance method to get registration summary
eventRegistrationSchema.methods.getRegistrationSummary = function() {
  return {
    registrationReference: this.registrationReference,
    fullName: this.fullName,
    email: this.email,
    eventTitle: this.eventTitle,
    registrationStatus: this.registrationStatus,
    registrationDate: this.registrationDate
  };
};

// Static method to get event statistics
eventRegistrationSchema.statics.getEventStats = async function(eventId) {
  const stats = await this.aggregate([
    { $match: { eventId: eventId } },
    {
      $group: {
        _id: '$registrationStatus',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const disabilityStats = await this.aggregate([
    { $match: { eventId: eventId, isPersonWithDisability: 'Yes' } },
    {
      $group: {
        _id: '$disabilityType',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    registrationStats: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
    disabilityStats: disabilityStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  };
};

// Static method to check if email already registered for event
eventRegistrationSchema.statics.isAlreadyRegistered = async function(email, eventId) {
  const existingRegistration = await this.findOne({ 
    email: email.toLowerCase().trim(), 
    eventId: eventId 
  });
  return !!existingRegistration;
};

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);