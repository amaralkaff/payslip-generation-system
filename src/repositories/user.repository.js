const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * User Repository
 * Data access layer for user operations
 */

class UserRepository {
  /**
   * Find user by username
   * @param {string} username - Username to search for
   * @returns {Promise<Object|null>} User object or null
   */
  async findByUsername(username) {
    const query = `
      SELECT id, username, password_hash, role, salary, full_name, email, is_active, 
             created_at, updated_at
      FROM users 
      WHERE username = $1 AND is_active = true
    `;
    
    try {
      const result = await pool.query(query, [username]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by username', {
        username,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - Email to search for
   * @returns {Promise<Object|null>} User object or null
   */
  async findByEmail(email) {
    const query = `
      SELECT id, username, password_hash, role, salary, full_name, email, is_active,
             created_at, updated_at
      FROM users 
      WHERE email = $1 AND is_active = true
    `;
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by email', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  async findById(id) {
    const query = `
      SELECT id, username, password_hash, role, salary, full_name, email, is_active,
             created_at, updated_at
      FROM users 
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by ID', {
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {number} createdBy - ID of user creating this user
   * @returns {Promise<Object>} Created user object
   */
  async create(userData, createdBy = null) {
    const query = `
      INSERT INTO users (username, password_hash, role, salary, full_name, email, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, role, salary, full_name, email, is_active, created_at, updated_at
    `;
    
    const values = [
      userData.username,
      userData.password_hash,
      userData.role,
      userData.salary,
      userData.full_name,
      userData.email,
      createdBy,
      createdBy
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user', {
        username: userData.username,
        email: userData.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user information
   * @param {number} id - User ID
   * @param {Object} updateData - Data to update
   * @param {number} updatedBy - ID of user making the update
   * @returns {Promise<Object>} Updated user object
   */
  async update(id, updateData, updatedBy) {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_by and updated_at
    fields.push(`updated_by = $${paramCount}`);
    values.push(updatedBy);
    paramCount++;
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add WHERE clause
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, role, salary, full_name, email, is_active, created_at, updated_at
    `;
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user', {
        userId: id,
        updateData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} id - User ID
   * @param {string} passwordHash - New password hash
   * @param {number} updatedBy - ID of user making the update
   * @returns {Promise<boolean>} Success status
   */
  async updatePassword(id, passwordHash, updatedBy) {
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
    
    try {
      const result = await pool.query(query, [passwordHash, updatedBy, id]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to update user password', {
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   * @param {number} id - User ID
   * @param {number} updatedBy - ID of user making the update
   * @returns {Promise<boolean>} Success status
   */
  async deactivate(id, updatedBy) {
    const query = `
      UPDATE users 
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    try {
      const result = await pool.query(query, [updatedBy, id]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to deactivate user', {
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all users with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users list with pagination
   */
  async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      role = null,
      search = null,
      isActive = null,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    let query = `
      SELECT id, username, role, salary, full_name, email, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Add filters
    if (role) {
      conditions.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (isActive !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }

    if (search) {
      conditions.push(`(full_name ILIKE $${paramCount} OR username ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    // Add conditions to query
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    // Add sorting
    const allowedSortFields = ['created_at', 'updated_at', 'username', 'full_name', 'role'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${order}`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    try {
      const result = await pool.query(query, values);
      
      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) FROM users WHERE 1=1`;
      const countValues = values.slice(0, -2); // Remove limit and offset
      
      if (conditions.length > 0) {
        countQuery += ` AND ${conditions.join(' AND ')}`;
      }
      
      const countResult = await pool.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].count);

      return {
        users: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Failed to get users list', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if username exists
   * @param {string} username - Username to check
   * @param {number} excludeId - User ID to exclude from check (for updates)
   * @returns {Promise<boolean>} True if username exists
   */
  async usernameExists(username, excludeId = null) {
    let query = 'SELECT id FROM users WHERE username = $1';
    const values = [username];
    
    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }
    
    try {
      const result = await pool.query(query, values);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check username existence', {
        username,
        excludeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {number} excludeId - User ID to exclude from check (for updates)
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email, excludeId = null) {
    let query = 'SELECT id FROM users WHERE email = $1';
    const values = [email];
    
    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }
    
    try {
      const result = await pool.query(query, values);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check email existence', {
        email,
        excludeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all active employees
   * @returns {Promise<Array>} List of active employees
   */
  async getActiveEmployees() {
    const query = `
      SELECT id, username, full_name, email, salary
      FROM users 
      WHERE role = 'employee' AND is_active = true
      ORDER BY full_name ASC
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows.map(user => ({
        ...user,
        salary: parseFloat(user.salary)
      }));
    } catch (error) {
      logger.error('Failed to get active employees', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new UserRepository(); 