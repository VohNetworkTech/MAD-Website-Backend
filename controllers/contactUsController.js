const ContactUs = require('../models/contactUs');
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

// @desc Submit contact us form
// @route POST /api/contactus/submit
// @access Public
exports.submitContactUs = async (req, res) => {
  try {
    let { fullName, email, mobile, subject, message } = req.body;

    // Input validation
    if (!fullName || !email || !mobile || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    mobile = sanitizeInput(mobile);
    subject = sanitizeInput(subject);
    message = sanitizeInput(message);

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

    // Validate subject
    const validSubjects = ['general-inquiry', 'volunteering', 'internship', 'partnership', 'donation', 'other'];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid subject selected' 
      });
    }

    // Validate message
    if (message.length < 10 || message.length > 1500) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be between 10-1500 characters' 
      });
    }

    // Check for duplicate submissions (same email within last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingContact = await ContactUs.findOne({
      email,
      createdAt: { $gte: fifteenMinutesAgo }
    });

    if (existingContact) {
      return res.status(429).json({ 
        success: false,
        message: 'Please wait at least 15 minutes before submitting another contact request' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Set priority based on subject
    let priority = 'medium';
    if (subject === 'donation' || subject === 'partnership') {
      priority = 'high';
    } else if (subject === 'general-inquiry') {
      priority = 'low';
    }

    // Create contact us entry
    const contactUs = await ContactUs.create({
      fullName,
      email,
      mobile: mobileValidation.cleanPhone,
      subject,
      message,
      priority,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to user
    // try {
    //   await sendUserConfirmationEmail(contactUs);
    // } catch (emailError) {
    //   console.error('Failed to send user confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendAdminNotificationEmail(contactUs);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We have received your message and will get back to you soon.',
      data: {
        ticketReference: contactUs.ticketReference,
        submittedAt: contactUs.createdAt,
      },
    });

  } catch (error) {
    console.error('Contact us form submission error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all contact us submissions (Admin only)
// @route GET /api/contactus/all
// @access Private (Admin)
exports.getAllContactUs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, subject, priority, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }
    
    // Filter by subject
    if (subject && ['general-inquiry', 'volunteering', 'internship', 'partnership', 'donation', 'other'].includes(subject)) {
      query.subject = subject;
    }
    
    // Filter by priority
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      query.priority = priority;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { ticketReference: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const contacts = await ContactUs.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await ContactUs.countDocuments(query);

    // Get statistics
    const stats = {
      total: await ContactUs.countDocuments(),
      new: await ContactUs.countDocuments({ status: 'new' }),
      inProgress: await ContactUs.countDocuments({ status: 'in-progress' }),
      resolved: await ContactUs.countDocuments({ status: 'resolved' }),
      closed: await ContactUs.countDocuments({ status: 'closed' }),
      bySubject: {
        generalInquiry: await ContactUs.countDocuments({ subject: 'general-inquiry' }),
        volunteering: await ContactUs.countDocuments({ subject: 'volunteering' }),
        internship: await ContactUs.countDocuments({ subject: 'internship' }),
        partnership: await ContactUs.countDocuments({ subject: 'partnership' }),
        donation: await ContactUs.countDocuments({ subject: 'donation' }),
        other: await ContactUs.countDocuments({ subject: 'other' }),
      }
    };

    res.json({
      success: true,
      data: contacts,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get contact us submissions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update contact us status (Admin only)
// @route PATCH /api/contactus/:id/status
// @access Private (Admin)
exports.updateContactUsStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, notes } = req.body;

    const updateData = {};
    
    if (status && ['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
      updateData.status = status;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date();
      }
    }
    
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      updateData.priority = priority;
    }
    
    if (assignedTo) {
      updateData.assignedTo = assignedTo;
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

    const contactUs = await ContactUs.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!contactUs) {
      return res.status(404).json({ 
        success: false,
        message: 'Contact submission not found' 
      });
    }

    res.json({
      success: true,
      message: 'Contact status updated successfully',
      data: contactUs,
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to user
const sendUserConfirmationEmail = async (contactUs) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping user confirmation');
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

  const subjectLabels = {
    'general-inquiry': 'General Inquiry',
    'volunteering': 'Volunteering',
    'internship': 'Internship',
    'partnership': 'Partnership',
    'donation': 'Donation',
    'other': 'Other'
  };

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: contactUs.email,
    subject: 'We received your message - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Message Received!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${contactUs.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for contacting MAD Foundation! We have received your message and our team will get back to you soon.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="color: #1f2937; margin-top: 0;">Your Message Details:</h3>
            <p style="margin: 8px 0;"><strong>Ticket Reference:</strong> ${contactUs.ticketReference}</p>
            <p style="margin: 8px 0;"><strong>Subject:</strong> ${subjectLabels[contactUs.subject]}</p>
            <p style="margin: 8px 0;"><strong>Submitted:</strong> ${contactUs.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> Under Review</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Your Message:</h3>
            <p style="color: #4b5563; line-height: 1.6; font-style: italic;">
              "${contactUs.message}"
            </p>
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">What's Next:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Our team will review your message and respond within 24-48 hours</li>
              <li>For urgent matters, we may contact you sooner</li>
              <li>Please save your ticket reference for future correspondence</li>
            </ul>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            We appreciate your interest in MAD Foundation and look forward to connecting with you.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Visit Our Website
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Best regards,<br>
            The MAD Foundation Team
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            For immediate assistance, please call us at <a href="tel:+919915670267" style="color: #2563eb;">+91 9915670267</a>
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send notification email to admin
const sendAdminNotificationEmail = async (contactUs) => {
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

  const subjectLabels = {
    'general-inquiry': 'General Inquiry',
    'volunteering': 'Volunteering',
    'internship': 'Internship',
    'partnership': 'Partnership',
    'donation': 'Donation',
    'other': 'Other'
  };

  const mailOptions = {
    from: `"MAD Foundation Website" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `New Contact Us: ${subjectLabels[contactUs.subject]} - ${contactUs.priority.toUpperCase()} Priority`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Contact Us Submission</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Contact Information:</h3>
          <p><strong>Name:</strong> ${contactUs.fullName}</p>
          <p><strong>Email:</strong> ${contactUs.email}</p>
          <p><strong>Mobile:</strong> ${contactUs.mobile}</p>
          <p><strong>Subject:</strong> ${subjectLabels[contactUs.subject]}</p>
          <p><strong>Priority:</strong> <span style="color: ${contactUs.priority === 'high' ? '#dc2626' : contactUs.priority === 'medium' ? '#f59e0b' : '#16a34a'};">${contactUs.priority.toUpperCase()}</span></p>
          <p><strong>Ticket Reference:</strong> ${contactUs.ticketReference}</p>
          <p><strong>Submitted at:</strong> ${contactUs.createdAt.toLocaleString()}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1f2937; margin-top: 0;">Message:</h3>
          <p style="color: #4b5563; line-height: 1.6; margin: 0;">
            ${contactUs.message}
          </p>
        </div>
        
        <div style="background-color: ${contactUs.priority === 'high' ? '#fef3c7' : '#dbeafe'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${contactUs.priority === 'high' ? '#f59e0b' : '#2563eb'};">
          <p style="color: ${contactUs.priority === 'high' ? '#92400e' : '#1e40af'}; margin: 0;">
            <strong>Action Required:</strong> Please respond to this ${contactUs.priority} priority inquiry within ${contactUs.priority === 'high' ? '24 hours' : '48 hours'}.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};