const Admin = require('../models/Admin');
const User = require('../models/User');
const Cattle = require('../models/Cattle');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const emailService = require('../utils/emailService');
const { generateTokenPair } = require('../utils/tokenGenerator');

/**
 * Admin Controller - UPDATED WITH M_ADMIN WORKFLOW
 * New Flow:
 * 1. Regional Admin: Reviews cattle → Forward to M_Admin OR Deny
 * 2. M_Admin: Identifies cattle → Approve OR Reject
 * 3. Super Admin: Manages all admins and global access
 */

// ========== ADMIN MANAGEMENT (SUPER ADMIN ONLY) ==========

/**
 * @desc    Create regional admin account
 * @route   POST /api/v1/admin/regional-admin
 * @access  Private (Super Admin only)
 */
const createRegionalAdmin = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        mobileNumber,
        password,
        assignedRegion
    } = req.body;

    // Check if email or mobile already exists
    const adminExists = await Admin.findOne({
        $or: [{ email }, { mobileNumber }]
    });

    if (adminExists) {
        return res.status(400).json({
            success: false,
            message: adminExists.email === email
                ? 'Email already registered'
                : 'Mobile number already registered'
        });
    }

    // Check if region already has a regional admin
    const regionAdmin = await Admin.findOne({
        role: 'regional_admin',
        'assignedRegion.state': assignedRegion.state,
        isActive: true
    });

    if (regionAdmin) {
        return res.status(400).json({
            success: false,
            message: `Region ${assignedRegion.state} already has a regional admin`
        });
    }

    // Validate assigned region
    if (!assignedRegion || !assignedRegion.state) {
        return res.status(400).json({
            success: false,
            message: 'Assigned region with state is required'
        });
    }

    // Create regional admin
    const admin = await Admin.create({
        firstName,
        lastName,
        email,
        mobileNumber,
        password,
        role: 'regional_admin',
        assignedRegion,
        isApproved: true,
        isActive: true,
        approvedBy: req.user._id,
        approvedAt: new Date(),
        createdBy: 'super_admin'
    });

    await emailService.sendAdminApproved(email, `${firstName} ${lastName}`, 'regional_admin');

    res.status(201).json({
        success: true,
        message: 'Regional admin created successfully',
        data: {
            admin: {
                id: admin._id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                role: admin.role,
                assignedRegion: admin.assignedRegion
            }
        }
    });
});

/**
 * @desc    Create M_Admin account (NEW)
 * @route   POST /api/v1/admin/m-admin
 * @access  Private (Super Admin only)
 */
const createMAdmin = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        mobileNumber,
        password,
        assignedRegion
    } = req.body;

    // Check if email or mobile already exists
    const adminExists = await Admin.findOne({
        $or: [{ email }, { mobileNumber }]
    });

    if (adminExists) {
        return res.status(400).json({
            success: false,
            message: adminExists.email === email
                ? 'Email already registered'
                : 'Mobile number already registered'
        });
    }

    // Validate assigned region
    if (!assignedRegion || !assignedRegion.state) {
        return res.status(400).json({
            success: false,
            message: 'Assigned region with state is required for M_Admin'
        });
    }

    // Create M_Admin
    const admin = await Admin.create({
        firstName,
        lastName,
        email,
        mobileNumber,
        password,
        role: 'm_admin',
        assignedRegion,
        isApproved: true,
        isActive: true,
        approvedBy: req.user._id,
        approvedAt: new Date(),
        createdBy: 'super_admin'
    });

    await emailService.sendAdminApproved(email, `${firstName} ${lastName}`, 'm_admin');

    res.status(201).json({
        success: true,
        message: 'M_Admin created successfully',
        data: {
            admin: {
                id: admin._id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                role: admin.role,
                assignedRegion: admin.assignedRegion
            }
        }
    });
});

/**
 * @desc    Get all admins
 * @route   GET /api/v1/admin/admins
 * @access  Private (Super Admin only)
 */
