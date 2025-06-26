/**
 * Global Test Setup
 * Jest configuration and global test utilities
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests
// Rate limiting disabled in tests via .env.test (RATE_LIMIT_ENABLED=false)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jwt_tokens_in_testing_environment_only';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4'; // Lower for faster tests

// Mock console methods to reduce test output noise
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error // Keep errors for debugging
};

// Global test timeout
jest.setTimeout(30000);

// Mock external dependencies that shouldn't be called in tests
// (No external dependencies to mock at this time)

// Helper to restore console for specific tests
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Global test utilities
global.testUtils = {
  // Common test data
  validEmployee: {
    username: 'test_employee',
    password: 'password123',
    role: 'employee',
    salary: 5000.00,
    full_name: 'Test Employee',
    email: 'test.employee@company.com'
  },
  
  validAdmin: {
    username: 'test_admin',
    password: 'admin123',
    role: 'admin',
    salary: 8000.00,
    full_name: 'Test Admin',
    email: 'test.admin@company.com'
  },
  
  validAttendancePeriod: {
    name: 'Test Period',
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  },
  
  // Common assertion helpers
  expectValidResponse: (response, expectedStatus = 200) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('request_id');
  },
  
  expectErrorResponse: (response, expectedStatus, expectedCode) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toHaveProperty('code', expectedCode);
    expect(response.body).toHaveProperty('request_id');
  },
  
  expectValidJWTResponse: (response) => {
    global.testUtils.expectValidResponse(response, 200);
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data).toHaveProperty('user');
    expect(typeof response.body.data.token).toBe('string');
  },
  
  // Date utilities
  formatDate: (date) => {
    return date.toISOString().split('T')[0];
  },
  
  getWorkingDay: (baseDate, offset = 1) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offset);
    
    // Ensure it's a working day (Monday-Friday)
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    
    return global.testUtils.formatDate(date);
  }
};

// Enhanced error handling for async tests
const originalPromise = Promise;
global.Promise = class extends originalPromise {
  constructor(executor) {
    super((resolve, reject) => {
      try {
        executor(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }
};

// Global setup and teardown handlers
let testDbSetupPromise;

beforeAll(async () => {
  // Initialize test database connection
  const { setupTestDb } = require('./helpers/database');
  testDbSetupPromise = setupTestDb();
  await testDbSetupPromise;
});

afterAll(async () => {
  // Cleanup test database
  const { teardownTestDb } = require('./helpers/database');
  await teardownTestDb();
});

// Log test suite completion
process.on('exit', () => {
  if (process.env.NODE_ENV === 'test') {
    console.log('\n✅ Test suite completed');
  }
});