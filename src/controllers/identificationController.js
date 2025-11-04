const IdentificationRequest = require('../models/IdentificationRequest');
const Cattle = require('../models/Cattle');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const fs = require('fs').promises;
const path = require('path');

/**
 * Identification Request Controller
 * Handles user cattle identification requests
 * Flow: User → Capture → Create Request → M_Admin Identifies → User Gets Result
 */

// ========== USER: CATTLE IDENTIFICATION REQUESTS ==========

/**
 * @desc    Create identification request (User captures photo to identify cattle)
 * @route   POST /api/v1/cattle/identify
 * @access  Private (User only)
 */
const createIdentificationRequest = asyncHandler(async (req, res) => {
  const { latitude, longitude, address, deviceInfo } = req.body;

  // Check if image is uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload an image for identification'
    });
  }

  // Create identification request
  const identificationRequest = await IdentificationRequest.create({
    user: req.user._id,
    image: {
      filename: req.file.filename,
      path: req.file.path,
      uploadedAt: new Date(),
      size: req.file.size,
      mimetype: req.file.mimetype
    },
    location: latitude && longitude ? {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || ''
    } : undefined,
    deviceInfo: deviceInfo || req.get('user-agent'),
    status: 'pending'
  });

  // Get user details
  const user = await User.findById(req.user._id);

  // Find M_Admins in the user's region
  const mAdmins = await Admin.find({
    role: 'm_admin',
    'assignedRegion.state': user.address.state,
    isActive: true,
    isApproved: true
  });

  // Notify M_Admins
  for (const mAdmin of mAdmins) {
    await Notification.create({
      recipient: mAdmin._id,
      recipientModel: 'Admin',
      type: 'identification_request_created',
      title: 'New Cattle Identification Request',
      message: `${user.firstName} ${user.lastName} has submitted a cattle identification request.`,
      relatedUser: user._id,
      priority: 'normal',
      actionUrl: `/m-admin/identification/${identificationRequest._id}`,
      actionText: 'Identify Cattle'
    });

    // Update M_Admin statistics
    if (mAdmin.statistics) {
      mAdmin.statistics.identificationRequestsPending = 
        (mAdmin.statistics.identificationRequestsPending || 0) + 1;
      await mAdmin.save();
    }
  }

  // Populate and return
  await identificationRequest.populate('user', 'firstName lastName mobileNumber email');

  res.status(201).json({
    success: true,
    message: 'Identification request submitted successfully. Processing may take up to 24 hours.',
    data: {
      identificationRequest,
      estimatedTime: '24 hours',
      requestId: identificationRequest.requestId
    }
  });
});

/**
 * @desc    Get user's identification requests
 * @route   GET /api/v1/cattle/identify/my-requests
 * @access  Private (User only)
 */
const getMyIdentificationRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  let query = { user: req.user._id };

  // Filter by status if provided
  if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const requests = await IdentificationRequest.find(query)
    .populate('result.cattle', 'cattleId breed age images.face')
    .populate('processing.processedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await IdentificationRequest.countDocuments(query);

  // Format image URLs
  const formattedRequests = requests.map(req => {
    const reqObj = req.toObject();
    if (reqObj.image) {
      reqObj.image.url = `/uploads/identification/${reqObj.image.filename}`;
    }
    return reqObj;
  });

  res.status(200).json({
    success: true,
    data: {
      requests: formattedRequests,
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
 * @desc    Get single identification request by ID
 * @route   GET /api/v1/cattle/identify/:id
 * @access  Private (User only - own requests)
 */
const getIdentificationRequestById = asyncHandler(async (req, res) => {
  const request = await IdentificationRequest.findOne({
    _id: req.params.id,
    user: req.user._id
  })
    .populate('user', 'firstName lastName mobileNumber email address')
    .populate('result.cattle', 'cattleId breed age color type images')
    .populate('processing.processedBy', 'firstName lastName role');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  // Format image URL
  const requestObj = request.toObject();
  if (requestObj.image) {
    requestObj.image.url = `/uploads/identification/${requestObj.image.filename}`;
  }

  res.status(200).json({
    success: true,
    data: requestObj
  });
});

/**
 * @desc    Cancel identification request
 * @route   PUT /api/v1/cattle/identify/:id/cancel
 * @access  Private (User only - own requests)
 */
const cancelIdentificationRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const request = await IdentificationRequest.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  if (request.status === 'completed' || request.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel a ${request.status} request`
    });
  }

  await request.cancel(req.user._id, reason || 'Cancelled by user');

  res.status(200).json({
    success: true,
    message: 'Identification request cancelled successfully',
    data: request
  });
});

// ========== M_ADMIN: PROCESS IDENTIFICATION REQUESTS ==========

/**
 * @desc    Get pending identification requests for M_Admin
 * @route   GET /api/v1/admin/m-admin/identification/pending
 * @access  Private (M_Admin only)
 */
const getPendingIdentificationRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  // Build query - M_Admin sees only their region
  let userIds = [];
  if (req.user.role === 'm_admin') {
    const users = await User.find({
      'address.state': req.user.assignedRegion.state
    }).select('_id');
    userIds = users.map(u => u._id);
  }

  const query = {
    status: { $in: ['pending', 'processing'] }
  };

  if (userIds.length > 0) {
    query.user = { $in: userIds };
  }

  const skip = (page - 1) * limit;

  const requests = await IdentificationRequest.find(query)
    .populate('user', 'firstName lastName mobileNumber email address')
    .populate('processing.processedBy', 'firstName lastName')
    .sort({ createdAt: 1 }) // Oldest first
    .limit(parseInt(limit))
    .skip(skip);

  const total = await IdentificationRequest.countDocuments(query);

  // Format image URLs
  const formattedRequests = requests.map(req => {
    const reqObj = req.toObject();
    if (reqObj.image) {
      reqObj.image.url = `/uploads/identification/${reqObj.image.filename}`;
    }
    return reqObj;
  });

  res.status(200).json({
    success: true,
    data: {
      requests: formattedRequests,
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
 * @desc    Get identification request details for M_Admin processing
 * @route   GET /api/v1/admin/m-admin/identification/:id
 * @access  Private (M_Admin only)
 */
const getIdentificationRequestForAdmin = asyncHandler(async (req, res) => {
  const request = await IdentificationRequest.findById(req.params.id)
    .populate('user', 'firstName lastName mobileNumber email address occupation')
    .populate('result.cattle')
    .populate('processing.processedBy', 'firstName lastName role');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  // Format image URL
  const requestObj = request.toObject();
  if (requestObj.image) {
    requestObj.image.url = `/uploads/identification/${requestObj.image.filename}`;
  }

  res.status(200).json({
    success: true,
    data: requestObj
  });
});

/**
 * @desc    Start processing identification request
 * @route   PUT /api/v1/admin/m-admin/identification/:id/start
 * @access  Private (M_Admin only)
 */
const startProcessingRequest = asyncHandler(async (req, res) => {
  const request = await IdentificationRequest.findById(req.params.id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Cannot start processing a ${request.status} request`
    });
  }

  await request.startProcessing(req.user._id);

  // Notify user that processing has started
  await Notification.create({
    recipient: request.user,
    recipientModel: 'User',
    type: 'identification_processing_started',
    title: 'Identification In Progress',
    message: `Your cattle identification request ${request.requestId} is now being processed.`,
    priority: 'normal'
  });

  res.status(200).json({
    success: true,
    message: 'Started processing identification request',
    data: request
  });
});

/**
 * @desc    Complete identification request with result
 * @route   PUT /api/v1/admin/m-admin/identification/:id/complete
 * @access  Private (M_Admin only)
 */
const completeIdentificationRequest = asyncHandler(async (req, res) => {
  const { found, cattleId, message, adminNotes, confidence } = req.body;

  if (found === undefined || found === null) {
    return res.status(400).json({
      success: false,
      message: 'Please specify if cattle was found (true/false)'
    });
  }

  const request = await IdentificationRequest.findById(req.params.id)
    .populate('user');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  if (request.status !== 'pending' && request.status !== 'processing') {
    return res.status(400).json({
      success: false,
      message: `Cannot complete a ${request.status} request`
    });
  }

  // If cattle found, verify it exists
  let cattle = null;
  if (found && cattleId) {
    cattle = await Cattle.findOne({ _id: cattleId });
    if (!cattle) {
      return res.status(404).json({
        success: false,
        message: 'Cattle not found with provided ID'
      });
    }
  }

  // Complete the request with result
  await request.completeWithResult({
    found: found,
    cattle: cattle?._id,
    cattleId: cattle?.cattleId,
    confidence: confidence || null,
    message: message || (found ? 'Cattle identified successfully' : 'No match found in database')
  });

  // Update admin notes if provided
  if (adminNotes) {
    request.adminNotes = adminNotes;
    await request.save();
  }

  // Update M_Admin statistics
  const mAdmin = await Admin.findById(req.user._id);
  if (mAdmin && mAdmin.statistics) {
    mAdmin.statistics.identificationRequestsPending = 
      Math.max(0, (mAdmin.statistics.identificationRequestsPending || 0) - 1);
    mAdmin.statistics.identificationRequestsCompleted = 
      (mAdmin.statistics.identificationRequestsCompleted || 0) + 1;
    await mAdmin.save();
  }

  // Add to cattle's identification history if found
  if (cattle) {
    cattle.identificationHistory = cattle.identificationHistory || [];
    cattle.identificationHistory.push({
      identifiedAt: new Date(),
      identifiedBy: req.user._id,
      method: 'image_scan'
    });
    await cattle.save();
  }

  // Notify user
  const notificationTitle = found ? 'Cattle Identified!' : 'Identification Complete';
  const notificationMessage = found 
    ? `Your cattle has been identified as ${cattle.cattleId}. Processing completed in ${request.processing.timeTaken || 0} seconds.`
    : `No match found for your identification request. ${message || ''}`;

  await Notification.create({
    recipient: request.user._id,
    recipientModel: 'User',
    type: found ? 'identification_found' : 'identification_not_found',
    title: notificationTitle,
    message: notificationMessage,
    priority: 'high',
    actionUrl: found ? `/cattle/${cattle._id}` : null,
    actionText: found ? 'View Cattle' : null
  });

  await request.populate('result.cattle', 'cattleId breed age images.face');

  res.status(200).json({
    success: true,
    message: 'Identification request completed successfully',
    data: request
  });
});

