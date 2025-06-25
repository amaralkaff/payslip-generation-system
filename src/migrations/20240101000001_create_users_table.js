/**
 * Migration: Create users table
 * Created: 2024-01-01T00:00:01.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
      salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_users_username ON users(username);`);
  await client.query(`CREATE INDEX idx_users_role ON users(role);`);
  await client.query(`CREATE INDEX idx_users_active ON users(is_active);`);
  await client.query(`CREATE INDEX idx_users_email ON users(email);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS users CASCADE;');
}

module.exports = {
  up,
  down
}; 