/**
 * Database Test Helpers
 * Utilities for setting up and managing test database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/utils/logger');

let testPool;
let isSetup = false;

/**
 * Setup test database connection and schema
 */
async function setupTestDb() {
  if (isSetup) {
    return testPool;
  }

  try {
    // Create connection pool for tests
    testPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: parseInt(process.env.DB_MAX_CONNECTIONS) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Skip migrations - already run during setup
    // await runMigrations();
    
    // Create test admin user if not exists
    await createTestAdmin();

    isSetup = true;
    logger.info('Test database setup completed');
    return testPool;
  } catch (error) {
    logger.error('Failed to setup test database', { error: error.message });
    throw error;
  }
}

/**
 * Teardown test database connection
 */
async function teardownTestDb() {
  if (testPool) {
    try {
      await testPool.end();
      isSetup = false;
      logger.info('Test database connection closed');
    } catch (error) {
      logger.error('Error closing test database connection', { error: error.message });
    }
  }
}

/**
 * Run database migrations for test environment
 */
async function runMigrations() {
  try {
    // Use the existing migration system instead of re-implementing it
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const migrationProcess = spawn('npm', ['run', 'migrate'], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      let stdout = '';
      let stderr = '';
      
      migrationProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      migrationProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      migrationProcess.on('close', (code) => {
        if (code === 0) {
          logger.debug('Test migrations completed successfully');
          resolve();
        } else {
          logger.error('Test migrations failed', { stdout, stderr, code });
          reject(new Error(`Migration failed with code ${code}: ${stderr}`));
        }
      });
    });
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

/**
 * Extract table name from CREATE TABLE statement
 */
function extractTableName(sql) {
  const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
  return match ? match[1] : null;
}

/**
 * Check if table exists
 */
async function tableExists(tableName) {
  try {
    const result = await testPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

/**
 * Create test admin user
 */
async function createTestAdmin() {
  const bcrypt = require('bcrypt');
  
  try {
    // Use lower salt rounds for faster tests 
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 4;
    const passwordHash = await bcrypt.hash('admin123', saltRounds);
    
    await testPool.query(`
      INSERT INTO users (id, username, password_hash, role, salary, full_name, email, is_active, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        is_active = EXCLUDED.is_active
    `, [
      1, // Explicit ID
      'admin',
      passwordHash,
      'admin',
      10000.00,
      'Test Admin',
      'admin@test.com',
      true,
      null, // Admin creates itself
      null  // Admin updates itself
    ]);
  } catch (error) {
    logger.debug('Test admin creation failed', { error: error.message });
    throw error;
  }
}

/**
 * Clear test data (preserves schema and seed data)
 */
async function clearTestData() {
  if (!testPool) {
    await setupTestDb();
  }

  try {
    // Clear data in dependency order (foreign key constraints)
    const clearQueries = [
      'DELETE FROM payslips WHERE id > 0',
      'DELETE FROM payrolls WHERE id > 0', 
      'DELETE FROM reimbursements WHERE id > 0',
      'DELETE FROM overtime_records WHERE id > 0',
      'DELETE FROM attendance_records WHERE id > 0',
      'DELETE FROM attendance_periods WHERE id > 0',
      'DELETE FROM audit_logs WHERE id > 0',
      'DELETE FROM request_logs WHERE id > 0',
      'DELETE FROM users WHERE username != \'admin\'', // Keep admin user
    ];

    for (const query of clearQueries) {
      await testPool.query(query);
    }

    // Reset sequences to start after admin user (ID=1)
    await resetSequences();
    
    logger.debug('Test data cleared successfully');
  } catch (error) {
    logger.error('Failed to clear test data', { error: error.message });
    throw error;
  }
}

/**
 * Execute query with test pool
 */
async function query(text, params) {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDb() first.');
  }
  
  try {
    return await testPool.query(text, params);
  } catch (error) {
    logger.error('Test query failed', { 
      query: text,
      params,
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get a client from the test pool
 */
async function getClient() {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDb() first.');
  }
  
  return await testPool.connect();
}

/**
 * Execute multiple queries in a transaction
 */
async function transaction(queries) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reset auto-increment sequences for test isolation
 */
async function resetSequences() {
  try {
    const sequences = [
      { name: 'users_id_seq', start: 2 }, // Start after admin user (ID=1)
      { name: 'attendance_periods_id_seq', start: 1 },
      { name: 'attendance_records_id_seq', start: 1 },
      { name: 'overtime_records_id_seq', start: 1 },
      { name: 'reimbursements_id_seq', start: 1 },
      { name: 'payrolls_id_seq', start: 1 },
      { name: 'payslips_id_seq', start: 1 }
    ];
    
    for (const { name, start } of sequences) {
      await testPool.query(`ALTER SEQUENCE ${name} RESTART WITH ${start}`);
    }
  } catch (error) {
    logger.debug('Sequence reset failed (may not exist yet)', { error: error.message });
  }
}

/**
 * Get pool statistics for monitoring
 */
function getPoolStats() {
  if (!testPool) {
    return null;
  }
  
  return {
    totalCount: testPool.totalCount,
    idleCount: testPool.idleCount,
    waitingCount: testPool.waitingCount
  };
}

module.exports = {
  setupTestDb,
  teardownTestDb,
  clearTestData,
  query,
  getClient,
  transaction,
  resetSequences,
  getPoolStats,
  get pool() {
    return testPool;
  }
};