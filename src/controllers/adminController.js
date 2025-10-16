const Admin = require('../models/Admin');
const User = require('../models/User');
const Cattle = require('../models/Cattle');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const emailService = require('../utils/emailService');
const { generateTokenPair } = require('../utils/tokenGenerator');

/**
 * Admin Controller
 * Handles admin operations, cattle verification, user management, and regional constraints
 * Following document:
 * - Regional Admin: Limited to assigned region only
 * - Super Admin: Global access to all regions
 * - 48-hour verification turnaround
 */

// ========== ADMIN MANAGEMENT (SUPER ADMIN ONLY) ==========

/**
 * @desc    Create regional admin account
 * @route   POST /api/v1/admin/regional-admin
 * @access  Private (Super Admin only)
 */
const createRegionalAdmin = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    mobileNumber,
    password,
    assignedRegion
  } = req.body;

  // Check if email or mobile already exists
  const adminExists = await Admin.findOne({
    $or: [{ email }, { mobileNumber }]
  });

  if (adminExists) {
    return res.status(400).json({
      success: false,
      message: adminExists.email === email 
        ? 'Email already registered' 
        : 'Mobile number already registered'
    });
  }

  // Check if region already has an admin (only one regional admin per region)
  const regionAdmin = await Admin.findOne({
    role: 'regional_admin',
    'assignedRegion.state': assignedRegion.state,
    isActive: true
  });

  if (regionAdmin) {
    return res.status(400).json({
      success: false,
      message: `Region ${assignedRegion.state} already has a regional admin`
    });
  }

  // Validate assigned region
  if (!assignedRegion || !assignedRegion.state) {
    return res.status(400).json({
      success: false,
      message: 'Assigned region with state is required for regional admin'
    });
  }

  // Create regional admin
  const admin = await Admin.create({
    firstName,
    lastName,
    email,
    mobileNumber,
    password,
    role: 'regional_admin',
    assignedRegion,
    isApproved: true, // Auto-approved when created by super admin
    isActive: true,
    approvedBy: req.user._id,
    approvedAt: new Date(),
    createdBy: 'super_admin'
  });

  // Send approval email
  await emailService.sendAdminApproved(email, `${firstName} ${lastName}`, 'regional_admin');

  res.status(201).json({
    success: true,
    message: 'Regional admin created successfully',
    data: {
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        assignedRegion: admin.assignedRegion,
        isActive: admin.isActive
      }
    }
  });
});

/**
 * @desc    Get all admins
 * @route   GET /api/v1/admin/admins
 * @access  Private (Super Admin only)
 */
const getAllAdmins = asyncHandler(async (req, res) => {
  const { role, isActive, isApproved, state, page = 1, limit = 20 } = req.query;

  const query = {};

  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (isApproved !== undefined) query.isApproved = isApproved === 'true';
  if (state) query['assignedRegion.state'] = state;

  const skip = (page - 1) * limit;

  const admins = await Admin.find(query)
    .populate('approvedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Admin.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      admins,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * @desc    Approve regional admin account
 * @route   PUT /api/v1/admin/:id/approve
 * @access  Private (Super Admin only)
 */
const approveRegionalAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  if (admin.role !== 'regional_admin') {
    return res.status(400).json({
      success: false,
      message: 'Only regional admins need approval'
    });
  }

  if (admin.isApproved) {
    return res.status(400).json({
      success: false,
      message: 'Admin is already approved'
    });
  }

  admin.isApproved = true;
  admin.isActive = true;
  admin.approvedBy = req.user._id;
  admin.approvedAt = new Date();
  await admin.save();

  // Send approval notification
  await emailService.sendAdminApproved(admin.email, admin.fullName, admin.role);

  await Notification.create({
    recipient: admin._id,
    recipientModel: 'Admin',
    type: 'admin_approved',
    title: 'Account Approved',
    message: 'Your regional admin account has been approved. You can now log in and start verifying cattle registrations.',
    priority: 'high'
  });

  res.status(200).json({
    success: true,
    message: 'Regional admin approved successfully',
    data: admin
  });
});

/**
 * @desc    Deactivate admin account
 * @route   PUT /api/v1/admin/:id/deactivate
 * @access  Private (Super Admin only)
 */
const deactivateAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  if (admin.role === 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot deactivate super admin account'
    });
  }

  admin.isActive = false;
  await admin.save();

  await Notification.create({
    recipient: admin._id,
    recipientModel: 'Admin',
    type: 'account_deactivated',
    title: 'Account Deactivated',
    message: 'Your admin account has been deactivated. Please contact the super admin for more information.',
    priority: 'urgent'
  });

  res.status(200).json({
    success: true,
    message: 'Admin account deactivated successfully'
  });
});

