/**
 * Migration: Create attendance_periods table
 * Created: 2024-01-01T00:00:02.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE attendance_periods (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      payroll_processed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT check_dates CHECK (end_date > start_date)
    );
  `);

  // Create unique constraint for active period
  await client.query(`
    CREATE UNIQUE INDEX unique_active_period 
    ON attendance_periods(is_active) 
    WHERE is_active = true;
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_attendance_periods_dates ON attendance_periods(start_date, end_date);`);
  await client.query(`CREATE INDEX idx_attendance_periods_active ON attendance_periods(is_active);`);
  await client.query(`CREATE INDEX idx_attendance_periods_processed ON attendance_periods(payroll_processed);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS attendance_periods CASCADE;');
}

module.exports = {
  up,
  down
}; 