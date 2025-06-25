const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Authentication and Authorization Middleware
 * Handles JWT token verification and role-based access control
 */

/**
 * JWT token verification middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.auth('TOKEN_MISSING', {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: 'Access token is required'
        },
        request_id: req.id
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user information to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      email: decoded.email
    };

    // Add token info for potential refresh
    req.tokenInfo = {
      iat: decoded.iat,
      exp: decoded.exp,
      jti: decoded.jti // JWT ID for token blacklisting if needed
    };

    logger.auth('TOKEN_VERIFIED', {
      requestId: req.id,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      ipAddress: req.ip
    });

    next();
  } catch (error) {
    let errorCode = 'TOKEN_INVALID';
    let message = 'Invalid or expired token';

    if (error.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      message = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      errorCode = 'TOKEN_MALFORMED';
      message = 'Malformed token';
    }

    logger.auth('TOKEN_VERIFICATION_FAILED', {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message
    });

    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message
      },
      request_id: req.id
    });
  }
};

/**
 * Role-based authorization middleware factory
 * @param {Array|string} allowedRoles - Roles that can access the endpoint
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      logger.auth('AUTHORIZATION_NO_USER', {
        requestId: req.id,
        ipAddress: req.ip
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        },
        request_id: req.id
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.auth('AUTHORIZATION_INSUFFICIENT_ROLE', {
        requestId: req.id,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to access this resource'
        },
        request_id: req.id
      });
    }

    logger.auth('AUTHORIZATION_SUCCESS', {
      requestId: req.id,
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: roles
    });

    next();
  };
};

/**
 * Resource ownership middleware
 * Ensures users can only access their own resources (unless admin)
 * @param {string} paramName - Name of the parameter containing the user ID
 * @returns {Function} Express middleware function
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        },
        request_id: req.id
      });
    }

    // Admins can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Get the resource user ID from params, body, or query
    const resourceUserId = req.params[paramName] || 
                          req.body[paramName] || 
                          req.query[paramName];

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: `${paramName} is required`
        },
        request_id: req.id
      });
    }

    // Check if user owns the resource
    if (req.user.id !== resourceUserId) {
      logger.auth('OWNERSHIP_VIOLATION', {
        requestId: req.id,
        userId: req.user.id,
        resourceUserId,
        paramName,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'You can only access your own resources'
        },
        request_id: req.id
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        email: decoded.email
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed', {
      requestId: req.id,
      error: error.message
    });
  }

  next();
};

/**
 * Password hashing utility
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Password verification utility
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} Whether passwords match
 */
const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = null) => {
  const tokenPayload = {
    userId: payload.id,
    username: payload.username,
    role: payload.role,
    email: payload.email,
    jti: crypto.randomUUID() // Unique token ID
  };

  const options = {};
  if (expiresIn || process.env.JWT_EXPIRES_IN) {
    options.expiresIn = expiresIn || process.env.JWT_EXPIRES_IN;
  }

  return jwt.sign(tokenPayload, process.env.JWT_SECRET, options);
};

/**
 * Decode JWT token without verification (for expired token data)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token data
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Middleware to add user context to logger
 */
const addUserContext = (req, res, next) => {
  if (req.user) {
    req.logger = logger.child({
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      requestId: req.id
    });
  } else {
    req.logger = logger.child({
      requestId: req.id
    });
  }
  next();
};

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.auth('AUTH_RATE_LIMIT_EXCEEDED', {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_AUTH_ATTEMPTS',
        message: 'Too many authentication attempts, please try again later'
      },
      request_id: req.id
    });
  }
});

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership,
  optionalAuth,
  addUserContext,
  authRateLimit,
  
  // Utilities
  hashPassword,
  verifyPassword,
  generateToken,
  decodeToken,
  
  // Common role combinations
  requireAdmin: requireRole('admin'),
  requireEmployee: requireRole(['admin', 'employee']),
  requireAdminOrOwnership: (paramName) => [
    authenticateToken,
    (req, res, next) => {
      if (req.user.role === 'admin') {
        return next();
      }
      return requireOwnership(paramName)(req, res, next);
    }
  ]
}; 