const User = require("../models/user");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const validator = require("validator");

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "12h" });
};

// Email validation function
const validateEmail = (email) => {
  // Check if email is valid format
  if (!validator.isEmail(email)) {
    return { isValid: false, message: "Invalid email format" };
  }
  
  // Check email length (reasonable limits)
  if (email.length > 254) {
    return { isValid: false, message: "Email too long" };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.{2,}/, // Multiple consecutive dots
    /^\./, // Starting with dot
    /\.$/, // Ending with dot
    /@.*@/, // Multiple @ symbols
    /[<>]/, // HTML injection attempts
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return { isValid: false, message: "Invalid email format" };
  }
  
  return { isValid: true };
};

// Phone number validation function
const validatePhoneNumber = (phoneNumber) => {
  // Check if phoneNumber exists and convert to string
  if (!phoneNumber) {
    return { isValid: false, message: "Phone number is required" };
  }
  
  // Convert to string if it's not already (handles numbers passed as integers)
  const phoneStr = String(phoneNumber);
  
  // Remove all non-digit characters for validation
  const cleanPhone = phoneStr.replace(/\D/g, '');
  
  // Check if phone number is empty after cleaning
  if (!cleanPhone) {
    return { isValid: false, message: "Phone number is required" };
  }
  
  // Check length (10-15 digits is reasonable for international numbers)
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { isValid: false, message: "Phone number must be between 10-15 digits" };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^0{10,}$/, // All zeros
    /^1{10,}$/, // All ones
    /^(.)\1{9,}$/, // Repeated same digit
    /[<>]/, // HTML injection attempts
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(phoneStr))) {
    return { isValid: false, message: "Invalid phone number format" };
  }
  
  return { isValid: true, cleanPhone };
};

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
};

// @desc Signup
exports.signup = async (req, res) => {
  try {
    let { name, email, phoneNumber, password } = req.body;
    
    // Input validation
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    // Sanitize inputs
    name = sanitizeInput(name);
    email = sanitizeInput(email.toLowerCase());
    phoneNumber = sanitizeInput(phoneNumber);
    
    // Validate name
    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ message: "Name must be between 2-50 characters" });
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ message: emailValidation.message });
    }
    
    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ message: phoneValidation.message });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }
    
    // Check for password strength
    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordStrengthRegex.test(password)) {
      return res.status(400).json({ 
        message: "Password must contain at least one lowercase letter, one uppercase letter, and one number" 
      });
    }
    
    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { email },
        { phoneNumber: phoneValidation.cleanPhone }
      ]
    });
    
    if (user) {
      if (user.email === email) {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (user.phoneNumber === phoneValidation.cleanPhone) {
        return res.status(400).json({ message: "Phone number already registered" });
      }
    }

    user = await User.create({ 
      name, 
      email, 
      phoneNumber: phoneValidation.cleanPhone, 
      password , 
      role: "user" // Default role
    });
    
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role : user.role,
      token: generateToken(user.id),
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// @desc Login
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    
    // Sanitize email
    email = sanitizeInput(email.toLowerCase());
    
    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role : user.role,
      token: generateToken(user.id),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// @desc Forgot Password (Send Reset Email)
exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    
    // Input validation
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Sanitize email
    email = sanitizeInput(email.toLowerCase());
    
    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex"); // Increased token size
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // Hash the token
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save();

    // Setup email with better security
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      secure: true,
      tls: {
        rejectUnauthorized: true
      }
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: `"AuthApp" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click this link to reset your password: ${resetUrl}\n\nThis link will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your account.</p>
          <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p><strong>This link will expire in 10 minutes.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr>
          <p><small>If the button doesn't work, copy and paste this link: ${resetUrl}</small></p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: "Error sending reset email" });
  }
};

// You need to create this endpoint in your auth controller
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    
    const query = {};
    
    // Filter by role
    if (role && ['user', 'admin'].includes(role)) {
      query.role = role;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password'); // Never send passwords

    const total = await User.countDocuments(query);

    const stats = {
      total: await User.countDocuments(),
      admins: await User.countDocuments({ role: 'admin' }),
      users: await User.countDocuments({ role: 'user' })
    };

    res.json({
      success: true,
      data: users,
      stats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

