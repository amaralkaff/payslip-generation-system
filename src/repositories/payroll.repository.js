const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Payroll Repository
 * Data access layer for payroll operations
 */

class PayrollRepository {
  /**
   * Create payroll record
   * @param {Object} payrollData - Payroll data
   * @param {number} createdBy - ID of user creating the payroll
   * @returns {Promise<Object>} Created payroll record
   */
  async createPayroll(payrollData, createdBy) {
    const { attendance_period_id, total_employees, total_amount, notes } = payrollData;
    
    const query = `
      INSERT INTO payrolls 
      (attendance_period_id, total_employees, total_amount, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, attendance_period_id, processed_at, total_employees, total_amount, status, notes
    `;
    
    try {
      const result = await pool.query(query, [
        attendance_period_id, total_employees, total_amount, notes, createdBy
      ]);
      const payroll = result.rows[0];
      payroll.total_amount = parseFloat(payroll.total_amount);
      return payroll;
    } catch (error) {
      logger.error('Failed to create payroll', {
        payrollData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payroll by attendance period ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object|null>} Payroll record or null
   */
  async getByPeriodId(periodId) {
    const query = `
      SELECT id, attendance_period_id, processed_at, total_employees, total_amount, status, notes
      FROM payrolls 
      WHERE attendance_period_id = $1
    `;
    
    try {
      const result = await pool.query(query, [periodId]);
      const payroll = result.rows[0];
      if (payroll) {
        payroll.total_amount = parseFloat(payroll.total_amount);
      }
      return payroll || null;
    } catch (error) {
      logger.error('Failed to get payroll by period ID', {
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payroll by ID
   * @param {number} id - Payroll ID
   * @returns {Promise<Object|null>} Payroll record or null
   */
  async getById(id) {
    const query = `
      SELECT p.id, p.attendance_period_id, p.processed_at, p.total_employees, p.total_amount, p.status, p.notes,
             ap.name as period_name, ap.start_date, ap.end_date
      FROM payrolls p
      JOIN attendance_periods ap ON p.attendance_period_id = ap.id
      WHERE p.id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      const payroll = result.rows[0];
      if (payroll) {
        payroll.total_amount = parseFloat(payroll.total_amount);
      }
      return payroll || null;
    } catch (error) {
      logger.error('Failed to get payroll by ID', {
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create payslip record
   * @param {Object} payslipData - Payslip data
   * @param {number} createdBy - ID of user creating the payslip
   * @returns {Promise<Object>} Created payslip record
   */
  async createPayslip(payslipData, createdBy) {
    const {
      user_id, payroll_id, attendance_period_id, base_salary, attendance_days,
      total_working_days, prorated_salary, overtime_hours, overtime_rate,
      overtime_amount, total_reimbursements, gross_pay, deductions, net_pay
    } = payslipData;
    
    const query = `
      INSERT INTO payslips 
      (user_id, payroll_id, attendance_period_id, base_salary, attendance_days,
       total_working_days, prorated_salary, overtime_hours, overtime_rate,
       overtime_amount, total_reimbursements, gross_pay, deductions, net_pay, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, user_id, payroll_id, attendance_period_id, base_salary, attendance_days,
                total_working_days, prorated_salary, overtime_hours, overtime_rate,
                overtime_amount, total_reimbursements, gross_pay, deductions, net_pay, generated_at
    `;
    
    try {
      const result = await pool.query(query, [
        user_id, payroll_id, attendance_period_id, base_salary, attendance_days,
        total_working_days, prorated_salary, overtime_hours, overtime_rate,
        overtime_amount, total_reimbursements, gross_pay, deductions, net_pay, createdBy
      ]);
      
      const payslip = result.rows[0];
      // Convert decimal fields to numbers
      const decimalFields = [
        'base_salary', 'prorated_salary', 'overtime_hours', 'overtime_rate',
        'overtime_amount', 'total_reimbursements', 'gross_pay', 'deductions', 'net_pay'
      ];
      
      decimalFields.forEach(field => {
        if (payslip[field] !== null) {
          payslip[field] = parseFloat(payslip[field]);
        }
      });
      
      return payslip;
    } catch (error) {
      logger.error('Failed to create payslip', {
        payslipData,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payslip for user in period
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object|null>} Payslip record or null
   */
  async getPayslipByUserAndPeriod(userId, periodId) {
    const query = `
      SELECT ps.*, u.full_name, u.username, u.email,
             ap.name as period_name, ap.start_date, ap.end_date
      FROM payslips ps
      JOIN users u ON ps.user_id = u.id
      JOIN attendance_periods ap ON ps.attendance_period_id = ap.id
      WHERE ps.user_id = $1 AND ps.attendance_period_id = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, periodId]);
      const payslip = result.rows[0];
      
      if (payslip) {
        // Convert decimal fields to numbers
        const decimalFields = [
          'base_salary', 'prorated_salary', 'overtime_hours', 'overtime_rate',
          'overtime_amount', 'total_reimbursements', 'gross_pay', 'deductions', 'net_pay'
        ];
        
        decimalFields.forEach(field => {
          if (payslip[field] !== null) {
            payslip[field] = parseFloat(payslip[field]);
          }
        });
      }
      
      return payslip || null;
    } catch (error) {
      logger.error('Failed to get payslip by user and period', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all payslips for a payroll
   * @param {number} payrollId - Payroll ID
   * @returns {Promise<Array>} List of payslips
   */
  async getPayslipsByPayroll(payrollId) {
    const query = `
      SELECT ps.*, u.full_name, u.username, u.email
      FROM payslips ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.payroll_id = $1
      ORDER BY u.full_name ASC
    `;
    
    try {
      const result = await pool.query(query, [payrollId]);
      
      return result.rows.map(payslip => {
        // Convert decimal fields to numbers
        const decimalFields = [
          'base_salary', 'prorated_salary', 'overtime_hours', 'overtime_rate',
          'overtime_amount', 'total_reimbursements', 'gross_pay', 'deductions', 'net_pay'
        ];
        
        decimalFields.forEach(field => {
          if (payslip[field] !== null) {
            payslip[field] = parseFloat(payslip[field]);
          }
        });
        
        return payslip;
      });
    } catch (error) {
      logger.error('Failed to get payslips by payroll', {
        payrollId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payroll summary with payslip totals
   * @param {number} payrollId - Payroll ID
   * @returns {Promise<Object>} Payroll summary
   */
  async getPayrollSummary(payrollId) {
    const query = `
      SELECT 
        p.id, p.attendance_period_id, p.processed_at, p.total_employees, p.total_amount, p.status, p.notes,
        ap.name as period_name, ap.start_date, ap.end_date,
        COUNT(ps.id) as actual_payslips,
        COALESCE(SUM(ps.net_pay), 0) as calculated_total,
        COALESCE(AVG(ps.net_pay), 0) as average_net_pay,
        COALESCE(SUM(ps.attendance_days), 0) as total_attendance_days,
        COALESCE(SUM(ps.overtime_hours), 0) as total_overtime_hours,
        COALESCE(SUM(ps.total_reimbursements), 0) as total_reimbursements_paid
      FROM payrolls p
      JOIN attendance_periods ap ON p.attendance_period_id = ap.id
      LEFT JOIN payslips ps ON p.id = ps.payroll_id
      WHERE p.id = $1
      GROUP BY p.id, ap.name, ap.start_date, ap.end_date
    `;
    
    try {
      const result = await pool.query(query, [payrollId]);
      const summary = result.rows[0];
      
      if (summary) {
        // Convert decimal fields to numbers
        const decimalFields = [
          'total_amount', 'calculated_total', 'average_net_pay', 
          'total_overtime_hours', 'total_reimbursements_paid'
        ];
        
        decimalFields.forEach(field => {
          if (summary[field] !== null) {
            summary[field] = parseFloat(summary[field]);
          }
        });
      }
      
      return summary || null;
    } catch (error) {
      logger.error('Failed to get payroll summary', {
        payrollId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all payrolls
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of payrolls
   */
  async listPayrolls(options = {}) {
    const { limit = 20, offset = 0 } = options;
    
    const query = `
      SELECT p.id, p.attendance_period_id, p.processed_at, p.total_employees, p.total_amount, p.status,
             ap.name as period_name, ap.start_date, ap.end_date
      FROM payrolls p
      JOIN attendance_periods ap ON p.attendance_period_id = ap.id
      ORDER BY p.processed_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    try {
      const result = await pool.query(query, [limit, offset]);
      
      return result.rows.map(payroll => ({
        ...payroll,
        total_amount: parseFloat(payroll.total_amount)
      }));
    } catch (error) {
      logger.error('Failed to list payrolls', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if payslip exists for user in payroll
   * @param {number} userId - User ID
   * @param {number} payrollId - Payroll ID
   * @returns {Promise<boolean>} True if payslip exists
   */
  async payslipExists(userId, payrollId) {
    const query = `
      SELECT id FROM payslips 
      WHERE user_id = $1 AND payroll_id = $2
    `;
    
    try {
      const result = await pool.query(query, [userId, payrollId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check payslip existence', {
        userId,
        payrollId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PayrollRepository(); 