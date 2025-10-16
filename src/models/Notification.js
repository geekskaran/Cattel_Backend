const mongoose = require('mongoose');

/**
 * Notification Schema - Handles in-app notifications
 * As per document point 7: Regional and Super admins get notifications
 * when cattle is registered or verification status changes
 */
const notificationSchema = new mongoose.Schema({
  // Recipient of the notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['User', 'Admin']
  },

  // Notification type
  type: {
    type: String,
    required: true,
    enum: [
      'cattle_registered',           // New cattle submitted for verification
      'cattle_approved',             // Cattle approved by admin
      'cattle_rejected',             // Cattle rejected by admin
      'verification_reminder',       // Reminder for pending verification (approaching 48hr deadline)
      'verification_overdue',        // Verification deadline exceeded
      'transfer_request_received',   // New transfer request received
      'transfer_request_accepted',   // Transfer request accepted
      'transfer_request_rejected',   // Transfer request rejected
      'transfer_request_cancelled',  // Transfer request cancelled
      'admin_approved',              // Regional admin account approved
      'admin_rejected',              // Regional admin account rejected
      'account_activated',           // Account activated
      'account_deactivated'          // Account deactivated
    ]
  },

  // Notification title and message
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },

  // Related entities
  relatedCattle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  relatedTransfer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransferRequest'
  },

  // Notification status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Action button/link (for navigation in mobile app)
  actionUrl: {
    type: String,
    trim: true
  },
  actionText: {
    type: String,
    trim: true
  },

  // Metadata for additional information
  metadata: {
    type: mongoose.Schema.Mixed,
    default: {}
  },

  // Expiry (auto-delete old notifications)
  expiresAt: {
    type: Date,
    default: function() {
      // Notifications expire after 90 days
      return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    }
  }

}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, recipientModel: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = await this.create(data);
  return notification;
};

// Static method to get unread count for a user/admin
notificationSchema.statics.getUnreadCount = async function(recipientId, recipientModel) {
  return await this.countDocuments({
    recipient: recipientId,
    recipientModel: recipientModel,
    isRead: false
  });
};

// Static method to mark all as read for a user/admin
notificationSchema.statics.markAllAsRead = async function(recipientId, recipientModel) {
  const result = await this.updateMany(
    {
      recipient: recipientId,
      recipientModel: recipientModel,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
  return result.modifiedCount;
};

// Static method to delete old read notifications
notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

module.exports = mongoose.model('Notification', notificationSchema);