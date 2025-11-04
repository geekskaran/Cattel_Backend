const express = require('express');
const router = express.Router();
const {
  createIdentificationRequest,
  getMyIdentificationRequests,
  getIdentificationRequestById,
  cancelIdentificationRequest,
  getPendingIdentificationRequests,
  getIdentificationRequestForAdmin,
  startProcessingRequest,
  completeIdentificationRequest,
  failIdentificationRequest,
  getIdentificationStatistics
} = require('../controllers/identificationController');
const { protect } = require('../middlewares/authMiddleware');
const { userOnly, mAdminOnly } = require('../middlewares/roleMiddleware');
const { handleIdentificationImageUpload } = require('../middlewares/uploadMiddleware');
const { validateIdentificationRequest } = require('../middlewares/validationMiddleware');

/**
 * Identification Request Routes
 * Handles user cattle identification by photo
 * Flow: User captures → Creates request → M_Admin processes → User gets result
 */

// ========== USER ENDPOINTS ==========

// Protect all routes
router.use(protect);

/**
 * @route   POST /api/v1/cattle/identify
 * @desc    Create identification request (User captures cattle photo)
 * @access  Private (User only)
 */
router.post(
  '/identify',
  userOnly,
  handleIdentificationImageUpload,
  validateIdentificationRequest,
  createIdentificationRequest
);

/**
 * @route   GET /api/v1/cattle/identify/my-requests
 * @desc    Get user's identification requests
 * @access  Private (User only)
 */
router.get('/identify/my-requests', userOnly, getMyIdentificationRequests);

/**
 * @route   GET /api/v1/cattle/identify/statistics
 * @desc    Get identification statistics
 * @access  Private
 */
router.get('/identify/statistics', getIdentificationStatistics);

/**
 * @route   GET /api/v1/cattle/identify/:id
 * @desc    Get single identification request
 * @access  Private (User only - own requests)
 */
router.get('/identify/:id', userOnly, getIdentificationRequestById);

/**
 * @route   PUT /api/v1/cattle/identify/:id/cancel
 * @desc    Cancel identification request
 * @access  Private (User only - own requests)
 */
router.put('/identify/:id/cancel', userOnly, cancelIdentificationRequest);

// ========== M_ADMIN ENDPOINTS ==========

/**
 * @route   GET /api/v1/admin/m-admin/identification/pending
 * @desc    Get pending identification requests
 * @access  Private (M_Admin only)
 */
router.get('/admin/m-admin/identification/pending', mAdminOnly, getPendingIdentificationRequests);

/**
 * @route   GET /api/v1/admin/m-admin/identification/:id
 * @desc    Get identification request details for processing
 * @access  Private (M_Admin only)
 */
router.get('/admin/m-admin/identification/:id', mAdminOnly, getIdentificationRequestForAdmin);

/**
 * @route   PUT /api/v1/admin/m-admin/identification/:id/start
 * @desc    Start processing identification request
 * @access  Private (M_Admin only)
 */
router.put('/admin/m-admin/identification/:id/start', mAdminOnly, startProcessingRequest);

/**
 * @route   PUT /api/v1/admin/m-admin/identification/:id/complete
 * @desc    Complete identification request with result
 * @access  Private (M_Admin only)
 */
router.put('/admin/m-admin/identification/:id/complete', mAdminOnly, completeIdentificationRequest);

/**
 * @route   PUT /api/v1/admin/m-admin/identification/:id/fail
 * @desc    Mark identification request as failed
 * @access  Private (M_Admin only)
 */
router.put('/admin/m-admin/identification/:id/fail', mAdminOnly, failIdentificationRequest);

module.exports = router;