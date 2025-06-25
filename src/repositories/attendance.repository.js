const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Attendance Repository
 * Data access layer for attendance operations
 */

class AttendanceRepository {
  /**
   * Create new attendance period
   * @param {Object} periodData - Attendance period data
   * @param {number} createdBy - ID of user creating the period
   * @returns {Promise<Object>} Created attendance period
   */
  async createPeriod(periodData, createdBy) {
    const { name, start_date, end_date } = periodData;
    
    const query = `
      INSERT INTO attendance_periods (name, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, start_date, end_date, is_active, payroll_processed, created_at
    `;
    
    try {
      const result = await pool.query(query, [name, start_date, end_date, createdBy]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create attendance period', {
        periodData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get active attendance period
   * @returns {Promise<Object|null>} Active attendance period or null
   */
  async getActivePeriod() {
    const query = `
      SELECT id, name, start_date, end_date, is_active, payroll_processed, created_at
      FROM attendance_periods 
      WHERE is_active = true
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get active attendance period', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get attendance period by ID
   * @param {number} id - Attendance period ID
   * @returns {Promise<Object|null>} Attendance period or null
   */
  async getPeriodById(id) {
    const query = `
      SELECT id, name, start_date, end_date, is_active, payroll_processed, created_at
      FROM attendance_periods 
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get attendance period by ID', {
        periodId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List attendance periods
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of attendance periods
   */
  async listPeriods(options = {}) {
    const { limit = 20, offset = 0, includeProcessed = true } = options;
    
    let query = `
      SELECT id, name, start_date, end_date, is_active, payroll_processed, created_at
      FROM attendance_periods
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    if (!includeProcessed) {
      conditions.push('payroll_processed = false');
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);
    
    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Failed to list attendance periods', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Submit attendance record
   * @param {Object} attendanceData - Attendance record data
   * @param {number} createdBy - ID of user creating the record
   * @returns {Promise<Object>} Created attendance record
   */
  async submitAttendance(attendanceData, createdBy) {
    const { user_id, attendance_period_id, attendance_date, notes, ip_address } = attendanceData;
    
    const query = `
      INSERT INTO attendance_records 
      (user_id, attendance_period_id, attendance_date, check_in_time, notes, ip_address, created_by)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)
      RETURNING id, user_id, attendance_period_id, attendance_date, check_in_time, notes, created_at
    `;
    
    try {
      const result = await pool.query(query, [
        user_id, attendance_period_id, attendance_date, notes, ip_address, createdBy
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to submit attendance', {
        attendanceData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if attendance exists for user on date
   * @param {number} userId - User ID
   * @param {string} date - Attendance date (YYYY-MM-DD)
   * @returns {Promise<boolean>} True if attendance exists
   */
  async attendanceExistsForDate(userId, date) {
    const query = `
      SELECT id FROM attendance_records 
      WHERE user_id = $1 AND attendance_date = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, date]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check attendance existence', {
        userId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get attendance records for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Array>} List of attendance records
   */
  async getUserAttendanceInPeriod(userId, periodId) {
    const query = `
      SELECT id, attendance_date, check_in_time, notes, created_at
      FROM attendance_records 
      WHERE user_id = $1 AND attendance_period_id = $2
      ORDER BY attendance_date ASC
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get user attendance in period', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Count attendance days for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<number>} Number of attendance days
   */
  async countAttendanceDays(userId, periodId) {
    const query = `
      SELECT COUNT(*) as count
      FROM attendance_records 
      WHERE user_id = $1 AND attendance_period_id = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to count attendance days', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate working days in period (Monday-Friday)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<number>} Number of working days
   */
  async calculateWorkingDays(startDate, endDate) {
    const query = `
      SELECT COUNT(*) as count
      FROM generate_series($1::date, $2::date, '1 day'::interval) AS day
      WHERE EXTRACT(DOW FROM day) BETWEEN 1 AND 5
    `;
    
    try {
      const result = await pool.query(query, [startDate, endDate]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to calculate working days', {
        startDate,
        endDate,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark attendance period as processed
   * @param {number} periodId - Attendance period ID
   * @param {number} updatedBy - ID of user updating the period
   * @returns {Promise<Object>} Updated attendance period
   */
  async markPeriodAsProcessed(periodId, updatedBy) {
    const query = `
      UPDATE attendance_periods 
      SET payroll_processed = true, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, start_date, end_date, is_active, payroll_processed, updated_at
    `;
    
    try {
      const result = await pool.query(query, [updatedBy, periodId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to mark period as processed', {
        periodId,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AttendanceRepository(); 