const getAllAdmins = asyncHandler(async (req, res) => {
    const { role, isActive, isApproved, state, page = 1, limit = 20 } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (state) query['assignedRegion.state'] = state;

    const skip = (page - 1) * limit;

    const admins = await Admin.find(query)
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Admin.countDocuments(query);

    res.status(200).json({
        success: true,
        data: {
            admins,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Approve admin account
 * @route   PUT /api/v1/admin/:id/approve
 * @access  Private (Super Admin only)
 */
const approveAdmin = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
        return res.status(404).json({
            success: false,
            message: 'Admin not found'
        });
    }

    if (admin.role === 'super_admin') {
        return res.status(400).json({
            success: false,
            message: 'Super admin does not need approval'
        });
    }

    if (admin.isApproved) {
        return res.status(400).json({
            success: false,
            message: 'Admin is already approved'
        });
    }

    admin.isApproved = true;
    admin.isActive = true;
    admin.approvedBy = req.user._id;
    admin.approvedAt = new Date();
    await admin.save();

    await emailService.sendAdminApproved(admin.email, admin.fullName, admin.role);

    await Notification.create({
        recipient: admin._id,
        recipientModel: 'Admin',
        type: 'admin_approved',
        title: 'Account Approved',
        message: `Your ${admin.role.replace('_', ' ')} account has been approved.`,
        priority: 'high'
    });

    res.status(200).json({
        success: true,
        message: 'Admin approved successfully',
        data: admin
    });
});

/**
 * @desc    Deactivate admin account
 * @route   PUT /api/v1/admin/:id/deactivate
 * @access  Private (Super Admin only)
 */
const deactivateAdmin = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
        return res.status(404).json({
            success: false,
            message: 'Admin not found'
        });
    }

    if (admin.role === 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Cannot deactivate super admin account'
        });
    }

    admin.isActive = false;
    await admin.save();

    await Notification.create({
        recipient: admin._id,
        recipientModel: 'Admin',
        type: 'account_deactivated',
        title: 'Account Deactivated',
        message: 'Your admin account has been deactivated.',
        priority: 'urgent'
    });

    res.status(200).json({
        success: true,
        message: 'Admin account deactivated successfully'
    });
});

// ========== REGIONAL ADMIN: REVIEW & FORWARD/DENY ==========

/**
 * @desc    Get pending cattle for regional admin review
 * @route   GET /api/v1/admin/regional/cattle/pending
 * @access  Private (Regional Admin only)
 */
