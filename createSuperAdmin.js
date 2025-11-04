// createSuperAdmin.js - FIXED VERSION
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Admin = require('./src/models/Admin');

const createSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 
                     process.env.MONGODB_URI || 
                     process.env.DATABASE_URL ||
                     process.env.DB_URI;

    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in .env file!');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Delete existing super admin
    await Admin.deleteOne({ email: 'karan@gmail.com' });
    console.log('🗑️  Deleted existing super admin');

    console.log('👤 Creating Super Admin...');
    
    // Create with plain password - pre-save hook will hash it
    const superAdmin = new Admin({
      firstName: 'Karan',
      lastName: 'Yadav',
      email: 'karan@gmail.com',
      mobileNumber: '8353937117',
      password: 'Karan@0909',
      role: 'super_admin',
      isApproved: true,
      isActive: true,
      isEmailVerified: true,
      isMobileVerified: true,
      assignedRegion: {
        state: 'All',
        districts: []
      },
      createdBy: 'backend_team'
    });

    await superAdmin.save();

    console.log('\n✅ Super Admin created successfully!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email: karan@gmail.com');
    console.log('🔑 Password: Karan@0909');
    console.log('📱 Mobile: 8353937117');
    console.log('🛡️  Role: super_admin');
    console.log('═══════════════════════════════════════');

    // Test password comparison
    const testAdmin = await Admin.findOne({ email: 'karan@gmail.com' }).select('+password');
    const isMatch = await testAdmin.comparePassword('Karan@0909');
    console.log('\n🧪 Password Test:', isMatch ? '✅ PASS' : '❌ FAIL');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmin();