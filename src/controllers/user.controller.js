const userService = require('../services/user.service');
const logger = require('../utils/logger');

/**
 * User Controller
 * Handles HTTP requests for user operations including admin user management
 */
class UserController {

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await userService.getUserProfile(userId);

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
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      // Users can only update certain fields of their own profile
      const allowedFields = ['full_name', 'email'];
      const filteredUpdateData = {};
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_VALID_FIELDS',
            message: 'No valid fields provided for update'
          },
          request_id: req.id
        });
      }

      const result = await userService.updateUserProfile(userId, filteredUpdateData, userId);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== ADMIN METHODS =====

  /**
   * Get all users (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAllUsers(req, res, next) {
    try {
      const { page, limit, role, search, isActive, sortBy, sortOrder } = req.query;
      
      const options = {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        role: role || null,
        search: search || null,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'desc'
      };

      // Parse boolean query parameters
      if (isActive !== undefined) {
        options.isActive = isActive === 'true';
      }

      const result = await userService.getAllUsers(options);

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
   * Get user by ID (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await userService.getUserById(parseInt(id));

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
   * Update user (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const adminId = req.user.id;

      // Admin can update more fields than regular users
      const allowedFields = ['username', 'full_name', 'email', 'role', 'salary', 'is_active'];
      const filteredUpdateData = {};
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_VALID_FIELDS',
            message: 'No valid fields provided for update'
          },
          request_id: req.id
        });
      }

      const result = await userService.updateUser(parseInt(id), filteredUpdateData, adminId);

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
   * Deactivate user (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async deactivateUser(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      
      const result = await userService.deactivateUser(parseInt(id), adminId);

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
   * Activate user (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async activateUser(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      
      const result = await userService.activateUser(parseInt(id), adminId);

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
   * Get user statistics (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getUserStatistics(req, res, next) {
    try {
      const result = await userService.getUserStatistics();

      res.status(200).json({
        success: true,
        data: result.data,
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
const userController = new UserController();
const wrappedController = {};

Object.getOwnPropertyNames(UserController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(userController[method].bind(userController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  // Profile methods
  getProfile: wrappedController.getProfile,
  updateProfile: wrappedController.updateProfile,
  
  // Admin methods
  getAllUsers: wrappedController.getAllUsers,
  getUserById: wrappedController.getUserById,
  updateUser: wrappedController.updateUser,
  deactivateUser: wrappedController.deactivateUser,
  activateUser: wrappedController.activateUser,
  getUserStatistics: wrappedController.getUserStatistics
};