const getPendingRegionalReview = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, overdue } = req.query;

    let query = {
        status: 'transit',
        'verification.status': 'pending_regional_review'
    };

    // Regional admin can only see their region
    if (req.user.role === 'regional_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    // Filter by overdue
    if (overdue === 'true') {
        query['verification.turnaroundDeadline'] = { $lt: new Date() };
    }

    const skip = (page - 1) * limit;

    const cattle = await Cattle.find(query)
        .populate('owner', 'firstName lastName mobileNumber email address')
        .sort({ 'verification.submittedAt': 1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Cattle.countDocuments(query);

    const cattleWithStatus = cattle.map(c => {
        const cattleObj = c.toObject();
        cattleObj.isOverdue = c.isVerificationOverdue();
        return cattleObj;
    });

    res.status(200).json({
        success: true,
        data: {
            cattle: cattleWithStatus,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Get cattle details for regional admin review
 * @route   GET /api/v1/admin/regional/cattle/:id/review
 * @access  Private (Regional Admin only)
 */
const getCattleForRegionalReview = asyncHandler(async (req, res) => {
    let query = {
        _id: req.params.id,
        'verification.status': 'pending_regional_review'
    };

    // Regional admin can only review cattle from their region
    if (req.user.role === 'regional_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query)
        .populate('owner', 'firstName lastName email mobileNumber address occupation dateOfBirth');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or already reviewed'
        });
    }

    const cattleData = cattle.toObject();
    cattleData.isOverdue = cattle.isVerificationOverdue();

    // Format image URLs
    const baseUrl = '/uploads/cattle';
    const categories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];

    cattleData.formattedImages = {};
    categories.forEach(category => {
        if (cattle.images[category]) {
            cattleData.formattedImages[category] = cattle.images[category].map(img => ({
                filename: img.filename,
                url: `${baseUrl}/${category}/${img.filename}`,
                uploadedAt: img.uploadedAt,
                size: img.size
            }));
        }
    });

    res.status(200).json({
        success: true,
        data: cattleData
    });
});

/**
 * @desc    Forward cattle to M_Admin (NEW)
 * @route   PUT /api/v1/admin/regional/cattle/:id/forward
 * @access  Private (Regional Admin only)
 */
const forwardCattleToMAdmin = asyncHandler(async (req, res) => {
    let query = {
        _id: req.params.id,
        'verification.status': 'pending_regional_review'
    };

    if (req.user.role === 'regional_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query).populate('owner');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or already reviewed'
        });
    }

    // Forward to M_Admin
    await cattle.forwardToMAdmin(req.user._id);

    // Update regional admin statistics
    const regionalAdmin = await Admin.findById(req.user._id);
    regionalAdmin.statistics.forwardedToMAdmin += 1;
    regionalAdmin.statistics.pendingVerifications = Math.max(0, regionalAdmin.statistics.pendingVerifications - 1);
    await regionalAdmin.save();

    // Find M_Admins in the same region
    const mAdmins = await Admin.find({
        role: 'm_admin',
        'assignedRegion.state': cattle.location.state,
        isActive: true,
        isApproved: true
    });

    // Notify M_Admins
    for (const mAdmin of mAdmins) {
        await Notification.create({
            recipient: mAdmin._id,
            recipientModel: 'Admin',
            type: 'cattle_forwarded_to_m_admin',
            title: 'New Cattle for Identification',
            message: `Cattle ${cattle.cattleId} forwarded by Regional Admin for identification and approval.`,
            relatedCattle: cattle._id,
            relatedUser: cattle.owner._id,
            priority: 'high',
            actionUrl: `/m-admin/cattle/${cattle._id}/verify`,
            actionText: 'Identify & Verify'
        });

        // Update M_Admin statistics
        mAdmin.statistics.pendingVerifications += 1;
        await mAdmin.save();
    }

    // Notify owner
    await Notification.create({
        recipient: cattle.owner._id,
        recipientModel: 'User',
        type: 'cattle_forwarded_to_m_admin',
        title: 'Cattle Forwarded for Identification',
        message: `Your cattle ${cattle.cattleId} has been forwarded for identification by the regional admin.`,
        relatedCattle: cattle._id,
        priority: 'medium'
    });

    res.status(200).json({
        success: true,
        message: 'Cattle forwarded to M_Admin successfully',
        data: cattle
    });
});

/**
 * @desc    Deny cattle by regional admin (NEW)
 * @route   PUT /api/v1/admin/regional/cattle/:id/deny
 * @access  Private (Regional Admin only)
 */
const denyCattleByRegionalAdmin = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Denial reason is required'
        });
    }

    let query = {
        _id: req.params.id,
        'verification.status': 'pending_regional_review'
    };

    if (req.user.role === 'regional_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query).populate('owner');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or already reviewed'
        });
    }

    // Deny by regional admin
    await cattle.denyByRegionalAdmin(req.user._id, reason);

    // Update regional admin statistics
    const regionalAdmin = await Admin.findById(req.user._id);
    regionalAdmin.statistics.deniedByRegionalAdmin += 1;
    regionalAdmin.statistics.pendingVerifications = Math.max(0, regionalAdmin.statistics.pendingVerifications - 1);
    await regionalAdmin.save();

    // Notify owner
    await Notification.create({
        recipient: cattle.owner._id,
        recipientModel: 'User',
        type: 'cattle_denied_by_regional',
        title: 'Cattle Registration Denied',
        message: `Your cattle registration (${cattle.cattleId}) was denied by regional admin. Reason: ${reason}`,
        relatedCattle: cattle._id,
        priority: 'high'
    });

    res.status(200).json({
        success: true,
        message: 'Cattle denied successfully',
        data: cattle
    });
});

// ========== M_ADMIN: IDENTIFICATION & APPROVAL/REJECTION ==========

/**
 * @desc    Get pending cattle for M_Admin identification (NEW)
 * @route   GET /api/v1/admin/m-admin/cattle/pending
 * @access  Private (M_Admin only)
 */