// ========== CATTLE VERIFICATION (REGIONAL & SUPER ADMIN) ==========

/**
 * @desc    Get pending cattle verifications
 * @route   GET /api/v1/admin/cattle/pending
 * @access  Private (Admin only)
 */
const getPendingVerifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, overdue } = req.query;

  let query = {
    status: 'transit',
    'verification.status': 'pending'
  };

  // Regional admin can only see their region
  if (req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  // Filter by overdue (48-hour deadline exceeded)
  if (overdue === 'true') {
    query['verification.turnaroundDeadline'] = { $lt: new Date() };
  }

  const skip = (page - 1) * limit;

  const cattle = await Cattle.find(query)
    .populate('owner', 'firstName lastName mobileNumber email address')
    .sort({ 'verification.submittedAt': 1 }) // Oldest first (FIFO)
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Cattle.countDocuments(query);

  // Mark overdue cattle
  const cattleWithStatus = cattle.map(c => {
    const cattleObj = c.toObject();
    cattleObj.isOverdue = c.isVerificationOverdue();
    return cattleObj;
  });

  res.status(200).json({
    success: true,
    data: {
      cattle: cattleWithStatus,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * @desc    Get cattle details for verification
 * @route   GET /api/v1/admin/cattle/:id/verify
 * @access  Private (Admin only)
 */
const getCattleForVerification = asyncHandler(async (req, res) => {
  let query = { _id: req.params.id };

  // Regional admin can only verify cattle from their region
  if (req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query)
    .populate('owner', 'firstName lastName email mobileNumber address occupation dateOfBirth')
    .populate('verification.verifiedBy', 'firstName lastName role');

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found or you do not have permission to verify it'
    });
  }

  // Format with all image URLs
  const cattleData = cattle.toObject();
  cattleData.isOverdue = cattle.isVerificationOverdue();

  // Add formatted image URLs
  const baseUrl = '/uploads/cattle';
  const categories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];
  
  cattleData.formattedImages = {};
  categories.forEach(category => {
    if (cattle.images[category]) {
      cattleData.formattedImages[category] = cattle.images[category].map(img => ({
        filename: img.filename,
        url: `${baseUrl}/${category}/${img.filename}`,
        uploadedAt: img.uploadedAt,
        size: img.size
      }));
    }
  });

  res.status(200).json({
    success: true,
    data: cattleData
  });
});

/**
 * @desc    Approve cattle registration
 * @route   PUT /api/v1/admin/cattle/:id/approve
 * @access  Private (Admin only)
 */
