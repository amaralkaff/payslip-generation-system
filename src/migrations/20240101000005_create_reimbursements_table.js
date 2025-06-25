/**
 * Migration: Create reimbursements table
 * Created: 2024-01-01T00:00:05.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE reimbursements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      attendance_period_id INTEGER REFERENCES attendance_periods(id) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      receipt_url VARCHAR(500),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      ip_address INET,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT check_positive_amount CHECK (amount > 0)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_reimbursements_user_period ON reimbursements(user_id, attendance_period_id);`);
  await client.query(`CREATE INDEX idx_reimbursements_status ON reimbursements(status);`);
  await client.query(`CREATE INDEX idx_reimbursements_user_status ON reimbursements(user_id, status);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS reimbursements CASCADE;');
}

module.exports = {
  up,
  down
}; 