const getPendingMAdminVerification = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    let query = {
        status: 'transit',
        'verification.status': 'forwarded_to_m_admin'
    };

    // M_Admin can only see cattle from their region
    if (req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const skip = (page - 1) * limit;

    const cattle = await Cattle.find(query)
        .populate('owner', 'firstName lastName mobileNumber email address')
        .populate('verification.reviewedByRegionalAdmin', 'firstName lastName')
        .sort({ 'verification.forwardedToMAdminAt': 1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Cattle.countDocuments(query);

    res.status(200).json({
        success: true,
        data: {
            cattle,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Get cattle details for M_Admin verification (NEW)
 * @route   GET /api/v1/admin/m-admin/cattle/:id/verify
 * @access  Private (M_Admin only)
 */
const getCattleForMAdminVerification = asyncHandler(async (req, res) => {
    let query = {
        _id: req.params.id,
        'verification.status': 'forwarded_to_m_admin'
    };

    if (req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query)
        .populate('owner', 'firstName lastName email mobileNumber address occupation')
        .populate('verification.reviewedByRegionalAdmin', 'firstName lastName role');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or not ready for M_Admin verification'
        });
    }

    // Format with all image URLs
    const cattleData = cattle.toObject();
    const baseUrl = '/uploads/cattle';
    const categories = ['muzzle', 'face', 'left', 'right', 'fullBodyLeft', 'fullBodyRight'];

    cattleData.formattedImages = {};
    categories.forEach(category => {
        if (cattle.images[category]) {
            cattleData.formattedImages[category] = cattle.images[category].map(img => ({
                filename: img.filename,
                url: `${baseUrl}/${category}/${img.filename}`,
                uploadedAt: img.uploadedAt,
                size: img.size
            }));
        }
    });

    res.status(200).json({
        success: true,
        data: cattleData
    });
});

/**
 * @desc    Approve cattle by M_Admin (NEW - Final Approval)
 * @route   PUT /api/v1/admin/m-admin/cattle/:id/approve
 * @access  Private (M_Admin only)
 */
const approveCattleByMAdmin = asyncHandler(async (req, res) => {
    let query = {
        _id: req.params.id,
        'verification.status': 'forwarded_to_m_admin'
    };

    if (req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query).populate('owner');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or not ready for approval'
        });
    }

    // Approve by M_Admin
    await cattle.approve(req.user._id);

    // Update M_Admin statistics
    const mAdmin = await Admin.findById(req.user._id);
    mAdmin.statistics.pendingVerifications = Math.max(0, mAdmin.statistics.pendingVerifications - 1);
    mAdmin.statistics.totalVerifications += 1;
    mAdmin.statistics.approvedCattle += 1;
    await mAdmin.save();

    // Notify owner
    await Notification.create({
        recipient: cattle.owner._id,
        recipientModel: 'User',
        type: 'cattle_approved',
        title: 'Cattle Registration Approved',
        message: `Your cattle registration (${cattle.cattleId}) has been approved and is now active.`,
        relatedCattle: cattle._id,
        priority: 'high',
        actionUrl: `/cattle/${cattle._id}`,
        actionText: 'View Cattle'
    });

    // Send email
    await emailService.sendCattleApproved(
        cattle.owner.email,
        cattle.owner.fullName,
        cattle.cattleId
    );

    res.status(200).json({
        success: true,
        message: 'Cattle approved successfully',
        data: cattle
    });
});

/**
 * @desc    Reject cattle by M_Admin (NEW - Final Rejection)
 * @route   PUT /api/v1/admin/m-admin/cattle/:id/reject
 * @access  Private (M_Admin only)
 */
const rejectCattleByMAdmin = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required'
        });
    }

    let query = {
        _id: req.params.id,
        'verification.status': 'forwarded_to_m_admin'
    };

    if (req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query).populate('owner');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or not ready for rejection'
        });
    }

    // Reject by M_Admin
    await cattle.reject(req.user._id, reason);

    // Update M_Admin statistics
    const mAdmin = await Admin.findById(req.user._id);
    mAdmin.statistics.pendingVerifications = Math.max(0, mAdmin.statistics.pendingVerifications - 1);
    mAdmin.statistics.totalVerifications += 1;
    mAdmin.statistics.rejectedCattle += 1;
    await mAdmin.save();

    // Notify owner
    await Notification.create({
        recipient: cattle.owner._id,
        recipientModel: 'User',
        type: 'cattle_rejected',
        title: 'Cattle Registration Rejected',
        message: `Your cattle registration (${cattle.cattleId}) has been rejected. Reason: ${reason}`,
        relatedCattle: cattle._id,
        priority: 'high'
    });

    // Send email
    await emailService.sendCattleRejected(
        cattle.owner.email,
        cattle.owner.fullName,
        cattle.cattleId,
        reason
    );

    res.status(200).json({
        success: true,
        message: 'Cattle rejected successfully',
        data: cattle
    });
});

// ========== USER MANAGEMENT (ALL ADMINS) ==========

