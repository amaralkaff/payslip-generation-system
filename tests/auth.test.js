const request = require('supertest');
const app = require('../src/server');

/**
 * Authentication System Tests
 * Basic tests to verify authentication functionality
 */

describe('Authentication System', () => {
  
  describe('POST /api/v1/auth/login', () => {
    test('should reject login without credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
    
    test('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
  
  describe('GET /api/v1/auth/validate', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_MISSING');
    });
    
    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_MALFORMED');
    });
  });
  
  describe('POST /api/v1/auth/register', () => {
    test('should reject registration without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
          full_name: 'Test User'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_MISSING');
    });
  });
  
  describe('Health Check', () => {
    test('should respond to health check', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
  
});

module.exports = app; 