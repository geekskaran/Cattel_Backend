const mongoose = require('mongoose');

/**
 * Cattle Schema - Represents individual cattle registration
 * Strictly follows the document requirements:
 * - 14 images total: Muzzle(3), Face(3), Left(3), Right(3), Full Body Left(1), Full Body Right(1)
 * - Tag Number (user provided, NOT the cattle ID)
 * - System generates unique Cattle ID
 * - Three statuses: active, archive, transit
 * - Regional admin verification with 48-hour turnaround
 */
const cattleSchema = new mongoose.Schema({
  // System Generated Unique Cattle ID (NOT the tag number)
  cattleId: {
    type: String,
    unique: true,
    required: true
  },

  // Owner Information
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner is required']
  },

  // Basic Information (as per document)
  breed: {
    type: String,
    required: [true, 'Breed is required'],
    trim: true
  },
  
  // Tag Number - User provided ear tag (NOT the cattle ID)
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

  // Additional cattle information
  color: {
    type: String,
    trim: true
  },

  type: {
    type: String,
    trim: true
  },

  // Images - Exactly 14 images as per document
  // Muzzle: 3 pictures
  images: {
    muzzle: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }],
    
    // Face: 3 pictures
    face: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }],
    
    // Left side face: 3 pictures
    left: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }],
    
    // Right side face: 3 pictures
    right: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }],
    
    // Full body left: 1 picture
    fullBodyLeft: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }],
    
    // Full body right: 1 picture
    fullBodyRight: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      size: Number,
      mimetype: String
    }]
  },

  // Registration Status: active, archive, transit (as per document)
  status: {
    type: String,
    enum: ['active', 'archive', 'transit'],
    default: 'transit' // Starts as transit, moves to active after admin approval
  },

  // Verification by Regional Admin
  verification: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    verifiedAt: Date,
    rejectionReason: String,
    
    // 48-hour turnaround tracking
    submittedAt: {
      type: Date,
      default: Date.now
    },
    turnaroundDeadline: {
      type: Date
    }
  },

  // Temporary ID before approval (as per document point 6c)
  temporaryId: {
    type: String
  },

  // Check if cattle already exists in database (1 to n matching as per image points 11 & 12)
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle'
  },

  // Location of the cattle (inherited from owner during registration)
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

  // Archive information (when user clicks "archive" button)
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

// Indexes for faster queries
cattleSchema.index({ cattleId: 1 });
cattleSchema.index({ owner: 1 });
cattleSchema.index({ status: 1 });
cattleSchema.index({ 'verification.status': 1 });
cattleSchema.index({ 'location.state': 1, 'location.district': 1 });
cattleSchema.index({ createdAt: -1 });

// Pre-save middleware to generate unique Cattle ID
cattleSchema.pre('save', async function(next) {
  if (this.isNew && !this.cattleId) {
    // Generate unique Cattle ID format: C followed by timestamp and random number
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.cattleId = `C${timestamp}${random}`;
    
    // Generate temporary ID for transit status
    if (this.status === 'transit') {
      this.temporaryId = `TEMP-${this.cattleId}`;
    }
  }
  next();
});

// Pre-save middleware to set turnaround deadline (48 hours from submission)
cattleSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'transit') {
    const turnaroundHours = parseInt(process.env.VERIFICATION_TURNAROUND_HOURS) || 48;
    this.verification.turnaroundDeadline = new Date(
      this.verification.submittedAt.getTime() + (turnaroundHours * 60 * 60 * 1000)
    );
  }
  next();
});

// Validation: Ensure exactly 14 images (as per document)
cattleSchema.pre('save', function(next) {
  const muzzleCount = this.images.muzzle.length;
  const faceCount = this.images.face.length;
  const leftCount = this.images.left.length;
  const rightCount = this.images.right.length;
  const fullBodyLeftCount = this.images.fullBodyLeft.length;
  const fullBodyRightCount = this.images.fullBodyRight.length;

  const totalImages = muzzleCount + faceCount + leftCount + rightCount + fullBodyLeftCount + fullBodyRightCount;

  // Only validate if status is not transit (during submission, images are uploaded)
  if (this.status !== 'transit' && this.verification.status === 'approved') {
    if (muzzleCount !== 3) {
      return next(new Error('Exactly 3 muzzle images are required'));
    }
    if (faceCount !== 3) {
      return next(new Error('Exactly 3 face images are required'));
    }
    if (leftCount !== 3) {
      return next(new Error('Exactly 3 left side images are required'));
    }
    if (rightCount !== 3) {
      return next(new Error('Exactly 3 right side images are required'));
    }
    if (fullBodyLeftCount !== 1) {
      return next(new Error('Exactly 1 full body left image is required'));
    }
    if (fullBodyRightCount !== 1) {
      return next(new Error('Exactly 1 full body right image is required'));
    }
    if (totalImages !== 14) {
      return next(new Error('Exactly 14 images are required in total'));
    }
  }

  next();
});

// Method to approve cattle registration
cattleSchema.methods.approve = async function(adminId) {
  this.verification.status = 'approved';
  this.verification.verifiedBy = adminId;
  this.verification.verifiedAt = new Date();
  this.status = 'active'; // Move from transit to active
  this.temporaryId = undefined; // Remove temporary ID
  
  await this.save();
  return this;
};

// Method to reject cattle registration
cattleSchema.methods.reject = async function(adminId, reason) {
  this.verification.status = 'rejected';
  this.verification.verifiedBy = adminId;
  this.verification.verifiedAt = new Date();
  this.verification.rejectionReason = reason;
  
  await this.save();
  return this;
};

// Method to archive cattle (recycle bin)
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

// Method to check if verification deadline is exceeded
cattleSchema.methods.isVerificationOverdue = function() {
  if (this.verification.status === 'pending' && this.verification.turnaroundDeadline) {
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

// Static method to check if cattle already exists (duplicate detection)
cattleSchema.statics.checkDuplicate = async function(ownerId, imageData) {
  // This will be implemented with image comparison logic
  // For now, returns false (no ML model as per your instruction)
  return null;
};

cattleSchema.set('toJSON', { virtuals: true });
cattleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cattle', cattleSchema);