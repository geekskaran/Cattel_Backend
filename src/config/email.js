const nodemailer = require('nodemailer');

/**
 * Email Configuration using NodeMailer
 * Supports Gmail and other SMTP services
 */

// Create transporter
const createTransporter = () => {
  // Check if email configuration exists
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email credentials not configured. Email services will be disabled.');
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false // For development only
    }
  });

  return transporter;
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('⚠️  Email configuration skipped - credentials not provided');
      return false;
    }

    await transporter.verify();
    console.log('✅ Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
    console.log('💡 Email services will continue without email functionality');
    return false;
  }
};

// Email templates
const emailTemplates = {
  // Email verification
  emailVerification: (name, verificationLink) => ({
    subject: 'Verify Your Email - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cattle Identification System</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${name}!</h2>
            <p>Thank you for registering with our Cattle Identification System.</p>
            <p>Please verify your email address by clicking the button below:</p>
            <center>
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </center>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // OTP email
  otpEmail: (name, otp) => ({
    subject: 'Your OTP - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .otp-box { background-color: #fff; border: 2px dashed #2196F3; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cattle Identification System</h1>
          </div>
          <div class="content">
            <h2>Hello, ${name}!</h2>
            <p>Your One-Time Password (OTP) for verification is:</p>
            <div class="otp-box">${otp}</div>
            <p>This OTP is valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
            <p><strong>Do not share this OTP with anyone.</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Password reset
  passwordReset: (name, resetLink) => ({
    subject: 'Reset Your Password - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF5722; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #FF5722; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cattle Identification System</h1>
          </div>
          <div class="content">
            <h2>Hello, ${name}!</h2>
            <p>You have requested to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <center>
              <a href="${resetLink}" class="button">Reset Password</a>
            </center>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Cattle approved notification
  cattleApproved: (name, cattleId) => ({
    subject: 'Cattle Registration Approved - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Registration Approved</h1>
          </div>
          <div class="content">
            <h2>Hello, ${name}!</h2>
            <p>Great news! Your cattle registration has been approved.</p>
            <p><strong>Cattle ID:</strong> ${cattleId}</p>
            <p>You can now view your cattle in the gallery under "Active" status.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Cattle rejected notification
  cattleRejected: (name, cattleId, reason) => ({
    subject: 'Cattle Registration Rejected - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Registration Rejected</h1>
          </div>
          <div class="content">
            <h2>Hello, ${name}!</h2>
            <p>Unfortunately, your cattle registration has been rejected.</p>
            <p><strong>Cattle ID:</strong> ${cattleId}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please review the reason and submit a new registration if needed.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Admin account approved
  adminApproved: (name, role) => ({
    subject: 'Admin Account Approved - Cattle Identification System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #673AB7; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Account Approved</h1>
          </div>
          <div class="content">
            <h2>Hello, ${name}!</h2>
            <p>Your admin account has been approved.</p>
            <p><strong>Role:</strong> ${role === 'regional_admin' ? 'Regional Admin' : 'Super Admin'}</p>
            <p>You can now log in and access the admin portal.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Cattle Identification System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

module.exports = {
  createTransporter,
  verifyEmailConfig,
  emailTemplates
};