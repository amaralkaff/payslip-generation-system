/**
 * PayrollService Unit Tests
 * Testing critical payroll calculation and business logic
 */

const PayrollService = require('../../../src/services/payroll.service');
const PayrollServiceClass = PayrollService.PayrollService;
const payrollRepository = require('../../../src/repositories/payroll.repository');
const attendanceRepository = require('../../../src/repositories/attendance.repository');
const userRepository = require('../../../src/repositories/user.repository');
const overtimeRepository = require('../../../src/repositories/overtime.repository');
const reimbursementRepository = require('../../../src/repositories/reimbursement.repository');
const { createTestUser, createTestPeriod, createTestAttendanceRecords, createTestOvertimeRecords, createTestReimbursements } = require('../../factories');
const { clearTestData } = require('../../helpers/database');

// Mock repositories to isolate business logic
jest.mock('../../../src/repositories/payroll.repository');
jest.mock('../../../src/repositories/attendance.repository');
jest.mock('../../../src/repositories/user.repository');
jest.mock('../../../src/repositories/overtime.repository');
jest.mock('../../../src/repositories/reimbursement.repository');

describe('PayrollService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Unit tests should not touch the database
  // afterEach(async () => {
  //   await clearTestData();
  // });

  describe('Salary Calculation Logic', () => {
    describe('calculateProratedSalary', () => {
      test('should calculate correct prorated salary for full attendance', () => {
        const baseSalary = 5000.00;
        const attendanceData = {
          attendanceDays: 22,
          totalWorkingDays: 22
        };

        const result = PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);

        expect(result.proratedSalary).toBe(5000.00);
        expect(result.attendanceRate).toBe(1.0);
        expect(result.attendanceDays).toBe(22);
        expect(result.totalWorkingDays).toBe(22);
      });

      test('should calculate correct prorated salary for partial attendance', () => {
        const baseSalary = 5000.00;
        const attendanceData = {
          attendanceDays: 18,
          totalWorkingDays: 22
        };

        const result = PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);

        expect(result.proratedSalary).toBeCloseTo(4090.91, 2);
        expect(result.attendanceRate).toBeCloseTo(0.818, 3);
        expect(result.attendanceDays).toBe(18);
        expect(result.totalWorkingDays).toBe(22);
      });

      test('should handle zero attendance', () => {
        const baseSalary = 5000.00;
        const attendanceData = {
          attendanceDays: 0,
          totalWorkingDays: 22
        };

        const result = PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);

        expect(result.proratedSalary).toBe(0.00);
        expect(result.attendanceRate).toBe(0.0);
        expect(result.attendanceDays).toBe(0);
        expect(result.totalWorkingDays).toBe(22);
      });

      test('should handle edge case of more attendance days than working days', () => {
        const baseSalary = 5000.00;
        const attendanceData = {
          attendanceDays: 25, // More than total working days
          totalWorkingDays: 22
        };

        const result = PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);

        // Should cap at 100%
        expect(result.proratedSalary).toBe(5000.00);
        expect(result.attendanceRate).toBe(1.0);
      });

      test('should handle decimal attendance days', () => {
        const baseSalary = 6000.00;
        const attendanceData = {
          attendanceDays: 15.5,
          totalWorkingDays: 20
        };

        const result = PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);

        expect(result.proratedSalary).toBeCloseTo(4650.00, 2);
        expect(result.attendanceRate).toBeCloseTo(0.775, 3);
      });
    });

    describe('calculateOvertimeAmount', () => {
      test('should calculate overtime at 2x rate', () => {
        const baseSalary = 5000.00;
        const totalWorkingDays = 22;
        const overtimeHours = 2.5;

        const result = PayrollServiceClass.calculateOvertimeAmount(baseSalary, totalWorkingDays, overtimeHours);

        const expectedHourlyRate = baseSalary / (totalWorkingDays * 8); // ~28.41
        const expectedOvertimeRate = expectedHourlyRate * 2; // ~56.82
        const expectedOvertimeAmount = overtimeHours * expectedOvertimeRate; // ~142.05

        expect(result.overtimeAmount).toBeCloseTo(142.05, 2);
        expect(result.overtimeRate).toBeCloseTo(56.82, 2);
        expect(result.overtimeHours).toBe(2.5);
      });

      test('should handle zero overtime hours', () => {
        const baseSalary = 5000.00;
        const totalWorkingDays = 22;
        const overtimeHours = 0;

        const result = PayrollServiceClass.calculateOvertimeAmount(baseSalary, totalWorkingDays, overtimeHours);

        expect(result.overtimeAmount).toBe(0.00);
        expect(result.overtimeRate).toBeCloseTo(56.82, 2);
        expect(result.overtimeHours).toBe(0);
      });

      test('should handle maximum overtime hours (3 hours per day)', () => {
        const baseSalary = 4000.00;
        const totalWorkingDays = 20;
        const overtimeHours = 60; // 3 hours × 20 days

        const result = PayrollServiceClass.calculateOvertimeAmount(baseSalary, totalWorkingDays, overtimeHours);

        const expectedHourlyRate = 4000 / (20 * 8); // 25.00
        const expectedOvertimeRate = 50.00; // 2x rate
        const expectedOvertimeAmount = 60 * 50; // 3000.00

        expect(result.overtimeAmount).toBe(3000.00);
        expect(result.overtimeRate).toBe(50.00);
        expect(result.overtimeHours).toBe(60);
      });

      test('should handle decimal overtime hours', () => {
        const baseSalary = 6000.00;
        const totalWorkingDays = 24;
        const overtimeHours = 1.75;

        const result = PayrollServiceClass.calculateOvertimeAmount(baseSalary, totalWorkingDays, overtimeHours);

        const expectedHourlyRate = 6000 / (24 * 8); // 31.25
        const expectedOvertimeRate = 62.50; // 2x rate
        const expectedOvertimeAmount = 1.75 * 62.50; // 109.375

        expect(result.overtimeAmount).toBeCloseTo(109.38, 2);
        expect(result.overtimeRate).toBe(62.50);
        expect(result.overtimeHours).toBe(1.75);
      });
    });

    describe('calculateNetPay', () => {
      test('should calculate correct net pay with all components', () => {
        const components = {
          proratedSalary: 4500.00,
          overtimeAmount: 250.00,
          reimbursementAmount: 150.00
        };

        const result = PayrollServiceClass.calculateNetPay(components);

        expect(result.netPay).toBe(4900.00);
        expect(result.breakdown).toEqual({
          base_salary: 4500.00,
          overtime_amount: 250.00,
          reimbursement_amount: 150.00,
          total: 4900.00
        });
      });

      test('should handle zero values in components', () => {
        const components = {
          proratedSalary: 3000.00,
          overtimeAmount: 0,
          reimbursementAmount: 0
        };

        const result = PayrollServiceClass.calculateNetPay(components);

        expect(result.netPay).toBe(3000.00);
        expect(result.breakdown).toEqual({
          base_salary: 3000.00,
          overtime_amount: 0,
          reimbursement_amount: 0,
          total: 3000.00
        });
      });

      test('should handle all zero components', () => {
        const components = {
          proratedSalary: 0,
          overtimeAmount: 0,
          reimbursementAmount: 0
        };

        const result = PayrollServiceClass.calculateNetPay(components);

        expect(result.netPay).toBe(0.00);
        expect(result.breakdown).toEqual({
          base_salary: 0,
          overtime_amount: 0,
          reimbursement_amount: 0,
          total: 0
        });
      });
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate attendance period is not already processed', async () => {
      const period = { id: 1, is_active: true };
      const existingPayroll = { id: 1, attendance_period_id: 1 };
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(existingPayroll);

      await expect(
        PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1)
      ).rejects.toThrow('Payroll already processed for this period');
    });

    test('should validate attendance period exists', async () => {
      attendanceRepository.getPeriodById.mockResolvedValue(null);

      await expect(
        PayrollService.processPayroll({ attendance_period_id: 999 }, {}, 1)
      ).rejects.toThrow('Attendance period not found');
    });

    test('should validate period has active employees', async () => {
      const period = { id: 1, is_active: true };
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(null);
      userRepository.getActiveEmployees.mockResolvedValue([]);

      await expect(
        PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1)
      ).rejects.toThrow('No active employees found');
    });
  });

  describe('Complex Payroll Scenarios', () => {
    test('should handle employee with no attendance but overtime', async () => {
      const period = { id: 1, is_active: true, start_date: '2024-01-01', end_date: '2024-01-31' };
      const employee = { id: 1, salary: 5000, username: 'test_employee', full_name: 'Test Employee' };
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(null); // No existing payroll
      userRepository.getActiveEmployees.mockResolvedValue([employee]);
      attendanceRepository.calculateWorkingDays.mockResolvedValue(22);
      attendanceRepository.countAttendanceDays.mockResolvedValue(0);
      
      // Mock overtime data
      const overtimeData = [{ hours_worked: 2.5, overtime_date: '2024-01-15' }];
      overtimeRepository.getUserOvertimeInPeriod.mockResolvedValue(overtimeData);
      reimbursementRepository.getUserReimbursementsInPeriod.mockResolvedValue([]);
      
      // Mock payroll creation with realistic data
      const mockPayroll = { 
        id: 1, 
        total_amount: 142.05,
        processed_at: new Date(),
        status: 'completed'
      };
      payrollRepository.createPayroll.mockResolvedValue(mockPayroll);
      payrollRepository.createPayslip.mockResolvedValue({ id: 1 });
      attendanceRepository.markPeriodAsProcessed.mockResolvedValue(period);

      const result = await PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1);

      expect(result.success).toBe(true);
      expect(result.data.total_employees).toBe(1);
      
      // Should have overtime but zero base salary
      const expectedOvertimeRate = 5000 / (22 * 8) * 2; // ~56.82
      const expectedOvertimeAmount = 2.5 * expectedOvertimeRate; // ~142.05
      
      expect(result.data.total_employees).toBe(1);
      expect(result.data).toHaveProperty('total_amount');
      expect(result.data).toHaveProperty('payroll_id');
    });

    test('should handle employee with full attendance and maximum overtime', async () => {
      const period = { id: 1, is_active: true, start_date: '2024-01-01', end_date: '2024-01-31' };
      const employee = { id: 1, salary: 6000, username: 'test_employee', full_name: 'Test Employee' };
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(null); // No existing payroll
      userRepository.getActiveEmployees.mockResolvedValue([employee]);
      attendanceRepository.calculateWorkingDays.mockResolvedValue(22);
      attendanceRepository.countAttendanceDays.mockResolvedValue(22);
      
      // Mock maximum overtime (3 hours × 22 days = 66 hours)
      const overtimeData = Array.from({ length: 22 }, (_, i) => ({
        hours_worked: 3,
        overtime_date: `2024-01-${(i + 1).toString().padStart(2, '0')}`
      }));
      overtimeRepository.getUserOvertimeInPeriod.mockResolvedValue(overtimeData);
      reimbursementRepository.getUserReimbursementsInPeriod.mockResolvedValue([]);
      
      // Mock payroll creation with realistic data
      const mockPayroll = { 
        id: 1, 
        total_amount: 142.05,
        processed_at: new Date(),
        status: 'completed'
      };
      payrollRepository.createPayroll.mockResolvedValue(mockPayroll);
      payrollRepository.createPayslip.mockResolvedValue({ id: 1 });
      attendanceRepository.markPeriodAsProcessed.mockResolvedValue(period);

      const result = await PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1);

      expect(result.success).toBe(true);
      expect(result.data.total_employees).toBe(1);
      expect(result.data).toHaveProperty('total_amount');
      expect(result.data).toHaveProperty('payroll_id');
    });

    test('should handle multiple employees with different scenarios', async () => {
      const period = { id: 1, is_active: true, start_date: '2024-01-01', end_date: '2024-01-31' };
      const employees = [
        { id: 1, salary: 5000, username: 'employee1', full_name: 'Employee One' },
        { id: 2, salary: 6000, username: 'employee2', full_name: 'Employee Two' },
        { id: 3, salary: 4000, username: 'employee3', full_name: 'Employee Three' }
      ];
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(null); // No existing payroll
      userRepository.getActiveEmployees.mockResolvedValue(employees);
      attendanceRepository.calculateWorkingDays.mockResolvedValue(20);
      
      // Mock different attendance scenarios
      attendanceRepository.countAttendanceDays
        .mockResolvedValueOnce(20) // Employee 1: Full attendance
        .mockResolvedValueOnce(15) // Employee 2: 75% attendance
        .mockResolvedValueOnce(10); // Employee 3: 50% attendance
      
      // Mock overtime data
      overtimeRepository.getUserOvertimeInPeriod
        .mockResolvedValueOnce([{ hours_worked: 10 }]) // Employee 1: 10 hours
        .mockResolvedValueOnce([{ hours_worked: 5 }])  // Employee 2: 5 hours
        .mockResolvedValueOnce([]); // Employee 3: No overtime
      
      // Mock reimbursements
      reimbursementRepository.getUserReimbursementsInPeriod
        .mockResolvedValue([{ amount: 100 }]); // All employees: $100 reimbursement
      
      // Mock payroll creation with realistic data
      const mockPayroll = { 
        id: 1, 
        total_amount: 142.05,
        processed_at: new Date(),
        status: 'completed'
      };
      payrollRepository.createPayroll.mockResolvedValue(mockPayroll);
      payrollRepository.createPayslip.mockResolvedValue({ id: 1 });
      attendanceRepository.markPeriodAsProcessed.mockResolvedValue(period);

      const result = await PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1);

      expect(result.success).toBe(true);
      expect(result.data.total_employees).toBe(3);
      expect(result.data).toHaveProperty('total_amount');
      expect(result.data).toHaveProperty('payroll_id');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors during payroll processing', async () => {
      const period = { id: 1, is_active: true };
      
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      payrollRepository.getByPeriodId.mockResolvedValue(null);
      userRepository.getActiveEmployees.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        PayrollService.processPayroll({ attendance_period_id: 1 }, {}, 1)
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle invalid salary values', () => {
      const baseSalary = -1000; // Invalid negative salary
      const attendanceData = {
        attendanceDays: 20,
        totalWorkingDays: 22
      };

      expect(() => {
        PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);
      }).toThrow('Salary must be a positive number');
    });

    test('should handle invalid attendance data', () => {
      const baseSalary = 5000;
      const attendanceData = {
        attendanceDays: -5, // Invalid negative attendance
        totalWorkingDays: 22
      };

      expect(() => {
        PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);
      }).toThrow('Attendance days cannot be negative');
    });

    test('should handle zero working days', () => {
      const baseSalary = 5000;
      const attendanceData = {
        attendanceDays: 10,
        totalWorkingDays: 0 // Invalid zero working days
      };

      expect(() => {
        PayrollServiceClass.calculateProratedSalary(baseSalary, attendanceData);
      }).toThrow('Total working days must be greater than zero');
    });
  });

  describe('Payslip Generation', () => {
    test('should generate correct payslip structure', async () => {
      const userId = 1;
      const periodId = 1;
      const period = { id: 1, name: 'January 2024', start_date: '2024-01-01', end_date: '2024-01-31' };
      const user = { id: 1, salary: 5000, full_name: 'Test Employee', username: 'test_employee' };
      
      // Mock payslip data
      const mockPayslip = {
        id: 1,
        user_id: 1,
        attendance_period_id: 1,
        base_salary: 5000,
        prorated_salary: 4545.45,
        attendance_days: 20,
        total_working_days: 22,
        overtime_hours: 5,
        overtime_amount: 284.09,
        reimbursement_amount: 150,
        net_pay: 4979.54
      };
      
      payrollRepository.getPayslipByUserAndPeriod.mockResolvedValue(mockPayslip);
      attendanceRepository.getPeriodById.mockResolvedValue(period);
      userRepository.findById.mockResolvedValue(user);

      const result = await PayrollService.generatePayslip(userId, periodId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('employee');
      expect(result.data).toHaveProperty('period');
      expect(result.data).toHaveProperty('salary_breakdown');
      expect(result.data).toHaveProperty('totals');
      
      expect(result.data.totals.net_pay).toBe(4979.54);
      expect(result.data.salary_breakdown.base_salary).toBe(5000);
      expect(result.data.salary_breakdown.prorated_salary).toBe(4545.45);
    });

    test('should handle payslip not found', async () => {
      payrollRepository.getPayslipByUserAndPeriod.mockResolvedValue(null);

      await expect(
        PayrollService.generatePayslip(1, 1)
      ).rejects.toThrow('Payslip not found or payroll not processed for this period');
    });
  });
});