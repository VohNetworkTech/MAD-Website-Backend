const Collaboration = require('../models/collaboration');
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

// @desc Submit collaboration request
// @route POST /api/collaborate/submit
// @access Public
exports.submitCollaborationRequest = async (req, res) => {
  try {
    let { fullName, organizationName, email, mobile, areaOfInterest, message } = req.body;

    // Input validation
    if (!fullName || !organizationName || !email || !mobile || !areaOfInterest) {
      return res.status(400).json({ 
        success: false,
        message: 'All required fields must be filled' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    organizationName = sanitizeInput(organizationName);
    email = sanitizeInput(email.toLowerCase());
    mobile = sanitizeInput(mobile);
    areaOfInterest = sanitizeInput(areaOfInterest);
    message = message ? sanitizeInput(message) : '';

    // Validate name
    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ 
        success: false,
        message: 'Name must be between 2-100 characters' 
      });
    }

    // Validate organization name
    if (organizationName.length < 2 || organizationName.length > 200) {
      return res.status(400).json({ 
        success: false,
        message: 'Organization name must be between 2-200 characters' 
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

    // Validate area of interest
    const validAreas = ['Education', 'Employment', 'Skill Development', 'Livelihood', 'Assistive Technology', 'Healthcare & Rehabilitation', 'Advocacy', 'Accessibility', 'Policy Development', 'Research & Innovation', 'Other'];
    if (!validAreas.includes(areaOfInterest)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid area of interest selected' 
      });
    }

    // Validate message length if provided
    if (message && message.length > 2000) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be less than 2000 characters' 
      });
    }

    // Check for duplicate submissions (same organization and email within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingCollaboration = await Collaboration.findOne({
      $or: [
        { email, createdAt: { $gte: twentyFourHoursAgo } },
        { organizationName, createdAt: { $gte: twentyFourHoursAgo } }
      ]
    });

    if (existingCollaboration) {
      return res.status(429).json({ 
        success: false,
        message: 'A collaboration request from this organization or email already exists within the last 24 hours' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create collaboration request
    const collaboration = await Collaboration.create({
      fullName,
      organizationName,
      email,
      mobile: mobileValidation.cleanPhone,
      areaOfInterest,
      message,
      ipAddress,
      userAgent,
    });

    // // Send confirmation email to requester
    // try {
    //   await sendCollaborationConfirmationEmail(collaboration);
    // } catch (emailError) {
    //   console.error('Failed to send collaboration confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendCollaborationNotificationEmail(collaboration);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for your interest in partnering with MAD Foundation. We\'re excited about the potential collaboration opportunities.',
      data: {
        collaborationReference: collaboration.collaborationReference,
        submittedAt: collaboration.createdAt,
      },
    });

  } catch (error) {
    console.error('Collaboration request submission error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all collaborations (Admin only)
// @route GET /api/collaborate/all
// @access Private (Admin)
exports.getAllCollaborations = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, areaOfInterest, organizationType, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['pending', 'under-review', 'meeting-scheduled', 'in-discussion', 'approved', 'active-partnership', 'declined', 'on-hold'].includes(status)) {
      query.status = status;
    }
    
    // Filter by area of interest
    if (areaOfInterest && ['Education', 'Employment', 'Skill Development', 'Livelihood', 'Assistive Technology', 'Healthcare & Rehabilitation', 'Advocacy', 'Accessibility', 'Policy Development', 'Research & Innovation', 'Other'].includes(areaOfInterest)) {
      query.areaOfInterest = areaOfInterest;
    }
    
    // Filter by organization type
    if (organizationType && ['ngo', 'corporate', 'government', 'institution', 'individual', 'startup', 'other'].includes(organizationType)) {
      query.organizationType = organizationType;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { organizationName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { collaborationReference: { $regex: search, $options: 'i' } },
      ];
    }

    const collaborations = await Collaboration.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await Collaboration.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Collaboration.countDocuments(),
      pending: await Collaboration.countDocuments({ status: 'pending' }),
      underReview: await Collaboration.countDocuments({ status: 'under-review' }),
      approved: await Collaboration.countDocuments({ status: 'approved' }),
      activePartnerships: await Collaboration.countDocuments({ status: 'active-partnership' }),
      declined: await Collaboration.countDocuments({ status: 'declined' }),
    };

    res.json({
      success: true,
      data: collaborations,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get collaborations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update collaboration status (Admin only)
// @route PATCH /api/collaborate/:id/status
// @access Private (Admin)
exports.updateCollaborationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, organizationType, partnershipType, priority, declineReason, reviewedBy, notes, meetingDate, partnershipStartDate } = req.body;

    const updateData = {};
    
    if (status && ['pending', 'under-review', 'meeting-scheduled', 'in-discussion', 'approved', 'active-partnership', 'declined', 'on-hold'].includes(status)) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      
      if (status === 'declined' && declineReason) {
        updateData.declineReason = declineReason;
      }
      
      if (status === 'active-partnership' && partnershipStartDate) {
        updateData.partnershipStartDate = new Date(partnershipStartDate);
      }
    }
    
    if (organizationType && ['ngo', 'corporate', 'government', 'institution', 'individual', 'startup', 'other'].includes(organizationType)) {
      updateData.organizationType = organizationType;
    }
    
    if (partnershipType && ['project-based', 'long-term', 'funding', 'resource-sharing', 'knowledge-exchange', 'advocacy', 'other'].includes(partnershipType)) {
      updateData.partnershipType = partnershipType;
    }
    
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      updateData.priority = priority;
    }
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }
    
    if (notes) {
      updateData.notes = sanitizeInput(notes);
    }
    
    if (meetingDate) {
      updateData.meetingDate = new Date(meetingDate);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    const collaboration = await Collaboration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!collaboration) {
      return res.status(404).json({ 
        success: false,
        message: 'Collaboration request not found' 
      });
    }

    // Send status update email to requester
    try {
      await sendCollaborationStatusUpdateEmail(collaboration);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      success: true,
      message: 'Collaboration status updated successfully',
      data: collaboration,
    });
  } catch (error) {
    console.error('Update collaboration status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to requester
const sendCollaborationConfirmationEmail = async (collaboration) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping collaboration confirmation');
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
    to: collaboration.email,
    subject: 'Partnership Request Received - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Partnership Request Received!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${collaboration.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your interest in partnering with MAD Foundation! We're excited about the potential collaboration opportunities with ${collaboration.organizationName}.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="color: #1f2937; margin-top: 0;">Partnership Request Details:</h3>
            <p style="margin: 8px 0;"><strong>Reference ID:</strong> ${collaboration.collaborationReference}</p>
            <p style="margin: 8px 0;"><strong>Organization:</strong> ${collaboration.organizationName}</p>
            <p style="margin: 8px 0;"><strong>Area of Interest:</strong> ${collaboration.areaOfInterest}</p>
            <p style="margin: 8px 0;"><strong>Submitted:</strong> ${collaboration.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> Under Review</p>
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">What Happens Next:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Our partnership team will review your submission within 48 hours</li>
              <li>We'll contact you to discuss potential collaboration opportunities</li>
              <li>If there's mutual interest, we'll schedule a meeting to explore partnerships</li>
              <li>You'll receive updates about your request status via email</li>
            </ul>
          </div>
          
          ${collaboration.message ? `
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Your Message:</h3>
              <p style="color: #4b5563; line-height: 1.6; font-style: italic;">
                "${collaboration.message}"
              </p>
            </div>
          ` : ''}
          
          <p style="color: #4b5563; line-height: 1.6;">
            We appreciate your commitment to creating a more inclusive world and look forward to potentially working together.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Learn More About Our Work
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Looking forward to potential collaboration,<br>
            The MAD Foundation Partnership Team
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
const sendCollaborationNotificationEmail = async (collaboration) => {
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
    subject: 'New Partnership Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Partnership Request</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Organization Information:</h3>
          <p><strong>Contact Person:</strong> ${collaboration.fullName}</p>
          <p><strong>Organization:</strong> ${collaboration.organizationName}</p>
          <p><strong>Email:</strong> ${collaboration.email}</p>
          <p><strong>Mobile:</strong> ${collaboration.mobile}</p>
          <p><strong>Reference ID:</strong> ${collaboration.collaborationReference}</p>
          <p><strong>Area of Interest:</strong> ${collaboration.areaOfInterest}</p>
          <p><strong>Submitted at:</strong> ${collaboration.createdAt.toLocaleString()}</p>
          
          ${collaboration.message ? `
            <h4 style="color: #1f2937; margin-top: 20px;">Message:</h4>
            <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #2563eb;">
              <p style="color: #4b5563; line-height: 1.6; margin: 0;">
                ${collaboration.message}
              </p>
            </div>
          ` : ''}
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0;">
            <strong>Action Required:</strong> Please review this partnership request and contact the organization within 48 hours.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send status update email
const sendCollaborationStatusUpdateEmail = async (collaboration) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || collaboration.status === 'pending') {
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
  
  switch (collaboration.status) {
    case 'meeting-scheduled':
      subject = 'Meeting Scheduled - Partnership Discussion';
      content = `
        <p style="color: #2563eb;">We're pleased to inform you that a meeting has been scheduled to discuss potential partnership opportunities.</p>
        ${collaboration.meetingDate ? `<p><strong>Meeting Date:</strong> ${collaboration.meetingDate.toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>` : ''}
        <p>Our team will contact you with detailed meeting information shortly.</p>
      `;
      break;
    case 'approved':
      subject = 'Partnership Approved - MAD Foundation';
      content = `
        <p style="color: #16a34a;">Great news! Your partnership proposal has been approved by MAD Foundation.</p>
        <p>We're excited to move forward with this collaboration and will be in touch to finalize partnership details.</p>
        ${collaboration.partnershipType ? `<p><strong>Partnership Type:</strong> ${collaboration.partnershipType}</p>` : ''}
      `;
      break;
    case 'active-partnership':
      subject = 'Partnership Now Active - MAD Foundation';
      content = `
        <p style="color: #16a34a;">Congratulations! Our partnership is now officially active.</p>
        ${collaboration.partnershipStartDate ? `<p><strong>Partnership Start Date:</strong> ${collaboration.partnershipStartDate.toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        })}</p>` : ''}
        <p>We look forward to working together towards creating a more inclusive world.</p>
      `;
      break;
    case 'declined':
      subject = 'Partnership Request Update';
      content = `
        <p style="color: #dc2626;">Thank you for your interest in partnering with MAD Foundation. After careful review, we've decided not to proceed with this partnership at this time.</p>
        ${collaboration.declineReason ? `<p><strong>Reason:</strong> ${collaboration.declineReason}</p>` : ''}
        <p>We appreciate your commitment to our shared mission and encourage you to reach out for future opportunities.</p>
      `;
      break;
    default:
      return; // Don't send email for other statuses
  }

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: collaboration.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Partnership Request Update</h2>
        <p>Dear ${collaboration.fullName},</p>
        ${content}
        <p><strong>Reference ID:</strong> ${collaboration.collaborationReference}</p>
        <p><strong>Organization:</strong> ${collaboration.organizationName}</p>
        <p>Best regards,<br>The MAD Foundation Partnership Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};