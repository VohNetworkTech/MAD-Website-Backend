const EventRegistration = require('../models/eventRegistration');
const nodemailer = require('nodemailer');

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return { isValid: false, message: 'Email is required' };
  if (!emailRegex.test(email)) return { isValid: false, message: 'Please enter a valid email address' };
  if (email.length > 254) return { isValid: false, message: 'Email is too long' };
  return { isValid: true };
};

// Mobile number validation function
const validateMobileNumber = (mobile) => {
  const mobileRegex = /^[0-9]{10,15}$/;
  if (!mobile) return { isValid: false, message: 'Mobile number is required' };
  if (!mobileRegex.test(mobile)) return { isValid: false, message: 'Please enter a valid mobile number (10-15 digits)' };
  return { isValid: true };
};

// @desc Register for an event
// @route POST /api/events/register
// @access Public
exports.registerForEvent = async (req, res) => {
  try {
    let { 
      fullName, 
      email, 
      mobileNumber, 
      city, 
      occupation, 
      organization, 
      isPersonWithDisability, 
      disabilityType, 
      otherDisabilityText,
      eventId,
      eventTitle
    } = req.body;

    // Input validation
    if (!fullName || !email || !mobileNumber || !isPersonWithDisability || !eventId || !eventTitle) {
      return res.status(400).json({ 
        success: false,
        message: 'All mandatory fields are required' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    mobileNumber = sanitizeInput(mobileNumber);
    city = city ? sanitizeInput(city) : '';
    occupation = occupation ? sanitizeInput(occupation) : '';
    organization = organization ? sanitizeInput(organization) : '';
    disabilityType = disabilityType ? sanitizeInput(disabilityType) : '';
    otherDisabilityText = otherDisabilityText ? sanitizeInput(otherDisabilityText) : '';
    eventTitle = sanitizeInput(eventTitle);

    // Validate name
    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ 
        success: false,
        message: 'Name must be between 2-100 characters' 
      });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: emailValidation.message 
      });
    }

    // Validate mobile number
    const mobileValidation = validateMobileNumber(mobileNumber);
    if (!mobileValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: mobileValidation.message 
      });
    }

    // Validate disability fields
    if (!['Yes', 'No'].includes(isPersonWithDisability)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please specify if you are a person with disability' 
      });
    }

    if (isPersonWithDisability === 'Yes' && !disabilityType) {
      return res.status(400).json({ 
        success: false,
        message: 'Please select disability type' 
      });
    }

    if (disabilityType === 'Other (please specify)' && !otherDisabilityText) {
      return res.status(400).json({ 
        success: false,
        message: 'Please specify your disability type' 
      });
    }

    // Check if already registered for this event
    const isAlreadyRegistered = await EventRegistration.isAlreadyRegistered(email, parseInt(eventId));
    if (isAlreadyRegistered) {
      return res.status(409).json({ 
        success: false,
        message: 'You are already registered for this event' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create event registration
    const registration = await EventRegistration.create({
      fullName,
      email,
      mobileNumber,
      city,
      occupation,
      organization,
      isPersonWithDisability,
      disabilityType: isPersonWithDisability === 'Yes' ? disabilityType : '',
      otherDisabilityText: disabilityType === 'Other (please specify)' ? otherDisabilityText : '',
      eventId: parseInt(eventId),
      eventTitle,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to registrant
    // try {
    //   await sendRegistrationConfirmationEmail(registration);
    // } catch (emailError) {
    //   console.error('Failed to send confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendAdminNotificationEmail(registration);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for submitting your response. Your response has been submitted successfully.',
      data: {
        registrationReference: registration.registrationReference,
        eventTitle: registration.eventTitle,
        registrationDate: registration.registrationDate,
        registrationStatus: registration.registrationStatus
      },
    });

  } catch (error) {
    console.error('Event registration error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

// @desc Get all event registrations (Admin only)
// @route GET /api/events/registrations
// @access Private (Admin)
exports.getAllRegistrations = async (req, res) => {
  try {
    const { page = 1, limit = 10, eventId, registrationStatus, search } = req.query;
    
    const query = {};
    
    // Filter by event ID
    if (eventId) {
      query.eventId = parseInt(eventId);
    }
    
    // Filter by registration status
    if (registrationStatus && ['confirmed', 'waitlist', 'cancelled'].includes(registrationStatus)) {
      query.registrationStatus = registrationStatus;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registrationReference: { $regex: search, $options: 'i' } },
        { eventTitle: { $regex: search, $options: 'i' } },
      ];
    }

    const registrations = await EventRegistration.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await EventRegistration.countDocuments(query);

    // Get statistics
    const stats = {
      total: await EventRegistration.countDocuments(),
      confirmed: await EventRegistration.countDocuments({ registrationStatus: 'confirmed' }),
      waitlist: await EventRegistration.countDocuments({ registrationStatus: 'waitlist' }),
      cancelled: await EventRegistration.countDocuments({ registrationStatus: 'cancelled' }),
      withDisability: await EventRegistration.countDocuments({ isPersonWithDisability: 'Yes' }),
    };

    res.json({
      success: true,
      data: registrations,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Get event statistics (Admin only)
// @route GET /api/events/:eventId/stats
// @access Private (Admin)
exports.getEventStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const stats = await EventRegistration.getEventStats(parseInt(eventId));
    
    const totalRegistrations = await EventRegistration.countDocuments({ eventId: parseInt(eventId) });
    
    res.json({
      success: true,
      data: {
        eventId: parseInt(eventId),
        totalRegistrations,
        ...stats
      }
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics'
    });
  }
};

// @desc Update registration status (Admin only)
// @route PATCH /api/events/registration/:id/status
// @access Private (Admin)
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { registrationStatus, notes } = req.body;

    if (!['confirmed', 'waitlist', 'cancelled'].includes(registrationStatus)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid registration status' 
      });
    }

    const registration = await EventRegistration.findByIdAndUpdate(
      id,
      { 
        registrationStatus,
        notes: notes || '',
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!registration) {
      return res.status(404).json({ 
        success: false,
        message: 'Registration not found' 
      });
    }

    // Send status update email
    try {
      await sendStatusUpdateEmail(registration);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      success: true,
      message: 'Registration status updated successfully',
      data: registration
    });
  } catch (error) {
    console.error('Update registration status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to registrant
const sendRegistrationConfirmationEmail = async (registration) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping confirmation email');
    return;
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secure: true,
    tls: {
      rejectUnauthorized: true
    }
  });

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: registration.email,
    subject: 'Event Registration Confirmation - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Registration Confirmed!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${registration.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for registering for our event! We're excited to have you join us.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1f2937; margin-top: 0;">Registration Details:</h3>
            <p style="margin: 8px 0;"><strong>Event:</strong> ${registration.eventTitle}</p>
            <p style="margin: 8px 0;"><strong>Registration Reference:</strong> ${registration.registrationReference}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> ${registration.registrationStatus.charAt(0).toUpperCase() + registration.registrationStatus.slice(1)}</p>
            <p style="margin: 8px 0;"><strong>Registered On:</strong> ${registration.registrationDate.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">What's Next:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li>Keep this email for your records</li>
              <li>We'll send you event details and updates closer to the date</li>
              <li>If you have any questions, feel free to contact us</li>
            </ul>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Thank you for being part of our mission to create a more inclusive world.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Visit Our Website
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Best regards,<br>
            The MAD Foundation Team
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            For any queries, please contact us at <a href="mailto:contact@mad-foundation.org" style="color: #3b82f6;">contact@mad-foundation.org</a>
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send notification email to admin
const sendAdminNotificationEmail = async (registration) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping admin notification');
    return;
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secure: true,
    tls: {
      rejectUnauthorized: true
    }
  });

  const mailOptions = {
    from: `"MAD Foundation Website" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: 'New Event Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">New Event Registration</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Registration Details:</h3>
          <p><strong>Event:</strong> ${registration.eventTitle}</p>
          <p><strong>Name:</strong> ${registration.fullName}</p>
          <p><strong>Email:</strong> ${registration.email}</p>
          <p><strong>Mobile:</strong> ${registration.mobileNumber}</p>
          <p><strong>City:</strong> ${registration.city || 'Not provided'}</p>
          <p><strong>Occupation:</strong> ${registration.occupation || 'Not provided'}</p>
          <p><strong>Organization:</strong> ${registration.organization || 'Not provided'}</p>
          <p><strong>Person with Disability:</strong> ${registration.isPersonWithDisability}</p>
          ${registration.disabilityType ? `<p><strong>Disability Type:</strong> ${registration.disabilityType}</p>` : ''}
          ${registration.otherDisabilityText ? `<p><strong>Disability Details:</strong> ${registration.otherDisabilityText}</p>` : ''}
          <p><strong>Registration Reference:</strong> ${registration.registrationReference}</p>
          <p><strong>Registered at:</strong> ${registration.registrationDate.toLocaleString()}</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send status update email
const sendStatusUpdateEmail = async (registration) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return;
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secure: true,
    tls: {
      rejectUnauthorized: true
    }
  });

  let subject, content;
  
  switch (registration.registrationStatus) {
    case 'confirmed':
      subject = 'Registration Confirmed - MAD Foundation';
      content = `
        <p style="color: #16a34a;">Great news! Your event registration has been confirmed.</p>
        <p>We look forward to seeing you at the event.</p>
      `;
      break;
    case 'waitlist':
      subject = 'Registration Waitlisted - MAD Foundation';
      content = `
        <p style="color: #f59e0b;">Your registration has been placed on our waitlist.</p>
        <p>We'll notify you if a spot becomes available.</p>
      `;
      break;
    case 'cancelled':
      subject = 'Registration Cancelled - MAD Foundation';
      content = `
        <p style="color: #dc2626;">Your event registration has been cancelled.</p>
        <p>If this was done in error, please contact us.</p>
      `;
      break;
    default:
      return;
  }

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: registration.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Registration Status Update</h2>
        <p>Dear ${registration.fullName},</p>
        ${content}
        <p><strong>Event:</strong> ${registration.eventTitle}</p>
        <p><strong>Registration Reference:</strong> ${registration.registrationReference}</p>
        <p>Best regards,<br>The MAD Foundation Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};