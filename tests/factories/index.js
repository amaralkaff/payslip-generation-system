/**
 * Test Data Factories
 * Utilities for creating test data with realistic values
 */

const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const { query } = require('../helpers/database');

/**
 * Create a test user
 */
async function createTestUser(overrides = {}) {
  const userData = {
    username: faker.internet.userName().toLowerCase(),
    password: 'password123', // Plain password for testing
    role: 'employee',
    salary: faker.number.float({ min: 3000, max: 8000, precision: 0.01 }),
    full_name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    is_active: true,
    ...overrides
  };

  // Hash password
  const password_hash = await bcrypt.hash(userData.password, 10);
  
  try {
    // Check if admin user is being created and already exists
    if (userData.username === 'admin') {
      const existingAdmin = await query('SELECT * FROM users WHERE username = $1', ['admin']);
      if (existingAdmin.rows.length > 0) {
        const adminUser = existingAdmin.rows[0];
        adminUser.password = userData.password;
        return adminUser;
      }
    }

    const result = await query(`
      INSERT INTO users (username, password_hash, role, salary, full_name, email, is_active, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, username, role, salary, full_name, email, is_active, created_at, updated_at
    `, [
      userData.username,
      password_hash,
      userData.role,
      userData.salary,
      userData.full_name,
      userData.email,
      userData.is_active,
      1, // All users created by admin
      1  // All users updated by admin
    ]);

    const user = result.rows[0];
    // Add plain password for test login
    user.password = userData.password;
    return user;
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      // Try with a different username
      userData.username = `${userData.username}_${Date.now()}`;
      userData.email = `test_${Date.now()}_${userData.email}`;
      return createTestUser(userData);
    }
    throw error;
  }
}

/**
 * Create multiple test users
 */
async function createMultipleTestUsers(count, overrides = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const userOverrides = {
      ...overrides,
      username: `test_user_${Date.now()}_${i}`,
      email: `test.user.${Date.now()}.${i}@company.com`
    };
    
    const user = await createTestUser(userOverrides);
    users.push(user);
  }
  return users;
}

/**
 * Create test attendance period
 */
