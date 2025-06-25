const winston = require('winston');
const path = require('path');

/**
 * Enhanced Logger Configuration
 * Provides structured logging with performance monitoring and audit trails
 */

// Custom log format with request tracing
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    // Add performance data if available
    if (global.performance && global.performance.now) {
      logEntry.uptime = process.uptime();
      logEntry.memory = process.memoryUsage();
    }
    
    return JSON.stringify(logEntry);
  })
);

// Custom log format for console (development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
    let logString = `${timestamp} [${level}]: ${message}`;
    
    // Add request context if available
    if (requestId) logString += ` [RequestID: ${requestId}]`;
    if (userId) logString += ` [UserID: ${userId}]`;
    
    // Add metadata
    if (Object.keys(meta).length > 0) {
      logString += ` ${JSON.stringify(meta)}`;
    }
    
    return logString;
  })
);

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'payslip-system',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: []
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// File transports for production
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE_PATH) {
  const logDir = path.dirname(process.env.LOG_FILE_PATH || './logs/app.log');
  
  // Ensure log directory exists
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Application logs
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE_PATH || './logs/app.log',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));
  
  // Error logs
  logger.add(new winston.transports.File({
    filename: './logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));
  
  // Audit logs
  logger.add(new winston.transports.File({
    filename: './logs/audit.log',
    level: 'info',
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

/**
 * Enhanced logging methods with request context
 */

/**
 * Log audit events
 * @param {string} action - Action performed
 * @param {Object} context - Request context
 * @param {Object} data - Additional data
 */
logger.audit = (action, context = {}, data = {}) => {
  logger.info('AUDIT', {
    action,
    userId: context.userId,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Log performance metrics
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} context - Request context
 * @param {Object} metadata - Additional metadata
 */
logger.performance = (operation, duration, context = {}, metadata = {}) => {
  const logData = {
    operation,
    duration: `${duration.toFixed(2)}ms`,
    requestId: context.requestId,
    userId: context.userId,
    ...metadata
  };
  
  if (duration > 1000) {
    logger.warn('SLOW_OPERATION', logData);
  } else {
    logger.debug('PERFORMANCE', logData);
  }
};

/**
 * Log database operations
 * @param {string} query - SQL query (sanitized)
 * @param {number} duration - Duration in milliseconds
 * @param {number} rowCount - Number of rows affected
 * @param {Object} context - Request context
 */
logger.database = (query, duration, rowCount, context = {}) => {
  const logData = {
    operation: 'DATABASE_QUERY',
    query: query.replace(/\$\d+/g, '?'), // Sanitize parameters
    duration: `${duration.toFixed(2)}ms`,
    rowCount,
    requestId: context.requestId,
    userId: context.userId
  };
  
  if (duration > (parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 1000)) {
    logger.warn('SLOW_QUERY', logData);
  } else {
    logger.debug('DATABASE', logData);
  }
};

/**
 * Log API requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in milliseconds
 */
logger.request = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration.toFixed(2)}ms`,
    requestId: req.id,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: res.get('Content-Length')
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP_REQUEST_ERROR', logData);
  } else if (duration > 1000) {
    logger.warn('SLOW_REQUEST', logData);
  } else {
    logger.info('HTTP_REQUEST', logData);
  }
};

/**
 * Log authentication events
 * @param {string} event - Authentication event type
 * @param {Object} context - Request context
 * @param {Object} data - Additional data
 */
logger.auth = (event, context = {}, data = {}) => {
  logger.info('AUTH', {
    event,
    userId: context.userId,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Log business events (payroll processing, etc.)
 * @param {string} event - Business event type
 * @param {Object} context - Request context
 * @param {Object} data - Additional data
 */
logger.business = (event, context = {}, data = {}) => {
  logger.info('BUSINESS', {
    event,
    userId: context.userId,
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Create child logger with persistent context
 * @param {Object} context - Context to be included in all logs
 * @returns {Object} Child logger
 */
logger.child = (context) => {
  return {
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    audit: (action, data = {}) => logger.audit(action, context, data),
    performance: (operation, duration, metadata = {}) => 
      logger.performance(operation, duration, context, metadata),
    business: (event, data = {}) => logger.business(event, context, data)
  };
};

/**
 * Graceful shutdown handler
 */
logger.close = () => {
  return new Promise((resolve) => {
    logger.end(() => {
      resolve();
    });
  });
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({ filename: './logs/exceptions.log' })
  );
  
  logger.rejections.handle(
    new winston.transports.File({ filename: './logs/rejections.log' })
  );
}

module.exports = logger; 