const reimbursementService = require('../services/reimbursement.service');
const { validate } = require('../utils/validation');
const { reimbursementSchemas } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Reimbursement Controller
 * Handles HTTP requests for reimbursement endpoints
 */

class ReimbursementController {
  /**
   * Submit reimbursement (Employee)
   * POST /api/v1/employee/reimbursements
   */
  async submitReimbursement(req, res, next) {
    try {
      const reimbursementData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id
      };

      const result = await reimbursementService.submitReimbursement(
        reimbursementData, 
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
   * Get user reimbursements for active period
   * GET /api/v1/employee/reimbursements
   */
  async getUserReimbursements(req, res, next) {
    try {
      const result = await reimbursementService.getUserReimbursements(req.user?.id);

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
   * Get user reimbursements for specific period
   * GET /api/v1/employee/reimbursements/:periodId
   */
  async getUserReimbursementsInPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await reimbursementService.getUserReimbursementsInPeriod(req.user?.id, periodId);

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
   * Update reimbursement status (Admin only)
   * PATCH /api/v1/admin/reimbursements/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const reimbursementId = parseInt(req.params.id);
      const { status, notes } = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        adminId: req.user?.id
      };

      const result = await reimbursementService.updateStatus(
        reimbursementId, 
        status, 
        notes, 
        requestContext, 
        req.user?.id
      );

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
   * Get reimbursements by period (Admin only)
   * GET /api/v1/admin/reimbursements/:periodId
   */
  async getReimbursementsByPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        status: req.query.status
      };

      const result = await reimbursementService.getReimbursementsByPeriod(periodId, options);

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
   * Get reimbursement summary for period (Admin only)
   * GET /api/v1/admin/reimbursements/:periodId/summary
   */
  async getReimbursementSummaryByPeriod(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await reimbursementService.getReimbursementSummaryByPeriod(periodId);

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
   * Get pending reimbursements count (Admin only)
   * GET /api/v1/admin/reimbursements/pending/count
   */
  async getPendingCount(req, res, next) {
    try {
      const result = await reimbursementService.getPendingCount();

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
const reimbursementController = new ReimbursementController();
const wrappedController = {};

Object.getOwnPropertyNames(ReimbursementController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(reimbursementController[method].bind(reimbursementController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  submitReimbursement: wrappedController.submitReimbursement,
  getUserReimbursements: wrappedController.getUserReimbursements,
  getUserReimbursementsInPeriod: wrappedController.getUserReimbursementsInPeriod,
  updateStatus: wrappedController.updateStatus,
  getReimbursementsByPeriod: wrappedController.getReimbursementsByPeriod,
  getReimbursementSummaryByPeriod: wrappedController.getReimbursementSummaryByPeriod,
  getPendingCount: wrappedController.getPendingCount,
  
  // Validation middleware for each endpoint
  validateSubmitReimbursement: validate(reimbursementSchemas.submission, 'body'),
  validateUpdateStatus: validate(reimbursementSchemas.statusUpdate, 'body')
}; 