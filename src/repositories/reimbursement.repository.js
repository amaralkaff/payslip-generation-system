const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Reimbursement Repository
 * Data access layer for reimbursement operations
 */

class ReimbursementRepository {
  /**
   * Submit reimbursement request
   * @param {Object} reimbursementData - Reimbursement data
   * @param {number} createdBy - ID of user creating the request
   * @returns {Promise<Object>} Created reimbursement record
   */
  async submitReimbursement(reimbursementData, createdBy) {
    const { user_id, attendance_period_id, amount, description, receipt_url, ip_address } = reimbursementData;
    
    const query = `
      INSERT INTO reimbursements 
      (user_id, attendance_period_id, amount, description, receipt_url, ip_address, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, attendance_period_id, amount, description, receipt_url, status, created_at
    `;
    
    try {
      const result = await pool.query(query, [
        user_id, attendance_period_id, amount, description, receipt_url, ip_address, createdBy
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to submit reimbursement', {
        reimbursementData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reimbursements for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Array>} List of reimbursement records
   */
  async getUserReimbursementsInPeriod(userId, periodId) {
    const query = `
      SELECT id, amount, description, receipt_url, status, created_at
      FROM reimbursements 
      WHERE user_id = $1 AND attendance_period_id = $2
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return result.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount)
      }));
    } catch (error) {
      logger.error('Failed to get user reimbursements in period', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate total approved reimbursements for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<number>} Total approved reimbursement amount
   */
  async getTotalApprovedReimbursements(userId, periodId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total_amount
      FROM reimbursements 
      WHERE user_id = $1 AND attendance_period_id = $2 AND status = 'approved'
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return parseFloat(result.rows[0].total_amount);
    } catch (error) {
      logger.error('Failed to get total approved reimbursements', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reimbursement by ID
   * @param {number} id - Reimbursement ID
   * @returns {Promise<Object|null>} Reimbursement record or null
   */
  async getById(id) {
    const query = `
      SELECT id, user_id, attendance_period_id, amount, description, receipt_url, status, created_at, updated_at
      FROM reimbursements 
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      const reimbursement = result.rows[0];
      if (reimbursement) {
        reimbursement.amount = parseFloat(reimbursement.amount);
      }
      return reimbursement || null;
    } catch (error) {
      logger.error('Failed to get reimbursement by ID', {
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update reimbursement status (for admin approval/rejection)
   * @param {number} id - Reimbursement ID
   * @param {string} status - New status ('approved' or 'rejected')
   * @param {number} updatedBy - ID of user updating the status
   * @returns {Promise<Object>} Updated reimbursement record
   */
  async updateStatus(id, status, updatedBy) {
    const query = `
      UPDATE reimbursements 
      SET status = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, user_id, attendance_period_id, amount, description, receipt_url, status, updated_at
    `;
    
    try {
      const result = await pool.query(query, [status, updatedBy, id]);
      const reimbursement = result.rows[0];
      if (reimbursement) {
        reimbursement.amount = parseFloat(reimbursement.amount);
      }
      return reimbursement;
    } catch (error) {
      logger.error('Failed to update reimbursement status', {
        id,
        status,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reimbursements by period (for admin)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of reimbursements with user info
   */
  async getReimbursementsByPeriod(periodId, options = {}) {
    const { status, limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT r.id, r.amount, r.description, r.receipt_url, r.status, r.created_at,
             u.id as user_id, u.full_name, u.username
      FROM reimbursements r
      JOIN users u ON r.user_id = u.id
      WHERE r.attendance_period_id = $1
    `;
    
    const values = [periodId];
    let paramCount = 2;
    
    if (status) {
      query += ` AND r.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);
    
    try {
      const result = await pool.query(query, values);
      return result.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount)
      }));
    } catch (error) {
      logger.error('Failed to get reimbursements by period', {
        periodId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reimbursement summary for all users in period
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Array>} Reimbursement summary by user
   */
  async getReimbursementSummaryByPeriod(periodId) {
    const query = `
      SELECT u.id as user_id, u.full_name, u.username,
             COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.amount ELSE 0 END), 0) as total_approved,
             COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END), 0) as total_pending,
             COALESCE(SUM(CASE WHEN r.status = 'rejected' THEN r.amount ELSE 0 END), 0) as total_rejected,
             COUNT(r.id) as total_requests
      FROM users u
      LEFT JOIN reimbursements r ON u.id = r.user_id AND r.attendance_period_id = $1
      WHERE u.role = 'employee' AND u.is_active = true
      GROUP BY u.id, u.full_name, u.username
      ORDER BY total_approved DESC, u.full_name ASC
    `;
    
    try {
      const result = await pool.query(query, [periodId]);
      return result.rows.map(row => ({
        ...row,
        total_approved: parseFloat(row.total_approved),
        total_pending: parseFloat(row.total_pending),
        total_rejected: parseFloat(row.total_rejected)
      }));
    } catch (error) {
      logger.error('Failed to get reimbursement summary by period', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get pending reimbursements count
   * @param {number} periodId - Attendance period ID (optional)
   * @returns {Promise<number>} Count of pending reimbursements
   */
  async getPendingCount(periodId = null) {
    let query = `
      SELECT COUNT(*) as count
      FROM reimbursements 
      WHERE status = 'pending'
    `;
    
    const values = [];
    if (periodId) {
      query += ` AND attendance_period_id = $1`;
      values.push(periodId);
    }
    
    try {
      const result = await pool.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get pending reimbursements count', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ReimbursementRepository(); 