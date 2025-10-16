const mongoose = require('mongoose');

/**
 * TransferRequest Schema - Handles cattle ownership transfers
 * As per document: Users can initiate "sell" to transfer ownership
 * Shows in Settings > Transfer requests section
 */
const transferRequestSchema = new mongoose.Schema({
  // Cattle being transferred
  cattle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
    required: [true, 'Cattle reference is required']
  },

  // Current owner (seller)
  fromOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Current owner is required']
  },

  // New owner (buyer)
  toOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'New owner is required']
  },

  // Transfer type
  transferType: {
    type: String,
    enum: ['sell', 'gift', 'inheritance', 'other'],
    default: 'sell'
  },

  // Transfer status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },

  // Transfer details
  transferDetails: {
    price: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    },
    transferDate: {
      type: Date,
      default: Date.now
    }
  },

  // Buyer's response
  buyerResponse: {
    respondedAt: Date,
    message: String
  },

  // Admin verification (if required)
  adminVerification: {
    isRequired: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    verifiedAt: Date,
    verificationNotes: String
  },

  // Request expiry
  expiresAt: {
    type: Date,
    default: function() {
      // Transfer request expires in 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },

  // Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  cancellationReason: String,

  // Completion
  completedAt: Date

}, {
  timestamps: true
});

// Indexes
transferRequestSchema.index({ cattle: 1 });
transferRequestSchema.index({ fromOwner: 1 });
transferRequestSchema.index({ toOwner: 1 });
transferRequestSchema.index({ status: 1 });
transferRequestSchema.index({ createdAt: -1 });

// Validation: Cannot transfer to the same owner
transferRequestSchema.pre('save', function(next) {
  if (this.fromOwner.equals(this.toOwner)) {
    return next(new Error('Cannot transfer cattle to the same owner'));
  }
  next();
});

// Method to accept transfer
transferRequestSchema.methods.accept = async function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending transfers can be accepted');
  }

  this.status = 'accepted';
  this.buyerResponse.respondedAt = new Date();
  this.completedAt = new Date();

  // Update cattle owner
  const Cattle = mongoose.model('Cattle');
  const cattle = await Cattle.findById(this.cattle);
  
  if (cattle) {
    // Add to transfer history
    cattle.transferHistory.push(this._id);
    
    // Change owner
    const oldOwnerId = cattle.owner;
    cattle.owner = this.toOwner;
    await cattle.save();

    // Update user's cattle array
    const User = mongoose.model('User');
    await User.findByIdAndUpdate(oldOwnerId, {
      $pull: { cattle: this.cattle }
    });
    await User.findByIdAndUpdate(this.toOwner, {
      $addToSet: { cattle: this.cattle }
    });
  }

  await this.save();
  return this;
};

// Method to reject transfer
transferRequestSchema.methods.reject = async function(message) {
  if (this.status !== 'pending') {
    throw new Error('Only pending transfers can be rejected');
  }

  this.status = 'rejected';
  this.buyerResponse.respondedAt = new Date();
  this.buyerResponse.message = message;

  await this.save();
  return this;
};

// Method to cancel transfer
transferRequestSchema.methods.cancel = async function(userId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Only pending transfers can be cancelled');
  }

  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;

  await this.save();
  return this;
};

// Check if transfer request is expired
transferRequestSchema.methods.isExpired = function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

// Static method to clean up expired requests
transferRequestSchema.statics.cleanupExpired = async function() {
  const expiredRequests = await this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });

  for (const request of expiredRequests) {
    request.status = 'cancelled';
    request.cancellationReason = 'Expired';
    await request.save();
  }

  return expiredRequests.length;
};

module.exports = mongoose.model('TransferRequest', transferRequestSchema);