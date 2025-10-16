const { 
  uploadCattleImages, 
  uploadSingleProfile, 
  validateCattleImages,
  deleteUploadedFiles 
} = require('../config/multer');

/**
 * Upload Middleware Wrapper
 * Adds error handling to multer uploads
 */

/**
 * Handle cattle image upload with validation
 */
const handleCattleImageUpload = (req, res, next) => {
  uploadCattleImages(req, res, (err) => {
    if (err) {
      // Delete any uploaded files if error occurs
      if (req.files) {
        deleteUploadedFiles(req.files);
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading images'
      });
    }

    // Validate image count (14 images required)
    const validation = validateCattleImages(req.files);

    if (!validation.valid) {
      // Delete uploaded files if validation fails
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: validation.message,
        errors: validation.errors
      });
    }

    next();
  });
};

/**
 * Handle profile picture upload
 */
const handleProfileUpload = (req, res, next) => {
  uploadSingleProfile(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading profile picture'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a profile picture'
      });
    }

    next();
  });
};

/**
 * Optional profile picture upload (doesn't fail if no file)
 */
const handleOptionalProfileUpload = (req, res, next) => {
  uploadSingleProfile(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading profile picture'
      });
    }

    // Continue even if no file uploaded
    next();
  });
};

module.exports = {
  handleCattleImageUpload,
  handleProfileUpload,
  handleOptionalProfileUpload
};