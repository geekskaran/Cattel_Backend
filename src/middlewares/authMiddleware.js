const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user/admin to request object
 */

/**
 * Protect routes - Verify JWT token
 * Works for both Users and Admins
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if it's a user or admin based on decoded data
      if (decoded.role === 'user') {
        // Find user by ID from token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'User not found. Token is invalid.'
          });
        }

        // Check if user is active
        if (!req.user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Your account has been deactivated. Please contact support.'
          });
        }

        req.userType = 'user';
      } else if (decoded.role === 'regional_admin' || decoded.role === 'super_admin') {
        // Find admin by ID from token
        req.user = await Admin.findById(decoded.id).select('-password');

        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Admin not found. Token is invalid.'
          });
        }

        // Check if admin is active and approved
        if (!req.user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Your admin account has been deactivated.'
          });
        }

        if (!req.user.isApproved && decoded.role === 'regional_admin') {
          return res.status(401).json({
            success: false,
            message: 'Your admin account is pending approval.'
          });
        }

        req.userType = 'admin';
        req.adminRole = decoded.role;
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid token role.'
        });
      }

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.'
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route.'
      });
    }
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

/**
 * Optional authentication - Attach user if token exists, but don't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role === 'user') {
          req.user = await User.findById(decoded.id).select('-password');
          req.userType = 'user';
        } else if (decoded.role === 'regional_admin' || decoded.role === 'super_admin') {
          req.user = await Admin.findById(decoded.id).select('-password');
          req.userType = 'admin';
          req.adminRole = decoded.role;
        }
      } catch (error) {
        // Token invalid, but continue without user
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Check if user/admin account is verified
 */
const checkVerified = (req, res, next) => {
  if (req.userType === 'user') {
    if (!req.user.isEmailVerified && !req.user.isMobileVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email or mobile number to access this resource.'
      });
    }
  }

  next();
};

/**
 * Refresh token verification
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      req.tokenData = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in token verification'
    });
  }
};

module.exports = {
  protect,
  optionalAuth,
  checkVerified,
  verifyRefreshToken
};