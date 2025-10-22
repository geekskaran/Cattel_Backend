const mongoose = require('mongoose');

/**
 * Cattle Schema - Updated with new verification workflow
 * New Flow:
 * 1. User registers → status: 'transit', verification.status: 'pending_regional_review'
 * 2. Regional Admin reviews → Can 'deny' OR forward → verification.status: 'forwarded_to_m_admin'
 * 3. M_Admin identifies → Can 'approve' OR 'reject' → status: 'active' or remains 'transit'
 */
const cattleSchema = new mongoose.Schema({
  // System Generated Unique Cattle ID
  cattleId: {
    type: String,
    // unique: true,
    // required: true
  },

  // Owner Information
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner is required']
  },

  // Basic Information
  breed: {
    type: String,
    required: [true, 'Breed is required'],
    trim: true
  },
  
  tagNo: {
    type: String,
    trim: true,
    default: null
  },

  medicalHistory: {
    type: String,
    trim: true,
    default: ''
  },

  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [0, 'Age cannot be negative']
  },

  color: {
    type: String,
    trim: true
  },

  type: {
    type: String,
    trim: true
  },

  // Images - 14 total
  images: {
    muzzle: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }],
    face: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }],
    left: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }],
    right: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }],
    fullBodyLeft: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }],
    fullBodyRight: [{
      filename: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      size: Number,
      mimetype: String
    }]
  },

  // Status: active, archive, transit
  status: {
    type: String,
    enum: ['active', 'archive', 'transit'],
    default: 'transit'
  },

  // UPDATED Verification with new workflow
  verification: {
    status: {
      type: String,
      enum: [
        'pending_regional_review',    // Initial state after user submits
        'denied_by_regional',          // Regional admin denied
        'forwarded_to_m_admin',        // Regional admin forwarded to M_Admin
        'pending_m_admin_review',      // M_Admin is reviewing
        'approved',                     // M_Admin approved
        'rejected'                      // M_Admin rejected
      ],
      default: 'pending_regional_review'
    },
    
    // Regional Admin Review
    reviewedByRegionalAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    regionalReviewedAt: Date,
    regionalAdminAction: {
      type: String,
      enum: ['forwarded', 'denied'],
      default: null
    },
    regionalDenialReason: String,
    
    // M_Admin Review (Final approval/rejection)
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    verifiedAt: Date,
    rejectionReason: String,
    
    // Timing
    submittedAt: {
      type: Date,
      default: Date.now
    },
    turnaroundDeadline: {
      type: Date
    },
    forwardedToMAdminAt: Date
  },

  // Temporary ID before approval
  temporaryId: {
    type: String
  },

  // Duplicate detection
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle'
  },

  // Location
  location: {
    state: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    pinCode: {
      type: String
    }
  },

  // Transfer/Ownership history
  transferHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransferRequest'
  }],

  // Archive information
  archivedAt: Date,
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Identification/Verification attempts
  identificationHistory: [{
    identifiedAt: Date,
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    method: {
      type: String,
      enum: ['image_scan', 'manual_search']
    }
  }]

}, {
  timestamps: true
});

// Indexes
cattleSchema.index({ cattleId: 1 });
cattleSchema.index({ owner: 1 });
cattleSchema.index({ status: 1 });
cattleSchema.index({ 'verification.status': 1 });
cattleSchema.index({ 'location.state': 1, 'location.district': 1 });
cattleSchema.index({ createdAt: -1 });

// Pre-save: Generate unique Cattle ID
cattleSchema.pre('save', async function(next) {
  if (this.isNew && !this.cattleId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.cattleId = `C${timestamp}${random}`;
    
    if (this.status === 'transit') {
      this.temporaryId = `TEMP-${this.cattleId}`;
    }
  }
  next();
});

// Pre-save: Set turnaround deadline (48 hours)
cattleSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'transit') {
    const turnaroundHours = parseInt(process.env.VERIFICATION_TURNAROUND_HOURS) || 48;
    this.verification.turnaroundDeadline = new Date(
      this.verification.submittedAt.getTime() + (turnaroundHours * 60 * 60 * 1000)
    );
  }
  next();
});

// NEW: Method for Regional Admin to forward to M_Admin
cattleSchema.methods.forwardToMAdmin = async function(regionalAdminId) {
  this.verification.status = 'forwarded_to_m_admin';
  this.verification.reviewedByRegionalAdmin = regionalAdminId;
  this.verification.regionalReviewedAt = new Date();
  this.verification.regionalAdminAction = 'forwarded';
  this.verification.forwardedToMAdminAt = new Date();
  
  await this.save();
  return this;
};

// NEW: Method for Regional Admin to deny
cattleSchema.methods.denyByRegionalAdmin = async function(regionalAdminId, reason) {
  this.verification.status = 'denied_by_regional';
  this.verification.reviewedByRegionalAdmin = regionalAdminId;
  this.verification.regionalReviewedAt = new Date();
  this.verification.regionalAdminAction = 'denied';
  this.verification.regionalDenialReason = reason;
  
  await this.save();
  return this;
};

// UPDATED: Method for M_Admin to approve
cattleSchema.methods.approve = async function(mAdminId) {
  this.verification.status = 'approved';
  this.verification.verifiedBy = mAdminId;
  this.verification.verifiedAt = new Date();
  this.status = 'active';
  this.temporaryId = undefined;
  
  await this.save();
  return this;
};

// UPDATED: Method for M_Admin to reject
cattleSchema.methods.reject = async function(mAdminId, reason) {
  this.verification.status = 'rejected';
  this.verification.verifiedBy = mAdminId;
  this.verification.verifiedAt = new Date();
  this.verification.rejectionReason = reason;
  
  await this.save();
  return this;
};

// Method to archive cattle
cattleSchema.methods.archive = async function(userId) {
  this.status = 'archive';
  this.archivedAt = new Date();
  this.archivedBy = userId;
  
  await this.save();
  return this;
};

// Method to restore from archive
cattleSchema.methods.restore = async function() {
  if (this.verification.status === 'approved') {
    this.status = 'active';
  } else {
    this.status = 'transit';
  }
  this.archivedAt = undefined;
  this.archivedBy = undefined;
  
  await this.save();
  return this;
};

// Check if verification deadline exceeded
cattleSchema.methods.isVerificationOverdue = function() {
  if (this.verification.status === 'pending_regional_review' && this.verification.turnaroundDeadline) {
    return new Date() > this.verification.turnaroundDeadline;
  }
  return false;
};

// Virtual to get total image count
cattleSchema.virtual('totalImages').get(function() {
  return (
    this.images.muzzle.length +
    this.images.face.length +
    this.images.left.length +
    this.images.right.length +
    this.images.fullBodyLeft.length +
    this.images.fullBodyRight.length
  );
});

cattleSchema.set('toJSON', { virtuals: true });
cattleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cattle', cattleSchema);