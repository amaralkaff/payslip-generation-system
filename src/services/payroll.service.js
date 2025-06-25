const payrollRepository = require('../repositories/payroll.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const overtimeRepository = require('../repositories/overtime.repository');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

/**
 * Payroll Service
 * Business logic for payroll processing and payslip generation
 */

class PayrollService {
  /**
   * Process payroll for attendance period
   * @param {Object} payrollData - Payroll processing data
   * @param {Object} requestContext - Request context for logging
   * @param {number} adminId - ID of admin processing payroll
   * @returns {Promise<Object>} Service result
   */
  async processPayroll(payrollData, requestContext = {}, adminId) {
    try {
      const { attendance_period_id, notes } = payrollData;

      // Get attendance period
      const period = await attendanceRepository.getPeriodById(attendance_period_id);
      if (!period) {
        throw new Error('Attendance period not found');
      }

      // Check if payroll already processed
      const existingPayroll = await payrollRepository.getByPeriodId(attendance_period_id);
      if (existingPayroll) {
        throw new Error('Payroll already processed for this period');
      }

      // Check if period is active
      if (!period.is_active) {
        throw new Error('Cannot process payroll for inactive period');
      }

      logger.business('PAYROLL_PROCESSING_STARTED', requestContext, {
        periodId: attendance_period_id,
        periodName: period.name,
        adminId
      });

      // Get all active employees
      const employees = await userRepository.getActiveEmployees();
      if (employees.length === 0) {
        throw new Error('No active employees found');
      }

      // Calculate working days in period
      const totalWorkingDays = await attendanceRepository.calculateWorkingDays(
        period.start_date,
        period.end_date
      );

      let totalAmount = 0;
      const payslipsData = [];

      // Process each employee
      for (const employee of employees) {
        const payslipData = await this.calculatePayslip(
          employee,
          period,
          totalWorkingDays
        );
        payslipsData.push(payslipData);
        totalAmount += payslipData.net_pay;
      }

      // Create payroll record
      const payroll = await payrollRepository.createPayroll({
        attendance_period_id,
        total_employees: employees.length,
        total_amount: totalAmount,
        notes
      }, adminId);

      // Create payslips for all employees
      for (const payslipData of payslipsData) {
        payslipData.payroll_id = payroll.id;
        await payrollRepository.createPayslip(payslipData, adminId);
      }

      // Mark attendance period as processed
      await attendanceRepository.markPeriodAsProcessed(attendance_period_id, adminId);

      logger.business('PAYROLL_PROCESSING_COMPLETED', requestContext, {
        payrollId: payroll.id,
        periodId: attendance_period_id,
        totalEmployees: employees.length,
        totalAmount,
        adminId
      });

      return {
        success: true,
        data: {
          payroll_id: payroll.id,
          attendance_period_id,
          total_employees: employees.length,
          total_amount: totalAmount,
          processed_at: payroll.processed_at,
          status: payroll.status
        }
      };
    } catch (error) {
      logger.error('Failed to process payroll', {
        payrollData,
        adminId,
        error: error.message,
        requestContext
      });
      throw error;
    }
  }

  /**
   * Calculate payslip for individual employee
   * @param {Object} employee - Employee data
   * @param {Object} period - Attendance period
   * @param {number} totalWorkingDays - Total working days in period
   * @returns {Promise<Object>} Payslip calculation
   * @private
   */
  async calculatePayslip(employee, period, totalWorkingDays) {
    try {
      // Get attendance data
      const attendanceDays = await attendanceRepository.countAttendanceDays(
        employee.id,
        period.id
      );

      // Get overtime data
      const totalOvertimeHours = await overtimeRepository.getTotalOvertimeHours(
        employee.id,
        period.id
      );

      // Get approved reimbursements
      const totalReimbursements = await reimbursementRepository.getTotalApprovedReimbursements(
        employee.id,
        period.id
      );

      // Calculate prorated salary
      const baseSalary = parseFloat(employee.salary) || 0;
      const proratedSalary = (attendanceDays / totalWorkingDays) * baseSalary;

      // Calculate overtime
      const hourlyRate = proratedSalary / (totalWorkingDays * 8); // 8 hours per day
      const overtimeRate = hourlyRate * 2; // 2x rate for overtime
      const overtimeAmount = totalOvertimeHours * overtimeRate;

      // Calculate totals
      const grossPay = proratedSalary + overtimeAmount;
      const deductions = 0; // No deductions for now
      const netPay = grossPay + totalReimbursements - deductions;

      return {
        user_id: employee.id,
        attendance_period_id: period.id,
        base_salary: baseSalary,
        attendance_days: attendanceDays,
        total_working_days: totalWorkingDays,
        prorated_salary: proratedSalary,
        overtime_hours: totalOvertimeHours,
        overtime_rate: overtimeRate,
        overtime_amount: overtimeAmount,
        total_reimbursements: totalReimbursements,
        gross_pay: grossPay,
        deductions,
        net_pay: netPay
      };
    } catch (error) {
      logger.error('Failed to calculate payslip', {
        employeeId: employee.id,
        periodId: period.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate payslip for employee
   * @param {number} userId - User ID
   * @param {number} periodId - Attendance period ID
   * @returns {Promise<Object>} Service result
   */
  async generatePayslip(userId, periodId) {
    try {
      // Check if payslip exists
      const payslip = await payrollRepository.getPayslipByUserAndPeriod(userId, periodId);
      if (!payslip) {
        throw new Error('Payslip not found or payroll not processed for this period');
      }

      // Get detailed breakdown data
      const attendance = await attendanceRepository.getUserAttendanceInPeriod(userId, periodId);
      const overtime = await overtimeRepository.getUserOvertimeInPeriod(userId, periodId);
      const reimbursements = await reimbursementRepository.getUserReimbursementsInPeriod(
        userId, 
        periodId
      );

      return {
        success: true,
        data: {
          employee: {
            id: payslip.user_id,
            full_name: payslip.full_name,
            username: payslip.username,
            email: payslip.email
          },
          period: {
            id: payslip.attendance_period_id,
            name: payslip.period_name,
            start_date: payslip.start_date,
            end_date: payslip.end_date
          },
          salary_breakdown: {
            base_salary: payslip.base_salary,
            total_working_days: payslip.total_working_days,
            attendance_days: payslip.attendance_days,
            prorated_salary: payslip.prorated_salary
          },
          overtime_breakdown: {
            total_hours: payslip.overtime_hours,
            overtime_rate: payslip.overtime_rate,
            overtime_amount: payslip.overtime_amount,
            overtime_records: overtime
          },
          reimbursements: reimbursements.filter(r => r.status === 'approved'),
          attendance_records: attendance,
          totals: {
            gross_pay: payslip.gross_pay,
            total_reimbursements: payslip.total_reimbursements,
            deductions: payslip.deductions,
            net_pay: payslip.net_pay
          },
          generated_at: payslip.generated_at
        }
      };
    } catch (error) {
      logger.error('Failed to generate payslip', {
        userId,
        periodId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payroll summary (Admin only)
   * @param {number} payrollId - Payroll ID
   * @returns {Promise<Object>} Service result
   */
  async getPayrollSummary(payrollId) {
    try {
      const summary = await payrollRepository.getPayrollSummary(payrollId);
      if (!summary) {
        throw new Error('Payroll not found');
      }

      const payslips = await payrollRepository.getPayslipsByPayroll(payrollId);

      return {
        success: true,
        data: {
          payroll: {
            id: summary.id,
            attendance_period: {
              id: summary.attendance_period_id,
              name: summary.period_name,
              start_date: summary.start_date,
              end_date: summary.end_date
            },
            processed_at: summary.processed_at,
            total_employees: summary.total_employees,
            total_amount: summary.total_amount,
            status: summary.status
          },
          employee_payslips: payslips.map(payslip => ({
            employee_id: payslip.user_id,
            employee_name: payslip.full_name,
            username: payslip.username,
            net_pay: payslip.net_pay,
            attendance_days: payslip.attendance_days,
            overtime_hours: payslip.overtime_hours,
            total_reimbursements: payslip.total_reimbursements
          })),
          summary: {
            total_employees: summary.actual_payslips,
            total_net_pay: summary.calculated_total,
            average_net_pay: summary.average_net_pay,
            total_attendance_days: summary.total_attendance_days,
            total_overtime_hours: summary.total_overtime_hours,
            total_reimbursements_paid: summary.total_reimbursements_paid
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get payroll summary', {
        payrollId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all payrolls (Admin only)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Service result
   */
  async listPayrolls(options = {}) {
    try {
      const payrolls = await payrollRepository.listPayrolls(options);
      
      return {
        success: true,
        data: payrolls
      };
    } catch (error) {
      logger.error('Failed to list payrolls', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get payroll by ID
   * @param {number} payrollId - Payroll ID
   * @returns {Promise<Object>} Service result
   */
  async getPayrollById(payrollId) {
    try {
      const payroll = await payrollRepository.getById(payrollId);
      if (!payroll) {
        throw new Error('Payroll not found');
      }

      return {
        success: true,
        data: payroll
      };
    } catch (error) {
      logger.error('Failed to get payroll by ID', {
        payrollId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PayrollService(); 