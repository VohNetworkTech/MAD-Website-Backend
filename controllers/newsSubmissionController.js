const NewsSubmission = require('../models/newsSubmission');
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

// @desc Submit news update
// @route POST /api/news/submit
// @access Public
exports.submitNewsUpdate = async (req, res) => {
  try {
    let { fullName, email, newsUpdate } = req.body;

    // Input validation
    if (!fullName || !email || !newsUpdate) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Sanitize inputs
    fullName = sanitizeInput(fullName);
    email = sanitizeInput(email.toLowerCase());
    newsUpdate = sanitizeInput(newsUpdate);

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

    // Validate news update
    if (newsUpdate.length < 10 || newsUpdate.length > 2000) {
      return res.status(400).json({ 
        success: false,
        message: 'News update must be between 10-2000 characters' 
      });
    }

    // Check for duplicate submissions (same email and similar content within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existingSubmission = await NewsSubmission.findOne({
      email,
      createdAt: { $gte: oneHourAgo }
    });

    if (existingSubmission) {
      return res.status(429).json({ 
        success: false,
        message: 'Please wait at least one hour before submitting another news update' 
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create news submission
    const submission = await NewsSubmission.create({
      fullName,
      email,
      newsUpdate,
      ipAddress,
      userAgent,
    });

    // Send confirmation email to submitter
    // try {
    //   await sendSubmissionConfirmationEmail(submission);
    // } catch (emailError) {
    //   console.error('Failed to send confirmation email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // // Send notification email to admin
    // try {
    //   await sendSubmissionNotificationEmail(submission);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification email:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for sharing your news with MAD Foundation. We appreciate your contribution to our community updates.',
      data: {
        submissionReference: submission.submissionReference,
        submittedAt: submission.createdAt,
      },
    });

  } catch (error) {
    console.error('News submission error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Get all news submissions (Admin only)
// @route GET /api/news/submissions
// @access Private (Admin)
exports.getAllSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['pending', 'under-review', 'approved', 'published', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { newsUpdate: { $regex: search, $options: 'i' } },
        { submissionReference: { $regex: search, $options: 'i' } },
      ];
    }

    const submissions = await NewsSubmission.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress'); // Hide sensitive info

    const total = await NewsSubmission.countDocuments(query);

    // Get statistics
    const stats = {
      total: await NewsSubmission.countDocuments(),
      pending: await NewsSubmission.countDocuments({ status: 'pending' }),
      underReview: await NewsSubmission.countDocuments({ status: 'under-review' }),
      approved: await NewsSubmission.countDocuments({ status: 'approved' }),
      published: await NewsSubmission.countDocuments({ status: 'published' }),
      rejected: await NewsSubmission.countDocuments({ status: 'rejected' }),
    };

    res.json({
      success: true,
      data: submissions,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get news submissions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Update submission status (Admin only)
// @route PATCH /api/news/:id/status
// @access Private (Admin)
exports.updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, category, rejectionReason, reviewedBy } = req.body;

    const updateData = {};
    
    if (status && ['pending', 'under-review', 'approved', 'published', 'rejected'].includes(status)) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      
      if (status === 'published') {
        updateData.publishedAt = new Date();
      }
      
      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }
    
    if (category && ['announcement', 'event', 'achievement', 'accessibility', 'inclusion', 'other'].includes(category)) {
      updateData.category = category;
    }
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    const submission = await NewsSubmission.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({ 
        success: false,
        message: 'News submission not found' 
      });
    }

    // Send status update email to submitter
    try {
      await sendStatusUpdateEmail(submission);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      success: true,
      message: 'Submission status updated successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Update submission status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send confirmation email to submitter
const sendSubmissionConfirmationEmail = async (submission) => {
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
    to: submission.email,
    subject: 'News Submission Received - MAD Foundation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">News Submission Received!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Dear ${submission.fullName},
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Thank you for sharing your news with MAD Foundation! We appreciate your contribution to our community updates.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
            <h3 style="color: #1f2937; margin-top: 0;">Submission Details:</h3>
            <p style="margin: 8px 0;"><strong>Reference ID:</strong> ${submission.submissionReference}</p>
            <p style="margin: 8px 0;"><strong>Submitted:</strong> ${submission.createdAt.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> Under Review</p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">What's Next:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li>Our team will review your submission for alignment with our mission</li>
              <li>If approved, your news may be featured on our platform</li>
              <li>You'll receive updates about the status of your submission</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Your Submission:</h3>
            <p style="color: #4b5563; line-height: 1.6; font-style: italic;">
              "${submission.newsUpdate}"
            </p>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Thank you for being part of our mission to create a more inclusive world.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Visit Our Website
            </a>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Best regards,<br>
            The MAD Foundation Team
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            For any queries, please contact us at <a href="mailto:contact@mad-foundation.org" style="color: #ea580c;">contact@mad-foundation.org</a>
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send notification email to admin
const sendSubmissionNotificationEmail = async (submission) => {
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
    subject: 'New News Submission for Review',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">New News Submission for Review</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Submission Details:</h3>
          <p><strong>Submitter:</strong> ${submission.fullName}</p>
          <p><strong>Email:</strong> ${submission.email}</p>
          <p><strong>Reference ID:</strong> ${submission.submissionReference}</p>
          <p><strong>Submitted at:</strong> ${submission.createdAt.toLocaleString()}</p>
          
          <h4 style="color: #1f2937; margin-top: 20px;">News Content:</h4>
          <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #ea580c;">
            <p style="color: #4b5563; line-height: 1.6; margin: 0;">
              ${submission.newsUpdate}
            </p>
          </div>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0;">
            <strong>Action Required:</strong> Please review this submission and update its status accordingly.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send status update email
const sendStatusUpdateEmail = async (submission) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || submission.status === 'pending') {
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
  
  switch (submission.status) {
    case 'approved':
      subject = 'Your News Submission Has Been Approved!';
      content = `
        <p style="color: #16a34a;">Great news! Your submission has been approved and will be featured on our platform soon.</p>
        <p>We appreciate your valuable contribution to our community updates.</p>
      `;
      break;
    case 'published':
      subject = 'Your News Has Been Published!';
      content = `
        <p style="color: #16a34a;">Congratulations! Your news update is now live on our platform.</p>
        <p>Thank you for sharing your story with the MAD Foundation community.</p>
      `;
      break;
    case 'rejected':
      subject = 'Update on Your News Submission';
      content = `
        <p style="color: #dc2626;">Thank you for your submission. After review, we've decided not to feature this particular update.</p>
        ${submission.rejectionReason ? `<p><strong>Reason:</strong> ${submission.rejectionReason}</p>` : ''}
        <p>We encourage you to submit other relevant news and updates in the future.</p>
      `;
      break;
    default:
      return; // Don't send email for other statuses
  }

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: submission.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">News Submission Update</h2>
        <p>Dear ${submission.fullName},</p>
        ${content}
        <p><strong>Reference ID:</strong> ${submission.submissionReference}</p>
        <p>Best regards,<br>The MAD Foundation Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};