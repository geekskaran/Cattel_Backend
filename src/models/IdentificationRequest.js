const mongoose = require('mongoose');

/**
 * IdentificationRequest Schema
 * Handles user requests to identify cattle by photo
 * Flow: User captures photo → Creates request → M_Admin identifies → User gets result
 */
const identificationRequestSchema = new mongoose.Schema({
  // Request ID (auto-generated)
  requestId: {
    type: String,
    unique: true
  },

  // User who made the request
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },

  // Uploaded image for identification
  image: {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    size: Number,
    mimetype: String
  },

  // Request status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },

  // Processing information
  processing: {
    startedAt: Date,
    completedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    timeTaken: Number // in seconds
  },

  // Identification result
  result: {
    found: { type: Boolean, default: false },
    cattle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cattle'
    },
    cattleId: String,
    confidence: Number, // Percentage (for future ML integration)
    message: String,
    identifiedAt: Date
  },

  // Notes from M_Admin
  adminNotes: String,

  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },

  // Request metadata
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },

  deviceInfo: String,

  // Expiry (auto-cancel after 7 days if not processed)
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  },

  // Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  cancellationReason: String

}, {
  timestamps: true
});

// Indexes for faster queries
identificationRequestSchema.index({ requestId: 1 });
identificationRequestSchema.index({ user: 1 });
identificationRequestSchema.index({ status: 1 });
identificationRequestSchema.index({ createdAt: -1 });
identificationRequestSchema.index({ 'processing.processedBy': 1 });

// Pre-save: Generate unique Request ID
identificationRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() + 10000).toString().padStart(4, '0');
    this.requestId = `IDR-${timestamp}${random}`;
  }
  next();
});

// Method to start processing
identificationRequestSchema.methods.startProcessing = async function(adminId) {
  this.status = 'processing';
  this.processing.startedAt = new Date();
  this.processing.processedBy = adminId;
  await this.save();
  return this;
};

// Method to complete with result
identificationRequestSchema.methods.completeWithResult = async function(resultData) {
  this.status = 'completed';
  this.processing.completedAt = new Date();
  
  // Calculate time taken
  if (this.processing.startedAt) {
    const timeDiff = this.processing.completedAt - this.processing.startedAt;
    this.processing.timeTaken = Math.floor(timeDiff / 1000); // Convert to seconds
  }

  // Set result
  this.result = {
    ...this.result,
    ...resultData,
    identifiedAt: new Date()
  };

  await this.save();
  return this;
};

// Method to mark as failed
identificationRequestSchema.methods.markAsFailed = async function(message) {
  this.status = 'failed';
  this.processing.completedAt = new Date();
  this.result.message = message;
  await this.save();
  return this;
};

// Method to cancel request
identificationRequestSchema.methods.cancel = async function(userId, reason) {
  if (this.status !== 'pending' && this.status !== 'processing') {
    throw new Error('Only pending or processing requests can be cancelled');
  }

  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;

  await this.save();
  return this;
};

// Check if request is expired
identificationRequestSchema.methods.isExpired = function() {
  return (this.status === 'pending' || this.status === 'processing') && new Date() > this.expiresAt;
};

// Static method to clean up expired requests
identificationRequestSchema.statics.cleanupExpired = async function() {
  const expiredRequests = await this.find({
    status: { $in: ['pending', 'processing'] },
    expiresAt: { $lt: new Date() }
  });

  for (const request of expiredRequests) {
    request.status = 'failed';
    request.result.message = 'Request expired';
    await request.save();
  }

  return expiredRequests.length;
};

// Static method to get pending requests count for M_Admin
identificationRequestSchema.statics.getPendingCount = async function(region = null) {
  const query = { status: 'pending' };
  
  // If region specified, filter by user's region
  if (region) {
    const User = mongoose.model('User');
    const users = await User.find({ 'address.state': region }).select('_id');
    const userIds = users.map(u => u._id);
    query.user = { $in: userIds };
  }

  return await this.countDocuments(query);
};

module.exports = mongoose.model('IdentificationRequest', identificationRequestSchema);