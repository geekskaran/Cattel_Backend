const User = require('../models/User');
const Cattle = require('../models/Cattle');
const Admin = require('../models/Admin');
const reportGenerator = require('../utils/reportGenerator');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const path = require('path');
const fs = require('fs');

/**
 * Report Controller
 * Handles report generation for admins (Excel and CSV)
 */

// ========== FARMER/USER REPORTS ==========

/**
 * @desc    Generate farmers report
 * @route   GET /api/v1/reports/farmers
 * @access  Private (Admin only)
 */
const generateFarmersReport = asyncHandler(async (req, res) => {
  const { format = 'xlsx', state, district, status } = req.query;

  let query = {};

  // Regional admin can only generate reports for their region
  if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
    query['address.state'] = req.user.assignedRegion.state;
  }

  // Apply filters
  if (state) query['address.state'] = state;
  if (district) query['address.district'] = district;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  // Fetch farmers data
  const farmers = await User.find(query)
    .populate('cattle', 'cattleId status')
    .lean();

  const regionName = req.user.role === 'regional_admin' || req.user.role === 'm_admin'
    ? req.user.assignedRegion.state 
    : 'All_Regions';

  let filePath;

  if (format === 'csv') {
    const headers = [
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Total Cattle', key: 'totalCattle', width: 12 },
      { header: 'Status', key: 'status', width: 10 }
    ];

    const data = farmers.map(farmer => ({
      userId: farmer._id.toString(),
      firstName: farmer.firstName,
      lastName: farmer.lastName,
      email: farmer.email,
      mobileNumber: farmer.mobileNumber,
      district: farmer.address?.district || '',
      state: farmer.address?.state || '',
      totalCattle: farmer.cattle?.length || 0,
      status: farmer.isActive ? 'Active' : 'Inactive'
    }));

    filePath = await reportGenerator.generateCSVReport(data, headers, 'Farmers_Report');
  } else {
    filePath = await reportGenerator.generateFarmersReport(farmers, regionName);
  }

  res.download(filePath, path.basename(filePath), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      return res.status(500).json({
        success: false,
        message: 'Error downloading report'
      });
    }

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);
  });
});

// ========== CATTLE REPORTS ==========

/**
 * @desc    Generate cattle report
 * @route   GET /api/v1/reports/cattle
 * @access  Private (Admin only)
 */
const generateCattleReport = asyncHandler(async (req, res) => {
  const { format = 'xlsx', state, district, status, verificationStatus } = req.query;

  let query = {};

  if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  if (state) query['location.state'] = state;
  if (district) query['location.district'] = district;
  if (status) query.status = status;
  if (verificationStatus) query['verification.status'] = verificationStatus;

  const cattle = await Cattle.find(query)
    .populate('owner', 'firstName lastName mobileNumber email')
    .populate('verification.verifiedBy', 'firstName lastName role')
    .lean();

  const regionName = req.user.role === 'regional_admin' || req.user.role === 'm_admin'
    ? req.user.assignedRegion.state 
    : 'All_Regions';

  let filePath;

  if (format === 'csv') {
    const headers = [
      { header: 'Cattle ID', key: 'cattleId', width: 20 },
      { header: 'Owner Name', key: 'ownerName', width: 25 },
      { header: 'Breed', key: 'breed', width: 20 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    const data = cattle.map(cow => ({
      cattleId: cow.cattleId,
      ownerName: cow.owner ? `${cow.owner.firstName} ${cow.owner.lastName}` : 'N/A',
      breed: cow.breed,
      age: cow.age,
      district: cow.location?.district || '',
      state: cow.location?.state || '',
      status: cow.status
    }));

    filePath = await reportGenerator.generateCSVReport(data, headers, 'Cattle_Report');
  } else {
    filePath = await reportGenerator.generateCattleReport(cattle, regionName);
  }

  res.download(filePath, path.basename(filePath), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      return res.status(500).json({
        success: false,
        message: 'Error downloading report'
      });
    }

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);
  });
});

// ========== COMBINED REPORTS ==========

/**
 * @desc    Generate combined report
 * @route   GET /api/v1/reports/combined
 * @access  Private (Admin only)
 */
const generateCombinedReport = asyncHandler(async (req, res) => {
  const { state, district } = req.query;

  let farmerQuery = {};
  let cattleQuery = {};

  if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
    farmerQuery['address.state'] = req.user.assignedRegion.state;
    cattleQuery['location.state'] = req.user.assignedRegion.state;
  }

  if (state) {
    farmerQuery['address.state'] = state;
    cattleQuery['location.state'] = state;
  }
  if (district) {
    farmerQuery['address.district'] = district;
    cattleQuery['location.district'] = district;
  }

  const farmers = await User.find(farmerQuery)
    .populate('cattle', 'cattleId status')
    .lean();

  const cattle = await Cattle.find(cattleQuery)
    .populate('owner', 'firstName lastName')
    .lean();

  const regionName = req.user.role === 'regional_admin' || req.user.role === 'm_admin'
    ? req.user.assignedRegion.state 
    : 'All_Regions';

  const filePath = await reportGenerator.generateCombinedReport(farmers, cattle, regionName);

  res.download(filePath, path.basename(filePath), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      return res.status(500).json({
        success: false,
        message: 'Error downloading report'
      });
    }

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);
  });
});

