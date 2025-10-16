const fs = require('fs');
const path = require('path');

// Define the project structure
const structure = {
  'src': {
    'config': {},
    'models': {},
    'controllers': {},
    'routes': {},
    'middlewares': {},
    'utils': {},
    'uploads': {
      'profiles': {},
      'cattle': {
        'muzzle': {},
        'face': {},
        'left': {},
        'right': {},
        'fullBodyLeft': {},
        'fullBodyRight': {}
      },
      'temp': {}
    }
  }
};

// Files to create
const files = [
  '.env',
  '.gitignore',
  'src/server.js',
  'src/app.js',
  'src/config/database.js',
  'src/config/multer.js',
  'src/config/email.js',
  'src/models/User.js',
  'src/models/Cattle.js',
  'src/models/Admin.js',
  'src/models/TransferRequest.js',
  'src/models/Notification.js',
  'src/controllers/authController.js',
  'src/controllers/userController.js',
  'src/controllers/cattleController.js',
  'src/controllers/adminController.js',
  'src/controllers/reportController.js',
  'src/routes/authRoutes.js',
  'src/routes/userRoutes.js',
  'src/routes/cattleRoutes.js',
  'src/routes/adminRoutes.js',
  'src/routes/reportRoutes.js',
  'src/middlewares/authMiddleware.js',
  'src/middlewares/roleMiddleware.js',
  'src/middlewares/uploadMiddleware.js',
  'src/middlewares/errorMiddleware.js',
  'src/middlewares/validationMiddleware.js',
  'src/utils/emailService.js',
  'src/utils/smsService.js',
  'src/utils/otpGenerator.js',
  'src/utils/tokenGenerator.js',
  'src/utils/reportGenerator.js',
  'src/utils/imageHelper.js'
];

// Function to create directory structure recursively
function createStructure(basePath, structure) {
  Object.keys(structure).forEach(key => {
    const currentPath = path.join(basePath, key);
    
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath, { recursive: true });
      console.log(`✅ Created directory: ${currentPath}`);
    }
    
    if (Object.keys(structure[key]).length > 0) {
      createStructure(currentPath, structure[key]);
    }
  });
}

// Function to create files
function createFiles(files) {
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    const dir = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create empty file if it doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '');
      console.log(`✅ Created file: ${file}`);
    } else {
      console.log(`⚠️  File already exists: ${file}`);
    }
  });
}

// Main execution
console.log('🚀 Starting project structure setup...\n');

try {
  // Create directory structure
  console.log('📁 Creating directories...');
  createStructure(__dirname, structure);
  
  console.log('\n📄 Creating files...');
  createFiles(files);
  
  console.log('\n✨ Project structure created successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm init -y');
  console.log('2. Run: npm install express mongoose dotenv cors bcryptjs jsonwebtoken express-validator morgan helmet express-rate-limit multer nodemailer moment exceljs');
  console.log('3. Run: npm install --save-dev nodemon');
  console.log('4. Configure your .env file');
  console.log('5. Start coding! 🎉\n');
  
} catch (error) {
  console.error('❌ Error creating project structure:', error.message);
}