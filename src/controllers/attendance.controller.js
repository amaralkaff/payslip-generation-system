const attendanceService = require('../services/attendance.service');
const { validate } = require('../utils/validation');
const { attendanceSchemas } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Attendance Controller
 * Handles HTTP requests for attendance endpoints
 */

class AttendanceController {
  /**
   * Create attendance period (Admin only)
   * POST /api/v1/admin/attendance-periods
   */
  async createPeriod(req, res, next) {
    try {
      const periodData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        adminId: req.user?.id
      };

      const result = await attendanceService.createPeriod(periodData, requestContext, req.user?.id);

      res.status(201).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active attendance period
   * GET /api/v1/attendance-periods/active
   */
  async getActivePeriod(req, res, next) {
    try {
      const result = await attendanceService.getActivePeriod();

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List attendance periods
   * GET /api/v1/attendance-periods
   */
  async listPeriods(req, res, next) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        includeProcessed: req.query.include_processed === 'true'
      };

      const result = await attendanceService.listPeriods(options, req.user?.role);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit attendance (Employee)
   * POST /api/v1/employee/attendance
   */
  async submitAttendance(req, res, next) {
    try {
      const attendanceData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id
      };

      const result = await attendanceService.submitAttendance(
        attendanceData, 
        requestContext, 
        req.user?.id
      );

      res.status(201).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user attendance for active period
   * GET /api/v1/employee/attendance
   */
  async getUserAttendance(req, res, next) {
    try {
      const result = await attendanceService.getUserAttendance(req.user?.id);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user attendance for specific period
   * GET /api/v1/employee/attendance/:periodId
   */
  async getUserAttendanceInPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await attendanceService.getUserAttendanceInPeriod(req.user?.id, periodId);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get attendance period by ID
   * GET /api/v1/attendance-periods/:id
   */
  async getPeriodById(req, res, next) {
    try {
      const periodId = parseInt(req.params.id);
      const result = await attendanceService.getPeriodById(periodId);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate working days in period
   * GET /api/v1/attendance-periods/working-days
   */
  async calculateWorkingDays(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'start_date and end_date are required'
          },
          request_id: req.id
        });
      }

      // Validate date formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Dates must be in YYYY-MM-DD format'
          },
          request_id: req.id
        });
      }

      // Validate dates are actual valid dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Invalid date values provided'
          },
          request_id: req.id
        });
      }

      const result = await attendanceService.calculateWorkingDays(start_date, end_date);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== ADMIN METHODS =====

  /**
   * Get all attendance records for a period (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAttendanceForPeriod(req, res, next) {
    try {
      const { periodId } = req.params;
      const { page, limit, userId } = req.query;
      
      const options = {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
        userId: userId || undefined
      };

      const result = await attendanceService.getAttendanceForPeriod(parseInt(periodId), options);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get attendance summary for a period (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAttendanceSummaryForPeriod(req, res, next) {
    try {
      const { periodId } = req.params;
      
      const result = await attendanceService.getAttendanceSummaryForPeriod(parseInt(periodId));

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all attendance periods (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAllPeriods(req, res, next) {
    try {
      const { page, limit, isActive, payrollProcessed } = req.query;
      
      const options = {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20
      };

      // Parse boolean query parameters
      if (isActive !== undefined) {
        options.isActive = isActive === 'true';
      }
      if (payrollProcessed !== undefined) {
        options.payrollProcessed = payrollProcessed === 'true';
      }

      const result = await attendanceService.getAllPeriods(options);

      res.status(200).json({
        success: true,
        data: result.data,
        request_id: req.id
      });
    } catch (error) {
      next(error);
    }
  }
}

// Create error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Wrap all methods with error handling
const attendanceController = new AttendanceController();
const wrappedController = {};

Object.getOwnPropertyNames(AttendanceController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(attendanceController[method].bind(attendanceController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  // Employee methods
  createPeriod: wrappedController.createPeriod,
  getActivePeriod: wrappedController.getActivePeriod,
  listPeriods: wrappedController.listPeriods,
  submitAttendance: wrappedController.submitAttendance,
  getUserAttendance: wrappedController.getUserAttendance,
  getUserAttendanceInPeriod: wrappedController.getUserAttendanceInPeriod,
  getPeriodById: wrappedController.getPeriodById,
  calculateWorkingDays: wrappedController.calculateWorkingDays,
  
  // Admin methods
  getAttendanceForPeriod: wrappedController.getAttendanceForPeriod,
  getAttendanceSummaryForPeriod: wrappedController.getAttendanceSummaryForPeriod,
  getAllPeriods: wrappedController.getAllPeriods,
  
  // Validation middleware for each endpoint
  validateCreatePeriod: validate(attendanceSchemas.period, 'body'),
  validateSubmitAttendance: validate(attendanceSchemas.submission, 'body')
}; 