/**
 * Migration: Create overtime_records table
 * Created: 2024-01-01T00:00:04.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE overtime_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      attendance_period_id INTEGER REFERENCES attendance_periods(id) NOT NULL,
      overtime_date DATE NOT NULL,
      hours_worked DECIMAL(3,2) NOT NULL,
      description TEXT,
      ip_address INET,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT check_overtime_hours CHECK (hours_worked > 0 AND hours_worked <= 3.00),
      CONSTRAINT unique_daily_overtime UNIQUE (user_id, overtime_date)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_overtime_user_period ON overtime_records(user_id, attendance_period_id);`);
  await client.query(`CREATE INDEX idx_overtime_date ON overtime_records(overtime_date);`);
  await client.query(`CREATE INDEX idx_overtime_user_date ON overtime_records(user_id, overtime_date);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS overtime_records CASCADE;');
}

module.exports = {
  up,
  down
}; 