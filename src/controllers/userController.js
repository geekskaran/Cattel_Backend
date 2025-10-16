const User = require('../models/User');
const Cattle = require('../models/Cattle');
const TransferRequest = require('../models/TransferRequest');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const { deleteImage } = require('../utils/imageHelper');
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');

/**
 * User Controller
 * Handles user profile management, settings, and account operations
 * As per document: Settings section includes Profile, Transfer requests, Instructions, Change password, Logout
 */

// ========== PROFILE MANAGEMENT ==========

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private (User only)
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'cattle',
      select: 'cattleId breed age status verification',
      match: { status: { $ne: 'archive' } } // Exclude archived cattle
    });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      address: user.address,
      location: user.location,
      profilePicture: user.profilePicture,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      isActive: user.isActive,
      totalCattle: user.cattle.length,
      createdAt: user.createdAt
    }
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private (User only)
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Fields that can be updated
  const {
    firstName,
    lastName,
    dateOfBirth,
    occupation,
    address,
    location
  } = req.body;

  // Update fields if provided
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;
  if (occupation) user.occupation = occupation;
  if (address) user.address = { ...user.address, ...address };
  if (location && location.coordinates) {
    user.location = {
      type: 'Point',
      coordinates: location.coordinates
    };
  }

  // Handle profile picture update
  if (req.file) {
    // Delete old profile picture if exists
    if (user.profilePicture && user.profilePicture.path) {
      deleteImage(user.profilePicture.path);
    }

    user.profilePicture = {
      filename: req.file.filename,
      path: req.file.path,
      uploadedAt: new Date()
    };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      address: user.address,
      profilePicture: user.profilePicture
    }
  });
});

/**
 * @desc    Update profile picture
 * @route   PUT /api/v1/users/profile-picture
 * @access  Private (User only)
 */
const updateProfilePicture = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a profile picture'
    });
  }

  // Delete old profile picture
  if (user.profilePicture && user.profilePicture.path) {
    deleteImage(user.profilePicture.path);
  }

  // Update with new picture
  user.profilePicture = {
    filename: req.file.filename,
    path: req.file.path,
    uploadedAt: new Date()
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile picture updated successfully',
    data: {
      profilePicture: user.profilePicture
    }
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/v1/users/change-password
 * @access  Private (User only)
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Set new password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * @desc    Update email
 * @route   PUT /api/v1/users/email
 * @access  Private (User only)
 */
const updateEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if email already exists
  const emailExists = await User.findOne({ email });

  if (emailExists && emailExists._id.toString() !== req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Email already in use by another account'
    });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.email = email;
  user.isEmailVerified = false; // Need to verify new email

  await user.save();

  // Send verification email
  const otp = user.generateOTP();
  await user.save();
  await emailService.sendOTP(email, user.fullName, otp);

  res.status(200).json({
    success: true,
    message: 'Email updated. Please verify your new email with the OTP sent.',
    data: {
      email: user.email,
      isEmailVerified: user.isEmailVerified
    }
  });
});

/**
 * @desc    Update mobile number
 * @route   PUT /api/v1/users/mobile
 * @access  Private (User only)
 */
const updateMobileNumber = asyncHandler(async (req, res) => {
  const { mobileNumber } = req.body;

  // Check if mobile number already exists
  const mobileExists = await User.findOne({ mobileNumber });

  if (mobileExists && mobileExists._id.toString() !== req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number already in use by another account'
    });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.mobileNumber = mobileNumber;
  user.isMobileVerified = false; // Need to verify new number

  await user.save();

  // Send verification OTP
  const otp = user.generateOTP();
  await user.save();
  await smsService.sendOTP(mobileNumber, otp);

  res.status(200).json({
    success: true,
    message: 'Mobile number updated. Please verify with the OTP sent.',
    data: {
      mobileNumber: user.mobileNumber,
      isMobileVerified: user.isMobileVerified
    }
  });
});

// ========== CATTLE MANAGEMENT (User View) ==========

/**
 * @desc    Get user's cattle gallery
 * @route   GET /api/v1/users/cattle
 * @access  Private (User only)
 */
