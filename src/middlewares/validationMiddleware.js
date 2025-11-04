const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware using express-validator
 * Validates request data according to document requirements
 */

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * User Signup Validation
 * As per document: firstname, lastname, email, mobile, DOB, location, address, occupation, password
 */
const validateUserSignup = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('First name can only contain letters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Last name can only contain letters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  body('dateOfBirth')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Please provide a valid date')
    .custom((value) => {
      const age = Math.floor((new Date() - new Date(value)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        throw new Error('You must be at least 18 years old to register');
      }
      return true;
    }),

  body('occupation')
    .trim()
    .notEmpty().withMessage('Occupation is required'),

  body('address.houseAndStreet')
    .trim()
    .notEmpty().withMessage('House and street address is required'),

  body('address.district')
    .trim()
    .notEmpty().withMessage('District is required'),

  body('address.state')
    .trim()
    .notEmpty().withMessage('State is required'),

  body('address.country')
    .trim()
    .notEmpty().withMessage('Country is required'),

  body('address.pinCode')
    .trim()
    .notEmpty().withMessage('Pin code is required')
    .matches(/^[0-9]{6}$/).withMessage('Pin code must be exactly 6 digits'),

  body('location.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 }).withMessage('Location coordinates must be an array of [longitude, latitude]'),

  handleValidationErrors
];

/**
 * User Login Validation
 */
const validateLogin = [
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors
];

/**
 * OTP Login Validation
 */
const validateOTPLogin = [
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),

  handleValidationErrors
];

/**
 * Verify OTP Validation
 */
const validateVerifyOTP = [
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),

  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),

  handleValidationErrors
];

/**
 * Cattle Registration Validation
 * As per document: breed, tagNo, medicalHistory, age, images (14 total)
 */
const validateCattleRegistration = [
  body('breed')
    .trim()
    .notEmpty().withMessage('Breed is required'),

  body('tagNo')
    .optional()
    .trim(),

  body('medicalHistory')
    .optional()
    .trim(),

  body('age')
    .notEmpty().withMessage('Age is required')
    .isInt({ min: 0, max: 50 }).withMessage('Age must be between 0 and 50 years'),

  body('type')
    .optional()
    .trim(),

  body('color')
    .optional()
    .trim(),

  handleValidationErrors
];

/**
 * Cattle ID Validation
 */
const validateCattleId = [
  param('cattleId')
    .notEmpty().withMessage('Cattle ID is required')
    .isMongoId().withMessage('Invalid cattle ID format'),

  handleValidationErrors
];

/**
 * Admin Approval/Rejection Validation
 */
const validateAdminDecision = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['approved', 'rejected']).withMessage('Status must be either approved or rejected'),

  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty().withMessage('Rejection reason is required when rejecting'),

  handleValidationErrors
];

/**
 * Transfer Request Validation
 */
const validateTransferRequest = [
  body('cattleId')
    .notEmpty().withMessage('Cattle ID is required')
    .isMongoId().withMessage('Invalid cattle ID'),

  body('toOwnerId')
    .notEmpty().withMessage('New owner ID is required')
    .isMongoId().withMessage('Invalid owner ID'),

  body('transferType')
    .optional()
    .isIn(['sell', 'gift', 'inheritance', 'other']).withMessage('Invalid transfer type'),

  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('notes')
    .optional()
    .trim(),

  handleValidationErrors
];

/**
 * Email Validation
 */
const validateEmail = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

/**
 * Password Reset Validation
 */
const validatePasswordReset = [
  body('password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  handleValidationErrors
];

/**
 * Change Password Validation
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),

  handleValidationErrors
];

/**
 * Search Query Validation
 */
const validateSearchQuery = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 }).withMessage('Search query cannot be empty'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
];

/**
 * Pagination Validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  handleValidationErrors
];

/**
 * Phone Number Validation
 */
const validatePhoneNumber = [
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),

  handleValidationErrors
];



// ADD THIS CODE TO YOUR EXISTING validationMiddleware.js

const validateIdentificationRequest = [
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('deviceInfo')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Device info must be less than 200 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];


module.exports = {
  handleValidationErrors,
  validateUserSignup,
  validateLogin,
  validateOTPLogin,
  validateVerifyOTP,
  validateCattleRegistration,
  validateCattleId,
  validateAdminDecision,
  validateTransferRequest,
  validateEmail,
  validatePasswordReset,
  validateChangePassword,
  validateSearchQuery,
  validatePagination,
  validatePhoneNumber,
  validateIdentificationRequest
};