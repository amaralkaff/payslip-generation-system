const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Overtime Repository
 * Data access layer for overtime operations
 */

class OvertimeRepository {
  /**
   * Submit overtime record
   * @param {Object} overtimeData - Overtime record data
   * @param {number} createdBy - ID of user creating the record
   * @returns {Promise<Object>} Created overtime record
   */
  async submitOvertime(overtimeData, createdBy) {
    const { user_id, attendance_period_id, overtime_date, hours_worked, description, ip_address } = overtimeData;
    
    const query = `
      INSERT INTO overtime_records 
      (user_id, attendance_period_id, overtime_date, hours_worked, description, ip_address, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, attendance_period_id, overtime_date, hours_worked, description, created_at
    `;
    
    try {
      const result = await pool.query(query, [
        user_id, attendance_period_id, overtime_date, hours_worked, description, ip_address, createdBy
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to submit overtime', {
        overtimeData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if overtime exists for user on date
   * @param {number} userId - User ID
   * @param {string} date - Overtime date (YYYY-MM-DD)
   * @returns {Promise<boolean>} True if overtime exists
   */
  async overtimeExistsForDate(userId, date) {
    const query = `
      SELECT id FROM overtime_records 
      WHERE user_id = $1 AND overtime_date = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, date]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check overtime existence', {
        userId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get overtime records for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Array>} List of overtime records
   */
  async getUserOvertimeInPeriod(userId, periodId) {
    const query = `
      SELECT id, overtime_date, hours_worked, description, created_at
      FROM overtime_records 
      WHERE user_id = $1 AND attendance_period_id = $2
      ORDER BY overtime_date ASC
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get user overtime in period', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate total overtime hours for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<number>} Total overtime hours
   */
  async getTotalOvertimeHours(userId, periodId) {
    const query = `
      SELECT COALESCE(SUM(hours_worked), 0) as total_hours
      FROM overtime_records 
      WHERE user_id = $1 AND attendance_period_id = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return parseFloat(result.rows[0].total_hours);
    } catch (error) {
      logger.error('Failed to get total overtime hours', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get overtime records by period (for admin)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of overtime records with user info
   */
  async getOvertimeByPeriod(periodId, options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    const query = `
      SELECT o.id, o.overtime_date, o.hours_worked, o.description, o.created_at,
             u.id as user_id, u.full_name, u.username
      FROM overtime_records o
      JOIN users u ON o.user_id = u.id
      WHERE o.attendance_period_id = $1
      ORDER BY o.overtime_date DESC, u.full_name ASC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [periodId, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get overtime by period', {
        periodId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get overtime summary for all users in period
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Array>} Overtime summary by user
   */
  async getOvertimeSummaryByPeriod(periodId) {
    const query = `
      SELECT u.id as user_id, u.full_name, u.username,
             COALESCE(SUM(o.hours_worked), 0) as total_overtime_hours,
             COUNT(o.id) as overtime_days
      FROM users u
      LEFT JOIN overtime_records o ON u.id = o.user_id AND o.attendance_period_id = $1
      WHERE u.role = 'employee' AND u.is_active = true
      GROUP BY u.id, u.full_name, u.username
      ORDER BY total_overtime_hours DESC, u.full_name ASC
    `;
    
    try {
      const result = await pool.query(query, [periodId]);
      return result.rows.map(row => ({
        ...row,
        total_overtime_hours: parseFloat(row.total_overtime_hours)
      }));
    } catch (error) {
      logger.error('Failed to get overtime summary by period', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new OvertimeRepository(); 