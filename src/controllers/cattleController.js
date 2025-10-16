const Cattle = require('../models/Cattle');
const User = require('../models/User');
const TransferRequest = require('../models/TransferRequest');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const { deleteCattleImages, formatCattleImages } = require('../utils/imageHelper');
const emailService = require('../utils/emailService');

/**
 * Cattle Controller
 * Handles cattle registration, management, verification, and transfer
 * Following document: 14 images (muzzle:3, face:3, left:3, right:3, fullBodyLeft:1, fullBodyRight:1)
 * Statuses: active, archive, transit
 */

// ========== CATTLE REGISTRATION ==========

/**
 * @desc    Register new cattle
 * @route   POST /api/v1/cattle/register
 * @access  Private (User only)
 */
const registerCattle = asyncHandler(async (req, res) => {
  const { breed, tagNo, medicalHistory, age, type, color } = req.body;

  // Check if images are uploaded (handled by middleware)
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please upload all required images (14 total)'
    });
  }

  // Get user's location for cattle
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prepare image data
  const images = {
    muzzle: req.files.muzzle?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || [],
    face: req.files.face?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || [],
    left: req.files.left?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || [],
    right: req.files.right?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || [],
    fullBodyLeft: req.files.fullBodyLeft?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || [],
    fullBodyRight: req.files.fullBodyRight?.map(file => ({
      filename: file.filename,
      path: file.path,
      uploadedAt: new Date(),
      size: file.size,
      mimetype: file.mimetype
    })) || []
  };

  // Create cattle
  const cattle = await Cattle.create({
    owner: req.user._id,
    breed,
    tagNo,
    medicalHistory,
    age,
    type,
    color,
    images,
    location: {
      state: user.address.state,
      district: user.address.district,
      pinCode: user.address.pinCode
    },
    status: 'transit', // Starts in transit, pending verification
    verification: {
      status: 'pending',
      submittedAt: new Date()
    }
  });

  // Add cattle to user's cattle array
  user.cattle.push(cattle._id);
  await user.save();

  // Create notification for regional admin
  const Admin = require('../models/Admin');
  const regionalAdmins = await Admin.find({
    role: 'regional_admin',
    'assignedRegion.state': user.address.state,
    isActive: true,
    isApproved: true
  });

  // Notify all regional admins in this region
  for (const admin of regionalAdmins) {
    await Notification.create({
      recipient: admin._id,
      recipientModel: 'Admin',
      type: 'cattle_registered',
      title: 'New Cattle Registration',
      message: `New cattle (${cattle.cattleId}) registered by ${user.fullName} in ${user.address.district}, ${user.address.state}. Please verify within 48 hours.`,
      relatedCattle: cattle._id,
      relatedUser: user._id,
      priority: 'high',
      actionUrl: `/admin/cattle/${cattle._id}/verify`,
      actionText: 'Verify Now'
    });

    // Update admin statistics
    admin.statistics.pendingVerifications += 1;
    await admin.save();
  }

  res.status(201).json({
    success: true,
    message: 'Cattle registered successfully. Pending admin verification.',
    data: {
      cattle: {
        id: cattle._id,
        cattleId: cattle.cattleId,
        temporaryId: cattle.temporaryId,
        breed: cattle.breed,
        age: cattle.age,
        status: cattle.status,
        verification: cattle.verification,
        totalImages: cattle.totalImages
      }
    }
  });
});

/**
 * @desc    Get all cattle (with filters)
 * @route   GET /api/v1/cattle
 * @access  Private
 */
