const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Migration Creation Tool
 * Generates new migration files with proper naming and templates
 */

/**
 * Generate timestamp for migration filename
 * Format: YYYYMMDDHHMMSS
 */
function generateTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
}

/**
 * Generate migration template
 */
function generateMigrationTemplate(migrationName, type = 'table') {
  const templates = {
    table: `/**
 * Migration: ${migrationName}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  // TODO: Add your migration code here
  
  // Example: Create table
  // await client.query(\`
  //   CREATE TABLE example_table (
  //     id SERIAL PRIMARY KEY,
  //     name VARCHAR(100) NOT NULL,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  //   );
  // \`);

  // Example: Add index
  // await client.query(\`
  //   CREATE INDEX idx_example_table_name ON example_table(name);
  // \`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  // TODO: Add rollback code here
  
  // Example: Drop table
  // await client.query('DROP TABLE IF EXISTS example_table;');
}

module.exports = {
  up,
  down
};
`,

    index: `/**
 * Migration: ${migrationName}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  // TODO: Add index creation code here
  
  // Example:
  // await client.query(\`
  //   CREATE INDEX CONCURRENTLY idx_table_column ON table_name(column_name);
  // \`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  // TODO: Add index removal code here
  
  // Example:
  // await client.query('DROP INDEX IF EXISTS idx_table_column;');
}

module.exports = {
  up,
  down
};
`,

    data: `/**
 * Migration: ${migrationName}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  // TODO: Add data migration code here
  
  // Example: Insert data
  // await client.query(\`
  //   INSERT INTO table_name (column1, column2) VALUES 
  //   ('value1', 'value2'),
  //   ('value3', 'value4');
  // \`);

  // Example: Update data
  // await client.query(\`
  //   UPDATE table_name SET column = 'new_value' WHERE condition = 'old_value';
  // \`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  // TODO: Add data rollback code here
  
  // Example: Delete data
  // await client.query(\`
  //   DELETE FROM table_name WHERE condition = 'value';
  // \`);
}

module.exports = {
  up,
  down
};
`
  };

  return templates[type] || templates.table;
}

/**
 * Create a new migration file
 */
async function createMigration(migrationName, type = 'table') {
  try {
    if (!migrationName) {
      throw new Error('Migration name is required');
    }

    // Sanitize migration name
    const sanitizedName = migrationName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Generate filename
    const timestamp = generateTimestamp();
    const filename = `${timestamp}_${sanitizedName}.js`;
    const filepath = path.join(__dirname, filename);

    // Check if file already exists
    try {
      await fs.access(filepath);
      throw new Error(`Migration file ${filename} already exists`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    // Generate template
    const template = generateMigrationTemplate(migrationName, type);

    // Write file
    await fs.writeFile(filepath, template, 'utf8');

    logger.info(`Created migration: ${filename}`);
    console.log(`✅ Created migration: ${filename}`);
    console.log(`📁 Location: ${filepath}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Edit the migration file to add your changes');
    console.log('2. Run migrations: npm run migrate');

    return filepath;

  } catch (error) {
    logger.error('Failed to create migration:', error);
    console.error('❌ Failed to create migration:', error.message);
    throw error;
  }
}

/**
 * CLI execution
 */
async function runCLI() {
  try {
    const migrationName = process.argv[2];
    const migrationType = process.argv[3] || 'table';

    if (!migrationName) {
      console.log('Usage: npm run migrate:create <migration_name> [type]');
      console.log('');
      console.log('Types:');
      console.log('  table - Create table migration (default)');
      console.log('  index - Create index migration');
      console.log('  data  - Create data migration');
      console.log('');
      console.log('Examples:');
      console.log('  npm run migrate:create create_users_table');
      console.log('  npm run migrate:create add_user_email_index index');
      console.log('  npm run migrate:create seed_admin_user data');
      process.exit(1);
    }

    await createMigration(migrationName, migrationType);
    process.exit(0);

  } catch (error) {
    console.error('Migration creation failed:', error.message);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  runCLI();
}

module.exports = {
  createMigration,
  generateTimestamp,
  generateMigrationTemplate
}; 