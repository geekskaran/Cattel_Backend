const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Multer Configuration for Image Uploads
 * Handles profile pictures and cattle images with proper validation
 * Images stored in local server storage as per requirements
 */

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage configuration for profile pictures
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Format: userId_timestamp_originalname
    const userId = req.user ? req.user.id : 'temp';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for cattle images with category-based folders
const cattleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Get image category from fieldname (muzzle, face, left, right, fullBodyLeft, fullBodyRight)
    const category = file.fieldname;
    const uploadPath = path.join(__dirname, `../uploads/cattle/${category}`);
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Format: cattleId_category_timestamp_index.ext
    const userId = req.user ? req.user.id : 'temp';
    const timestamp = Date.now();
    const category = file.fieldname;
    const ext = path.extname(file.originalname);
    const random = Math.floor(Math.random() * 10000);
    const filename = `${userId}_${category}_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

// File filter to accept only images
const imageFileFilter = (req, file, cb) => {
  // Allowed image types from .env
  const allowedTypes = process.env.ALLOWED_IMAGE_TYPES 
    ? process.env.ALLOWED_IMAGE_TYPES.split(',')
    : ['image/jpeg', 'image/jpg', 'image/png'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, and PNG images are allowed.'), false);
  }
};

// File size limit from .env (default 10MB)
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

// Multer upload for profile pictures
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: maxFileSize
  },
  fileFilter: imageFileFilter
});

// Multer upload for cattle images
// Exactly 14 images: muzzle(3), face(3), left(3), right(3), fullBodyLeft(1), fullBodyRight(1)
const uploadCattle = multer({
  storage: cattleStorage,
  limits: {
    fileSize: maxFileSize,
    files: 14 // Maximum 14 files as per document
  },
  fileFilter: imageFileFilter
});

// Field configuration for cattle image upload (14 images total)
const cattleImageFields = [
  { name: 'muzzle', maxCount: 3 },      // 3 muzzle images
  { name: 'face', maxCount: 3 },        // 3 face images
  { name: 'left', maxCount: 3 },        // 3 left side images
  { name: 'right', maxCount: 3 },       // 3 right side images
  { name: 'fullBodyLeft', maxCount: 1 }, // 1 full body left image
  { name: 'fullBodyRight', maxCount: 1 } // 1 full body right image
];

// Middleware to upload cattle images with all categories
const uploadCattleImages = uploadCattle.fields(cattleImageFields);

// Single profile picture upload
const uploadSingleProfile = uploadProfile.single('profilePicture');

// Helper function to delete uploaded files (for cleanup on error)
const deleteUploadedFiles = (files) => {
  if (!files) return;

  // Handle multiple file formats (array, object with arrays, single file)
  if (Array.isArray(files)) {
    files.forEach(file => {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  } else if (typeof files === 'object') {
    Object.keys(files).forEach(key => {
      if (Array.isArray(files[key])) {
        files[key].forEach(file => {
          if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
    });
  } else if (files && files.path && fs.existsSync(files.path)) {
    fs.unlinkSync(files.path);
  }
};

// Validate cattle images count (must be exactly 14 images)
const validateCattleImages = (files) => {
  if (!files) {
    return { valid: false, message: 'No images uploaded' };
  }

  const muzzleCount = files.muzzle ? files.muzzle.length : 0;
  const faceCount = files.face ? files.face.length : 0;
  const leftCount = files.left ? files.left.length : 0;
  const rightCount = files.right ? files.right.length : 0;
  const fullBodyLeftCount = files.fullBodyLeft ? files.fullBodyLeft.length : 0;
  const fullBodyRightCount = files.fullBodyRight ? files.fullBodyRight.length : 0;

  const errors = [];

  if (muzzleCount !== 3) {
    errors.push(`Muzzle images: ${muzzleCount}/3 (exactly 3 required)`);
  }
  if (faceCount !== 3) {
    errors.push(`Face images: ${faceCount}/3 (exactly 3 required)`);
  }
  if (leftCount !== 3) {
    errors.push(`Left side images: ${leftCount}/3 (exactly 3 required)`);
  }
  if (rightCount !== 3) {
    errors.push(`Right side images: ${rightCount}/3 (exactly 3 required)`);
  }
  if (fullBodyLeftCount !== 1) {
    errors.push(`Full body left image: ${fullBodyLeftCount}/1 (exactly 1 required)`);
  }
  if (fullBodyRightCount !== 1) {
    errors.push(`Full body right image: ${fullBodyRightCount}/1 (exactly 1 required)`);
  }

  const totalImages = muzzleCount + faceCount + leftCount + rightCount + fullBodyLeftCount + fullBodyRightCount;

  if (totalImages !== 14) {
    errors.push(`Total images: ${totalImages}/14 (exactly 14 required)`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Invalid image count',
      errors: errors
    };
  }

  return { valid: true, message: 'All images validated successfully' };
};

module.exports = {
  uploadProfile,
  uploadCattle,
  uploadCattleImages,
  uploadSingleProfile,
  cattleImageFields,
  deleteUploadedFiles,
  validateCattleImages,
  ensureDirectoryExists
};