const getAllCattle = asyncHandler(async (req, res) => {
  const { 
    status, 
    verificationStatus, 
    breed, 
    state, 
    district, 
    search,
    page = 1, 
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query based on user type
  let query = {};

  if (req.userType === 'user') {
    // Users can only see their own cattle
    query.owner = req.user._id;
  } else if (req.userType === 'admin') {
    // Regional admin can only see cattle from their region
    if (req.user.role === 'regional_admin') {
      query['location.state'] = req.user.assignedRegion.state;
      
      // If specific districts assigned
      if (req.user.assignedRegion.districts && req.user.assignedRegion.districts.length > 0) {
        query['location.district'] = { $in: req.user.assignedRegion.districts };
      }
    }
    // Super admin can see all cattle (no additional query)
  }

  // Apply filters
  if (status) query.status = status;
  if (verificationStatus) query['verification.status'] = verificationStatus;
  if (breed) query.breed = { $regex: breed, $options: 'i' };
  if (state) query['location.state'] = state;
  if (district) query['location.district'] = district;

  // Search by cattleId, tagNo, or breed
  if (search) {
    query.$or = [
      { cattleId: { $regex: search, $options: 'i' } },
      { tagNo: { $regex: search, $options: 'i' } },
      { breed: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const cattle = await Cattle.find(query)
    .populate('owner', 'firstName lastName mobileNumber address')
    .populate('verification.verifiedBy', 'firstName lastName role')
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Cattle.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      cattle,
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
 * @desc    Get single cattle by ID
 * @route   GET /api/v1/cattle/:id
 * @access  Private
 */
const getCattleById = asyncHandler(async (req, res) => {
  let query = { _id: req.params.id };

  // Apply access control
  if (req.userType === 'user') {
    query.owner = req.user._id;
  } else if (req.userType === 'admin' && req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query)
    .populate('owner', 'firstName lastName email mobileNumber address occupation')
    .populate('verification.verifiedBy', 'firstName lastName email role')
    .populate('transferHistory');

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found or you do not have permission to view it'
    });
  }

  // Format images with URLs
  const formattedCattle = cattle.toObject();
  formattedCattle.images = formatCattleImages(cattle.images);

  res.status(200).json({
    success: true,
    data: formattedCattle
  });
});

/**
 * @desc    Search cattle by image (placeholder for future ML integration)
 * @route   POST /api/v1/cattle/search-by-image
 * @access  Private (Admin only)
 */
const searchCattleByImage = asyncHandler(async (req, res) => {
  // This is a placeholder for future ML model integration
  // As per your instruction: no ML model, images go to regional admin for approval

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload an image to search'
    });
  }

  // For now, return message that this feature requires ML model
  res.status(200).json({
    success: true,
    message: 'Image search feature requires ML model integration. Currently, manual verification is performed by regional admins.',
    data: {
      uploadedImage: req.file.filename,
      note: 'This feature will be available after ML model integration'
    }
  });
});

// ========== CATTLE MANAGEMENT (USER) ==========

/**
 * @desc    Archive cattle (move to recycle bin)
 * @route   PUT /api/v1/cattle/:id/archive
 * @access  Private (Owner only)
 */
const archiveCattle = asyncHandler(async (req, res) => {
  const cattle = await Cattle.findOne({
    _id: req.params.id,
    owner: req.user._id
  });

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  if (cattle.status === 'archive') {
    return res.status(400).json({
      success: false,
      message: 'Cattle is already archived'
    });
  }

  await cattle.archive(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Cattle moved to archive',
    data: cattle
  });
});

/**
 * @desc    Restore cattle from archive
 * @route   PUT /api/v1/cattle/:id/restore
 * @access  Private (Owner only)
 */
const restoreCattle = asyncHandler(async (req, res) => {
  const cattle = await Cattle.findOne({
    _id: req.params.id,
    owner: req.user._id
  });

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  if (cattle.status !== 'archive') {
    return res.status(400).json({
      success: false,
      message: 'Cattle is not archived'
    });
  }

  await cattle.restore();

  res.status(200).json({
    success: true,
    message: 'Cattle restored successfully',
    data: cattle
  });
});

/**
 * @desc    Delete cattle permanently
 * @route   DELETE /api/v1/cattle/:id
 * @access  Private (Owner only)
 */
const deleteCattle = asyncHandler(async (req, res) => {
  const cattle = await Cattle.findOne({
    _id: req.params.id,
    owner: req.user._id
  });

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  // Delete all images
  deleteCattleImages(cattle.images);

  // Remove from user's cattle array
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { cattle: cattle._id }
  });

  // Delete cattle
  await cattle.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Cattle deleted permanently'
  });
});

// ========== CATTLE TRANSFER (SELL FUNCTIONALITY) ==========

/**
 * @desc    Initiate cattle transfer (sell)
 * @route   POST /api/v1/cattle/:id/transfer
 * @access  Private (Owner only)
 */