const approveCattle = asyncHandler(async (req, res) => {
  let query = { 
    _id: req.params.id,
    'verification.status': 'pending'
  };

  // Regional admin can only approve cattle from their region
  if (req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query).populate('owner');

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found, already verified, or you do not have permission'
    });
  }

  // Approve cattle
  await cattle.approve(req.user._id);

  // Update admin statistics
  const admin = await Admin.findById(req.user._id);
  admin.statistics.pendingVerifications = Math.max(0, admin.statistics.pendingVerifications - 1);
  admin.statistics.totalVerifications += 1;
  admin.statistics.approvedCattle += 1;
  await admin.save();

  // Notify owner
  await Notification.create({
    recipient: cattle.owner._id,
    recipientModel: 'User',
    type: 'cattle_approved',
    title: 'Cattle Registration Approved',
    message: `Your cattle registration (${cattle.cattleId}) has been approved and is now active.`,
    relatedCattle: cattle._id,
    priority: 'high',
    actionUrl: `/cattle/${cattle._id}`,
    actionText: 'View Cattle'
  });

  // Send email notification
  await emailService.sendCattleApproved(
    cattle.owner.email,
    cattle.owner.fullName,
    cattle.cattleId
  );

  res.status(200).json({
    success: true,
    message: 'Cattle registration approved successfully',
    data: cattle
  });
});

/**
 * @desc    Reject cattle registration
 * @route   PUT /api/v1/admin/cattle/:id/reject
 * @access  Private (Admin only)
 */
const rejectCattle = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required'
    });
  }

  let query = { 
    _id: req.params.id,
    'verification.status': 'pending'
  };

  // Regional admin can only reject cattle from their region
  if (req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query).populate('owner');

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found, already verified, or you do not have permission'
    });
  }

  // Reject cattle
  await cattle.reject(req.user._id, reason);

  // Update admin statistics
  const admin = await Admin.findById(req.user._id);
  admin.statistics.pendingVerifications = Math.max(0, admin.statistics.pendingVerifications - 1);
  admin.statistics.totalVerifications += 1;
  admin.statistics.rejectedCattle += 1;
  await admin.save();

  // Notify owner
  await Notification.create({
    recipient: cattle.owner._id,
    recipientModel: 'User',
    type: 'cattle_rejected',
    title: 'Cattle Registration Rejected',
    message: `Your cattle registration (${cattle.cattleId}) has been rejected. Reason: ${reason}`,
    relatedCattle: cattle._id,
    priority: 'high'
  });

  // Send email notification
  await emailService.sendCattleRejected(
    cattle.owner.email,
    cattle.owner.fullName,
    cattle.cattleId,
    reason
  );

  res.status(200).json({
    success: true,
    message: 'Cattle registration rejected',
    data: cattle
  });
});

// ========== USER MANAGEMENT (ADMIN) ==========

/**
 * @desc    Get all users (farmers)
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { 
    state, 
    district, 
    isActive, 
    isVerified,
    search,
    page = 1, 
    limit = 20 
  } = req.query;

  let query = {};

  // Regional admin can only see users from their region
  if (req.user.role === 'regional_admin') {
    query['address.state'] = req.user.assignedRegion.state;
  }

  // Apply filters
  if (state) query['address.state'] = state;
  if (district) query['address.district'] = district;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (isVerified === 'true') {
    query.$or = [
      { isEmailVerified: true },
      { isMobileVerified: true }
    ];
  }

  // Search by name, email, or mobile
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { mobileNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .populate('cattle', 'cattleId breed status')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * @desc    Get user details by ID
 * @route   GET /api/v1/admin/users/:id
 * @access  Private (Admin only)
 */
