const fs = require('fs');
const path = require('path');

/**
 * Image Helper Utility
 * Handles image operations and validations
 */

/**
 * Delete a single image file
 * @param {string} filePath - Path to the image file
 */
const deleteImage = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Image deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting image: ${error.message}`);
    return false;
  }
};

/**
 * Delete multiple image files
 * @param {Array} filePaths - Array of file paths
 */
const deleteMultipleImages = (filePaths) => {
  if (!Array.isArray(filePaths)) {
    return false;
  }

  let deletedCount = 0;
  filePaths.forEach(filePath => {
    if (deleteImage(filePath)) {
      deletedCount++;
    }
  });

  console.log(`✅ Deleted ${deletedCount}/${filePaths.length} images`);
  return deletedCount;
};

/**
 * Delete all images from cattle image object
 * @param {Object} images - Cattle images object with categories
 */
const deleteCattleImages = (images) => {
  if (!images) return 0;

  let deletedCount = 0;
  const categories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];

  categories.forEach(category => {
    if (images[category] && Array.isArray(images[category])) {
      images[category].forEach(image => {
        if (image && image.path) {
          if (deleteImage(image.path)) {
            deletedCount++;
          }
        }
      });
    }
  });

  return deletedCount;
};

/**
 * Get image URL for client access
 * @param {string} filePath - Server file path
 * @returns {string} - URL path for client
 */
const getImageURL = (filePath) => {
  if (!filePath) return null;
  
  // Convert absolute path to relative URL
  // Example: /uploads/cattle/muzzle/image.jpg
  const uploadsIndex = filePath.indexOf('uploads');
  if (uploadsIndex !== -1) {
    return `/${filePath.substring(uploadsIndex).replace(/\\/g, '/')}`;
  }
  
  return filePath;
};

/**
 * Format cattle images for response
 * @param {Object} images - Cattle images object
 * @returns {Object} - Formatted images with URLs
 */
const formatCattleImages = (images) => {
  if (!images) return null;

  const formatted = {};
  const categories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];

  categories.forEach(category => {
    if (images[category] && Array.isArray(images[category])) {
      formatted[category] = images[category].map(image => ({
        filename: image.filename,
        url: getImageURL(image.path),
        uploadedAt: image.uploadedAt,
        size: image.size,
        mimetype: image.mimetype
      }));
    }
  });

  return formatted;
};

/**
 * Validate image file type
 * @param {string} mimetype - File mimetype
 * @returns {boolean} - True if valid
 */
const isValidImageType = (mimetype) => {
  const allowedTypes = process.env.ALLOWED_IMAGE_TYPES 
    ? process.env.ALLOWED_IMAGE_TYPES.split(',')
    : ['image/jpeg', 'image/jpg', 'image/png'];

  return allowedTypes.includes(mimetype);
};

/**
 * Validate image file size
 * @param {number} size - File size in bytes
 * @returns {boolean} - True if valid
 */
const isValidImageSize = (size) => {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
  return size <= maxSize;
};

/**
 * Get file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Directory created: ${dirPath}`);
  }
};

/**
 * Move file from one location to another
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 */
const moveFile = (sourcePath, destPath) => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    ensureDirectoryExists(destDir);

    // Move file
    fs.renameSync(sourcePath, destPath);
    console.log(`✅ File moved from ${sourcePath} to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error moving file: ${error.message}`);
    return false;
  }
};

/**
 * Copy file from one location to another
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 */
const copyFile = (sourcePath, destPath) => {
  try {
    const destDir = path.dirname(destPath);
    ensureDirectoryExists(destDir);

    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ File copied from ${sourcePath} to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error copying file: ${error.message}`);
    return false;
  }
};

module.exports = {
  deleteImage,
  deleteMultipleImages,
  deleteCattleImages,
  getImageURL,
  formatCattleImages,
  isValidImageType,
  isValidImageSize,
  formatFileSize,
  fileExists,
  ensureDirectoryExists,
  moveFile,
  copyFile
};