async function createTestPeriod(overrides = {}) {
  const start = faker.date.recent({ days: 60 });
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1); // One month period
  
  const periodData = {
    name: `${faker.date.month()} ${start.getFullYear()} Period`,
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
    is_active: false,
    payroll_processed: false,
    ...overrides
  };

  try {
    const result = await query(`
      INSERT INTO attendance_periods (name, start_date, end_date, is_active, payroll_processed, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, start_date, end_date, is_active, payroll_processed, created_at, updated_at
    `, [
      periodData.name,
      periodData.start_date,
      periodData.end_date,
      periodData.is_active,
      periodData.payroll_processed,
      1, // created_by admin
      1  // updated_by admin
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Create test attendance records for a user
 */
async function createTestAttendanceRecords(userId, periodId, count = 10) {
  const period = await query('SELECT * FROM attendance_periods WHERE id = $1', [periodId]);
  if (period.rows.length === 0) {
    throw new Error('Period not found');
  }

  const periodData = period.rows[0];
  const startDate = new Date(periodData.start_date);
  const endDate = new Date(periodData.end_date);
  
  const records = [];
  let currentDate = new Date(startDate);
  let recordsCreated = 0;

  while (currentDate <= endDate && recordsCreated < count) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const attendanceDate = currentDate.toISOString().split('T')[0];
      
      // Random check-in time between 8:00 and 9:30 AM
      const checkInHour = faker.number.int({ min: 8, max: 9 });
      const checkInMinute = faker.number.int({ min: 0, max: 59 });
      const checkInTime = `${checkInHour.toString().padStart(2, '0')}:${checkInMinute.toString().padStart(2, '0')}`;

      try {
        const result = await query(`
          INSERT INTO attendance_records (user_id, attendance_period_id, attendance_date, check_in_time, notes, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, user_id, attendance_period_id, attendance_date, check_in_time, notes, created_at
        `, [
          userId,
          periodId,
          attendanceDate,
          checkInTime,
          faker.lorem.sentence({ min: 3, max: 8 }),
          userId,
          userId
        ]);

        records.push(result.rows[0]);
        recordsCreated++;
      } catch (error) {
        // Skip if attendance already exists for this date
        if (error.code !== '23505') {
          throw error;
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return records;
}

/**
 * Create test overtime records for a user
 */
async function createTestOvertimeRecords(userId, periodId, count = 5) {
  const period = await query('SELECT * FROM attendance_periods WHERE id = $1', [periodId]);
  if (period.rows.length === 0) {
    throw new Error('Period not found');
  }

  const periodData = period.rows[0];
  const startDate = new Date(periodData.start_date);
  const endDate = new Date(periodData.end_date);
  
  const records = [];
  const usedDates = new Set();

  for (let i = 0; i < count; i++) {
    let overtimeDate;
    let attempts = 0;
    
    // Find a unique date within the period
    do {
      const randomDays = faker.number.int({ 
        min: 0, 
        max: Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24))
      });
      
      const date = new Date(startDate);
      date.setDate(date.getDate() + randomDays);
      overtimeDate = date.toISOString().split('T')[0];
      attempts++;
    } while (usedDates.has(overtimeDate) && attempts < 50);

    if (attempts >= 50) break; // Avoid infinite loop

    usedDates.add(overtimeDate);

    // Random overtime hours (0.5 to 3.0 hours, max allowed)
    const hoursWorked = faker.number.float({ min: 0.5, max: 3.0, precision: 0.1 });

    try {
      const result = await query(`
        INSERT INTO overtime_records (user_id, attendance_period_id, overtime_date, hours_worked, description, status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, attendance_period_id, overtime_date, hours_worked, description, status, created_at
      `, [
        userId,
        periodId,
        overtimeDate,
        hoursWorked,
        faker.lorem.sentence({ min: 5, max: 15 }),
        'approved',
        userId,
        userId
      ]);

      records.push(result.rows[0]);
    } catch (error) {
      // Skip if overtime already exists for this date
      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  return records;
}

/**
 * Create test reimbursement records for a user
 */
async function createTestReimbursements(userId, periodId, count = 3) {
  const records = [];
  
  const categories = ['travel', 'meals', 'accommodation', 'equipment', 'training', 'communication', 'other'];

  for (let i = 0; i < count; i++) {
    const amount = faker.number.float({ min: 50, max: 500, precision: 0.01 });
    const category = faker.helpers.arrayElement(categories);
    
    try {
      const result = await query(`
        INSERT INTO reimbursements (user_id, attendance_period_id, amount, description, category, status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, attendance_period_id, amount, description, category, status, created_at
      `, [
        userId,
        periodId,
        amount,
        faker.lorem.sentence({ min: 8, max: 20 }),
        category,
        'approved',
        userId,
        userId
      ]);

      records.push(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  return records;
}

/**
 * Create test payroll
 */
async function createTestPayroll(periodId, processedBy, overrides = {}) {
  const payrollData = {
    attendance_period_id: periodId,
    total_employees: 0,
    total_base_salary: 0,
    total_overtime_amount: 0,
    total_reimbursement_amount: 0,
    total_amount: 0,
    processed_by: processedBy,
    ...overrides
  };

  try {
    const result = await query(`
      INSERT INTO payrolls (attendance_period_id, total_employees, total_base_salary, total_overtime_amount, total_reimbursement_amount, total_amount, processed_by, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, attendance_period_id, total_employees, total_base_salary, total_overtime_amount, total_reimbursement_amount, total_amount, processed_by, created_at
    `, [
      payrollData.attendance_period_id,
      payrollData.total_employees,
      payrollData.total_base_salary,
      payrollData.total_overtime_amount,
      payrollData.total_reimbursement_amount,
      payrollData.total_amount,
      payrollData.processed_by,
      processedBy,
      processedBy
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Login user and return JWT token for testing
 */
async function loginUser(user) {
  const request = require('supertest');
  const app = require('../../src/server');

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      username: user.username,
      password: user.password || 'password123'
    });

  if (response.status !== 200) {
    console.error('Login request failed:', {
      username: user.username,
      status: response.status,
      body: response.body
    });
    throw new Error(`Login failed for user ${user.username}: ${response.body.error?.message}`);
  }

  return response.body.data.token;
}

/**
 * Create complete test scenario (user + period + data)
 */
async function createTestScenario(options = {}) {
  const {
    userCount = 1,
    userRole = 'employee',
    attendanceCount = 15,
    overtimeCount = 5,
    reimbursementCount = 2,
    periodActive = false
  } = options;

  // Create users
  const users = await createMultipleTestUsers(userCount, { role: userRole });
  
  // Create period
  const period = await createTestPeriod({ is_active: periodActive });
  
  // Create data for each user
  for (const user of users) {
    await createTestAttendanceRecords(user.id, period.id, attendanceCount);
    await createTestOvertimeRecords(user.id, period.id, overtimeCount);
    await createTestReimbursements(user.id, period.id, reimbursementCount);
  }

  return {
    users,
    period,
    adminToken: await loginUser(users.find(u => u.role === 'admin') || users[0])
  };
}

module.exports = {
  createTestUser,
  createMultipleTestUsers,
  createTestPeriod,
  createTestAttendanceRecords,
  createTestOvertimeRecords,
  createTestReimbursements,
  createTestPayroll,
  loginUser,
  createTestScenario
};