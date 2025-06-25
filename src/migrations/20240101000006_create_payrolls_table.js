/**
 * Migration: Create payrolls table
 * Created: 2024-01-01T00:00:06.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE payrolls (
      id SERIAL PRIMARY KEY,
      attendance_period_id INTEGER REFERENCES attendance_periods(id) NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_employees INTEGER NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT unique_period_payroll UNIQUE (attendance_period_id)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_payrolls_period ON payrolls(attendance_period_id);`);
  await client.query(`CREATE INDEX idx_payrolls_status ON payrolls(status);`);
  await client.query(`CREATE INDEX idx_payrolls_processed_at ON payrolls(processed_at);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS payrolls CASCADE;');
}

module.exports = {
  up,
  down
}; 