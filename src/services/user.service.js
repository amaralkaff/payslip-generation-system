const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

/**
 * User Service
 * Business logic for user operations including admin user management
 */
class UserService {
  
  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Service result
   */
  async getUserProfile(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Remove sensitive information
      const { password_hash, ...userProfile } = user;
      
      return {
        success: true,
        data: userProfile
      };
    } catch (error) {
      logger.error('Failed to get user profile', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @param {number} updatedBy - ID of user making the update
   * @returns {Promise<Object>} Service result
   */
  async updateUserProfile(userId, updateData, updatedBy) {
    try {
      // Validate user exists
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Check username uniqueness if being updated
      if (updateData.username) {
        const usernameExists = await userRepository.usernameExists(updateData.username, userId);
        if (usernameExists) {
          const error = new Error('Username already exists');
          error.statusCode = 409;
          error.code = 'USERNAME_EXISTS';
          throw error;
        }
      }

      // Check email uniqueness if being updated
      if (updateData.email) {
        const emailExists = await userRepository.emailExists(updateData.email, userId);
        if (emailExists) {
          const error = new Error('Email already exists');
          error.statusCode = 409;
          error.code = 'EMAIL_EXISTS';
          throw error;
        }
      }

      const updatedUser = await userRepository.update(userId, updateData, updatedBy);
      
      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId,
        updateData,
        error: error.message
      });
      throw error;
    }
  }

  // ===== ADMIN METHODS =====

  /**
   * Get all users with filtering and pagination (Admin only)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Service result
   */
  async getAllUsers(options = {}) {
    try {
      const result = await userRepository.findAll(options);
      
      return {
        success: true,
        data: {
          users: result.users,
          pagination: result.pagination
        }
      };
    } catch (error) {
      logger.error('Failed to get all users (admin)', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user by ID (Admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Service result
   */
  async getUserById(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Remove password hash for security
      const { password_hash, ...safeUser } = user;
      
      return {
        success: true,
        data: safeUser
      };
    } catch (error) {
      logger.error('Failed to get user by ID (admin)', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user (Admin only)
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @param {number} adminId - ID of admin making the update
   * @returns {Promise<Object>} Service result
   */
  async updateUser(userId, updateData, adminId) {
    try {
      // Validate user exists
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Prevent admin from downgrading themselves
      if (userId === adminId && updateData.role && updateData.role !== 'admin') {
        const error = new Error('Cannot change your own admin role');
        error.statusCode = 400;
        error.code = 'CANNOT_CHANGE_OWN_ROLE';
        throw error;
      }

      // Check username uniqueness if being updated
      if (updateData.username) {
        const usernameExists = await userRepository.usernameExists(updateData.username, userId);
        if (usernameExists) {
          const error = new Error('Username already exists');
          error.statusCode = 409;
          error.code = 'USERNAME_EXISTS';
          throw error;
        }
      }

      // Check email uniqueness if being updated
      if (updateData.email) {
        const emailExists = await userRepository.emailExists(updateData.email, userId);
        if (emailExists) {
          const error = new Error('Email already exists');
          error.statusCode = 409;
          error.code = 'EMAIL_EXISTS';
          throw error;
        }
      }

      // Validate salary is positive number
      if (updateData.salary && updateData.salary <= 0) {
        const error = new Error('Salary must be a positive number');
        error.statusCode = 400;
        error.code = 'INVALID_SALARY';
        throw error;
      }

      const updatedUser = await userRepository.update(userId, updateData, adminId);
      
      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      logger.error('Failed to update user (admin)', {
        userId,
        updateData,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deactivate user (Admin only)
   * @param {number} userId - User ID
   * @param {number} adminId - ID of admin making the change
   * @returns {Promise<Object>} Service result
   */
  async deactivateUser(userId, adminId) {
    try {
      // Validate user exists
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Prevent admin from deactivating themselves
      if (userId === adminId) {
        const error = new Error('Cannot deactivate your own account');
        error.statusCode = 400;
        error.code = 'CANNOT_DEACTIVATE_SELF';
        throw error;
      }

      const success = await userRepository.deactivate(userId, adminId);
      
      if (!success) {
        throw new Error('Failed to deactivate user');
      }

      return {
        success: true,
        data: {
          message: 'User deactivated successfully',
          userId
        }
      };
    } catch (error) {
      logger.error('Failed to deactivate user (admin)', {
        userId,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Activate user (Admin only)
   * @param {number} userId - User ID
   * @param {number} adminId - ID of admin making the change
   * @returns {Promise<Object>} Service result
   */
  async activateUser(userId, adminId) {
    try {
      // Validate user exists
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const updatedUser = await userRepository.update(userId, { is_active: true }, adminId);
      
      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      logger.error('Failed to activate user (admin)', {
        userId,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user statistics (Admin only)
   * @returns {Promise<Object>} Service result
   */
  async getUserStatistics() {
    try {
      // Get statistics using the repository's findAll method with different filters
      const [allUsers, employees, admins, activeUsers, inactiveUsers] = await Promise.all([
        userRepository.findAll({ limit: 1 }), // Just for count
        userRepository.findAll({ role: 'employee', limit: 1 }),
        userRepository.findAll({ role: 'admin', limit: 1 }),
        userRepository.findAll({ isActive: true, limit: 1 }),
        userRepository.findAll({ isActive: false, limit: 1 })
      ]);

      return {
        success: true,
        data: {
          total_users: allUsers.pagination.total,
          total_employees: employees.pagination.total,
          total_admins: admins.pagination.total,
          active_users: activeUsers.pagination.total,
          inactive_users: inactiveUsers.pagination.total
        }
      };
    } catch (error) {
      logger.error('Failed to get user statistics (admin)', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new UserService();