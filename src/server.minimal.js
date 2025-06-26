/**
 * Minimal Payslip Generation System Server
 * Contains only the 8 core endpoints required by README
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

// Import utilities
const logger = require('./utils/logger');
const { AppError } = require('./utils/errors');

// Import minimal routes (only core functionality)
const authRoutes = require('./routes/auth.routes.minimal');
const attendanceRoutes = require('./routes/attendance.routes.minimal');
const overtimeRoutes = require('./routes/overtime.routes.minimal');
const reimbursementRoutes = require('./routes/reimbursement.routes.minimal');
const payrollRoutes = require('./routes/payroll.routes.minimal');

const app = express();

/**
 * Security Middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
}));

/**
 * Request Processing Middleware
 */
app.use(compression());

// Request ID for tracing
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || uuidv4();
  req.startTime = performance.now();
  res.set('x-request-id', req.id);
  next();
});

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      logger.info('HTTP_ACCESS', { message: message.trim() });
    }
  }
}));

// Body parsing
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

/**
 * API Documentation (Swagger)
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Minimal Payslip Generation System API',
      version: '1.0.0',
      description: 'A minimal payslip generation system with only the 8 core endpoints required by README specifications.',
      contact: {
        name: 'API Support',
        email: 'support@payslip-system.com'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from login endpoint'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            },
            request_id: {
              type: 'string'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            },
            request_id: {
              type: 'string'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Admin',
        description: 'Administrative functions (requires admin role)'
      },
      {
        name: 'Employee', 
        description: 'Employee functions (requires employee role)'
      },
      {
        name: 'System',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: [
    './src/server.minimal.js',
    './src/routes/auth.routes.minimal.js',
    './src/routes/attendance.routes.minimal.js',
    './src/routes/overtime.routes.minimal.js',
    './src/routes/reimbursement.routes.minimal.js',
    './src/routes/payroll.routes.minimal.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Minimal Payslip System API',
  customfavIcon: '/favicon.ico',
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #3b82f6; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true
  }
}));

// Add a redirect from root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

logger.info('📚 API documentation available at /api-docs');

/**
 * Health Check
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                 request_id:
 *                   type: string
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    },
    request_id: req.id
  });
});

/**
 * Core API Routes - Only Required Endpoints
 */
app.use('/api/v1/auth', authRoutes);           // Login only
app.use('/api/v1', attendanceRoutes);          // Admin: create period, Employee: submit attendance  
app.use('/api/v1', overtimeRoutes);            // Employee: submit overtime
app.use('/api/v1', reimbursementRoutes);       // Employee: submit reimbursements
app.use('/api/v1', payrollRoutes);             // Admin: process payroll & summary, Employee: generate payslip

/**
 * Error Handling
 */

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method}:${req.originalUrl} not found`
    },
    request_id: req.id
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    requestId: req.id,
    userId: req.user?.id
  });

  if (err && err.name === 'AppError') {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message
      },
      request_id: req.id
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : err.message
    },
    request_id: req.id
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Minimal Payslip System server running on port ${PORT}`);
  logger.info(`📋 Available endpoints:`);
  logger.info(`   POST /api/v1/auth/login - User login`);
  logger.info(`   POST /api/v1/admin/attendance-periods - Create attendance period`);
  logger.info(`   POST /api/v1/employee/attendance - Submit attendance`);
  logger.info(`   POST /api/v1/employee/overtime - Submit overtime`);
  logger.info(`   POST /api/v1/employee/reimbursements - Submit reimbursements`);
  logger.info(`   POST /api/v1/admin/payroll/process - Process payroll`);
  logger.info(`   GET /api/v1/employee/payslip/:periodId - Generate payslip`);
  logger.info(`   GET /api/v1/admin/payroll/summary/:payrollId - Payroll summary`);
});

module.exports = app;