const getUserById = asyncHandler(async (req, res) => {
  let query = { _id: req.params.id };

  // Regional admin can only view users from their region
  if (req.user.role === 'regional_admin') {
    query['address.state'] = req.user.assignedRegion.state;
  }

  const user = await User.findOne(query)
    .populate({
      path: 'cattle',
      populate: { path: 'verification.verifiedBy', select: 'firstName lastName' }
    });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found or you do not have permission to view'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * @desc    Search user by phone number (Super Admin and Regional Admin)
 * @route   GET /api/v1/admin/users/search/phone/:phoneNumber
 * @access  Private (Admin only)
 */
const searchUserByPhone = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.params;

  let query = { mobileNumber: phoneNumber };

  // Regional admin can only search in their region
  if (req.user.role === 'regional_admin') {
    query['address.state'] = req.user.assignedRegion.state;
  }

  const user = await User.findOne(query)
    .populate('cattle', 'cattleId breed age status verification');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found in your accessible region'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// ========== ADMIN STATISTICS & DASHBOARD ==========

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/v1/admin/dashboard
 * @access  Private (Admin only)
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  let cattleQuery = {};
  let userQuery = {};

  // Regional admin sees only their region
  if (req.user.role === 'regional_admin') {
    cattleQuery['location.state'] = req.user.assignedRegion.state;
    userQuery['address.state'] = req.user.assignedRegion.state;
  }

  // Total counts
  const totalUsers = await User.countDocuments(userQuery);
  const totalCattle = await Cattle.countDocuments(cattleQuery);

  // Cattle by status
  const cattleByStatus = await Cattle.aggregate([
    { $match: cattleQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Cattle by verification status
  const cattleByVerification = await Cattle.aggregate([
    { $match: cattleQuery },
    { $group: { _id: '$verification.status', count: { $sum: 1 } } }
  ]);

  // Overdue verifications (beyond 48 hours)
  const overdueVerifications = await Cattle.countDocuments({
    ...cattleQuery,
    status: 'transit',
    'verification.status': 'pending',
    'verification.turnaroundDeadline': { $lt: new Date() }
  });

  // District-wise breakdown (for regional admin and super admin)
  const districtBreakdown = await Cattle.aggregate([
    { $match: cattleQuery },
    {
      $group: {
        _id: '$location.district',
        totalCattle: { $sum: 1 },
        activeCattle: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        pendingVerification: {
          $sum: { $cond: [{ $eq: ['$verification.status', 'pending'] }, 1, 0] }
        }
      }
    },
    { $sort: { totalCattle: -1 } }
  ]);

  // Users by district
  const usersByDistrict = await User.aggregate([
    { $match: userQuery },
    {
      $group: {
        _id: '$address.district',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const statistics = {
    overview: {
      totalUsers,
      totalCattle,
      overdueVerifications
    },
    cattle: {
      byStatus: {},
      byVerification: {}
    },
    breakdown: {
      byDistrict: districtBreakdown,
      usersByDistrict
    }
  };

  cattleByStatus.forEach(item => {
    statistics.cattle.byStatus[item._id] = item.count;
  });

  cattleByVerification.forEach(item => {
    statistics.cattle.byVerification[item._id] = item.count;
  });

  res.status(200).json({
    success: true,
    data: statistics
  });
});

/**
 * @desc    Get admin notifications
 * @route   GET /api/v1/admin/notifications
 * @access  Private (Admin only)
 */
const getAdminNotifications = asyncHandler(async (req, res) => {
  const { isRead, page = 1, limit = 20 } = req.query;

  const query = {
    recipient: req.user._id,
    recipientModel: 'Admin'
  };

  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }

  const skip = (page - 1) * limit;

  const notifications = await Notification.find(query)
    .populate('relatedCattle', 'cattleId breed')
    .populate('relatedUser', 'firstName lastName mobileNumber')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.getUnreadCount(req.user._id, 'Admin');

  res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/admin/notifications/:id/read
 * @access  Private (Admin only)
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
    recipientModel: 'Admin'
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await notification.markAsRead();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/admin/notifications/read-all
 * @access  Private (Admin only)
 */
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const count = await Notification.markAllAsRead(req.user._id, 'Admin');

  res.status(200).json({
    success: true,
    message: `${count} notifications marked as read`
  });
});

module.exports = {
  // Admin Management (Super Admin only)
  createRegionalAdmin,
  getAllAdmins,
  approveRegionalAdmin,
  deactivateAdmin,

  // Cattle Verification
  getPendingVerifications,
  getCattleForVerification,
  approveCattle,
  rejectCattle,

  // User Management
  getAllUsers,
  getUserById,
  searchUserByPhone,

  // Dashboard & Statistics
  getAdminDashboard,

  // Notifications
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};