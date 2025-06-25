const overtimeService = require('../services/overtime.service');
const { validate } = require('../utils/validation');
const { overtimeSchemas } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Overtime Controller
 * Handles HTTP requests for overtime endpoints
 */

class OvertimeController {
  /**
   * Submit overtime (Employee)
   * POST /api/v1/employee/overtime
   */
  async submitOvertime(req, res, next) {
    try {
      const overtimeData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id
      };

      const result = await overtimeService.submitOvertime(
        overtimeData, 
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
   * Get user overtime for active period
   * GET /api/v1/employee/overtime
   */
  async getUserOvertime(req, res, next) {
    try {
      const result = await overtimeService.getUserOvertime(req.user?.id);

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
   * Get user overtime for specific period
   * GET /api/v1/employee/overtime/:periodId
   */
  async getUserOvertimeInPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await overtimeService.getUserOvertimeInPeriod(req.user?.id, periodId);

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
   * Get overtime records by period (Admin only)
   * GET /api/v1/admin/overtime/:periodId
   */
  async getOvertimeByPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await overtimeService.getOvertimeByPeriod(periodId, options);

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
   * Get overtime summary for period (Admin only)
   * GET /api/v1/admin/overtime/:periodId/summary
   */
  async getOvertimeSummary(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await overtimeService.getOvertimeSummary(periodId);

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
const overtimeController = new OvertimeController();
const wrappedController = {};

Object.getOwnPropertyNames(OvertimeController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(overtimeController[method].bind(overtimeController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  submitOvertime: wrappedController.submitOvertime,
  getUserOvertime: wrappedController.getUserOvertime,
  getUserOvertimeInPeriod: wrappedController.getUserOvertimeInPeriod,
  getOvertimeByPeriod: wrappedController.getOvertimeByPeriod,
  getOvertimeSummary: wrappedController.getOvertimeSummary,
  
  // Validation middleware for each endpoint
  validateSubmitOvertime: validate(overtimeSchemas.submission, 'body')
}; 