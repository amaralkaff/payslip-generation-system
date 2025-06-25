const overtimeRepository = require('../repositories/overtime.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const logger = require('../utils/logger');

/**
 * Overtime Service
 * Business logic for overtime operations
 */

class OvertimeService {
  /**
   * Submit overtime record
   * @param {Object} overtimeData - Overtime data
   * @param {Object} requestContext - Request context for logging
   * @param {number} userId - ID of user submitting overtime
   * @returns {Promise<Object>} Service result
   */
  async submitOvertime(overtimeData, requestContext = {}, userId) {
    try {
      const { overtime_date, hours_worked, description } = overtimeData;

      // Get active attendance period
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        throw new Error('No active attendance period found');
      }

      // Check if period is already processed
      if (activePeriod.payroll_processed) {
        throw new Error('Cannot submit overtime for a processed period');
      }

      // Validate overtime date is within the period
      const overtimeDate = new Date(overtime_date);
      const startDate = new Date(activePeriod.start_date);
      const endDate = new Date(activePeriod.end_date);

      if (overtimeDate < startDate || overtimeDate > endDate) {
        throw new Error('Overtime date must be within the active period');
      }

      // Validate hours (should be between 0.5 and 3 hours)
      if (hours_worked < 0.5 || hours_worked > 3) {
        throw new Error('Overtime hours must be between 0.5 and 3.0 hours');
      }

      // Check if overtime already exists for this date
      const exists = await overtimeRepository.overtimeExistsForDate(userId, overtime_date);
      if (exists) {
        throw new Error('Overtime already submitted for this date');
      }

      // Submit overtime
      const overtime = await overtimeRepository.submitOvertime({
        user_id: userId,
        attendance_period_id: activePeriod.id,
        overtime_date,
        hours_worked,
        description,
        ip_address: requestContext.ipAddress
      }, userId);

      logger.business('OVERTIME_SUBMITTED', requestContext, {
        overtimeId: overtime.id,
        userId,
        overtimeDate: overtime_date,
        hoursWorked: hours_worked,
        periodId: activePeriod.id
      });

      return {
        success: true,
        data: overtime
      };
    } catch (error) {
      logger.error('Failed to submit overtime', {
        overtimeData,
        userId,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Get user overtime for active period
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Service result
   */
  async getUserOvertime(userId) {
    try {
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        return {
          success: true,
          data: {
            period: null,
            overtime: [],
            summary: {
              total_hours: 0,
              total_days: 0
            }
          }
        };
      }

      const overtime = await overtimeRepository.getUserOvertimeInPeriod(userId, activePeriod.id);
      const totalHours = await overtimeRepository.getTotalOvertimeHours(userId, activePeriod.id);

      return {
        success: true,
        data: {
          period: activePeriod,
          overtime,
          summary: {
            total_hours: totalHours,
            total_days: overtime.length
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get user overtime', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user overtime for specific period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getUserOvertimeInPeriod(userId, periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const overtime = await overtimeRepository.getUserOvertimeInPeriod(userId, periodId);
      const totalHours = await overtimeRepository.getTotalOvertimeHours(userId, periodId);

      return {
        success: true,
        data: {
          period,
          overtime,
          summary: {
            total_hours: totalHours,
            total_days: overtime.length
          }
        }
      };
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
   * Get overtime records by period (Admin only)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Service result
   */
  async getOvertimeByPeriod(periodId, options = {}) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const overtime = await overtimeRepository.getOvertimeByPeriod(periodId, options);
      const summary = await overtimeRepository.getOvertimeSummaryByPeriod(periodId);

      return {
        success: true,
        data: {
          period,
          overtime,
          summary
        }
      };
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
   * Get overtime summary for period (Admin only)
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getOvertimeSummary(periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const summary = await overtimeRepository.getOvertimeSummaryByPeriod(periodId);

      return {
        success: true,
        data: {
          period,
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to get overtime summary', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new OvertimeService(); 