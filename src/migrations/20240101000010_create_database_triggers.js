/**
 * Migration: Create database triggers for automatic timestamp updates
 * Created: 2024-01-01T00:00:10.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  // Create the trigger function
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Apply triggers to all tables with updated_at column
  const tables = [
    'users',
    'attendance_periods', 
    'attendance_records',
    'overtime_records',
    'reimbursements',
    'payrolls',
    'payslips'
  ];

  for (const table of tables) {
    await client.query(`
      CREATE TRIGGER update_${table}_updated_at 
      BEFORE UPDATE ON ${table} 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  // Drop triggers
  const tables = [
    'users',
    'attendance_periods', 
    'attendance_records',
    'overtime_records',
    'reimbursements',
    'payrolls',
    'payslips'
  ];

  for (const table of tables) {
    await client.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
  }

  // Drop function
  await client.query('DROP FUNCTION IF EXISTS update_updated_at_column();');
}

module.exports = {
  up,
  down
}; 