/**
 * @desc    Get all users (farmers)
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
    const {
        state,
        district,
        isActive,
        isVerified,
        search,
        page = 1,
        limit = 20
    } = req.query;

    let query = {};

    // Regional admin and M_Admin can only see users from their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        query['address.state'] = req.user.assignedRegion.state;
    }

    // Apply filters
    if (state) query['address.state'] = state;
    if (district) query['address.district'] = district;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified === 'true') {
        query.$or = [
            { isEmailVerified: true },
            { isMobileVerified: true }
        ];
    }

    // Search
    if (search) {
        query.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { mobileNumber: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
        .populate('cattle', 'cattleId breed status')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
        success: true,
        data: {
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Get user details by ID
 * @route   GET /api/v1/admin/users/:id
 * @access  Private (Admin only)
 */
const getUserById = asyncHandler(async (req, res) => {
    let query = { _id: req.params.id };

    // Regional and M_Admin can only view users from their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        query['address.state'] = req.user.assignedRegion.state;
    }

    const user = await User.findOne(query)
        .populate({
            path: 'cattle',
            populate: { path: 'verification.verifiedBy', select: 'firstName lastName role' }
        });

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found or you do not have permission to view'
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

/**
 * @desc    Search user by phone number
 * @route   GET /api/v1/admin/users/search/phone/:phoneNumber
 * @access  Private (Admin only)
 */
const searchUserByPhone = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.params;

    let query = { mobileNumber: phoneNumber };

    // Regional and M_Admin can only search in their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        query['address.state'] = req.user.assignedRegion.state;
    }

    const user = await User.findOne(query)
        .populate('cattle', 'cattleId breed age status verification');

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found in your accessible region'
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