const getUserCattle = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  // Build query
  const query = { owner: req.user._id };

  // Filter by status (active, archive, transit)
  if (status) {
    query.status = status;
  }

  // Search by cattleId or breed
  if (search) {
    query.$or = [
      { cattleId: { $regex: search, $options: 'i' } },
      { breed: { $regex: search, $options: 'i' } },
      { tagNo: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  const cattle = await Cattle.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Cattle.countDocuments(query);

  // Get counts by status
  const statusCounts = await Cattle.aggregate([
    { $match: { owner: req.user._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const counts = {
    active: 0,
    archive: 0,
    transit: 0
  };

  statusCounts.forEach(item => {
    counts[item._id] = item.count;
  });

  res.status(200).json({
    success: true,
    data: {
      cattle,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      },
      counts
    }
  });
});

/**
 * @desc    Get single cattle details
 * @route   GET /api/v1/users/cattle/:cattleId
 * @access  Private (User only)
 */
const getCattleDetails = asyncHandler(async (req, res) => {
  const cattle = await Cattle.findOne({
    _id: req.params.cattleId,
    owner: req.user._id
  }).populate('transferHistory');

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  res.status(200).json({
    success: true,
    data: cattle
  });
});

// ========== TRANSFER REQUESTS ==========

/**
 * @desc    Get user's transfer requests (sell/purchase history)
 * @route   GET /api/v1/users/transfer-requests
 * @access  Private (User only)
 */
const getTransferRequests = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  // Build query - get requests where user is sender or receiver
  const query = {
    $or: [
      { fromOwner: req.user._id },
      { toOwner: req.user._id }
    ]
  };

  if (status) {
    query.status = status;
  }

  if (type) {
    query.transferType = type;
  }

  const requests = await TransferRequest.find(query)
    .populate('cattle', 'cattleId breed age')
    .populate('fromOwner', 'firstName lastName mobileNumber')
    .populate('toOwner', 'firstName lastName mobileNumber')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await TransferRequest.countDocuments(query);

  // Categorize requests
  const sentRequests = requests.filter(req => req.fromOwner._id.toString() === req.user._id.toString());
  const receivedRequests = requests.filter(req => req.toOwner._id.toString() === req.user._id.toString());

  res.status(200).json({
    success: true,
    data: {
      all: requests,
      sent: sentRequests,
      received: receivedRequests,
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
 * @desc    Get single transfer request details
 * @route   GET /api/v1/users/transfer-requests/:id
 * @access  Private (User only)
 */
const getTransferRequestDetails = asyncHandler(async (req, res) => {
  const request = await TransferRequest.findOne({
    _id: req.params.id,
    $or: [
      { fromOwner: req.user._id },
      { toOwner: req.user._id }
    ]
  })
    .populate('cattle')
    .populate('fromOwner', 'firstName lastName email mobileNumber address')
    .populate('toOwner', 'firstName lastName email mobileNumber address');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Transfer request not found'
    });
  }

  res.status(200).json({
    success: true,
    data: request
  });
});

/**
 * @desc    Accept transfer request
 * @route   PUT /api/v1/users/transfer-requests/:id/accept
 * @access  Private (User only - receiver)
 */
const acceptTransferRequest = asyncHandler(async (req, res) => {
  const request = await TransferRequest.findOne({
    _id: req.params.id,
    toOwner: req.user._id,
    status: 'pending'
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Transfer request not found or already processed'
    });
  }

  // Accept the transfer
  await request.accept();

  // Reload with populated data
  await request.populate('cattle fromOwner toOwner');

  res.status(200).json({
    success: true,
    message: 'Transfer request accepted successfully. Cattle ownership transferred.',
    data: request
  });
});

/**
 * @desc    Reject transfer request
 * @route   PUT /api/v1/users/transfer-requests/:id/reject
 * @access  Private (User only - receiver)
 */
const rejectTransferRequest = asyncHandler(async (req, res) => {
  const { message } = req.body;

  const request = await TransferRequest.findOne({
    _id: req.params.id,
    toOwner: req.user._id,
    status: 'pending'
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Transfer request not found or already processed'
    });
  }

  await request.reject(message);

  await request.populate('cattle fromOwner toOwner');

  res.status(200).json({
    success: true,
    message: 'Transfer request rejected',
    data: request
  });
});

/**
 * @desc    Cancel transfer request
 * @route   PUT /api/v1/users/transfer-requests/:id/cancel
 * @access  Private (User only - sender)
 */
const cancelTransferRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const request = await TransferRequest.findOne({
    _id: req.params.id,
    fromOwner: req.user._id,
    status: 'pending'
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Transfer request not found or already processed'
    });
  }

  await request.cancel(req.user._id, reason);

  await request.populate('cattle fromOwner toOwner');

  res.status(200).json({
    success: true,
    message: 'Transfer request cancelled',
    data: request
  });
});

// ========== ACCOUNT MANAGEMENT ==========

/**
 * @desc    Deactivate account
 * @route   PUT /api/v1/users/deactivate
 * @access  Private (User only)
 */
const deactivateAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.isActive = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

/**
 * @desc    Delete account (soft delete - mark as inactive)
 * @route   DELETE /api/v1/users/account
 * @access  Private (User only)
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your password to confirm account deletion'
    });
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Incorrect password'
    });
  }

  // Soft delete - deactivate account
  user.isActive = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

/**
 * @desc    Get user statistics
 * @route   GET /api/v1/users/statistics
 * @access  Private (User only)
 */
const getUserStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get cattle counts
  const cattleCounts = await Cattle.aggregate([
    { $match: { owner: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get verification status counts
  const verificationCounts = await Cattle.aggregate([
    { $match: { owner: userId } },
    {
      $group: {
        _id: '$verification.status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get transfer request counts
  const transferCounts = await TransferRequest.aggregate([
    {
      $match: {
        $or: [{ fromOwner: userId }, { toOwner: userId }]
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statistics = {
    cattle: {
      total: 0,
      active: 0,
      archive: 0,
      transit: 0
    },
    verification: {
      pending: 0,
      approved: 0,
      rejected: 0
    },
    transfers: {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      cancelled: 0
    }
  };

  // Process cattle counts
  cattleCounts.forEach(item => {
    statistics.cattle[item._id] = item.count;
    statistics.cattle.total += item.count;
  });

  // Process verification counts
  verificationCounts.forEach(item => {
    statistics.verification[item._id] = item.count;
  });

  // Process transfer counts
  transferCounts.forEach(item => {
    statistics.transfers[item._id] = item.count;
    statistics.transfers.total += item.count;
  });

  res.status(200).json({
    success: true,
    data: statistics
  });
});

module.exports = {
  // Profile Management
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  changePassword,
  updateEmail,
  updateMobileNumber,

  // Cattle Management
  getUserCattle,
  getCattleDetails,

  // Transfer Requests
  getTransferRequests,
  getTransferRequestDetails,
  acceptTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,

  // Account Management
  deactivateAccount,
  deleteAccount,
  getUserStatistics
};