// ========== VERIFICATION REPORT ==========

/**
 * @desc    Generate verification report
 * @route   GET /api/v1/reports/verification
 * @access  Private (Admin only)
 */
const generateVerificationReport = asyncHandler(async (req, res) => {
  const { format = 'xlsx', status, fromDate, toDate } = req.query;

  let query = {};

  if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  if (status) {
    query['verification.status'] = status;
  }

  if (fromDate || toDate) {
    query['verification.submittedAt'] = {};
    if (fromDate) query['verification.submittedAt'].$gte = new Date(fromDate);
    if (toDate) query['verification.submittedAt'].$lte = new Date(toDate);
  }

  const cattle = await Cattle.find(query)
    .populate('owner', 'firstName lastName mobileNumber')
    .populate('verification.verifiedBy', 'firstName lastName role')
    .lean();

  const regionName = req.user.role === 'regional_admin' || req.user.role === 'm_admin'
    ? req.user.assignedRegion.state 
    : 'All_Regions';

  const reportData = cattle.map(cow => {
    const submittedAt = cow.verification?.submittedAt;
    const verifiedAt = cow.verification?.verifiedAt;
    const turnaround = submittedAt && verifiedAt 
      ? Math.round((new Date(verifiedAt) - new Date(submittedAt)) / (1000 * 60 * 60)) 
      : null;

    return {
      cattleId: cow.cattleId,
      owner: cow.owner ? `${cow.owner.firstName} ${cow.owner.lastName}` : 'N/A',
      breed: cow.breed,
      submittedAt: submittedAt ? new Date(submittedAt).toLocaleString() : 'N/A',
      verificationStatus: cow.verification?.status || 'pending',
      verifiedBy: cow.verification?.verifiedBy 
        ? `${cow.verification.verifiedBy.firstName} ${cow.verification.verifiedBy.lastName}` 
        : 'N/A',
      turnaroundHours: turnaround !== null ? `${turnaround} hours` : 'N/A',
      isOverdue: turnaround !== null && turnaround > 48 ? 'Yes' : 'No'
    };
  });

  let filePath;

  if (format === 'csv') {
    const headers = [
      { header: 'Cattle ID', key: 'cattleId', width: 20 },
      { header: 'Owner', key: 'owner', width: 25 },
      { header: 'Breed', key: 'breed', width: 20 },
      { header: 'Status', key: 'verificationStatus', width: 15 },
      { header: 'Turnaround', key: 'turnaroundHours', width: 15 }
    ];

    filePath = await reportGenerator.generateCSVReport(reportData, headers, 'Verification_Report');
  } else {
    filePath = await reportGenerator.generateCattleReport(cattle, regionName);
  }

  res.download(filePath, path.basename(filePath), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      return res.status(500).json({
        success: false,
        message: 'Error downloading report'
      });
    }

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);
  });
});

// ========== STATISTICS REPORT ==========

/**
 * @desc    Get report statistics
 * @route   GET /api/v1/reports/statistics
 * @access  Private (Admin only)
 */
const getReportStatistics = asyncHandler(async (req, res) => {
  let farmerQuery = {};
  let cattleQuery = {};

  if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
    farmerQuery['address.state'] = req.user.assignedRegion.state;
    cattleQuery['location.state'] = req.user.assignedRegion.state;
  }

  const totalFarmers = await User.countDocuments(farmerQuery);
  const activeFarmers = await User.countDocuments({ ...farmerQuery, isActive: true });

  const totalCattle = await Cattle.countDocuments(cattleQuery);
  const activeCattle = await Cattle.countDocuments({ ...cattleQuery, status: 'active' });

  const pendingVerification = await Cattle.countDocuments({ 
    ...cattleQuery, 
    'verification.status': 'pending_regional_review' 
  });

  const statistics = {
    farmers: {
      total: totalFarmers,
      active: activeFarmers
    },
    cattle: {
      total: totalCattle,
      active: activeCattle,
      pendingVerification: pendingVerification
    }
  };

  res.status(200).json({
    success: true,
    data: statistics
  });
});

// ========== CLEANUP OLD REPORTS ==========

/**
 * @desc    Cleanup old report files
 * @route   DELETE /api/v1/reports/cleanup
 * @access  Private (Super Admin only)
 */
const cleanupOldReports = asyncHandler(async (req, res) => {
  const { daysOld = 7 } = req.query;

  const deletedCount = reportGenerator.cleanupOldReports(parseInt(daysOld));

  res.status(200).json({
    success: true,
    message: `Cleaned up ${deletedCount} old report files`,
    data: {
      deletedCount,
      daysOld: parseInt(daysOld)
    }
  });
});

module.exports = {
  generateFarmersReport,
  generateCattleReport,
  generateCombinedReport,
  generateVerificationReport,
  getReportStatistics,
  cleanupOldReports
};