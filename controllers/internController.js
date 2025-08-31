const Intern = require('../models/intern');
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

// @desc Submit internship application
// @route POST /api/intern/apply
// @access Public
exports.applyInternship = async (req, res) => {
  try {
    let { fullName, email, mobile, internshipArea, education, motivation } = req.body;

    // Input validation
    if (!fullName || !email || !mobile || !internshipArea || !motivation) {
      return res.status(400).json({ 
        success: false,
        message: 'All required fields must be filled' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    mobile = sanitizeInput(mobile);
    internshipArea = sanitizeInput(internshipArea);
    education = education ? sanitizeInput(education) : '';
    motivation = sanitizeInput(motivation);

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

    // Validate internship area
    const validAreas = ['Research & Policy', 'Content Development', 'Event Coordination', 'Social Media', 'Assistive Technology', 'More'];
    if (!validAreas.includes(internshipArea)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid internship area selected' 
      });
    }

    // Validate motivation
    if (motivation.length < 20 || motivation.length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Motivation must be between 20-1000 characters' 
      });
    }

    // Validate education length if provided
    if (education && education.length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Education background must be less than 1000 characters' 
      });
    }

    // Check if email already exists
    const existingIntern = await Intern.findOne({ email });
    if (existingIntern) {
      return res.status(400).json({ 
        success: false,
        message: 'An internship application with this email already exists' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create internship application
    const intern = await Intern.create({
      fullName,
      email,
      mobile: mobileValidation.cleanPhone,
      internshipArea,
      education,
      motivation,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to applicant
    // try {
    //   await sendInternConfirmationEmail(intern);
    // } catch (emailError) {
    //   console.error('Failed to send intern confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendInternNotificationEmail(intern);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for applying for an internship with MAD Foundation. Our team will review your application and get in touch with you soon.',
      data: {
        internReference: intern.internReference,
        submittedAt: intern.createdAt,
      },
    });

  } catch (error) {
    console.error('Internship application error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'An internship application with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all interns (Admin only)
// @route GET /api/intern/all
// @access Private (Admin)
exports.getAllInterns = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, internshipArea, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['pending', 'under-review', 'interview-scheduled', 'accepted', 'rejected', 'completed'].includes(status)) {
      query.status = status;
    }
    
    // Filter by internship area
    if (internshipArea && ['Research & Policy', 'Content Development', 'Event Coordination', 'Social Media', 'Assistive Technology', 'More'].includes(internshipArea)) {
      query.internshipArea = internshipArea;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { internReference: { $regex: search, $options: 'i' } },
        { motivation: { $regex: search, $options: 'i' } },
      ];
    }

    const interns = await Intern.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await Intern.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Intern.countDocuments(),
      pending: await Intern.countDocuments({ status: 'pending' }),
      underReview: await Intern.countDocuments({ status: 'under-review' }),
      accepted: await Intern.countDocuments({ status: 'accepted' }),
      completed: await Intern.countDocuments({ status: 'completed' }),
      rejected: await Intern.countDocuments({ status: 'rejected' }),
    };

    res.json({
      success: true,
      data: interns,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get interns error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update intern status (Admin only)
// @route PATCH /api/intern/:id/status
// @access Private (Admin)
exports.updateInternStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, duration, rejectionReason, reviewedBy, notes, mentor, interviewDate, startDate, endDate } = req.body;

    const updateData = {};
    
    if (status && ['pending', 'under-review', 'interview-scheduled', 'accepted', 'rejected', 'completed'].includes(status)) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      
      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }
    
    if (duration && ['1-month', '3-months', '6-months', 'flexible'].includes(duration)) {
      updateData.duration = duration;
    }
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }
    
    if (notes) {
      updateData.notes = sanitizeInput(notes);
    }
    
    if (mentor) {
      updateData.mentor = mentor;
    }
    
    if (interviewDate) {
      updateData.interviewDate = new Date(interviewDate);
    }
    
    if (startDate) {
      updateData.startDate = new Date(startDate);
    }
    
    if (endDate) {
      updateData.endDate = new Date(endDate);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    const intern = await Intern.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!intern) {
      return res.status(404).json({ 
        success: false,
        message: 'Internship application not found' 
      });
    }

    // Send status update email to applicant
    try {
      await sendInternStatusUpdateEmail(intern);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      success: true,
      message: 'Internship status updated successfully',
      data: intern,
    });
  } catch (error) {
    console.error('Update intern status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to applicant
const sendInternConfirmationEmail = async (intern) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping intern confirmation');
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
    to: intern.email,
    subject: 'Internship Application Received - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Application Received!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${intern.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for applying for an internship with MAD Foundation! We've received your application and are excited about your interest in joining our mission.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="color: #1f2937; margin-top: 0;">Application Details:</h3>
            <p style="margin: 8px 0;"><strong>Reference ID:</strong> ${intern.internReference}</p>
            <p style="margin: 8px 0;"><strong>Applied for:</strong> ${intern.internshipArea}</p>
            <p style="margin: 8px 0;"><strong>Submitted:</strong> ${intern.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> Under Review</p>
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">What Happens Next:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Our team will review your application within 5-7 business days</li>
              <li>If selected, we'll contact you to schedule an interview</li>
              <li>You'll receive updates about your application status via email</li>
              <li>Successful candidates will be provided with internship details and start dates</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Your Motivation:</h3>
            <p style="color: #4b5563; line-height: 1.6; font-style: italic;">
              "${intern.motivation}"
            </p>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            We appreciate your interest in contributing to our work towards building a more inclusive society.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Learn More About Our Work
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Best of luck with your application!<br>
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
const sendInternNotificationEmail = async (intern) => {
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
    subject: 'New Internship Application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Internship Application</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Applicant Information:</h3>
          <p><strong>Name:</strong> ${intern.fullName}</p>
          <p><strong>Email:</strong> ${intern.email}</p>
          <p><strong>Mobile:</strong> ${intern.mobile}</p>
          <p><strong>Reference ID:</strong> ${intern.internReference}</p>
          <p><strong>Internship Area:</strong> ${intern.internshipArea}</p>
          <p><strong>Applied at:</strong> ${intern.createdAt.toLocaleString()}</p>
          
          ${intern.education ? `
            <h4 style="color: #1f2937; margin-top: 20px;">Educational Background:</h4>
            <div style="background-color: white; padding: 15px; border-radius: 4px;">
              <p style="color: #4b5563; line-height: 1.6; margin: 0;">
                ${intern.education}
              </p>
            </div>
          ` : ''}
          
          <h4 style="color: #1f2937; margin-top: 20px;">Motivation:</h4>
          <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #2563eb;">
            <p style="color: #4b5563; line-height: 1.6; margin: 0;">
              ${intern.motivation}
            </p>
          </div>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0;">
            <strong>Action Required:</strong> Please review this internship application and update the status accordingly.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send status update email
const sendInternStatusUpdateEmail = async (intern) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || intern.status === 'pending') {
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
  
  switch (intern.status) {
    case 'interview-scheduled':
      subject = 'Interview Scheduled - MAD Foundation Internship';
      content = `
        <p style="color: #2563eb;">Great news! Your internship application has progressed to the interview stage.</p>
        ${intern.interviewDate ? `<p><strong>Interview Date:</strong> ${intern.interviewDate.toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>` : ''}
        <p>Our team will contact you with detailed interview information shortly.</p>
      `;
      break;
    case 'accepted':
      subject = 'Congratulations! Internship Offer - MAD Foundation';
      content = `
        <p style="color: #16a34a;">Congratulations! We're pleased to offer you an internship position with MAD Foundation.</p>
        ${intern.startDate ? `<p><strong>Start Date:</strong> ${intern.startDate.toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        })}</p>` : ''}
        ${intern.duration ? `<p><strong>Duration:</strong> ${intern.duration}</p>` : ''}
        ${intern.mentor ? `<p><strong>Mentor:</strong> ${intern.mentor}</p>` : ''}
        <p>We'll be in touch with detailed onboarding information soon.</p>
      `;
      break;
    case 'rejected':
      subject = 'Update on Your Internship Application';
      content = `
        <p style="color: #dc2626;">Thank you for your interest in interning with MAD Foundation. After careful review, we've decided not to proceed with your application at this time.</p>
        ${intern.rejectionReason ? `<p><strong>Feedback:</strong> ${intern.rejectionReason}</p>` : ''}
        <p>We encourage you to apply for future opportunities as they become available.</p>
      `;
      break;
    case 'completed':
      subject = 'Internship Completion - MAD Foundation';
      content = `
        <p style="color: #16a34a;">Congratulations on successfully completing your internship with MAD Foundation!</p>
        <p>Thank you for your valuable contributions to our mission. We hope this experience has been enriching for your career development.</p>
        <p>We'd love to stay connected and potentially collaborate in the future.</p>
      `;
      break;
    default:
      return; // Don't send email for other statuses
  }

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: intern.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Internship Application Update</h2>
        <p>Dear ${intern.fullName},</p>
        ${content}
        <p><strong>Reference ID:</strong> ${intern.internReference}</p>
        <p>Best regards,<br>The MAD Foundation Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};