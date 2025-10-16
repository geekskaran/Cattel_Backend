/**
 * OTP Generator Utility
 * Generates secure random OTPs
 */

/**
 * Generate numeric OTP
 * @param {number} length - Length of OTP (default from env or 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = null) => {
  const otpLength = length || parseInt(process.env.OTP_LENGTH) || 6;
  
  // Generate random number with specified length
  const min = Math.pow(10, otpLength - 1);
  const max = Math.pow(10, otpLength) - 1;
  const otp = Math.floor(min + Math.random() * (max - min + 1));
  
  return otp.toString();
};

/**
 * Generate alphanumeric OTP
 * @param {number} length - Length of OTP
 * @returns {string} - Generated alphanumeric OTP
 */
const generateAlphanumericOTP = (length = 6) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    otp += characters[randomIndex];
  }
  
  return otp;
};

/**
 * Verify OTP expiry
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {boolean} - True if expired, false otherwise
 */
const isOTPExpired = (expiryTime) => {
  return new Date() > new Date(expiryTime);
};

/**
 * Get OTP expiry time
 * @param {number} minutes - Minutes until expiry (default from env)
 * @returns {Date} - Expiry timestamp
 */
const getOTPExpiryTime = (minutes = null) => {
  const expiryMinutes = minutes || parseInt(process.env.OTP_EXPIRE_MINUTES) || 10;
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
};

module.exports = {
  generateOTP,
  generateAlphanumericOTP,
  isOTPExpired,
  getOTPExpiryTime
};