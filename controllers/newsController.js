const Newsletter = require('../models/news');
const crypto = require('crypto');
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

// @desc Subscribe to newsletter
// @route POST /api/newsletter/subscribe
// @access Public
exports.subscribeNewsletter = async (req, res) => {
  try {
    let { email } = req.body;

    // Input validation
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    // Sanitize email
    email = sanitizeInput(email.toLowerCase());

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: emailValidation.message 
      });
    }

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email });
    
    if (existingSubscriber) {
      if (existingSubscriber.status === 'active') {
        return res.status(400).json({ 
          success: false,
          message: 'This email is already subscribed to our newsletter' 
        });
      } else if (existingSubscriber.status === 'unsubscribed') {
        // Reactivate subscription
        existingSubscriber.status = 'active';
        existingSubscriber.subscribedAt = new Date();
        existingSubscriber.unsubscribedAt = undefined;
        existingSubscriber.unsubscribeToken = crypto.randomBytes(32).toString('hex');
        await existingSubscriber.save();

        // Send reactivation confirmation
        // try {
        //   await sendWelcomeEmail(existingSubscriber);
        // } catch (emailError) {
        //   console.error('Failed to send welcome email:', emailError);
        // }

        return res.status(200).json({
          success: true,
          message: 'Welcome back! Your subscription has been reactivated.',
          data: {
            id: existingSubscriber._id,
            subscribedAt: existingSubscriber.subscribedAt,
          },
        });
      }
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    // Create new subscription
    const subscriber = await Newsletter.create({
      email,
      ipAddress,
      userAgent,
      unsubscribeToken: crypto.randomBytes(32).toString('hex'),
    });

    // Send welcome email
    // try {
    //   await sendWelcomeEmail(subscriber);
    // } catch (emailError) {
    //   console.error('Failed to send welcome email:', emailError);
    //   // Don't fail the request if email fails
    // }

    // Send notification to admin
    // try {
    //   await sendSubscriptionNotification(subscriber);
    // } catch (emailError) {
    //   console.error('Failed to send admin notification:', emailError);
    //   // Don't fail the request if email fails
    // }

    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing! Check your email for confirmation.',
      data: {
        id: subscriber._id,
        subscribedAt: subscriber.subscribedAt,
      },
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'This email is already subscribed to our newsletter' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal server error. Please try again later.' 
    });
  }
};

// @desc Unsubscribe from newsletter
// @route GET /api/newsletter/unsubscribe/:token
// @access Public
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid unsubscribe token' 
      });
    }

    const subscriber = await Newsletter.findOne({ unsubscribeToken: token });

    if (!subscriber) {
      return res.status(404).json({ 
        success: false,
        message: 'Invalid or expired unsubscribe link' 
      });
    }

    // Update subscription status
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter.',
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// @desc Get all subscribers (Admin only)
// @route GET /api/newsletter/subscribers
// @access Private (Admin)
exports.getAllSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['active', 'inactive', 'unsubscribed'].includes(status)) {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    const subscribers = await Newsletter.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAgent -ipAddress -unsubscribeToken'); // Hide sensitive info

    const total = await Newsletter.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Newsletter.countDocuments(),
      active: await Newsletter.countDocuments({ status: 'active' }),
      unsubscribed: await Newsletter.countDocuments({ status: 'unsubscribed' }),
    };

    res.json({
      success: true,
      data: subscribers,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// Helper function to send welcome email
const sendWelcomeEmail = async (subscriber) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping welcome email');
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

  const unsubscribeUrl = `${process.env.CLIENT_URL}/api/newsletter/unsubscribe/${subscriber.unsubscribeToken}`;

  const mailOptions = {
    from: `"MAD Foundation" <${process.env.EMAIL_USER}>`,
    to: subscriber.email,
    subject: 'Welcome to MAD Foundation Newsletter!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Our Community!</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">
            Thank you for subscribing to the MAD Foundation newsletter!
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            You're now part of our mission to create a more inclusive world. Here's what you can expect:
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <ul style="color: #374151; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">📈 Monthly impact reports and success stories</li>
              <li style="margin-bottom: 10px;">🤝 Volunteer opportunities and events</li>
              <li style="margin-bottom: 10px;">📧 Updates on our ongoing projects</li>
              <li style="margin-bottom: 10px;">🌟 Exclusive content from our team</li>
            </ul>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Together, we can make a difference in the lives of those who need it most.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Visit Our Website
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            If you didn't subscribe to this newsletter, you can 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">unsubscribe here</a>.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send subscription notification to admin
const sendSubscriptionNotification = async (subscriber) => {
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
    subject: 'New Newsletter Subscription',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Newsletter Subscription</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${subscriber.email}</p>
          <p><strong>Subscribed at:</strong> ${subscriber.subscribedAt.toLocaleString()}</p>
          <p><strong>Source:</strong> ${subscriber.source}</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};