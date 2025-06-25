/**
 * Migration: Create request_logs table
 * Created: 2024-01-01T00:00:09.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE request_logs (
      id SERIAL PRIMARY KEY,
      request_id UUID UNIQUE NOT NULL,
      method VARCHAR(10) NOT NULL,
      url TEXT NOT NULL,
      status_code INTEGER,
      response_time INTEGER, -- milliseconds
      user_id INTEGER REFERENCES users(id),
      ip_address INET,
      user_agent TEXT,
      request_body JSONB,
      response_body JSONB,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_request_logs_request_id ON request_logs(request_id);`);
  await client.query(`CREATE INDEX idx_request_logs_user ON request_logs(user_id);`);
  await client.query(`CREATE INDEX idx_request_logs_status ON request_logs(status_code);`);
  await client.query(`CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);`);
  await client.query(`CREATE INDEX idx_request_logs_method_url ON request_logs(method, url);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS request_logs CASCADE;');
}

module.exports = {
  up,
  down
}; 