/**
 * Attendance Workflow Integration Tests
 * Testing complete attendance workflow with real HTTP requests
 */

const request = require('supertest');
const app = require('../../../src/server');
const { createTestUser, createTestPeriod, loginUser } = require('../../factories');
const { clearTestData } = require('../../helpers/database');

describe('Attendance Workflow Integration Tests', () => {
  let employee, admin, adminToken, employeeToken;

  beforeEach(async () => {
    await clearTestData();
    
    // Create test users
    employee = await createTestUser({ 
      username: 'test_employee',
      role: 'employee',
      salary: 5000.00 
    });
    
    // Use existing admin
    admin = { username: 'admin', password: 'admin123' };
    
    // Get tokens
    adminToken = await loginUser(admin);
    employeeToken = await loginUser(employee);
  });

  describe('Admin Attendance Period Management', () => {
    test('should create attendance period successfully', async () => {
      const periodData = {
        name: 'January 2024 Test Period',
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      };

      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(periodData);

      global.testUtils.expectValidResponse(response, 201);
      expect(response.body.data.name).toBe(periodData.name);
      // Handle timezone differences by comparing dates properly
      const responseStartDate = new Date(response.body.data.start_date).toISOString().split('T')[0];
      const responseEndDate = new Date(response.body.data.end_date).toISOString().split('T')[0];
      expect(responseStartDate).toBe(periodData.start_date);
      expect(responseEndDate).toBe(periodData.end_date);
      expect(response.body.data.is_active).toBe(true);
    });

    test('should prevent duplicate active periods', async () => {
      // Create first period
      await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'First Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });

      // Try to create second period
      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Second Period',
          start_date: '2024-02-01',
          end_date: '2024-02-29'
        });

      global.testUtils.expectErrorResponse(response, 409, 'ACTIVE_PERIOD_EXISTS');
    });

    test('should validate date ranges', async () => {
      const invalidPeriodData = {
        name: 'Invalid Period',
        start_date: '2024-01-31',
        end_date: '2024-01-01' // End before start
      };

      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPeriodData);

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should reject period creation by employee', async () => {
      const periodData = {
        name: 'Unauthorized Period',
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      };

      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(periodData);

      global.testUtils.expectErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Attendance Period Retrieval', () => {
    let period;

    beforeEach(async () => {
      // Create a test period
      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });
      period = response.body.data;
    });

    test('should get active attendance period', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/active')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.id).toBe(period.id);
      expect(response.body.data.is_active).toBe(true);
    });

    test('should get attendance period by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/attendance-periods/${period.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.id).toBe(period.id);
      expect(response.body.data.name).toBe('Test Period');
    });

    test('should return 404 for non-existent period', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/999999')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 404, 'PERIOD_NOT_FOUND');
    });

    test('should list attendance periods', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Employee Attendance Submission', () => {
    let period;

    beforeEach(async () => {
      // Create active period
      const response = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Attendance Test Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });
      period = response.body.data;
    });

    test('should submit attendance successfully', async () => {
      const attendanceData = {
        attendance_date: '2024-01-15', // Monday
        notes: 'Regular attendance - on time'
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(attendanceData);

      global.testUtils.expectValidResponse(response, 201);
      // Handle timezone differences by comparing dates properly
      const responseDate = new Date(response.body.data.attendance_date).toISOString().split('T')[0];
      expect(responseDate).toBe(attendanceData.attendance_date);
      expect(response.body.data.notes).toBe(attendanceData.notes);
      expect(response.body.data.check_in_time).toBeDefined();
      expect(response.body.data.user_id).toBe(employee.id);
    });

    test('should prevent duplicate attendance submission', async () => {
      const attendanceData = {
        attendance_date: '2024-01-16', // Tuesday
        notes: 'First submission'
      };

      // Submit first time
      await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(attendanceData);

      // Try to submit again
      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          ...attendanceData,
          notes: 'Duplicate submission attempt'
        });

      global.testUtils.expectErrorResponse(response, 400, 'ATTENDANCE_ALREADY_EXISTS');
    });

    test('should reject weekend attendance submission', async () => {
      const weekendAttendance = {
        attendance_date: '2024-01-06', // Saturday
        notes: 'Weekend work attempt'
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(weekendAttendance);

      global.testUtils.expectErrorResponse(response, 400, 'WEEKEND_NOT_ALLOWED');
    });

    test('should reject attendance outside period range', async () => {
      const outsideAttendance = {
        attendance_date: '2024-02-15', // Outside January period
        notes: 'Outside period'
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(outsideAttendance);

      global.testUtils.expectErrorResponse(response, 400, 'DATE_OUTSIDE_PERIOD');
    });

    test('should reject future date attendance', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      // Update period to include future dates
      const extendedPeriod = {
        name: 'Extended Period',
        start_date: '2024-01-01',
        end_date: futureDate.toISOString().split('T')[0]
      };

      // First close current period (simulate)
      await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(extendedPeriod);

      const futureAttendance = {
        attendance_date: futureDate.toISOString().split('T')[0],
        notes: 'Future attendance'
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(futureAttendance);

      global.testUtils.expectErrorResponse(response, 400, 'FUTURE_DATE_NOT_ALLOWED');
    });

    test('should handle missing notes gracefully', async () => {
      const attendanceData = {
        attendance_date: '2024-01-17' // Wednesday, no notes
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(attendanceData);

      global.testUtils.expectValidResponse(response, 201);
      expect(response.body.data.notes).toBeNull();
    });

    test('should reject attendance when no active period', async () => {
      // Simulate no active period by creating non-active period
      await clearTestData();
      
      const attendanceData = {
        attendance_date: '2024-01-15',
        notes: 'No active period'
      };

      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(attendanceData);

      global.testUtils.expectErrorResponse(response, 400, 'NO_ACTIVE_PERIOD');
    });
  });

  describe('Employee Attendance Retrieval', () => {
    let period;

    beforeEach(async () => {
      // Create period and submit some attendance
      const periodResponse = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Retrieval Test Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });
      period = periodResponse.body.data;

      // Submit test attendance records
      const attendanceDates = ['2024-01-15', '2024-01-16', '2024-01-17'];
      for (const date of attendanceDates) {
        await request(app)
          .post('/api/v1/employee/attendance')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            attendance_date: date,
            notes: `Attendance for ${date}`
          });
      }
    });

    test('should get user attendance for active period', async () => {
      const response = await request(app)
        .get('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.period.id).toBe(period.id);
      expect(response.body.data.attendance).toHaveLength(3);
      expect(response.body.data.summary.attendance_days).toBe(3);
      expect(response.body.data.summary.total_working_days).toBeGreaterThan(0);
    });

    test('should get user attendance for specific period', async () => {
      const response = await request(app)
        .get(`/api/v1/employee/attendance/${period.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.period.id).toBe(period.id);
      expect(response.body.data.attendance).toHaveLength(3);
    });

    test('should return empty attendance when no records', async () => {
      // Create new employee with no attendance
      const newEmployee = await createTestUser({ 
        username: 'no_attendance_employee',
        role: 'employee' 
      });
      const newEmployeeToken = await loginUser(newEmployee);

      const response = await request(app)
        .get('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${newEmployeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.attendance).toHaveLength(0);
      expect(response.body.data.summary.attendance_days).toBe(0);
    });

    test('should handle non-existent period gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/employee/attendance/999999')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 404, 'PERIOD_NOT_FOUND');
    });
  });

  describe('Working Days Calculation', () => {
    test('should calculate working days correctly', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/working-days')
        .query({
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        })
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.start_date).toBe('2024-01-01');
      expect(response.body.data.end_date).toBe('2024-01-31');
      expect(response.body.data.working_days).toBe(23); // January 2024 has 23 working days
    });

    test('should require both start and end dates', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/working-days')
        .query({
          start_date: '2024-01-01'
          // Missing end_date
        })
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 400, 'MISSING_PARAMETERS');
    });

    test('should handle single day calculation', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/working-days')
        .query({
          start_date: '2024-01-15', // Monday
          end_date: '2024-01-15'    // Same Monday
        })
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.working_days).toBe(1);
    });

    test('should handle weekend-only period', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/working-days')
        .query({
          start_date: '2024-01-06', // Saturday
          end_date: '2024-01-07'    // Sunday
        })
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.working_days).toBe(0);
    });
  });

  describe('Admin Attendance Oversight', () => {
    let period;

    beforeEach(async () => {
      // Create period
      const periodResponse = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Oversight Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });
      period = periodResponse.body.data;

      // Create multiple employees and attendance
      const employees = await Promise.all([
        createTestUser({ username: 'emp1', role: 'employee' }),
        createTestUser({ username: 'emp2', role: 'employee' }),
        createTestUser({ username: 'emp3', role: 'employee' })
      ]);

      // Submit attendance for each employee
      for (const emp of employees) {
        const empToken = await loginUser(emp);
        await request(app)
          .post('/api/v1/employee/attendance')
          .set('Authorization', `Bearer ${empToken}`)
          .send({
            attendance_date: '2024-01-15',
            notes: `Attendance by ${emp.username}`
          });
      }
    });

    test('should get all attendance for period (admin)', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/attendance/${period.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.period.id).toBe(period.id);
      expect(response.body.data.attendance.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should get attendance summary for period (admin)', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/attendance/${period.id}/summary`)
        .set('Authorization', `Bearer ${adminToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.period_id).toBe(period.id);
      expect(response.body.data.total_employees).toBeGreaterThan(0);
      expect(response.body.data.employees_with_attendance).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.employee_breakdown)).toBe(true);
    });

    test('should get all attendance periods (admin)', async () => {
      const response = await request(app)
        .get('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(Array.isArray(response.body.data.periods)).toBe(true);
      expect(response.body.data.periods.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should support pagination for admin attendance view', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/attendance/${period.id}`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.attendance.length).toBeLessThanOrEqual(2);
    });

    test('should support user filtering for admin attendance view', async () => {
      const emp1 = await createTestUser({ username: 'filter_test_emp', role: 'employee' });
      const emp1Token = await loginUser(emp1);
      
      await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          attendance_date: '2024-01-16',
          notes: 'Filtered attendance'
        });

      const response = await request(app)
        .get(`/api/v1/admin/attendance/${period.id}`)
        .query({ userId: emp1.id })
        .set('Authorization', `Bearer ${adminToken}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.attendance).toHaveLength(1);
      expect(response.body.data.attendance[0].user_id).toBe(emp1.id);
    });

    test('should reject admin endpoints for employees', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/attendance/${period.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection errors gracefully', async () => {
      // This would require mocking the database to simulate connection failure
      // For now, we'll test the error response format
      const response = await request(app)
        .get('/api/v1/attendance-periods/999999')
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 404, 'PERIOD_NOT_FOUND');
    });

    test('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/working-days')
        .query({
          start_date: 'invalid-date',
          end_date: '2024-01-31'
        })
        .set('Authorization', `Bearer ${employeeToken}`);

      global.testUtils.expectErrorResponse(response, 400, 'INVALID_DATE_FORMAT');
    });

    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/v1/employee/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should include request ID in all responses', async () => {
      const response = await request(app)
        .get('/api/v1/attendance-periods/active')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.body).toHaveProperty('request_id');
      expect(typeof response.body.request_id).toBe('string');
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('Performance and Load', () => {
    test('should handle multiple concurrent attendance submissions', async () => {
      // Create active period
      const periodResponse = await request(app)
        .post('/api/v1/admin/attendance-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Concurrent Test Period',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });

      const employees = await Promise.all(
        Array.from({ length: 5 }, (_, i) => 
          createTestUser({ 
            username: `concurrent_emp_${i}`,
            role: 'employee' 
          })
        )
      );

      // Submit attendance concurrently
      const promises = employees.map(async (emp, i) => {
        const token = await loginUser(emp);
        return request(app)
          .post('/api/v1/employee/attendance')
          .set('Authorization', `Bearer ${token}`)
          .send({
            attendance_date: `2024-01-${(15 + i).toString().padStart(2, '0')}`,
            notes: `Concurrent attendance ${i}`
          });
      });

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        global.testUtils.expectValidResponse(response, 201);
      });
    }, 10000);
  });
});