const Volunteer = require('../models/volunteer');
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

// Phone number validation function
const validateMobile = (mobile) => {
  if (!mobile) return { isValid: false, message: 'Mobile number is required' };
  
  const phoneStr = String(mobile);
  const cleanPhone = phoneStr.replace(/\D/g, '');
  
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { isValid: false, message: 'Mobile number must be between 10-15 digits' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^0{10,}$/, // All zeros
    /^1{10,}$/, // All ones
    /^(.)\1{9,}$/, // Repeated same digit
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(cleanPhone))) {
    return { isValid: false, message: 'Invalid mobile number format' };
  }
  
  return { isValid: true, cleanPhone };
};

// @desc Submit volunteer registration
// @route POST /api/volunteer/register
// @access Public
exports.registerVolunteer = async (req, res) => {
  try {
    let { fullName, email, mobile, expertise, howToHelp, message } = req.body;

    // Input validation
    if (!fullName || !email || !mobile || !howToHelp) {
      return res.status(400).json({ 
        success: false,
        message: 'All required fields must be filled' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    mobile = sanitizeInput(mobile);
    howToHelp = sanitizeInput(howToHelp);
    message = message ? sanitizeInput(message) : '';

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

    // Validate mobile
    const mobileValidation = validateMobile(mobile);
    if (!mobileValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: mobileValidation.message 
      });
    }

    // Validate howToHelp
    if (howToHelp.length < 10 || howToHelp.length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Description must be between 10-1000 characters' 
      });
    }

    // Validate expertise array
    const validExpertise = ['Education', 'Skill Development', 'Content Creation', 'Advocacy', 'Event Coordination', 'Research & Policy', 'More'];
    const sanitizedExpertise = [];
    
    if (Array.isArray(expertise)) {
      expertise.forEach(exp => {
        const cleanExp = sanitizeInput(exp);
        if (validExpertise.includes(cleanExp)) {
          sanitizedExpertise.push(cleanExp);
        }
      });
    }

    // Validate message length if provided
    if (message && message.length > 500) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be less than 500 characters' 
      });
    }

    // Check if email already exists
    const existingVolunteer = await Volunteer.findOne({ email });
    if (existingVolunteer) {
      return res.status(400).json({ 
        success: false,
        message: 'A volunteer with this email already exists' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create volunteer registration
    const volunteer = await Volunteer.create({
      fullName,
      email,
      mobile: mobileValidation.cleanPhone,
      expertise: sanitizedExpertise,
      howToHelp,
      message,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to volunteer
    // try {
    //   await sendVolunteerConfirmationEmail(volunteer);
    // } catch (emailError) {
    //   console.error('Failed to send volunteer confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendVolunteerNotificationEmail(volunteer);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for registering as a volunteer with MAD Foundation. Our team will connect with you soon to discuss how you can make an impact.',
      data: {
        volunteerReference: volunteer.volunteerReference,
        submittedAt: volunteer.createdAt,
      },
    });

  } catch (error) {
    console.error('Volunteer registration error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'A volunteer with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all volunteers (Admin only)
// @route GET /api/volunteer/all
// @access Private (Admin)
exports.getAllVolunteers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, expertise, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['pending', 'reviewed', 'approved', 'active', 'inactive', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    // Filter by expertise
    if (expertise && ['Education', 'Skill Development', 'Content Creation', 'Advocacy', 'Event Coordination', 'Research & Policy', 'More'].includes(expertise)) {
      query.expertise = { $in: [expertise] };
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { volunteerReference: { $regex: search, $options: 'i' } },
        { howToHelp: { $regex: search, $options: 'i' } },
      ];
    }

    const volunteers = await Volunteer.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await Volunteer.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Volunteer.countDocuments(),
      pending: await Volunteer.countDocuments({ status: 'pending' }),
      approved: await Volunteer.countDocuments({ status: 'approved' }),
      active: await Volunteer.countDocuments({ status: 'active' }),
      rejected: await Volunteer.countDocuments({ status: 'rejected' }),
    };

    res.json({
      success: true,
      data: volunteers,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update volunteer status (Admin only)
// @route PATCH /api/volunteer/:id/status
// @access Private (Admin)
exports.updateVolunteerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, availability, rejectionReason, reviewedBy, notes } = req.body;

    const updateData = {};
    
    if (status && ['pending', 'reviewed', 'approved', 'active', 'inactive', 'rejected'].includes(status)) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      
      if (status === 'approved') {
        updateData.approvedAt = new Date();
      }
      
      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }
    
    if (availability && ['part-time', 'full-time', 'weekends', 'flexible'].includes(availability)) {
      updateData.availability = availability;
    }
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }
    
    if (notes) {
      updateData.notes = sanitizeInput(notes);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!volunteer) {
      return res.status(404).json({ 
        success: false,
        message: 'Volunteer not found' 
      });
    }

    // Send status update email to volunteer
    try {
      await sendVolunteerStatusUpdateEmail(volunteer);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      success: true,
      message: 'Volunteer status updated successfully',
      data: volunteer,
    });
  } catch (error) {
    console.error('Update volunteer status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to volunteer
const sendVolunteerConfirmationEmail = async (volunteer) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping volunteer confirmation');
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
    to: volunteer.email,
    subject: 'Welcome to the MAD Foundation Volunteer Family!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to the Team!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${volunteer.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for registering as a volunteer with MAD Foundation! We're thrilled to have someone with your passion join our mission to create a more inclusive world.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3 style="color: #1f2937; margin-top: 0;">Registration Details:</h3>
            <p style="margin: 8px 0;"><strong>Reference ID:</strong> ${volunteer.volunteerReference}</p>
            <p style="margin: 8px 0;"><strong>Registered:</strong> ${volunteer.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0;"><strong>Areas of Expertise:</strong> ${volunteer.expertise.length > 0 ? volunteer.expertise.join(', ') : 'Not specified'}</p>
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">What Happens Next:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Our team will review your application within 2-3 business days</li>
              <li>You'll receive updates about your application status via email</li>
              <li>Once approved, we'll match you with suitable volunteer opportunities</li>
              <li>You'll be invited to our volunteer orientation session</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">How You Want to Help:</h3>
            <p style="color: #4b5563; line-height: 1.6; font-style: italic;">
              "${volunteer.howToHelp}"
            </p>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Your dedication to making a difference will help us empower individuals with disabilities and build a more inclusive society.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Explore Our Work
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            We're excited to work with you!<br>
            The MAD Foundation Team
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            For any queries, please contact us at <a href="mailto:contact@mad-foundation.org" style="color: #2563eb;">contact@mad-foundation.org</a> or call +91 9915670267
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send notification email to admin
const sendVolunteerNotificationEmail = async (volunteer) => {
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
    subject: 'New Volunteer Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">New Volunteer Registration</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Volunteer Information:</h3>
          <p><strong>Name:</strong> ${volunteer.fullName}</p>
          <p><strong>Email:</strong> ${volunteer.email}</p>
          <p><strong>Mobile:</strong> ${volunteer.mobile}</p>
          <p><strong>Reference ID:</strong> ${volunteer.volunteerReference}</p>
          <p><strong>Areas of Expertise:</strong> ${volunteer.expertise.length > 0 ? volunteer.expertise.join(', ') : 'Not specified'}</p>
          <p><strong>Registered at:</strong> ${volunteer.createdAt.toLocaleString()}</p>
          
          <h4 style="color: #1f2937; margin-top: 20px;">How They Want to Help:</h4>
          <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #16a34a;">
            <p style="color: #4b5563; line-height: 1.6; margin: 0;">
              ${volunteer.howToHelp}
            </p>
          </div>
          
          ${volunteer.message ? `
            <h4 style="color: #1f2937; margin-top: 20px;">Additional Message:</h4>
            <div style="background-color: white; padding: 15px; border-radius: 4px;">
              <p style="color: #4b5563; line-height: 1.6; margin: 0;">
                ${volunteer.message}
              </p>
            </div>
          ` : ''}
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0;">
            <strong>Action Required:</strong> Please review this volunteer application and update the status accordingly.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send status update email
const sendVolunteerStatusUpdateEmail = async (volunteer) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || volunteer.status === 'pending') {
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
  
  switch (volunteer.status) {
    case 'approved':
      subject = 'Your Volunteer Application Has Been Approved!';
      content = `
        <p style="color: #16a34a;">Congratulations! Your volunteer application has been approved.</p>
        <p>Our team will be in touch soon to discuss specific volunteer opportunities that match your expertise and interests.</p>
        <p>Welcome to the MAD Foundation volunteer family!</p>
      `;
      break;
    case 'active':
      subject = 'You\'re Now an Active MAD Foundation Volunteer!';
      content = `
        <p style="color: #16a34a;">Welcome aboard! You are now an active volunteer with MAD Foundation.</p>
        <p>You'll start receiving notifications about volunteer opportunities and events. Thank you for your commitment to our mission.</p>
      `;
      break;
    case 'rejected':
      subject = 'Update on Your Volunteer Application';
      content = `
        <p style="color: #dc2626;">Thank you for your interest in volunteering with MAD Foundation. After careful review, we've decided not to proceed with your application at this time.</p>
        ${volunteer.rejectionReason ? `<p><strong>Reason:</strong> ${volunteer.rejectionReason}</p>` : ''}
        <p>We encourage you to apply again in the future as our needs and programs evolve.</p>
      `;
      break;
    default:
      return; // Don't send email for other statuses
  }

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: volunteer.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Volunteer Application Update</h2>
        <p>Dear ${volunteer.fullName},</p>
        ${content}
        <p><strong>Reference ID:</strong> ${volunteer.volunteerReference}</p>
        <p>Best regards,<br>The MAD Foundation Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};
