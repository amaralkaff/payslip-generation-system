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

  // ===== ADMIN METHODS =====

  /**
   * Get all attendance records for a period (Admin view)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options (pagination, userId filter)
   * @returns {Promise<Object>} Attendance records with user details
   */
  async getAttendanceForPeriod(periodId, options = {}) {
    const { page = 1, limit = 50, userId } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE ar.attendance_period_id = $1';
    let queryParams = [periodId];
    let paramIndex = 2;

    if (userId) {
      whereClause += ` AND ar.user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    const query = `
      SELECT 
        ar.id,
        ar.attendance_date,
        ar.check_in_time,
        ar.notes,
        ar.created_at,
        u.id as user_id,
        u.username,
        u.full_name,
        u.email,
        ap.name as period_name,
        ap.start_date as period_start,
        ap.end_date as period_end
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      JOIN attendance_periods ap ON ar.attendance_period_id = ap.id
      ${whereClause}
      ORDER BY ar.attendance_date DESC, u.full_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance_records ar
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Failed to get attendance for period', {
        periodId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get attendance summary for a period (Admin view)
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Attendance summary with statistics
   */
  async getAttendanceSummaryForPeriod(periodId) {
    const query = `
      WITH period_info AS (
        SELECT id, name, start_date, end_date,
               (SELECT COUNT(*) FROM generate_series(start_date, end_date, '1 day'::interval) AS day
                WHERE EXTRACT(DOW FROM day) BETWEEN 1 AND 5) as total_working_days
        FROM attendance_periods 
        WHERE id = $1
      ),
      attendance_stats AS (
        SELECT 
          COUNT(DISTINCT ar.user_id) as employees_with_attendance,
          COUNT(*) as total_attendance_records,
          AVG(CASE WHEN ar.user_id IS NOT NULL THEN 1 ELSE 0 END) as avg_attendance_rate
        FROM attendance_records ar
        WHERE ar.attendance_period_id = $1
      ),
      employee_attendance AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.full_name,
          COUNT(ar.id) as attendance_days,
          ROUND((COUNT(ar.id)::decimal / pi.total_working_days * 100)::numeric, 2) as attendance_percentage
        FROM users u
        LEFT JOIN attendance_records ar ON u.id = ar.user_id AND ar.attendance_period_id = $1
        CROSS JOIN period_info pi
        WHERE u.role = 'employee' AND u.is_active = true
        GROUP BY u.id, u.username, u.full_name, pi.total_working_days
        ORDER BY attendance_percentage DESC, u.full_name ASC
      )
      SELECT 
        pi.id as period_id,
        pi.name as period_name,
        pi.start_date,
        pi.end_date,
        pi.total_working_days,
        ast.employees_with_attendance,
        ast.total_attendance_records,
        (SELECT COUNT(*) FROM users WHERE role = 'employee' AND is_active = true) as total_employees,
        json_agg(
          json_build_object(
            'user_id', ea.user_id,
            'username', ea.username,
            'full_name', ea.full_name,
            'attendance_days', ea.attendance_days,
            'attendance_percentage', ea.attendance_percentage
          ) ORDER BY ea.attendance_percentage DESC, ea.full_name ASC
        ) as employee_breakdown
      FROM period_info pi
      CROSS JOIN attendance_stats ast
      CROSS JOIN employee_attendance ea
      GROUP BY pi.id, pi.name, pi.start_date, pi.end_date, pi.total_working_days,
               ast.employees_with_attendance, ast.total_attendance_records
    `;

    try {
      const result = await pool.query(query, [periodId]);
      if (result.rows.length === 0) {
        throw new Error('Attendance period not found');
      }
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get attendance summary for period', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all attendance periods (Admin view)
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Object>} List of attendance periods with metadata
   */
  async getAllPeriods(options = {}) {
    const { page = 1, limit = 20, isActive, payrollProcessed } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;

    if (typeof isActive === 'boolean') {
      whereClause += ` AND is_active = $${paramIndex}`;
      queryParams.push(isActive);
      paramIndex++;
    }

    if (typeof payrollProcessed === 'boolean') {
      whereClause += ` AND payroll_processed = $${paramIndex}`;
      queryParams.push(payrollProcessed);
      paramIndex++;
    }

    const query = `
      SELECT 
        ap.id,
        ap.name,
        ap.start_date,
        ap.end_date,
        ap.is_active,
        ap.payroll_processed,
        ap.created_at,
        ap.updated_at,
        creator.username as created_by_username,
        creator.full_name as created_by_name,
        updater.username as updated_by_username,
        updater.full_name as updated_by_name,
        (SELECT COUNT(*) FROM attendance_records WHERE attendance_period_id = ap.id) as total_attendance_records,
        (SELECT COUNT(DISTINCT user_id) FROM attendance_records WHERE attendance_period_id = ap.id) as employees_with_attendance
      FROM attendance_periods ap
      LEFT JOIN users creator ON ap.created_by = creator.id
      LEFT JOIN users updater ON ap.updated_by = updater.id
      ${whereClause}
      ORDER BY ap.start_date DESC, ap.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance_periods ap
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Failed to get all attendance periods', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find overlapping attendance period
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object|null>} Overlapping period or null
   */
  async findOverlappingPeriod(startDate, endDate) {
    const query = `
      SELECT id, name, start_date, end_date, is_active
      FROM attendance_periods 
      WHERE (start_date <= $2 AND end_date >= $1)
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [startDate, endDate]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find overlapping period', {
        startDate,
        endDate,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deactivate attendance period
   * @param {number} periodId - Attendance period ID
   * @param {number} updatedBy - ID of user updating the period
   * @returns {Promise<Object>} Updated attendance period
   */
  async deactivatePeriod(periodId, updatedBy) {
    const query = `
      UPDATE attendance_periods 
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, start_date, end_date, is_active, updated_at
    `;
    
    try {
      const result = await pool.query(query, [updatedBy, periodId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to deactivate attendance period', {
        periodId,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Activate attendance period (and deactivate others)
   * @param {number} periodId - Attendance period ID
   * @param {number} updatedBy - ID of user updating the period
   * @returns {Promise<Object>} Updated attendance period
   */
  async activatePeriod(periodId, updatedBy) {
    // First deactivate all periods
    const deactivateQuery = `
      UPDATE attendance_periods 
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
    `;
    
    // Then activate the specific period
    const activateQuery = `
      UPDATE attendance_periods 
      SET is_active = true, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, start_date, end_date, is_active, updated_at
    `;
    
    try {
      await pool.query(deactivateQuery, [updatedBy]);
      const result = await pool.query(activateQuery, [updatedBy, periodId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to activate attendance period', {
        periodId,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AttendanceRepository(); 