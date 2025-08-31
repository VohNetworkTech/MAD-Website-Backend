const Donation = require('../models/donation');
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

// Donation amount validation
const validateDonationAmount = (amount) => {
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, message: 'Please enter a valid donation amount' };
  }
  if (numAmount < 1) {
    return { isValid: false, message: 'Minimum donation amount is ₹1' };
  }
  if (numAmount > 10000000) {
    return { isValid: false, message: 'Maximum donation amount is ₹1,00,00,000' };
  }
  return { isValid: true, amount: numAmount };
};

// @desc Submit donation form
// @route POST /api/donation/submit
// @access Public
exports.submitDonationForm = async (req, res) => {
  try {
    let { fullName, email, mobile, donationAmount, donationType, message } = req.body;

    // Input validation
    if (!fullName || !email || !mobile || !donationAmount || !donationType) {
      return res.status(400).json({ 
        success: false,
        message: 'All required fields must be filled' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    mobile = sanitizeInput(mobile);
    donationType = sanitizeInput(donationType);
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

    // Validate donation amount
    const amountValidation = validateDonationAmount(donationAmount);
    if (!amountValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: amountValidation.message 
      });
    }

    // Validate donation type
    const validDonationTypes = ['One-Time', 'Monthly', 'Sponsor a Program', 'Corporate Donation'];
    if (!validDonationTypes.includes(donationType)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid donation type selected' 
      });
    }

    // Validate message length if provided
    if (message && message.length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be less than 1000 characters' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create donation entry
    const donation = await Donation.create({
      fullName,
      email,
      mobile: mobileValidation.cleanPhone,
      donationAmount: amountValidation.amount,
      donationType,
      message,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to donor
    // try {
    //   await sendDonorConfirmationEmail(donation);
    // } catch (emailError) {
    //   console.error('Failed to send donor confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendDonationNotificationEmail(donation);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for your generous intention! Our team will contact you with donation details shortly.',
      data: {
        donationReference: donation.donationReference,
        submittedAt: donation.createdAt,
      },
    });

  } catch (error) {
    console.error('Donation form submission error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all donations (Admin only)
// @route GET /api/donation/all
// @access Private (Admin)
exports.getAllDonations = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, donationType, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['pending', 'contacted', 'completed', 'cancelled'].includes(status)) {
      query.status = status;
    }
    
    // Filter by donation type
    if (donationType && ['One-Time', 'Monthly', 'Sponsor a Program', 'Corporate Donation'].includes(donationType)) {
      query.donationType = donationType;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { donationReference: { $regex: search, $options: 'i' } },
      ];
    }

    const donations = await Donation.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await Donation.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Donation.countDocuments(),
      pending: await Donation.countDocuments({ status: 'pending' }),
      completed: await Donation.countDocuments({ status: 'completed' }),
      totalAmount: await Donation.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$donationAmount' } } }
      ]).then(result => result[0]?.total || 0),
    };

    res.json({
      success: true,
      data: donations,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update donation status (Admin only)
// @route PATCH /api/donation/:id/status
// @access Private (Admin)
exports.updateDonationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const updateData = {};
    
    if (status && ['pending', 'contacted', 'completed', 'cancelled'].includes(status)) {
      updateData.status = status;
      if (status === 'contacted') updateData.contactedAt = new Date();
      if (status === 'completed') updateData.completedAt = new Date();
    }
    
    if (paymentStatus && ['pending', 'processing', 'completed', 'failed'].includes(paymentStatus)) {
      updateData.paymentStatus = paymentStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    const donation = await Donation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!donation) {
      return res.status(404).json({ 
        success: false,
        message: 'Donation not found' 
      });
    }

    res.json({
      success: true,
      message: 'Donation status updated successfully',
      data: donation,
    });
  } catch (error) {
    console.error('Update donation status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to donor
const sendDonorConfirmationEmail = async (donation) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping donor confirmation');
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
    to: donation.email,
    subject: 'Thank you for your donation intention - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Thank You for Your Generous Heart!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${donation.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your intention to support MAD Foundation. Your generosity helps us create a more inclusive world for people with disabilities.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="color: #1f2937; margin-top: 0;">Donation Details:</h3>
            <p style="margin: 8px 0;"><strong>Reference ID:</strong> ${donation.donationReference}</p>
            <p style="margin: 8px 0;"><strong>Amount:</strong> ₹${donation.donationAmount.toLocaleString('en-IN')}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${donation.donationType}</p>
            <p style="margin: 8px 0;"><strong>Submitted:</strong> ${donation.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            ${donation.message ? `<p style="margin: 8px 0;"><strong>Your Message:</strong> ${donation.message}</p>` : ''}
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Next Steps:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Our team will contact you within 24 hours with payment details</li>
              <li>You will receive secure payment instructions via email or phone</li>
              <li>Upon completion, you'll receive a donation receipt for tax benefits</li>
            </ul>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Your support directly impacts the lives of individuals with disabilities, helping them achieve independence and dignity.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Learn More About Our Impact
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            With gratitude,<br>
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
const sendDonationNotificationEmail = async (donation) => {
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
    subject: 'New Donation Form Submission',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Donation Form Submission</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Donor Information:</h3>
          <p><strong>Name:</strong> ${donation.fullName}</p>
          <p><strong>Email:</strong> ${donation.email}</p>
          <p><strong>Mobile:</strong> ${donation.mobile}</p>
          <p><strong>Amount:</strong> ₹${donation.donationAmount.toLocaleString('en-IN')}</p>
          <p><strong>Type:</strong> ${donation.donationType}</p>
          <p><strong>Reference ID:</strong> ${donation.donationReference}</p>
          ${donation.message ? `<p><strong>Message:</strong> ${donation.message}</p>` : ''}
          <p><strong>Submitted at:</strong> ${donation.createdAt.toLocaleString()}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0;">
            <strong>Action Required:</strong> Please contact the donor within 24 hours to provide payment instructions.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};