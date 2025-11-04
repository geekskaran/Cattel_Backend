const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

// ========== Security Middleware ==========
app.use(helmet());

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:19006', 'http://localhost:19000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ========== Body Parser Middleware ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== Logging Middleware ==========
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ========== Static Files ==========
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== Health Check Route ==========
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cattle Identification System API',
    version: process.env.API_VERSION || 'v1',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ========== API Routes ==========
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const cattleRoutes = require('./routes/cattleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const identificationRoutes = require('./routes/identificationRoutes');

const apiVersion = process.env.API_VERSION || 'v1';

// ✅ FIXED: Added parentheses () instead of backticks ``
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/cattle`, cattleRoutes);
app.use(`/api/${apiVersion}/admin`, adminRoutes);
app.use(`/api/${apiVersion}/reports`, reportRoutes);

// ✅ FIXED: Correct mounting for identification routes
// This will handle /api/v1/cattle/identify/*
app.use(`/api/${apiVersion}/cattle`, identificationRoutes);

// ========== Error Handling ==========
app.use(notFound);
app.use(errorHandler);

module.exports = app;