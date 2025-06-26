const attendanceRepository = require('../repositories/attendance.repository');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');
const { customValidators } = require('../utils/validation');
const AppError = require('../utils/errors');

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
        throw new AppError('End date must be after start date', 400, 'VALIDATION_ERROR');
      }

      // Check for overlapping periods
      const overlappingPeriod = await attendanceRepository.findOverlappingPeriod(start_date, end_date);
      if (overlappingPeriod) {
        throw new AppError(
          `Attendance period overlaps with existing period "${overlappingPeriod.name}" (${overlappingPeriod.start_date} to ${overlappingPeriod.end_date})`, 
          409, 
          'PERIOD_OVERLAP'
        );
      }

      // Get current active period to deactivate if creating a new one
      const activePeriod = await attendanceRepository.getActivePeriod();

      // If there's an active period, reject creation
      if (activePeriod) {
        throw new AppError('There is already an active attendance period', 409, 'ACTIVE_PERIOD_EXISTS');
      }

      // Create the new period (it will be active by default)
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

      // Validate attendance_date is a valid date string
      if (isNaN(new Date(attendance_date).getTime())) {
        throw new AppError('Invalid attendance date format', 400, 'VALIDATION_ERROR');
      }

      // Get active attendance period
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        throw new AppError('No active attendance period found', 400, 'NO_ACTIVE_PERIOD');
      }

      // Check if period is already processed
      if (activePeriod.payroll_processed) {
        throw new AppError('Cannot submit attendance for a processed period', 400, 'PERIOD_PROCESSED');
      }

      // Validate not future date first
      const attendanceDate = new Date(attendance_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (attendanceDate > today) {
        throw new AppError('Cannot submit attendance for future dates', 400, 'FUTURE_DATE_NOT_ALLOWED');
      }

      // Validate date is within the period
      const startDate = new Date(activePeriod.start_date);
      const endDate = new Date(activePeriod.end_date);

      if (attendanceDate < startDate || attendanceDate > endDate) {
        throw new AppError('Attendance date must be within the active period', 400, 'DATE_OUTSIDE_PERIOD');
      }

      // Validate it's a working day (Monday-Friday)
      if (!customValidators.isWorkingDay(attendance_date)) {
        throw new AppError('Cannot submit attendance for weekends', 400, 'WEEKEND_NOT_ALLOWED');
      }

      // Check if attendance already exists for this date
      const exists = await attendanceRepository.attendanceExistsForDate(userId, attendance_date);
      if (exists) {
        throw new AppError('Attendance already submitted for this date', 400, 'ATTENDANCE_ALREADY_EXISTS');
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
      if (error.errorCode) {
        throw error;
      }
      logger.error('Failed to submit attendance', {
        attendanceData,
        userId,
        error: error.message,
        requestContext
      });
      throw new AppError('Failed to submit attendance', 500, 'INTERNAL_ERROR');
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
        throw new AppError('Attendance period not found', 404, 'PERIOD_NOT_FOUND');
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
        throw new AppError('Attendance period not found', 404, 'PERIOD_NOT_FOUND');
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

  // ===== ADMIN METHODS =====

  /**
   * Get all attendance records for a period (Admin view)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options (pagination, userId filter)
   * @returns {Promise<Object>} Service result
   */
  async getAttendanceForPeriod(periodId, options = {}) {
    try {
      // Validate period exists
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new AppError('Attendance period not found', 404, 'PERIOD_NOT_FOUND');
      }

      const result = await attendanceRepository.getAttendanceForPeriod(periodId, options);
      
      return {
        success: true,
        data: {
          period: {
            id: period.id,
            name: period.name,
            start_date: period.start_date,
            end_date: period.end_date,
            is_active: period.is_active,
            payroll_processed: period.payroll_processed
          },
          attendance: result.data,
          pagination: result.pagination
        }
      };
    } catch (error) {
      logger.error('Failed to get attendance for period (admin)', {
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
   * @returns {Promise<Object>} Service result
   */
  async getAttendanceSummaryForPeriod(periodId) {
    try {
      const summary = await attendanceRepository.getAttendanceSummaryForPeriod(periodId);
      
      // Ensure numeric fields are properly typed
      const processedSummary = {
        ...summary,
        total_working_days: parseInt(summary.total_working_days),
        employees_with_attendance: parseInt(summary.employees_with_attendance),
        total_attendance_records: parseInt(summary.total_attendance_records),
        total_employees: parseInt(summary.total_employees)
      };
      
      return {
        success: true,
        data: processedSummary
      };
    } catch (error) {
      if (error.message === 'Attendance period not found') {
        error.statusCode = 404;
        error.code = 'PERIOD_NOT_FOUND';
      }
      
      logger.error('Failed to get attendance summary for period (admin)', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all attendance periods (Admin view)
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Object>} Service result
   */
  async getAllPeriods(options = {}) {
    try {
      const result = await attendanceRepository.getAllPeriods(options);
      
      return {
        success: true,
        data: {
          periods: result.data,
          pagination: result.pagination
        }
      };
    } catch (error) {
      logger.error('Failed to get all attendance periods (admin)', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if date is a weekday (Monday-Friday)
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {boolean} True if weekday
   */
  static isWeekday(dateString) {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
  }

  /**
   * Check if date is within range
   * @param {string} dateString - Date to check
   * @param {string} startDate - Range start date
   * @param {string} endDate - Range end date
   * @returns {boolean} True if in range
   */
  static isDateInRange(dateString, startDate, endDate) {
    const date = new Date(dateString);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return date >= start && date <= end;
  }

  /**
   * Check if date is in the future
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {boolean} True if future date
   */
  static isFutureDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    date.setUTCHours(0, 0, 0, 0);
    return date > today;
  }
}

const attendanceServiceInstance = new AttendanceService();
attendanceServiceInstance.AttendanceService = AttendanceService; // Expose class for static methods
module.exports = attendanceServiceInstance; 