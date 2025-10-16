const { createTransporter, emailTemplates } = require('../config/email');

/**
 * Email Service - Handles sending emails
 * Uses templates from email config
 */

class EmailService {
  constructor() {
    this.transporter = createTransporter();
  }

  /**
   * Send email with provided options
   * @param {Object} options - Email options (to, subject, html, text)
   */
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || ''
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(to, name, verificationLink) {
    const template = emailTemplates.emailVerification(name, verificationLink);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }

  /**
   * Send OTP email
   */
  async sendOTP(to, name, otp) {
    const template = emailTemplates.otpEmail(name, otp);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(to, name, resetLink) {
    const template = emailTemplates.passwordReset(name, resetLink);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }

  /**
   * Send cattle approval notification
   */
  async sendCattleApproved(to, name, cattleId) {
    const template = emailTemplates.cattleApproved(name, cattleId);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }

  /**
   * Send cattle rejection notification
   */
  async sendCattleRejected(to, name, cattleId, reason) {
    const template = emailTemplates.cattleRejected(name, cattleId, reason);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }

  /**
   * Send admin account approval notification
   */
  async sendAdminApproved(to, name, role) {
    const template = emailTemplates.adminApproved(name, role);
    return await this.sendEmail({
      to,
      subject: template.subject,
      html: template.html
    });
  }
}

module.exports = new EmailService();