const authService = require('../services/auth.service');
const { validate } = require('../utils/validation');
const { authSchemas } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

class AuthController {
  /**
   * User login
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl
      };

      const result = await authService.login(username, password, requestContext);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User registration (Admin only)
   * POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const userData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        adminId: req.user?.id // ID of admin creating the user
      };

      const result = await authService.register(userData, requestContext, req.user?.id);

      res.status(201).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: userId
      };

      const result = await authService.changePassword(userId, currentPassword, newPassword, requestContext);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh JWT token
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOKEN_REQUIRED',
            message: 'Token is required for refresh'
          },
          request_id: req.id
        });
      }
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await authService.refreshToken(token, requestContext);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      
      const result = await authService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PUT /api/v1/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: userId
      };

      const result = await authService.updateProfile(userId, updateData, userId, requestContext);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User logout
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      // If no user context, treat as no-op success
      if (!req.user || !req.user.id) {
        return res.status(200).json({
          success: true,
          data: {
            message: 'Logout successful (no active session)'
          },
          request_id: req.id
        });
      }
      
      const userId = req.user.id;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: userId
      };

      const result = await authService.logout(userId, requestContext);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate token (for debugging/testing)
   * GET /api/v1/auth/validate
   */
  async validateToken(req, res, next) {
    try {
      // If we reach here, token is valid (middleware passed)
      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            email: req.user.email
          },
          tokenInfo: req.tokenInfo
        },
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }
}

// Create error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Wrap all methods with error handling
const authController = new AuthController();
const wrappedController = {};

Object.getOwnPropertyNames(AuthController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(authController[method].bind(authController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  login: wrappedController.login,
  register: wrappedController.register,
  changePassword: wrappedController.changePassword,
  refreshToken: wrappedController.refreshToken,
  getProfile: wrappedController.getProfile,
  updateProfile: wrappedController.updateProfile,
  logout: wrappedController.logout,
  validateToken: wrappedController.validateToken,
  
  // Validation middleware for each endpoint
  validateLogin: validate(authSchemas.login, 'body'),
  validateRegister: validate(authSchemas.register, 'body'),
  validateChangePassword: validate(authSchemas.changePassword, 'body'),
  
  // Custom validation for refresh token
  validateRefreshToken: (req, res, next) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid token string is required'
        },
        request_id: req.id
      });
    }
    next();
  }
}; 