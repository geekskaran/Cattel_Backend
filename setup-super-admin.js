// ============================================================
// SUPER ADMIN SETUP SCRIPT
// File: setup-super-admin.js (Create in root directory)
// Run: node setup-super-admin.js
// ============================================================

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cattle_identification_db';

// Admin Schema (inline for this script)
const adminSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['super_admin', 'regional_admin', 'm_admin'],
    required: true
  },
  region: { type: String },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  permissions: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

async function setupSuperAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ email: 'superadmin@cattleid.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Super Admin already exists!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Name:', existingAdmin.firstName, existingAdmin.lastName);
      console.log('\n🔑 Use these credentials to login:');
      console.log('Email: superadmin@cattleid.com');
      console.log('Password: Admin@123');
      process.exit(0);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    // Create Super Admin
    console.log('👤 Creating Super Admin...');
    const superAdmin = await Admin.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@cattleid.com',
      phoneNumber: '9999999999',
      password: hashedPassword,
      role: 'super_admin',
      region: 'All India',
      isApproved: true,
      isActive: true,
      permissions: [
        'manage_admins',
        'approve_admins',
        'deactivate_admins',
        'view_all_data',
        'manage_users',
        'manage_cattle',
        'generate_reports',
        'delete_records'
      ]
    });

    console.log('\n✅ Super Admin created successfully!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email: superadmin@cattleid.com');
    console.log('🔑 Password: Admin@123');
    console.log('👤 Role: super_admin');
    console.log('🌍 Region: All India');
    console.log('═══════════════════════════════════════');
    console.log('\n✅ You can now login using these credentials!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupSuperAdmin();