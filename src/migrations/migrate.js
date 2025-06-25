const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Database Migration Runner
 * Executes migrations in order and tracks execution state
 */

class MigrationRunner {
  constructor() {
    this.migrationsPath = __dirname;
    this.migrationsTable = 'schema_migrations';
  }

  /**
   * Initialize migrations tracking table
   */
  async initializeMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER,
        checksum VARCHAR(64)
      );
    `;
    
    await db.query(createTableQuery);
    logger.info('Migrations table initialized');
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    const result = await db.query(
      `SELECT version FROM ${this.migrationsTable} ORDER BY version`
    );
    return result.rows.map(row => row.version);
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    // Get all migration files
    const files = await fs.readdir(this.migrationsPath);
    const migrationFiles = files
      .filter(file => file.match(/^\d{14}_.*\.js$/))
      .sort();

    // Get executed migrations
    const executedMigrations = await this.getExecutedMigrations();
    
    // Filter to get pending migrations
    const pendingMigrations = migrationFiles.filter(file => {
      const version = file.replace('.js', '');
      return !executedMigrations.includes(version);
    });

    return pendingMigrations;
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    const version = filename.replace('.js', '');
    
    logger.info(`Executing migration: ${filename}`);
    
    const startTime = Date.now();
    
    try {
      // Load and execute migration
      const migration = require(migrationPath);
      
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${filename} must export an 'up' function`);
      }

      // Execute migration within transaction
      await db.withTransaction(async (client) => {
        await migration.up(client);
        
        // Record migration execution
        const executionTime = Date.now() - startTime;
        const migrationContent = await fs.readFile(migrationPath, 'utf8');
        const checksum = require('crypto')
          .createHash('sha256')
          .update(migrationContent)
          .digest('hex');

        await client.query(
          `INSERT INTO ${this.migrationsTable} (version, execution_time_ms, checksum) 
           VALUES ($1, $2, $3)`,
          [version, executionTime, checksum]
        );
      });

      logger.info(`Migration ${filename} executed successfully in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      logger.error(`Migration ${filename} failed:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      logger.info('Starting database migrations...');
      
      // Initialize migrations table if needed
      await this.initializeMigrationsTable();
      
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      // Execute each migration
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      logger.info('All migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    await this.initializeMigrationsTable();
    
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      executed: executed.length,
      pending: pending.length,
      executedMigrations: executed,
      pendingMigrations: pending.map(file => file.replace('.js', ''))
    };
  }
}

/**
 * CLI execution
 */
async function runCLI() {
  const runner = new MigrationRunner();
  
  try {
    const command = process.argv[2];
    
    switch (command) {
      case 'status':
        const status = await runner.getStatus();
        console.log('\n=== Migration Status ===');
        console.log(`Executed: ${status.executed}`);
        console.log(`Pending: ${status.pending}`);
        
        if (status.pendingMigrations.length > 0) {
          console.log('\nPending migrations:');
          status.pendingMigrations.forEach(migration => {
            console.log(`  - ${migration}`);
          });
        }
        break;
        
      default:
        await runner.runMigrations();
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Migration CLI failed:', error);
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  runCLI();
}

module.exports = MigrationRunner; 