// ========== ADMIN DASHBOARD & STATISTICS ==========

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/v1/admin/dashboard
 * @access  Private (Admin only)
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
    let cattleQuery = {};
    let userQuery = {};

    // Regional and M_Admin see only their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        cattleQuery['location.state'] = req.user.assignedRegion.state;
        userQuery['address.state'] = req.user.assignedRegion.state;
    }

    // Total counts
    const totalUsers = await User.countDocuments(userQuery);
    const totalCattle = await Cattle.countDocuments(cattleQuery);

    // Cattle by status
    const cattleByStatus = await Cattle.aggregate([
        { $match: cattleQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Cattle by verification status
    const cattleByVerification = await Cattle.aggregate([
        { $match: cattleQuery },
        { $group: { _id: '$verification.status', count: { $sum: 1 } } }
    ]);

    // Role-specific statistics
    let roleSpecificStats = {};

    if (req.user.role === 'regional_admin') {
        roleSpecificStats.pendingReview = await Cattle.countDocuments({
            ...cattleQuery,
            'verification.status': 'pending_regional_review'
        });
        roleSpecificStats.forwarded = req.user.statistics.forwardedToMAdmin;
        roleSpecificStats.denied = req.user.statistics.deniedByRegionalAdmin;
    }
    if (req.user.role === 'm_admin') {
        roleSpecificStats.pendingIdentification = await Cattle.countDocuments({
            ...cattleQuery,
            'verification.status': 'forwarded_to_m_admin'
        });
        roleSpecificStats.approved = req.user.statistics.approvedCattle;
        roleSpecificStats.rejected = req.user.statistics.rejectedCattle;
    }

    // Overdue verifications
    const overdueVerifications = await Cattle.countDocuments({
        ...cattleQuery,
        status: 'transit',
        'verification.status': 'pending_regional_review',
        'verification.turnaroundDeadline': { $lt: new Date() }
    });

    // District-wise breakdown
    const districtBreakdown = await Cattle.aggregate([
        { $match: cattleQuery },
        {
            $group: {
                _id: '$location.district',
                totalCattle: { $sum: 1 },
                activeCattle: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                pendingVerification: {
                    $sum: { $cond: [{ $eq: ['$verification.status', 'pending_regional_review'] }, 1, 0] }
                }
            }
        },
        { $sort: { totalCattle: -1 } }
    ]);

    // Users by district
    const usersByDistrict = await User.aggregate([
        { $match: userQuery },
        {
            $group: {
                _id: '$address.district',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const statistics = {
        overview: {
            totalUsers,
            totalCattle,
            overdueVerifications
        },
        cattle: {
            byStatus: {},
            byVerification: {}
        },
        roleSpecific: roleSpecificStats,
        breakdown: {
            byDistrict: districtBreakdown,
            usersByDistrict
        }
    };

    cattleByStatus.forEach(item => {
        statistics.cattle.byStatus[item._id] = item.count;
    });

    cattleByVerification.forEach(item => {
        statistics.cattle.byVerification[item._id] = item.count;
    });

    res.status(200).json({
        success: true,
        data: statistics
    });
});

// ========== NOTIFICATIONS ==========

/**
 * @desc    Get admin notifications
 * @route   GET /api/v1/admin/notifications
 * @access  Private (Admin only)
 */
const getAdminNotifications = asyncHandler(async (req, res) => {
    const { isRead, page = 1, limit = 20 } = req.query;

    const query = {
        recipient: req.user._id,
        recipientModel: 'Admin'
    };

    if (isRead !== undefined) {
        query.isRead = isRead === 'true';
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(query)
        .populate('relatedCattle', 'cattleId breed')
        .populate('relatedUser', 'firstName lastName mobileNumber')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(req.user._id, 'Admin');

    res.status(200).json({
        success: true,
        data: {
            notifications,
            unreadCount,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/admin/notifications/:id/read
 * @access  Private (Admin only)
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
        _id: req.params.id,
        recipient: req.user._id,
        recipientModel: 'Admin'
    });

    if (!notification) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found'
        });
    }

    await notification.markAsRead();

    res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
    });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/admin/notifications/read-all
 * @access  Private (Admin only)
 */
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const count = await Notification.markAllAsRead(req.user._id, 'Admin');

    res.status(200).json({
        success: true,
        message: `${count} notifications marked as read`
    });
});

// ========== CATTLE VIEW (ALL ADMINS) ==========

/**
 * @desc    Get all cattle (Admin view)
 * @route   GET /api/v1/admin/cattle
 * @access  Private (Admin only)
 */
const getAllCattle = asyncHandler(async (req, res) => {
    const {
        status,
        verificationStatus,
        breed,
        state,
        district,
        search,
        page = 1,
        limit = 20
    } = req.query;

    let query = {};

    // Regional and M_Admin can only see cattle from their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    // Apply filters
    if (status) query.status = status;
    if (verificationStatus) query['verification.status'] = verificationStatus;
    if (breed) query.breed = { $regex: breed, $options: 'i' };
    if (state) query['location.state'] = state;
    if (district) query['location.district'] = district;

    // Search
    if (search) {
        query.$or = [
            { cattleId: { $regex: search, $options: 'i' } },
            { tagNo: { $regex: search, $options: 'i' } },
            { breed: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;

    const cattle = await Cattle.find(query)
        .populate('owner', 'firstName lastName mobileNumber address')
        .populate('verification.verifiedBy', 'firstName lastName role')
        .populate('verification.reviewedByRegionalAdmin', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Cattle.countDocuments(query);

    res.status(200).json({
        success: true,
        data: {
            cattle,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Get single cattle by ID (Admin view)
 * @route   GET /api/v1/admin/cattle/:id
 * @access  Private (Admin only)
 */
const getCattleById = asyncHandler(async (req, res) => {
    let query = { _id: req.params.id };

    // Regional and M_Admin can only view cattle from their region
    if (req.user.role === 'regional_admin' || req.user.role === 'm_admin') {
        query['location.state'] = req.user.assignedRegion.state;
    }

    const cattle = await Cattle.findOne(query)
        .populate('owner', 'firstName lastName email mobileNumber address')
        .populate('verification.verifiedBy', 'firstName lastName role')
        .populate('verification.reviewedByRegionalAdmin', 'firstName lastName role')
        .populate('transferHistory');

    if (!cattle) {
        return res.status(404).json({
            success: false,
            message: 'Cattle not found or you do not have permission to view'
        });
    }

    res.status(200).json({
        success: true,
        data: cattle
    });
});

module.exports = {
    // Admin Management (Super Admin only)
    createRegionalAdmin,
    createMAdmin, // NEW
    getAllAdmins,
    approveAdmin,
    deactivateAdmin,

    // Regional Admin Operations (NEW WORKFLOW)
    getPendingRegionalReview,
    getCattleForRegionalReview,
    forwardCattleToMAdmin,
    denyCattleByRegionalAdmin,

    // M_Admin Operations (NEW WORKFLOW)
    getPendingMAdminVerification,
    getCattleForMAdminVerification,
    approveCattleByMAdmin,
    rejectCattleByMAdmin,

    // User Management
    getAllUsers,
    getUserById,
    searchUserByPhone,

    // Dashboard & Statistics
    getAdminDashboard,

    // Notifications
    getAdminNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,

    // Cattle View
    getAllCattle,
    getCattleById
};