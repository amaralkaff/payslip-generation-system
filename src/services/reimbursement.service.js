const reimbursementRepository = require('../repositories/reimbursement.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const logger = require('../utils/logger');

/**
 * Reimbursement Service
 * Business logic for reimbursement operations
 */

class ReimbursementService {
  /**
   * Submit reimbursement request
   * @param {Object} reimbursementData - Reimbursement data
   * @param {Object} requestContext - Request context for logging
   * @param {number} userId - ID of user submitting reimbursement
   * @returns {Promise<Object>} Service result
   */
  async submitReimbursement(reimbursementData, requestContext = {}, userId) {
    try {
      const { amount, description, receipt_url } = reimbursementData;

      // Get active attendance period
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        throw new Error('No active attendance period found');
      }

      // Check if period is already processed
      if (activePeriod.payroll_processed) {
        throw new Error('Cannot submit reimbursement for a processed period');
      }

      // Validate amount
      if (amount <= 0) {
        throw new Error('Reimbursement amount must be positive');
      }

      // Submit reimbursement
      const reimbursement = await reimbursementRepository.submitReimbursement({
        user_id: userId,
        attendance_period_id: activePeriod.id,
        amount,
        description,
        receipt_url,
        ip_address: requestContext.ipAddress
      }, userId);

      logger.business('REIMBURSEMENT_SUBMITTED', requestContext, {
        reimbursementId: reimbursement.id,
        userId,
        amount,
        description: description.substring(0, 100),
        periodId: activePeriod.id
      });

      return {
        success: true,
        data: reimbursement
      };
    } catch (error) {
      logger.error('Failed to submit reimbursement', {
        reimbursementData,
        userId,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Get user reimbursements for active period
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Service result
   */
  async getUserReimbursements(userId) {
    try {
      const activePeriod = await attendanceRepository.getActivePeriod();
      if (!activePeriod) {
        return {
          success: true,
          data: {
            period: null,
            reimbursements: [],
            summary: {
              total_amount: 0,
              approved_amount: 0,
              pending_amount: 0,
              rejected_amount: 0,
              total_requests: 0
            }
          }
        };
      }

      const reimbursements = await reimbursementRepository.getUserReimbursementsInPeriod(
        userId, 
        activePeriod.id
      );

      // Calculate summary
      const summary = reimbursements.reduce((acc, reimb) => {
        acc.total_amount += reimb.amount;
        acc.total_requests++;
        
        switch (reimb.status) {
          case 'approved':
            acc.approved_amount += reimb.amount;
            break;
          case 'pending':
            acc.pending_amount += reimb.amount;
            break;
          case 'rejected':
            acc.rejected_amount += reimb.amount;
            break;
        }
        
        return acc;
      }, {
        total_amount: 0,
        approved_amount: 0,
        pending_amount: 0,
        rejected_amount: 0,
        total_requests: 0
      });

      return {
        success: true,
        data: {
          period: activePeriod,
          reimbursements,
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to get user reimbursements', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user reimbursements for specific period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getUserReimbursementsInPeriod(userId, periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const reimbursements = await reimbursementRepository.getUserReimbursementsInPeriod(
        userId, 
        periodId
      );

      // Calculate summary
      const summary = reimbursements.reduce((acc, reimb) => {
        acc.total_amount += reimb.amount;
        acc.total_requests++;
        
        switch (reimb.status) {
          case 'approved':
            acc.approved_amount += reimb.amount;
            break;
          case 'pending':
            acc.pending_amount += reimb.amount;
            break;
          case 'rejected':
            acc.rejected_amount += reimb.amount;
            break;
        }
        
        return acc;
      }, {
        total_amount: 0,
        approved_amount: 0,
        pending_amount: 0,
        rejected_amount: 0,
        total_requests: 0
      });

      return {
        success: true,
        data: {
          period,
          reimbursements,
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to get user reimbursements in period', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update reimbursement status (Admin only)
   * @param {number} reimbursementId - Reimbursement ID
   * @param {string} status - New status ('approved' or 'rejected')
   * @param {Object} requestContext - Request context for logging
   * @param {number} adminId - ID of admin updating status
   * @returns {Promise<Object>} Service result
   */
  async updateStatus(reimbursementId, status, requestContext = {}, adminId) {
    try {
      // Get reimbursement first
      const reimbursement = await reimbursementRepository.getById(reimbursementId);
      if (!reimbursement) {
        throw new Error('Reimbursement not found');
      }

      // Check if period is already processed
      const period = await attendanceRepository.getPeriodById(reimbursement.attendance_period_id);
      if (period && period.payroll_processed) {
        throw new Error('Cannot update reimbursement status for a processed period');
      }

      // Validate status
      if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Status must be either approved or rejected');
      }

      // Update status
      const updatedReimbursement = await reimbursementRepository.updateStatus(
        reimbursementId, 
        status, 
        adminId
      );

      logger.business('REIMBURSEMENT_STATUS_UPDATED', requestContext, {
        reimbursementId,
        userId: reimbursement.user_id,
        oldStatus: reimbursement.status,
        newStatus: status,
        amount: reimbursement.amount,
        updatedBy: adminId
      });

      return {
        success: true,
        data: updatedReimbursement
      };
    } catch (error) {
      logger.error('Failed to update reimbursement status', {
        reimbursementId,
        status,
        adminId,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Get reimbursements by period (Admin only)
   * @param {number} periodId - Attendance period ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Service result
   */
  async getReimbursementsByPeriod(periodId, options = {}) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const reimbursements = await reimbursementRepository.getReimbursementsByPeriod(
        periodId, 
        options
      );
      const summary = await reimbursementRepository.getReimbursementSummaryByPeriod(periodId);

      return {
        success: true,
        data: {
          period,
          reimbursements,
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to get reimbursements by period', {
        periodId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reimbursement summary for period (Admin only)
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async getReimbursementSummary(periodId) {
    try {
      const period = await attendanceRepository.getPeriodById(periodId);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      const summary = await reimbursementRepository.getReimbursementSummaryByPeriod(periodId);

      return {
        success: true,
        data: {
          period,
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to get reimbursement summary', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get pending reimbursements count
   * @param {number} periodId - Optional period ID filter
   * @returns {Promise<Object>} Service result
   */
  async getPendingCount(periodId = null) {
    try {
      const count = await reimbursementRepository.getPendingCount(periodId);
      
      return {
        success: true,
        data: {
          pending_count: count,
          period_id: periodId
        }
      };
    } catch (error) {
      logger.error('Failed to get pending reimbursements count', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ReimbursementService(); 