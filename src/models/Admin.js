const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Admin Schema - Represents Regional Admins, M_Admins, and Super Admins
 * Updated workflow:
 * - Regional Admin: Reviews and forwards/denies cattle to M_Admin
 * - M_Admin: Performs identification and approves/rejects cattle
 * - Super Admin: Global management
 */
const adminSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },

  // Admin Role - UPDATED with m_admin
  role: {
    type: String,
    enum: ['regional_admin', 'm_admin', 'super_admin'],
    required: [true, 'Admin role is required']
  },

  // Regional Assignment (for regional_admin and m_admin)
  assignedRegion: {
    state: {
      type: String,
      trim: true
    },
    districts: [{
      type: String,
      trim: true
    }]
  },

  // Profile Picture
  profilePicture: {
    filename: String,
    path: String,
    uploadedAt: Date
  },

  // Verification Status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isMobileVerified: {
    type: Boolean,
    default: false
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: false // All admins need super admin approval
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' // Reference to Super Admin who approved
  },
  approvedAt: Date,

  // OTP for authentication
  otp: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },

  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // Activity Tracking
  lastLogin: Date,
  loginHistory: [{
    loginAt: Date,
    ipAddress: String,
    userAgent: String
  }],

  // Statistics for Regional Admin and M_Admin
  statistics: {
    totalVerifications: {
      type: Number,
      default: 0
    },
    pendingVerifications: {
      type: Number,
      default: 0
    },
    forwardedToMAdmin: { // NEW: For Regional Admin
      type: Number,
      default: 0
    },
    approvedCattle: {
      type: Number,
      default: 0
    },
    rejectedCattle: {
      type: Number,
      default: 0
    },
    deniedByRegionalAdmin: { // NEW: For tracking regional admin denials
      type: Number,
      default: 0
    }
  },

  // Notifications
  notifications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification'
  }],

  // Created by (for admins created by super admin or backend team)
  createdBy: {
    type: String,
    enum: ['backend_team', 'super_admin'],
    default: 'backend_team'
  }

}, {
  timestamps: true
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ mobileNumber: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ 'assignedRegion.state': 1 });

// Validation: Regional admin and M_admin must have assigned region
adminSchema.pre('save', function(next) {
  if ((this.role === 'regional_admin' || this.role === 'm_admin') && 
      (!this.assignedRegion || !this.assignedRegion.state)) {
    return next(new Error(`${this.role} must have an assigned region`));
  }
  next();
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
adminSchema.methods.generateOTP = function() {
  const otpLength = parseInt(process.env.OTP_LENGTH) || 6;
  const otp = Math.floor(Math.pow(10, otpLength - 1) + Math.random() * 9 * Math.pow(10, otpLength - 1)).toString();
  
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES) * 60 * 1000),
    attempts: 0
  };
  
  return otp;
};

// Method to verify OTP
adminSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.otp || !this.otp.code) {
    return { success: false, message: 'No OTP found' };
  }

  if (this.otp.expiresAt < new Date()) {
    return { success: false, message: 'OTP has expired' };
  }

  if (this.otp.attempts >= 3) {
    return { success: false, message: 'Maximum OTP attempts exceeded' };
  }

  if (this.otp.code === candidateOTP) {
    this.otp = undefined;
    return { success: true, message: 'OTP verified successfully' };
  }

  this.otp.attempts += 1;
  return { success: false, message: 'Invalid OTP' };
};

// Virtual for full name
adminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Check if admin can manage a specific region
adminSchema.methods.canManageRegion = function(state, district = null) {
  if (this.role === 'super_admin') {
    return true;
  }

  if (this.role === 'regional_admin' || this.role === 'm_admin') {
    if (this.assignedRegion.state !== state) {
      return false;
    }
    
    if (district && this.assignedRegion.districts.length > 0) {
      return this.assignedRegion.districts.includes(district);
    }
    
    return true;
  }

  return false;
};

adminSchema.set('toJSON', { virtuals: true });
adminSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Admin', adminSchema);