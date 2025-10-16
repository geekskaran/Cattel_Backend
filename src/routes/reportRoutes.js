const express = require('express');
const router = express.Router();
const {
  generateFarmersReport,
  generateCattleReport,
  generateCombinedReport,
  generateVerificationReport,
  getReportStatistics,
  cleanupOldReports
} = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly, superAdminOnly, regionalOrMAdminOnly } = require('../middlewares/roleMiddleware');

/**
 * Report Routes
 * Handles report generation for admins
 * Regional and M_Admin: Only their region
 * Super Admin: All regions
 */

// Apply authentication and admin-only access to all routes
router.use(protect);
router.use(adminOnly);

// ========== REPORT GENERATION ==========

/**
 * @route   GET /api/v1/reports/farmers
 * @desc    Generate farmers report (Excel or CSV)
 * @access  Private (Admin only)
 * @query   format=xlsx|csv, state, district, status
 */
router.get('/farmers', generateFarmersReport);

/**
 * @route   GET /api/v1/reports/cattle
 * @desc    Generate cattle report (Excel or CSV)
 * @access  Private (Admin only)
 * @query   format=xlsx|csv, state, district, status, verificationStatus
 */
router.get('/cattle', generateCattleReport);

/**
 * @route   GET /api/v1/reports/combined
 * @desc    Generate combined report (Farmers + Cattle in Excel)
 * @access  Private (Admin only)
 * @query   state, district
 */
router.get('/combined', generateCombinedReport);

/**
 * @route   GET /api/v1/reports/verification
 * @desc    Generate verification report with turnaround tracking
 * @access  Private (Admin only)
 * @query   format=xlsx|csv, status, fromDate, toDate
 */
router.get('/verification', generateVerificationReport);

// ========== STATISTICS ==========

/**
 * @route   GET /api/v1/reports/statistics
 * @desc    Get report statistics (summary - no file download)
 * @access  Private (Admin only)
 */
router.get('/statistics', getReportStatistics);

// ========== MAINTENANCE ==========

/**
 * @route   DELETE /api/v1/reports/cleanup
 * @desc    Cleanup old report files
 * @access  Private (Super Admin only)
 * @query   daysOld (default: 7)
 */
router.delete('/cleanup', superAdminOnly, cleanupOldReports);

module.exports = router;