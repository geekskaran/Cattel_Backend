const express = require('express');
const router = express.Router();
const {
  // Admin Management
  createRegionalAdmin,
  createMAdmin,
  getAllAdmins,
  approveAdmin,
  deactivateAdmin,
  
  // Regional Admin Operations
  getPendingRegionalReview,
  getCattleForRegionalReview,
  forwardCattleToMAdmin,
  denyCattleByRegionalAdmin,
  
  // M_Admin Operations
  getPendingMAdminVerification,
  getCattleForMAdminVerification,
  approveCattleByMAdmin,
  rejectCattleByMAdmin,
  
  // User Management
  getAllUsers,
  getUserById,
  searchUserByPhone,
  
  // Dashboard & Statistics
  getAdminDashboard,
  
  // Notifications
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  
  // Cattle View
  getAllCattle,
  getCattleById
} = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const {
  adminOnly,
  superAdminOnly,
  regionalAdminOnly,
  mAdminOnly,
  regionalOrMAdminOnly
} = require('../middlewares/roleMiddleware');
const { validateAdminDecision } = require('../middlewares/validationMiddleware');

/**
 * Admin Routes - UPDATED WITH M_ADMIN WORKFLOW
 * Handles admin operations with new three-tier workflow
 */

// Apply authentication to all admin routes
router.use(protect);
router.use(adminOnly);

// ========== SUPER ADMIN ONLY: ADMIN MANAGEMENT ==========

/**
 * @route   POST /api/v1/admin/regional-admin
 * @desc    Create regional admin account
 * @access  Private (Super Admin only)
 */
router.post('/regional-admin', superAdminOnly, createRegionalAdmin);

/**
 * @route   POST /api/v1/admin/m-admin
 * @desc    Create M_Admin account (NEW)
 * @access  Private (Super Admin only)
 */
router.post('/m-admin', superAdminOnly, createMAdmin);

/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admins
 * @access  Private (Super Admin only)
 */
router.get('/admins', superAdminOnly, getAllAdmins);

/**
 * @route   PUT /api/v1/admin/:id/approve
 * @desc    Approve admin account
 * @access  Private (Super Admin only)
 */
router.put('/:id/approve', superAdminOnly, approveAdmin);

/**
 * @route   PUT /api/v1/admin/:id/deactivate
 * @desc    Deactivate admin account
 * @access  Private (Super Admin only)
 */
router.put('/:id/deactivate', superAdminOnly, deactivateAdmin);

// ========== REGIONAL ADMIN: REVIEW & FORWARD/DENY ==========

/**
 * @route   GET /api/v1/admin/regional/cattle/pending
 * @desc    Get cattle pending regional admin review (NEW)
 * @access  Private (Regional Admin only)
 */
router.get('/regional/cattle/pending', regionalAdminOnly, getPendingRegionalReview);

/**
 * @route   GET /api/v1/admin/regional/cattle/:id/review
 * @desc    Get cattle details for regional review (NEW)
 * @access  Private (Regional Admin only)
 */
router.get('/regional/cattle/:id/review', regionalAdminOnly, getCattleForRegionalReview);

/**
 * @route   PUT /api/v1/admin/regional/cattle/:id/forward
 * @desc    Forward cattle to M_Admin (NEW)
 * @access  Private (Regional Admin only)
 */
router.put('/regional/cattle/:id/forward', regionalAdminOnly, forwardCattleToMAdmin);

/**
 * @route   PUT /api/v1/admin/regional/cattle/:id/deny
 * @desc    Deny cattle by regional admin (NEW)
 * @access  Private (Regional Admin only)
 */
router.put('/regional/cattle/:id/deny', regionalAdminOnly, validateAdminDecision, denyCattleByRegionalAdmin);

// ========== M_ADMIN: IDENTIFICATION & APPROVAL/REJECTION ==========

/**
 * @route   GET /api/v1/admin/m-admin/cattle/pending
 * @desc    Get cattle pending M_Admin identification (NEW)
 * @access  Private (M_Admin only)
 */
router.get('/m-admin/cattle/pending', mAdminOnly, getPendingMAdminVerification);

/**
 * @route   GET /api/v1/admin/m-admin/cattle/:id/verify
 * @desc    Get cattle details for M_Admin verification (NEW)
 * @access  Private (M_Admin only)
 */
router.get('/m-admin/cattle/:id/verify', mAdminOnly, getCattleForMAdminVerification);

/**
 * @route   PUT /api/v1/admin/m-admin/cattle/:id/approve
 * @desc    Approve cattle by M_Admin (NEW - Final Approval)
 * @access  Private (M_Admin only)
 */
router.put('/m-admin/cattle/:id/approve', mAdminOnly, approveCattleByMAdmin);

/**
 * @route   PUT /api/v1/admin/m-admin/cattle/:id/reject
 * @desc    Reject cattle by M_Admin (NEW - Final Rejection)
 * @access  Private (M_Admin only)
 */
router.put('/m-admin/cattle/:id/reject', mAdminOnly, validateAdminDecision, rejectCattleByMAdmin);

// ========== USER MANAGEMENT (ALL ADMINS) ==========

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users/farmers
 * @access  Private (Admin only)
 */
router.get('/users', getAllUsers);

/**
 * @route   GET /api/v1/admin/users/search/phone/:phoneNumber
 * @desc    Search user by phone number
 * @access  Private (Admin only)
 */
router.get('/users/search/phone/:phoneNumber', searchUserByPhone);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user details by ID
 * @access  Private (Admin only)
 */
router.get('/users/:id', getUserById);

// ========== DASHBOARD & STATISTICS (ALL ADMINS) ==========

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/dashboard', getAdminDashboard);

// ========== CATTLE VIEW (ALL ADMINS) ==========

/**
 * @route   GET /api/v1/admin/cattle
 * @desc    Get all cattle (admin view)
 * @access  Private (Admin only)
 */
router.get('/cattle', getAllCattle);

/**
 * @route   GET /api/v1/admin/cattle/:id
 * @desc    Get single cattle by ID (admin view)
 * @access  Private (Admin only)
 */
router.get('/cattle/:id', getCattleById);

// ========== NOTIFICATIONS (ALL ADMINS) ==========

/**
 * @route   GET /api/v1/admin/notifications
 * @desc    Get admin notifications
 * @access  Private (Admin only)
 */
router.get('/notifications', getAdminNotifications);

/**
 * @route   PUT /api/v1/admin/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (Admin only)
 */
router.put('/notifications/:id/read', markNotificationAsRead);

/**
 * @route   PUT /api/v1/admin/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Admin only)
 */
router.put('/notifications/read-all', markAllNotificationsAsRead);

module.exports = router;