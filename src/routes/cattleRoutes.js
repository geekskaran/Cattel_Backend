const express = require('express');
const router = express.Router();
const {
  registerCattle,
  getAllCattle,
  getCattleById,
  searchCattleByImage,
  archiveCattle,
  restoreCattle,
  deleteCattle,
  initiateCattleTransfer,
  getCattleTransferHistory,
  getCattleImages,
  getCattleStatistics
} = require('../controllers/cattleController');
const { protect } = require('../middlewares/authMiddleware');
const { userOnly, adminOnly, checkOwnership } = require('../middlewares/roleMiddleware');
const { handleCattleImageUpload, handleOptionalProfileUpload } = require('../middlewares/uploadMiddleware');
const {
  validateCattleRegistration,
  validateCattleId,
  validateTransferRequest
} = require('../middlewares/validationMiddleware');

/**
 * Cattle Routes
 * Handles cattle registration, management, and operations
 */

// ========== PUBLIC/MIXED ROUTES (require authentication) ==========

router.use(protect);

/**
 * @route   POST /api/v1/cattle/register
 * @desc    Register new cattle with 14 images
 * @access  Private (User only)
 */
router.post(
  '/register',
  userOnly,
  handleCattleImageUpload,
  validateCattleRegistration,
  registerCattle
);

/**
 * @route   GET /api/v1/cattle
 * @desc    Get all cattle (filtered by role)
 * @access  Private
 */
router.get('/', getAllCattle);

/**
 * @route   GET /api/v1/cattle/statistics
 * @desc    Get cattle statistics
 * @access  Private
 */
router.get('/statistics', getCattleStatistics);

/**
 * @route   POST /api/v1/cattle/search-by-image
 * @desc    Search cattle by image (placeholder for ML)
 * @access  Private (Admin only)
 */
router.post('/search-by-image', adminOnly, handleOptionalProfileUpload, searchCattleByImage);

/**
 * @route   GET /api/v1/cattle/:id
 * @desc    Get single cattle by ID
 * @access  Private
 */
router.get('/:id', getCattleById);

/**
 * @route   GET /api/v1/cattle/:id/images/:category
 * @desc    Get cattle images by category
 * @access  Private
 */
router.get('/:id/images/:category', getCattleImages);

// ========== USER ONLY ROUTES ==========

/**
 * @route   PUT /api/v1/cattle/:id/archive
 * @desc    Archive cattle (move to recycle bin)
 * @access  Private (Owner only)
 */
router.put('/:id/archive', userOnly, checkOwnership('cattle'), archiveCattle);

/**
 * @route   PUT /api/v1/cattle/:id/restore
 * @desc    Restore cattle from archive
 * @access  Private (Owner only)
 */
router.put('/:id/restore', userOnly, checkOwnership('cattle'), restoreCattle);

/**
 * @route   DELETE /api/v1/cattle/:id
 * @desc    Delete cattle permanently
 * @access  Private (Owner only)
 */
router.delete('/:id', userOnly, checkOwnership('cattle'), deleteCattle);

/**
 * @route   POST /api/v1/cattle/:id/transfer
 * @desc    Initiate cattle transfer (sell)
 * @access  Private (Owner only)
 */
router.post(
  '/:id/transfer',
  userOnly,
  checkOwnership('cattle'),
  validateTransferRequest,
  initiateCattleTransfer
);

/**
 * @route   GET /api/v1/cattle/:id/transfer-history
 * @desc    Get cattle transfer history
 * @access  Private
 */
router.get('/:id/transfer-history', getCattleTransferHistory);

module.exports = router;