/**
 * @desc    Mark identification request as failed
 * @route   PUT /api/v1/admin/m-admin/identification/:id/fail
 * @access  Private (M_Admin only)
 */
const failIdentificationRequest = asyncHandler(async (req, res) => {
  const { message, reason } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a failure message'
    });
  }

  const request = await IdentificationRequest.findById(req.params.id)
    .populate('user');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Identification request not found'
    });
  }

  if (request.status === 'completed' || request.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: `Cannot fail a ${request.status} request`
    });
  }

  await request.markAsFailed(message);
  
  if (reason) {
    request.adminNotes = reason;
    await request.save();
  }

  // Update M_Admin statistics
  const mAdmin = await Admin.findById(req.user._id);
  if (mAdmin && mAdmin.statistics) {
    mAdmin.statistics.identificationRequestsPending = 
      Math.max(0, (mAdmin.statistics.identificationRequestsPending || 0) - 1);
    await mAdmin.save();
  }

  // Notify user
  await Notification.create({
    recipient: request.user._id,
    recipientModel: 'User',
    type: 'identification_failed',
    title: 'Identification Failed',
    message: `Your identification request failed: ${message}`,
    priority: 'high'
  });

  res.status(200).json({
    success: true,
    message: 'Identification request marked as failed',
    data: request
  });
});

// ========== STATISTICS ==========

/**
 * @desc    Get identification statistics
 * @route   GET /api/v1/cattle/identify/statistics
 * @access  Private (User can see their stats, Admin can see all)
 */
const getIdentificationStatistics = asyncHandler(async (req, res) => {
  let query = {};

  // Users see only their statistics
  if (req.userType === 'user') {
    query.user = req.user._id;
  }
  // M_Admin sees their region
  else if (req.userType === 'admin' && req.user.role === 'm_admin') {
    const users = await User.find({
      'address.state': req.user.assignedRegion.state
    }).select('_id');
    const userIds = users.map(u => u._id);
    query.user = { $in: userIds };
  }

  const stats = {
    total: await IdentificationRequest.countDocuments(query),
    pending: await IdentificationRequest.countDocuments({ ...query, status: 'pending' }),
    processing: await IdentificationRequest.countDocuments({ ...query, status: 'processing' }),
    completed: await IdentificationRequest.countDocuments({ ...query, status: 'completed' }),
    failed: await IdentificationRequest.countDocuments({ ...query, status: 'failed' }),
    cancelled: await IdentificationRequest.countDocuments({ ...query, status: 'cancelled' }),
    found: await IdentificationRequest.countDocuments({ ...query, 'result.found': true }),
    notFound: await IdentificationRequest.countDocuments({ 
      ...query, 
      status: 'completed',
      'result.found': false 
    })
  };

  // Calculate average processing time for completed requests
  const completedRequests = await IdentificationRequest.find({
    ...query,
    status: 'completed',
    'processing.timeTaken': { $exists: true }
  }).select('processing.timeTaken');

  if (completedRequests.length > 0) {
    const totalTime = completedRequests.reduce((sum, req) => sum + req.processing.timeTaken, 0);
    stats.averageProcessingTime = Math.floor(totalTime / completedRequests.length);
  } else {
    stats.averageProcessingTime = 0;
  }

  res.status(200).json({
    success: true,
    data: stats
  });
});

module.exports = {
  // User endpoints
  createIdentificationRequest,
  getMyIdentificationRequests,
  getIdentificationRequestById,
  cancelIdentificationRequest,

  // M_Admin endpoints
  getPendingIdentificationRequests,
  getIdentificationRequestForAdmin,
  startProcessingRequest,
  completeIdentificationRequest,
  failIdentificationRequest,

  // Statistics
  getIdentificationStatistics
};