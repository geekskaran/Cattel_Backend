const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  changePassword,
  updateEmail,
  updateMobileNumber,
  getUserCattle,
  getCattleDetails,
  getTransferRequests,
  getTransferRequestDetails,
  acceptTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,
  deactivateAccount,
  deleteAccount,
  getUserStatistics
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { userOnly } = require('../middlewares/roleMiddleware');
const { handleOptionalProfileUpload } = require('../middlewares/uploadMiddleware');
const {
  validateChangePassword,
  validateEmail,
  validatePhoneNumber
} = require('../middlewares/validationMiddleware');

/**
 * User Routes
 * All routes require authentication and user role
 */

// Apply protect and userOnly middleware to all routes
router.use(protect);
router.use(userOnly);

// ========== PROFILE MANAGEMENT ==========

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private (User only)
 */
router.get('/profile', getUserProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private (User only)
 */
router.put('/profile', handleOptionalProfileUpload, updateUserProfile);

/**
 * @route   PUT /api/v1/users/profile-picture
 * @desc    Update profile picture
 * @access  Private (User only)
 */
router.put('/profile-picture', handleOptionalProfileUpload, updateProfilePicture);

/**
 * @route   PUT /api/v1/users/change-password
 * @desc    Change password
 * @access  Private (User only)
 */
router.put('/change-password', validateChangePassword, changePassword);

/**
 * @route   PUT /api/v1/users/email
 * @desc    Update email
 * @access  Private (User only)
 */
router.put('/email', validateEmail, updateEmail);

/**
 * @route   PUT /api/v1/users/mobile
 * @desc    Update mobile number
 * @access  Private (User only)
 */
router.put('/mobile', validatePhoneNumber, updateMobileNumber);

// ========== CATTLE MANAGEMENT ==========

/**
 * @route   GET /api/v1/users/cattle
 * @desc    Get user's cattle gallery
 * @access  Private (User only)
 */
router.get('/cattle', getUserCattle);

/**
 * @route   GET /api/v1/users/cattle/:cattleId
 * @desc    Get single cattle details
 * @access  Private (User only)
 */
router.get('/cattle/:cattleId', getCattleDetails);

// ========== TRANSFER REQUESTS ==========

/**
 * @route   GET /api/v1/users/transfer-requests
 * @desc    Get user's transfer requests
 * @access  Private (User only)
 */
router.get('/transfer-requests', getTransferRequests);

/**
 * @route   GET /api/v1/users/transfer-requests/:id
 * @desc    Get transfer request details
 * @access  Private (User only)
 */
router.get('/transfer-requests/:id', getTransferRequestDetails);

/**
 * @route   PUT /api/v1/users/transfer-requests/:id/accept
 * @desc    Accept transfer request
 * @access  Private (User only - receiver)
 */
router.put('/transfer-requests/:id/accept', acceptTransferRequest);

/**
 * @route   PUT /api/v1/users/transfer-requests/:id/reject
 * @desc    Reject transfer request
 * @access  Private (User only - receiver)
 */
router.put('/transfer-requests/:id/reject', rejectTransferRequest);

/**
 * @route   PUT /api/v1/users/transfer-requests/:id/cancel
 * @desc    Cancel transfer request
 * @access  Private (User only - sender)
 */
router.put('/transfer-requests/:id/cancel', cancelTransferRequest);

// ========== ACCOUNT MANAGEMENT ==========

/**
 * @route   GET /api/v1/users/statistics
 * @desc    Get user statistics
 * @access  Private (User only)
 */
router.get('/statistics', getUserStatistics);

/**
 * @route   PUT /api/v1/users/deactivate
 * @desc    Deactivate account
 * @access  Private (User only)
 */
router.put('/deactivate', deactivateAccount);

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete account
 * @access  Private (User only)
 */
router.delete('/account', deleteAccount);

module.exports = router;