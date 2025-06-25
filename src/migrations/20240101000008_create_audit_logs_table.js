/**
 * Migration: Create audit_logs table
 * Created: 2024-01-01T00:00:08.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE audit_logs (
      id SERIAL PRIMARY KEY,
      request_id UUID NOT NULL,
      table_name VARCHAR(50) NOT NULL,
      record_id INTEGER NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      old_values JSONB,
      new_values JSONB,
      user_id INTEGER REFERENCES users(id),
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);`);
  await client.query(`CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);`);
  await client.query(`CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);`);
  await client.query(`CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);`);
  await client.query(`CREATE INDEX idx_audit_logs_action ON audit_logs(action);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
}

module.exports = {
  up,
  down
}; 