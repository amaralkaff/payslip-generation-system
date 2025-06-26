const userRepository = require('../repositories/user.repository');
const { hashPassword, verifyPassword, generateToken, decodeToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Authentication Service
 * Business logic for user authentication and authorization
 */

const AppError = require('../utils/errors');

class AuthService {
  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} Authentication result with token and user data
   */
  async login(username, password, requestContext = {}) {
    try {
      // Input validation
      if (!username || !password) {
        throw new AppError('Username and password are required', 400, 'VALIDATION_ERROR');
      }

      if (username.length < 3 || username.length > 50) {
        throw new AppError('Username must be 3-50 characters', 400, 'VALIDATION_ERROR');
      }

      if (password.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400, 'VALIDATION_ERROR');
      }

      // Find user
      const user = await userRepository.findByUsername(username);
      if (!user) {
        // Use same timing as successful validation to prevent timing attacks
        await hashPassword(password);
        
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('User account is inactive', 401, 'ACCOUNT_INACTIVE');
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Generate JWT token
      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      };

      const token = generateToken(tokenPayload);

      // Remove password hash from response
      const { password_hash, ...userResponse } = user;

      logger.auth('LOGIN_SUCCESS', requestContext, {
        userId: user.id,
        username: user.username,
        role: user.role
      });

      return {
        success: true,
        data: {
          token,
          user: userResponse,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.auth('LOGIN_ERROR', requestContext, {
        username,
        error: error.message
      });
      
      throw new AppError('Login failed', 500, 'INTERNAL_ERROR');
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {Object} requestContext - Request context for logging
   * @param {number} createdBy - ID of admin creating the user (optional)
   * @returns {Promise<Object>} Registration result
   */
  async register(userData, requestContext = {}, createdBy = null) {
    try {
      const { username, password, email, full_name, role = 'employee', salary = 0 } = userData;

      // Validate required fields
      if (!username || !password || !email || !full_name) {
        throw new Error('Username, password, email, and full name are required');
      }

      // Validate password strength
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Check if username already exists
      const existingUsername = await userRepository.usernameExists(username);
      if (existingUsername) {
        throw new AppError('Username already exists', 409, 'USERNAME_EXISTS');
      }

      // Check if email already exists
      const existingEmail = await userRepository.emailExists(email);
      if (existingEmail) {
        throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Create user
      const newUser = await userRepository.create({
        username,
        password_hash,
        email,
        full_name,
        role,
        salary
      }, createdBy);

      logger.auth('USER_REGISTERED', requestContext, {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdBy
      });

      return {
        success: true,
        data: {
          user: newUser,
          message: 'User registered successfully'
        }
      };
    } catch (error) {
      if (error.errorCode) {
        throw error;
      }
      logger.auth('REGISTRATION_ERROR', requestContext, {
        username: userData.username,
        email: userData.email,
        error: error.message
      });
      
      throw new AppError('Failed to register user', 500, 'INTERNAL_ERROR');
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} Password change result
   */
  async changePassword(userId, currentPassword, newPassword, requestContext = {}) {
    try {
      // Validate inputs
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }

      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters');
      }

      if (currentPassword === newPassword) {
        throw new Error('New password must be different from current password');
      }

      // Find user
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      const success = await userRepository.updatePassword(userId, newPasswordHash, userId);
      
      if (!success) {
        throw new Error('Failed to update password');
      }

      logger.auth('PASSWORD_CHANGED', requestContext, {
        userId,
        username: user.username
      });

      return {
        success: true,
        data: {
          message: 'Password changed successfully'
        }
      };
    } catch (error) {
      if (error.errorCode) {
        throw error;
      }
      logger.auth('PASSWORD_CHANGE_ERROR', requestContext, {
        userId,
        error: error.message
      });
      
      throw new AppError('Failed to change password', 500, 'INTERNAL_ERROR');
    }
  }

  /**
   * Refresh JWT token
   * @param {string} token - Current JWT token
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} New token
   */
  async refreshToken(token, requestContext = {}) {
    try {
      // Decode token (even if expired, we can still get user info)
      const decoded = decodeToken(token);
      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Find user to ensure they still exist and are active
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.is_active) {
        logger.auth('TOKEN_REFRESH_FAILED_USER_INACTIVE', requestContext, {
          userId: decoded.userId,
          reason: 'User not found or inactive'
        });
        
        throw new Error('User account is inactive');
      }

      // Generate new token
      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      };

      const newToken = generateToken(tokenPayload);

      logger.auth('TOKEN_REFRESHED', requestContext, {
        userId: user.id,
        username: user.username
      });

      return {
        success: true,
        data: {
          token: newToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      };
    } catch (error) {
      logger.auth('TOKEN_REFRESH_ERROR', requestContext, {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Validate user credentials without generating token
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} User object if valid
   */
  async validateCredentials(username, password) {
    try {
      const user = await userRepository.findByUsername(username);
      if (!user || !user.is_active) {
        return null;
      }

      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return null;
      }

      // Remove password hash from response
      const { password_hash, ...userResponse } = user;
      return userResponse;
    } catch (error) {
      logger.error('Credential validation error', {
        username,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove password hash from response
      const { password_hash, ...userProfile } = user;
      return {
        success: true,
        data: userProfile
      };
    } catch (error) {
      logger.error('Get user profile error', {
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
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfile(userId, updateData, updatedBy, requestContext = {}) {
    try {
      // Remove sensitive fields that shouldn't be updated through this method
      const { password, password_hash, role, ...safeUpdateData } = updateData;

      // Validate email uniqueness if updating email
      if (safeUpdateData.email) {
        const emailExists = await userRepository.emailExists(safeUpdateData.email, userId);
        if (emailExists) {
          throw new Error('Email already exists');
        }
      }

      const updatedUser = await userRepository.update(userId, safeUpdateData, updatedBy);
      
      if (!updatedUser) {
        throw new Error('User not found');
      }

      logger.audit('USER_PROFILE_UPDATED', requestContext, {
        userId,
        updatedFields: Object.keys(safeUpdateData),
        updatedBy
      });

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      logger.error('Update profile error', {
        userId,
        updateData: Object.keys(updateData),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Logout user (for audit logging purposes)
   * @param {number} userId - User ID
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} Logout result
   */
  async logout(userId, requestContext = {}) {
    try {
      const user = await userRepository.findById(userId);
      
      logger.auth('USER_LOGOUT', requestContext, {
        userId,
        username: user?.username
      });

      return {
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      };
    } catch (error) {
      logger.auth('LOGOUT_ERROR', requestContext, {
        userId,
        error: error.message
      });
      
      throw error;
    }
  }
}

module.exports = new AuthService(); 