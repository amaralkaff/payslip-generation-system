const attendanceRepository = require('../repositories/attendance.repository');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');
const { customValidators } = require('../utils/validation');

/**
 * Attendance Service
 * Business logic for attendance operations
 */

class AttendanceService {
  /**
   * Create new attendance period (Admin only)
   * @param {Object} periodData - Attendance period data
   * @param {Object} requestContext - Request context for logging
   * @param {number} createdBy - ID of admin creating the period
   * @returns {Promise<Object>} Service result
   */
  async createPeriod(periodData, requestContext = {}, createdBy) {
    try {
      const { name, start_date, end_date } = periodData;

      // Validate dates
      if (new Date(end_date) <= new Date(start_date)) {
        throw new Error('End date must be after start date');
      }

      // Check if there's already an active period
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (activePeriod) {
        throw new Error('There is already an active attendance period');
      }

      // Create the period
      const period = await attendanceRepository.createPeriod({
        name,
        start_date,
        end_date
      }, createdBy);

      logger.business('ATTENDANCE_PERIOD_CREATED', requestContext, {
        periodId: period.id,
        name: period.name,
        startDate: period.start_date,
        endDate: period.end_date,
        createdBy
      });

      return {
        success: true,
        data: period
      };
    } catch (error) {
      logger.error('Failed to create attendance period', {
        periodData,
        createdBy,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Get active attendance period
   * @returns {Promise<Object>} Service result
   */
  async getActivePeriod() {
    try {
      const period = await attendanceRepository.getActivePeriod();
      
      return {
        success: true,
        data: period
      };
    } catch (error) {
      logger.error('Failed to get active attendance period', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List attendance periods
   * @param {Object} options - Query options
   * @param {string} userRole - Role of requesting user
   * @returns {Promise<Object>} Service result
   */
  async listPeriods(options = {}, userRole) {
    try {
      // Employees only see periods that are not processed yet by default
      if (userRole === 'employee' && options.includeProcessed === undefined) {
        options.includeProcessed = false;
      }

      const periods = await attendanceRepository.listPeriods(options);
      
      return {
        success: true,
        data: periods
      };
    } catch (error) {
      logger.error('Failed to list attendance periods', {
        options,
        userRole,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Submit attendance for employee
   * @param {Object} attendanceData - Attendance data
   * @param {Object} requestContext - Request context for logging
   * @param {number} userId - ID of user submitting attendance
   * @returns {Promise<Object>} Service result
   */
  async submitAttendance(attendanceData, requestContext = {}, userId) {
    try {
      const { attendance_date, notes } = attendanceData;

      // Get active attendance period
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        throw new Error('No active attendance period found');
      }

      // Check if period is already processed
      if (activePeriod.payroll_processed) {
        throw new Error('Cannot submit attendance for a processed period');
      }

      // Validate date is within the period
      const attendanceDate = new Date(attendance_date);
      const startDate = new Date(activePeriod.start_date);
      const endDate = new Date(activePeriod.end_date);

      if (attendanceDate < startDate || attendanceDate > endDate) {
        throw new Error('Attendance date must be within the active period');
      }

      // Validate it's a working day (Monday-Friday)
      if (!customValidators.isWorkingDay(attendance_date)) {
        throw new Error('Cannot submit attendance for weekends');
      }

      // Check if attendance already exists for this date
      const exists = await attendanceRepository.attendanceExistsForDate(userId, attendance_date);
      if (exists) {
        throw new Error('Attendance already submitted for this date');
      }

      // Submit attendance
      const attendance = await attendanceRepository.submitAttendance({
        user_id: userId,
        attendance_period_id: activePeriod.id,
        attendance_date,
        notes,
        ip_address: requestContext.ipAddress
      }, userId);

      logger.business('ATTENDANCE_SUBMITTED', requestContext, {
        attendanceId: attendance.id,
        userId,
        attendanceDate: attendance_date,
        periodId: activePeriod.id
      });

      return {
        success: true,
        data: attendance
      };
    } catch (error) {
      logger.error('Failed to submit attendance', {
        attendanceData,
        userId,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Get user attendance for active period
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Service result
   */
  async getUserAttendance(userId) {
    try {
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        return {
          success: true,
          data: {
            period: null,
            attendance: [],
            summary: {
              attendance_days: 0,
              total_working_days: 0
            }
          }
        };
      }

      const attendance = await attendanceRepository.getUserAttendanceInPeriod(userId, activePeriod.id);
      const attendanceDays = await attendanceRepository.countAttendanceDays(userId, activePeriod.id);
      const totalWorkingDays = await attendanceRepository.calculateWorkingDays(
        activePeriod.start_date, 
        activePeriod.end_date
      );

      return {
        success: true,
        data: {
          period: activePeriod,
          attendance,
          summary: {
            attendance_days: attendanceDays,
            total_working_days: totalWorkingDays
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get user attendance', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user attendance for specific period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getUserAttendanceInPeriod(userId, periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const attendance = await attendanceRepository.getUserAttendanceInPeriod(userId, periodId);
      const attendanceDays = await attendanceRepository.countAttendanceDays(userId, periodId);
      const totalWorkingDays = await attendanceRepository.calculateWorkingDays(
        period.start_date, 
        period.end_date
      );

      return {
        success: true,
        data: {
          period,
          attendance,
          summary: {
            attendance_days: attendanceDays,
            total_working_days: totalWorkingDays
          }
        }
      };
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
   * Get attendance period by ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getPeriodById(periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      return {
        success: true,
        data: period
      };
    } catch (error) {
      logger.error('Failed to get attendance period by ID', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate working days in period
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Service result
   */
  async calculateWorkingDays(startDate, endDate) {
    try {
      const workingDays = await attendanceRepository.calculateWorkingDays(startDate, endDate);
      
      return {
        success: true,
        data: {
          start_date: startDate,
          end_date: endDate,
          working_days: workingDays
        }
      };
    } catch (error) {
      logger.error('Failed to calculate working days', {
        startDate,
        endDate,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AttendanceService(); 