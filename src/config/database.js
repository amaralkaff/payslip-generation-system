const { Pool } = require('pg');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Database Configuration
 * Handles PostgreSQL connection pooling with performance optimizations
 */

const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'payslip_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    // Connection Pool Configuration
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    max: parseInt(process.env.DB_POOL_MAX) || 50,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS) || 2000,
    allowExitOnIdle: true,
    maxLifetimeSeconds: 3600 // 1 hour connection rotation
  },
  test: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.TEST_DB_NAME || 'payslip_system_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: false,
    min: 2,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 1000,
    allowExitOnIdle: true
  },
  production: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    min: parseInt(process.env.DB_POOL_MIN) || 10,
    max: parseInt(process.env.DB_POOL_MAX) || 50,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS) || 2000,
    allowExitOnIdle: false,
    maxLifetimeSeconds: 3600
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Validate required configuration
if (environment === 'production') {
  const requiredFields = ['host', 'database', 'user', 'password'];
  for (const field of requiredFields) {
    if (!dbConfig[field]) {
      throw new Error(`Missing required database configuration: ${field}`);
    }
  }
}

// Create connection pool
const pool = new Pool(dbConfig);

// Enhanced error handling for idle connections
pool.on('error', (err, client) => {
  logger.error('Database pool error', { 
    error: err.message, 
    stack: err.stack,
    client: client ? 'exists' : 'null'
  });
});

pool.on('connect', (client) => {
  logger.debug('New database connection established', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('release', (client) => {
  logger.debug('Client released back to pool', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

/**
 * Execute a single query using pool
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    logger.debug('Executing database query', { 
      query: text, 
      params: params ? '[HIDDEN]' : undefined,
      requestId 
    });
    
    const result = await pool.query(text, params);
    const duration = performance.now() - start;
    
    logger.debug('Database query completed', { 
      requestId, 
      duration: `${duration.toFixed(2)}ms`, 
      rowCount: result.rowCount 
    });
    
    // Log slow queries
    if (duration > (parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 1000)) {
      logger.warn('Slow query detected', {
        query: text,
        duration: `${duration.toFixed(2)}ms`,
        requestId
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error('Database query failed', {
      error: error.message,
      query: text,
      duration: `${duration.toFixed(2)}ms`,
      requestId
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
const getClient = () => {
  return pool.connect();
};

/**
 * Execute queries within a transaction
 * @param {Function} callback - Function that receives client and executes queries
 * @returns {Promise<any>} Transaction result
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get pool statistics for monitoring
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    config: {
      max: dbConfig.max,
      min: dbConfig.min
    }
  };
};

/**
 * Gracefully close the database pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
};

module.exports = {
  pool,
  query,
  getClient,
  withTransaction,
  getPoolStats,
  closePool,
  config: dbConfig
}; 