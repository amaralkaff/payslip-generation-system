require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const logger = require('./utils/logger');
const { getPoolStats } = require('./config/database');

/**
 * Express Application Setup
 * Implements layered architecture with security, performance, and monitoring
 */

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

/**
 * Security Middleware
 */

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      }
    });
  }
});

// Auth rate limiting (more restrictive)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS) || 10,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use(generalLimiter);
app.use('/api/auth', authLimiter);

/**
 * Performance Middleware
 */

// Compression
app.use(compression());

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || uuidv4();
  req.startTime = performance.now();
  res.set('x-request-id', req.id);
  next();
});

// Request logging with Morgan
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      logger.info('HTTP_ACCESS', { message: message.trim() });
    }
  }
}));

// Performance monitoring middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = performance.now() - req.startTime;
    
    // Log request performance
    logger.request(req, res, duration);
    
    // Log slow requests
    if (duration > 1000) {
      logger.performance('HTTP_REQUEST_SLOW', duration, {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

/**
 * Body Parsing Middleware
 */
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  type: 'application/x-www-form-urlencoded'
}));

/**
 * API Documentation (Development)
 */
if (process.env.API_DOCS_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Payslip Generation System API',
        version: '1.0.0',
        description: 'A comprehensive payslip generation system with employee attendance tracking, overtime management, and reimbursement processing.',
        contact: {
          name: 'API Support',
          email: 'support@payslip-system.com'
        }
      },
      servers: [
        {
          url: `http://${HOST}:${PORT}`,
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    apis: [
      './src/server.js',
      './src/routes/auth.routes.js'
    ]
  };
  
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  // Add a redirect from root to API docs in development
  if (process.env.NODE_ENV === 'development') {
    app.get('/', (req, res) => {
      res.redirect('/api-docs');
    });
  }
  
  logger.info('API documentation available at /api-docs');
}

/**
 * Health Check Endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  try {
    const dbStats = getPoolStats();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      database: {
        status: 'connected',
        pool: dbStats
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * API Routes
 */

// Import route modules
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const overtimeRoutes = require('./routes/overtime.routes');
const reimbursementRoutes = require('./routes/reimbursement.routes');
const payrollRoutes = require('./routes/payroll.routes');

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', attendanceRoutes);
app.use('/api/v1', overtimeRoutes);
app.use('/api/v1', reimbursementRoutes);
app.use('/api/v1', payrollRoutes);

/**
 * Error Handling Middleware
 */

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.id
  });
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    request_id: req.id
  });
});

// Global error handler
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_ERROR';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.message === 'Invalid credentials') {
    statusCode = 401;
    errorCode = 'INVALID_CREDENTIALS';
  } else if (err.message === 'User account is inactive') {
    statusCode = 401;
    errorCode = 'ACCOUNT_INACTIVE';
  } else if (err.message === 'Username already exists') {
    statusCode = 400;
    errorCode = 'USERNAME_EXISTS';
  } else if (err.message === 'Email already exists') {
    statusCode = 400;
    errorCode = 'EMAIL_EXISTS';
  } else if (err.message === 'User not found') {
    statusCode = 404;
    errorCode = 'USER_NOT_FOUND';
  }
  
  // Log error with full context
  logger.error('Request failed', {
    error: message,
    stack: err.stack,
    statusCode,
    errorCode,
    method: req.method,
    url: req.originalUrl,
    requestId: req.id,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't expose internal errors in production
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: process.env.NODE_ENV === 'production' && statusCode === 500 
        ? 'Internal Server Error' 
        : message
    },
    request_id: req.id
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
});

/**
 * Graceful Shutdown
 */
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  const server = app.listen(PORT, HOST);
  
  // Close server
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database pool
      const { closePool } = require('./config/database');
      await closePool();
      
      // Close logger
      await logger.close();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason.toString(),
    promise: promise.toString()
  });
  process.exit(1);
});

/**
 * Start Server
 */
if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    logger.info('Server started', {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      processId: process.pid
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🚀 Payslip Generation System Server Started!

📡 Server: http://${HOST}:${PORT}
🏥 Health: http://${HOST}:${PORT}/health
📚 API Docs: http://${HOST}:${PORT}/api-docs
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🆔 Process ID: ${process.pid}

Ready to accept requests! 🎉
      `);
    }
  });
  
  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
    } else {
      logger.error('Server error', { error: error.message });
    }
    process.exit(1);
  });
}

module.exports = app; 