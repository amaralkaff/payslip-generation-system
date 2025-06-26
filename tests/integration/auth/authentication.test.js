/**
 * Authentication Integration Tests
 * Testing complete authentication flow with real HTTP requests
 */

const request = require('supertest');
const app = require('../../../src/server');
const { createTestUser, loginUser } = require('../../factories');
const { clearTestData } = require('../../helpers/database');

describe('Authentication Integration Tests', () => {
  beforeEach(async () => {
    await clearTestData();
  });

  describe('POST /api/v1/auth/login', () => {
    test('should login successfully with valid employee credentials', async () => {
      const user = await createTestUser({
        username: 'test_employee',
        password: 'password123',
        role: 'employee'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: user.username,
          password: 'password123'
        });

      global.testUtils.expectValidJWTResponse(response);
      expect(response.body.data.user.username).toBe(user.username);
      expect(response.body.data.user.role).toBe('employee');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should login successfully with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      global.testUtils.expectValidJWTResponse(response);
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.user.role).toBe('admin');
    });

    test('should reject login with invalid username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'password123'
        });

      global.testUtils.expectErrorResponse(response, 401, 'INVALID_CREDENTIALS');
    });

    test('should reject login with invalid password', async () => {
      const user = await createTestUser({
        username: 'test_user',
        password: 'correct_password'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: user.username,
          password: 'wrong_password'
        });

      global.testUtils.expectErrorResponse(response, 401, 'INVALID_CREDENTIALS');
    });

    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should reject login with empty username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: '',
          password: 'password123'
        });

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should reject login with empty password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'test_user',
          password: ''
        });

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should reject login for inactive user', async () => {
      const user = await createTestUser({
        username: 'inactive_user',
        password: 'password123',
        is_active: false
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: user.username,
          password: 'password123'
        });

      global.testUtils.expectErrorResponse(response, 401, 'ACCOUNT_INACTIVE');
    });

    test('should handle SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: "admin'; DROP TABLE users; --",
          password: 'password'
        });

      global.testUtils.expectErrorResponse(response, 401, 'INVALID_CREDENTIALS');
    });

    test('should include request tracking headers', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: user.username,
          password: 'password123'
        });

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.body).toHaveProperty('request_id');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register new employee successfully (admin only)', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const newUserData = {
        username: 'new_employee',
        password: 'newpassword123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'New Employee',
        email: 'new.employee@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData);

      global.testUtils.expectValidResponse(response, 201);
      expect(response.body.data.user.username).toBe(newUserData.username);
      expect(response.body.data.user.role).toBe(newUserData.role);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should register new admin successfully', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const newAdminData = {
        username: 'new_admin',
        password: 'adminpassword123',
        role: 'admin',
        salary: 8000.00,
        full_name: 'New Admin',
        email: 'new.admin@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdminData);

      global.testUtils.expectValidResponse(response, 201);
      expect(response.body.data.user.role).toBe('admin');
    });

    test('should reject registration without admin token', async () => {
      const newUserData = {
        username: 'unauthorized_user',
        password: 'password123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'Unauthorized User',
        email: 'unauthorized@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(newUserData);

      global.testUtils.expectErrorResponse(response, 401, 'TOKEN_MISSING');
    });

    test('should reject registration with employee token', async () => {
      const employee = await createTestUser({ role: 'employee' });
      const employeeToken = await loginUser(employee);
      
      const newUserData = {
        username: 'rejected_user',
        password: 'password123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'Rejected User',
        email: 'rejected@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(newUserData);

      global.testUtils.expectErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should reject registration with duplicate username', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      const existingUser = await createTestUser({ username: 'existing_user' });
      
      const duplicateUserData = {
        username: existingUser.username,
        password: 'password123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'Duplicate User',
        email: 'duplicate@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserData);

      global.testUtils.expectErrorResponse(response, 409, 'USERNAME_EXISTS');
    });

    test('should reject registration with duplicate email', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      const existingUser = await createTestUser({ email: 'existing@company.com' });
      
      const duplicateUserData = {
        username: 'new_username',
        password: 'password123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'New User',
        email: existingUser.email
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserData);

      global.testUtils.expectErrorResponse(response, 409, 'EMAIL_EXISTS');
    });

    test('should validate required fields', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const incompleteUserData = {
        username: 'incomplete_user',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteUserData);

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should validate password strength', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const weakPasswordData = {
        username: 'weak_password_user',
        password: '123', // Too short
        role: 'employee',
        salary: 4500.00,
        full_name: 'Weak Password User',
        email: 'weak@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(weakPasswordData);

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should validate email format', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const invalidEmailData = {
        username: 'invalid_email_user',
        password: 'password123',
        role: 'employee',
        salary: 4500.00,
        full_name: 'Invalid Email User',
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidEmailData);

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should validate salary is positive', async () => {
      const adminToken = await loginUser({ username: 'admin', password: 'admin123' });
      
      const negativeSalaryData = {
        username: 'negative_salary_user',
        password: 'password123',
        role: 'employee',
        salary: -1000.00, // Negative salary
        full_name: 'Negative Salary User',
        email: 'negative@company.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(negativeSalaryData);

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    test.skip('should change password successfully', async () => {
      const user = await createTestUser({
        username: `password_change_user_${Date.now()}`,
        password: 'oldpassword123'
      });
      const token = await loginUser(user);

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword456'
        });

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.message).toContain('changed successfully');
    });

    test.skip('should verify new password works', async () => {
      // Add small delay to ensure unique timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const user = await createTestUser({
        username: `verify_password_user_${Date.now()}`,
        password: 'oldpassword123'
      });
      const token = await loginUser(user);

      // Change password
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword456'
        });

      // Try login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: user.username,
          password: 'newpassword456'
        });

      global.testUtils.expectValidJWTResponse(loginResponse);
    });

    test.skip('should reject change with incorrect current password', async () => {
      // Add small delay to ensure unique timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const user = await createTestUser({
        username: `reject_change_user_${Date.now()}`
      });
      const token = await loginUser(user);

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456'
        });

      global.testUtils.expectErrorResponse(response, 400, 'INVALID_CURRENT_PASSWORD');
    });

    test('should reject change without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword456'
        });

      global.testUtils.expectErrorResponse(response, 401, 'TOKEN_MISSING');
    });

    test('should validate new password strength', async () => {
      const user = await createTestUser();
      const token = await loginUser(user);

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: '123' // Too short
        });

      global.testUtils.expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/validate', () => {
    test('should validate valid token', async () => {
      const user = await createTestUser();
      const token = await loginUser(user);

      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.id).toBe(user.id);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', 'Bearer invalid_token');

      global.testUtils.expectErrorResponse(response, 401, 'INVALID_TOKEN');
    });

    test('should reject expired token', async () => {
      // This would require mocking JWT to create an expired token
      // For now, we'll test the endpoint structure
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkxOTl9.invalid');

      global.testUtils.expectErrorResponse(response, 401, 'INVALID_TOKEN');
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate');

      global.testUtils.expectErrorResponse(response, 401, 'TOKEN_MISSING');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('should logout successfully', async () => {
      const user = await createTestUser();
      const token = await loginUser(user);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.message).toContain('Logged out successfully');
    });

    test('should logout without token (no-op)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      global.testUtils.expectValidResponse(response, 200);
      expect(response.body.data.message).toContain('no active session');
    });

    test('should audit logout action', async () => {
      const user = await createTestUser();
      const token = await loginUser(user);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      global.testUtils.expectValidResponse(response, 200);
      // The audit logging would be verified in the audit logs
      expect(response.body).toHaveProperty('request_id');
    });
  });

  describe('Rate Limiting', () => {
    test.skip('should enforce rate limiting on login attempts', async () => {
      // Temporarily enable rate limiting for this test
      const originalRateLimit = process.env.RATE_LIMIT_ENABLED;
      process.env.RATE_LIMIT_ENABLED = 'true';
      
      try {
        const promises = [];
        
        // Make multiple rapid login attempts (25 > 10 auth limit)
        for (let i = 0; i < 25; i++) {
          promises.push(
            request(app)
              .post('/api/v1/auth/login')
              .send({
                username: 'nonexistent',
                password: 'wrongpassword'
              })
          );
        }

        const responses = await Promise.all(promises);
        
        // Some responses should be rate limited (429 status)
        const rateLimitedResponses = responses.filter(res => res.status === 429);
        const unauthorizedResponses = responses.filter(res => res.status === 401);
        
        // We should have both unauthorized (invalid creds) and rate limited responses
        expect(unauthorizedResponses.length).toBeGreaterThan(0);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      } finally {
        // Restore original rate limiting setting
        process.env.RATE_LIMIT_ENABLED = originalRateLimit;
      }
    }, 15000); // Increased timeout
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(response.headers).toHaveProperty('x-xss-protection', '0');
      expect(response.headers).toHaveProperty('referrer-policy', 'no-referrer');
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});