const express = require('express');
const router = express.Router();
const {
  userSignup,
  userLogin,
  requestLoginOTP,
  verifyLoginOTP,
  verifyMobile,
  resendOTP,
  forgotPassword,
  resetPassword,
  adminLogin,
  requestAdminLoginOTP,
  verifyAdminLoginOTP,
  getMe,
  logout
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { handleOptionalProfileUpload } = require('../middlewares/uploadMiddleware');
const {
  validateUserSignup,
  validateLogin,
  validateOTPLogin,
  validateVerifyOTP,
  validatePasswordReset,
  validatePhoneNumber
} = require('../middlewares/validationMiddleware');

/**
 * Authentication Routes
 * Handles user and admin authentication
 */

// ========== USER AUTHENTICATION ==========

/**
 * @route   POST /api/v1/auth/signup
 * @desc    User signup with profile picture (optional)
 * @access  Public
 */
router.post('/signup', handleOptionalProfileUpload, validateUserSignup, userSignup);

/**
 * @route   POST /api/v1/auth/login
 * @desc    User login with mobile number and password
 * @access  Public
 */
router.post('/login', validateLogin, userLogin);

/**
 * @route   POST /api/v1/auth/login/otp/request
 * @desc    Request OTP for login
 * @access  Public
 */
router.post('/login/otp/request', validateOTPLogin, requestLoginOTP);

/**
 * @route   POST /api/v1/auth/login/otp/verify
 * @desc    Verify OTP and login
 * @access  Public
 */
router.post('/login/otp/verify', validateVerifyOTP, verifyLoginOTP);

/**
 * @route   POST /api/v1/auth/verify/mobile
 * @desc    Verify mobile number with OTP
 * @access  Public
 */
router.post('/verify/mobile', validateVerifyOTP, verifyMobile);

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
router.post('/resend-otp', validatePhoneNumber, resendOTP);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request OTP for password reset
 * @access  Public
 */
router.post('/forgot-password', validatePhoneNumber, forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post('/reset-password', validatePasswordReset, resetPassword);

// ========== ADMIN AUTHENTICATION ==========

/**
 * @route   POST /api/v1/auth/admin/login
 * @desc    Admin login with email and password
 * @access  Public
 */
router.post('/admin/login', adminLogin);

/**
 * @route   POST /api/v1/auth/admin/login/otp/request
 * @desc    Request OTP for admin login
 * @access  Public
 */
router.post('/admin/login/otp/request', requestAdminLoginOTP);

/**
 * @route   POST /api/v1/auth/admin/login/otp/verify
 * @desc    Verify OTP and admin login
 * @access  Public
 */
router.post('/admin/login/otp/verify', verifyAdminLoginOTP);

// ========== COMMON ROUTES ==========

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user/admin
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user/admin
 * @access  Private
 */
router.post('/logout', protect, logout);

module.exports = router;