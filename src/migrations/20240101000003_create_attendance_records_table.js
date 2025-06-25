/**
 * Migration: Create attendance_records table
 * Created: 2024-01-01T00:00:03.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE attendance_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      attendance_period_id INTEGER REFERENCES attendance_periods(id) NOT NULL,
      attendance_date DATE NOT NULL,
      check_in_time TIMESTAMP NOT NULL,
      notes TEXT,
      ip_address INET,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT unique_daily_attendance UNIQUE (user_id, attendance_date),
      CONSTRAINT check_weekday CHECK (EXTRACT(DOW FROM attendance_date) BETWEEN 1 AND 5)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_attendance_user_period ON attendance_records(user_id, attendance_period_id);`);
  await client.query(`CREATE INDEX idx_attendance_date ON attendance_records(attendance_date);`);
  await client.query(`CREATE INDEX idx_attendance_user_date ON attendance_records(user_id, attendance_date);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS attendance_records CASCADE;');
}

module.exports = {
  up,
  down
}; 