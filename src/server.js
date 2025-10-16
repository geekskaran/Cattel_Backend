require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/database');
const { verifyEmailConfig } = require('./config/email');

/**
 * Server Initialization
 * Starts the Express server and connects to MongoDB
 */

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Server port
const PORT = process.env.PORT || 8000;

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Verify email configuration (optional, won't stop server if fails)
    await verifyEmailConfig();

    // Start listening
    const server = app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(50));
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Server running on port: ${PORT}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${process.env.API_VERSION || 'v1'}`);
      console.log(`📝 Health Check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50));
      console.log('📚 Available Routes:');
      console.log(`   - Auth:    /api/${process.env.API_VERSION || 'v1'}/auth`);
      console.log(`   - Users:   /api/${process.env.API_VERSION || 'v1'}/users`);
      console.log(`   - Cattle:  /api/${process.env.API_VERSION || 'v1'}/cattle`);
      console.log(`   - Admin:   /api/${process.env.API_VERSION || 'v1'}/admin`);
      console.log(`   - Reports: /api/${process.env.API_VERSION || 'v1'}/reports`);
      console.log('='.repeat(50));
      console.log('✅ Server ready to accept connections');
      console.log('='.repeat(50));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Process terminated!');
      });
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('\n👋 SIGINT RECEIVED. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed. Exiting process...');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Initialize server
startServer();