const initiateCattleTransfer = asyncHandler(async (req, res) => {
  const { toOwnerId, transferType, price, notes } = req.body;

  // Get cattle
  const cattle = await Cattle.findOne({
    _id: req.params.id,
    owner: req.user._id,
    status: 'active' // Can only transfer active cattle
  });

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found or cannot be transferred'
    });
  }

  // Check if new owner exists
  const newOwner = await User.findById(toOwnerId);

  if (!newOwner) {
    return res.status(404).json({
      success: false,
      message: 'New owner not found'
    });
  }

  // Check for existing pending transfer
  const existingTransfer = await TransferRequest.findOne({
    cattle: cattle._id,
    status: 'pending'
  });

  if (existingTransfer) {
    return res.status(400).json({
      success: false,
      message: 'There is already a pending transfer request for this cattle'
    });
  }

  // Create transfer request
  const transferRequest = await TransferRequest.create({
    cattle: cattle._id,
    fromOwner: req.user._id,
    toOwner: toOwnerId,
    transferType: transferType || 'sell',
    transferDetails: {
      price,
      notes,
      transferDate: new Date()
    }
  });

  // Notify new owner
  await Notification.create({
    recipient: newOwner._id,
    recipientModel: 'User',
    type: 'transfer_request_received',
    title: 'New Transfer Request',
    message: `${req.user.fullName} wants to transfer cattle ${cattle.cattleId} (${cattle.breed}) to you.`,
    relatedCattle: cattle._id,
    relatedUser: req.user._id,
    relatedTransfer: transferRequest._id,
    priority: 'high',
    actionUrl: `/transfer-requests/${transferRequest._id}`,
    actionText: 'View Request'
  });

  await transferRequest.populate('cattle fromOwner toOwner');

  res.status(201).json({
    success: true,
    message: 'Transfer request sent successfully',
    data: transferRequest
  });
});

/**
 * @desc    Get cattle transfer history
 * @route   GET /api/v1/cattle/:id/transfer-history
 * @access  Private
 */
const getCattleTransferHistory = asyncHandler(async (req, res) => {
  let query = { _id: req.params.id };

  // Apply access control
  if (req.userType === 'user') {
    query.owner = req.user._id;
  } else if (req.userType === 'admin' && req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query)
    .populate({
      path: 'transferHistory',
      populate: [
        { path: 'fromOwner', select: 'firstName lastName mobileNumber' },
        { path: 'toOwner', select: 'firstName lastName mobileNumber' }
      ]
    });

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      cattleId: cattle.cattleId,
      currentOwner: cattle.owner,
      transferHistory: cattle.transferHistory
    }
  });
});

// ========== CATTLE IMAGES ==========

/**
 * @desc    Get cattle images by category
 * @route   GET /api/v1/cattle/:id/images/:category
 * @access  Private
 */
const getCattleImages = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const validCategories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image category'
    });
  }

  let query = { _id: req.params.id };

  // Apply access control
  if (req.userType === 'user') {
    query.owner = req.user._id;
  } else if (req.userType === 'admin' && req.user.role === 'regional_admin') {
    query['location.state'] = req.user.assignedRegion.state;
  }

  const cattle = await Cattle.findOne(query);

  if (!cattle) {
    return res.status(404).json({
      success: false,
      message: 'Cattle not found'
    });
  }

  const images = cattle.images[category] || [];

  // Format images with URLs
  const formattedImages = images.map(img => ({
    filename: img.filename,
    url: `/uploads/cattle/${category}/${img.filename}`,
    uploadedAt: img.uploadedAt,
    size: img.size,
    mimetype: img.mimetype
  }));

  res.status(200).json({
    success: true,
    data: {
      category,
      count: formattedImages.length,
      images: formattedImages
    }
  });
});

/**
 * @desc    Get cattle statistics
 * @route   GET /api/v1/cattle/statistics
 * @access  Private
 */
const getCattleStatistics = asyncHandler(async (req, res) => {
  let matchQuery = {};

  // Apply access control
  if (req.userType === 'user') {
    matchQuery.owner = req.user._id;
  } else if (req.userType === 'admin' && req.user.role === 'regional_admin') {
    matchQuery['location.state'] = req.user.assignedRegion.state;
  }

  // Status counts
  const statusCounts = await Cattle.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Verification counts
  const verificationCounts = await Cattle.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$verification.status', count: { $sum: 1 } } }
  ]);

  // Breed distribution
  const breedDistribution = await Cattle.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$breed', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Location distribution
  const locationDistribution = await Cattle.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { state: '$location.state', district: '$location.district' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const statistics = {
    total: await Cattle.countDocuments(matchQuery),
    byStatus: {},
    byVerification: {},
    byBreed: breedDistribution.map(item => ({
      breed: item._id,
      count: item.count
    })),
    byLocation: locationDistribution.map(item => ({
      state: item._id.state,
      district: item._id.district,
      count: item.count
    }))
  };

  statusCounts.forEach(item => {
    statistics.byStatus[item._id] = item.count;
  });

  verificationCounts.forEach(item => {
    statistics.byVerification[item._id] = item.count;
  });

  res.status(200).json({
    success: true,
    data: statistics
  });
});

module.exports = {
  // Registration & Viewing
  registerCattle,
  getAllCattle,
  getCattleById,
  searchCattleByImage,

  // Management
  archiveCattle,
  restoreCattle,
  deleteCattle,

  // Transfer
  initiateCattleTransfer,
  getCattleTransferHistory,

  // Images
  getCattleImages,

  // Statistics
  getCattleStatistics
};