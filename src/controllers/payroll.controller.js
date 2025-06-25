const payrollService = require('../services/payroll.service');
const { validate } = require('../utils/validation');
const { payrollSchemas } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Payroll Controller
 * Handles HTTP requests for payroll and payslip endpoints
 */

class PayrollController {
  /**
   * Process payroll (Admin only)
   * POST /api/v1/admin/payroll/process
   */
  async processPayroll(req, res, next) {
    try {
      const payrollData = req.body;
      
      // Create request context for logging
      const requestContext = {
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        adminId: req.user?.id
      };

      const result = await payrollService.processPayroll(
        payrollData, 
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
   * Generate payslip for employee
   * GET /api/v1/employee/payslip/:periodId
   */
  async generatePayslip(req, res, next) {
    try {
      const periodId = parseInt(req.params.periodId);
      const result = await payrollService.generatePayslip(req.user?.id, periodId);

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
   * Get payroll summary (Admin only)
   * GET /api/v1/admin/payroll/summary/:payrollId
   */
  async getPayrollSummary(req, res, next) {
    try {
      const payrollId = parseInt(req.params.payrollId);
      const result = await payrollService.getPayrollSummary(payrollId);

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
   * List all payrolls (Admin only)
   * GET /api/v1/admin/payroll
   */
  async listPayrolls(req, res, next) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await payrollService.listPayrolls(options);

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
   * Get payroll by ID (Admin only)
   * GET /api/v1/admin/payroll/:id
   */
  async getPayrollById(req, res, next) {
    try {
      const payrollId = parseInt(req.params.id);
      const result = await payrollService.getPayrollById(payrollId);

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
const payrollController = new PayrollController();
const wrappedController = {};

Object.getOwnPropertyNames(PayrollController.prototype).forEach(method => {
  if (method !== 'constructor') {
    wrappedController[method] = asyncHandler(payrollController[method].bind(payrollController));
  }
});

// Export individual methods for easier route binding
module.exports = {
  processPayroll: wrappedController.processPayroll,
  generatePayslip: wrappedController.generatePayslip,
  getPayrollSummary: wrappedController.getPayrollSummary,
  listPayrolls: wrappedController.listPayrolls,
  getPayrollById: wrappedController.getPayrollById,
  
  // Validation middleware for each endpoint
  validateProcessPayroll: validate(payrollSchemas.process, 'body')
}; 