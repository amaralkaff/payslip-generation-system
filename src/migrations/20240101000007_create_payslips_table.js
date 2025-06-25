/**
 * Migration: Create payslips table
 * Created: 2024-01-01T00:00:07.000Z
 */

/**
 * Run the migration
 * @param {Object} client - Database client
 */
async function up(client) {
  await client.query(`
    CREATE TABLE payslips (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      payroll_id INTEGER REFERENCES payrolls(id) NOT NULL,
      attendance_period_id INTEGER REFERENCES attendance_periods(id) NOT NULL,
      
      -- Salary breakdown
      base_salary DECIMAL(10,2) NOT NULL,
      attendance_days INTEGER NOT NULL,
      total_working_days INTEGER NOT NULL,
      prorated_salary DECIMAL(10,2) NOT NULL,
      
      -- Overtime breakdown  
      overtime_hours DECIMAL(5,2) DEFAULT 0.00,
      overtime_rate DECIMAL(10,2) DEFAULT 0.00,
      overtime_amount DECIMAL(10,2) DEFAULT 0.00,
      
      -- Reimbursements
      total_reimbursements DECIMAL(10,2) DEFAULT 0.00,
      
      -- Final calculation
      gross_pay DECIMAL(10,2) NOT NULL,
      deductions DECIMAL(10,2) DEFAULT 0.00,
      net_pay DECIMAL(10,2) NOT NULL,
      
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      
      CONSTRAINT unique_user_payroll UNIQUE (user_id, payroll_id)
    );
  `);

  // Create indexes
  await client.query(`CREATE INDEX idx_payslips_user ON payslips(user_id);`);
  await client.query(`CREATE INDEX idx_payslips_payroll ON payslips(payroll_id);`);
  await client.query(`CREATE INDEX idx_payslips_period ON payslips(attendance_period_id);`);
  await client.query(`CREATE INDEX idx_payslips_generated_at ON payslips(generated_at);`);
}

/**
 * Reverse the migration (optional)
 * @param {Object} client - Database client
 */
async function down(client) {
  await client.query('DROP TABLE IF EXISTS payslips CASCADE;');
}

module.exports = {
  up,
  down
}; 