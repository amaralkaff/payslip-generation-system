const bcrypt = require('bcrypt');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Database Seeder
 * Creates initial admin and employee users as specified in requirements
 */

class DatabaseSeeder {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  }

  /**
   * Generate fake employee data
   */
  generateEmployeeData(index) {
    const firstNames = [
      'Ahmad', 'Siti', 'Muhammad', 'Nur', 'Abdul', 'Fatimah', 'Ali', 'Aisyah', 'Omar', 'Khadijah',
      'Hassan', 'Zainab', 'Ibrahim', 'Aminah', 'Yusuf', 'Maryam', 'Ismail', 'Hafsah', 'Umar', 'Ruqayyah',
      'Othman', 'Sumayyah', 'Zakaria', 'Safiyyah', 'Adam', 'Umm', 'Noah', 'Sarah', 'Daniel', 'Hannah',
      'Michael', 'Emily', 'David', 'Jessica', 'James', 'Ashley', 'Robert', 'Amanda', 'John', 'Stephanie',
      'William', 'Melissa', 'Richard', 'Nicole', 'Joseph', 'Elizabeth', 'Thomas', 'Helen', 'Charles', 'Linda'
    ];

    const lastNames = [
      'Abdullah', 'Rahman', 'Hassan', 'Hussein', 'Ahmad', 'Ibrahim', 'Ismail', 'Yusuf', 'Omar', 'Ali',
      'Mahmud', 'Salim', 'Karim', 'Rashid', 'Nasir', 'Hakim', 'Amin', 'Latif', 'Majid', 'Hamid',
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
    ];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Generate salary between 3,000,000 and 15,000,000 IDR (or 3000-15000 for other currencies)
    const minSalary = 3000000;
    const maxSalary = 15000000;
    const salary = Math.floor(Math.random() * (maxSalary - minSalary + 1)) + minSalary;

    return {
      username: `employee${String(index).padStart(3, '0')}`,
      password: `emp${String(index).padStart(3, '0')}pass`, // Simple pattern for testing
      email: `employee${String(index).padStart(3, '0')}@company.com`,
      full_name: `${firstName} ${lastName}`,
      role: 'employee',
      salary: salary,
      is_active: true
    };
  }

  /**
   * Generate admin data
   */
  generateAdminData() {
    return {
      username: 'admin',
      password: 'admin123', // Simple password for testing
      email: 'admin@company.com',
      full_name: 'System Administrator',
      role: 'admin',
      salary: 0.00, // Admins have 0 salary as per schema default
      is_active: true
    };
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Clear existing data
   */
  async clearExistingData() {
    try {
      logger.info('Clearing existing user data...');
      
      await db.withTransaction(async (client) => {
        // Clear in order due to foreign key constraints
        await client.query('DELETE FROM payslips');
        await client.query('DELETE FROM payrolls');
        await client.query('DELETE FROM reimbursements');
        await client.query('DELETE FROM overtime_records');
        await client.query('DELETE FROM attendance_records');
        await client.query('DELETE FROM attendance_periods');
        await client.query('DELETE FROM audit_logs');
        await client.query('DELETE FROM request_logs');
        await client.query('DELETE FROM users');
        
        // Reset sequences
        await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE attendance_periods_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE attendance_records_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE overtime_records_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE reimbursements_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE payrolls_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE payslips_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE request_logs_id_seq RESTART WITH 1');
      });
      
      logger.info('Existing data cleared successfully');
    } catch (error) {
      logger.error('Failed to clear existing data:', error);
      throw error;
    }
  }

  /**
   * Create admin user
   */
  async createAdmin() {
    try {
      logger.info('Creating admin user...');
      
      const adminData = this.generateAdminData();
      const hashedPassword = await this.hashPassword(adminData.password);
      
      const result = await db.query(`
        INSERT INTO users (
          username, password_hash, email, full_name, role, 
          salary, is_active, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1)
        RETURNING id, username, email, full_name, role
      `, [
        adminData.username,
        hashedPassword,
        adminData.email,
        adminData.full_name,
        adminData.role,
        adminData.salary,
        adminData.is_active
      ]);
      
      logger.info('Admin user created successfully', {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email
      });
      
      console.log(`\n🔑 ADMIN CREDENTIALS:`);
      console.log(`   Username: ${adminData.username}`);
      console.log(`   Password: ${adminData.password}`);
      console.log(`   Email: ${adminData.email}\n`);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create admin user:', error);
      throw error;
    }
  }

  /**
   * Create employee users
   */
  async createEmployees() {
    try {
      logger.info('Creating 100 employee users...');
      
      const employees = [];
      const batchSize = 10; // Process in batches for better performance
      
      for (let i = 1; i <= 100; i += batchSize) {
        const batch = [];
        const endIndex = Math.min(i + batchSize - 1, 100);
        
        logger.info(`Creating employees ${i} to ${endIndex}...`);
        
        // Prepare batch data
        for (let j = i; j <= endIndex; j++) {
          const employeeData = this.generateEmployeeData(j);
          const hashedPassword = await this.hashPassword(employeeData.password);
          
          batch.push({
            ...employeeData,
            hashedPassword,
            index: j
          });
        }
        
        // Insert batch
        await db.withTransaction(async (client) => {
          for (const emp of batch) {
            const result = await client.query(`
              INSERT INTO users (
                username, password_hash, email, full_name, role, 
                salary, is_active, created_by, updated_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1)
              RETURNING id, username, email, full_name, salary
            `, [
              emp.username,
              emp.hashedPassword,
              emp.email,
              emp.full_name,
              emp.role,
              emp.salary,
              emp.is_active
            ]);
            
            employees.push({
              ...result.rows[0],
              originalPassword: emp.password
            });
          }
        });
      }
      
      logger.info('All 100 employees created successfully');
      
      // Display sample credentials
      console.log(`\n👥 SAMPLE EMPLOYEE CREDENTIALS (first 5):`);
      for (let i = 0; i < Math.min(5, employees.length); i++) {
        const emp = employees[i];
        console.log(`   ${emp.username} | ${emp.originalPassword} | ${emp.email} | Salary: ${emp.salary?.toLocaleString()}`);
      }
      console.log(`   ... and 95 more employees (employee004 to employee100)`);
      console.log(`   Pattern: employee### | emp###pass | employee###@company.com\n`);
      
      return employees;
    } catch (error) {
      logger.error('Failed to create employees:', error);
      throw error;
    }
  }

  /**
   * Create initial attendance period for testing
   */
  async createInitialAttendancePeriod(adminId) {
    try {
      logger.info('Creating initial attendance period for testing...');
      
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); // First day of current month
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of current month
      
      const result = await db.query(`
        INSERT INTO attendance_periods (
          name, start_date, end_date, is_active, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, start_date, end_date, is_active
      `, [
        `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        true,
        adminId,
        adminId
      ]);
      
      logger.info('Initial attendance period created', {
        id: result.rows[0].id,
        name: result.rows[0].name,
        startDate: result.rows[0].start_date,
        endDate: result.rows[0].end_date
      });
      
      console.log(`📅 ACTIVE ATTENDANCE PERIOD:`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Period: ${result.rows[0].start_date} to ${result.rows[0].end_date}`);
      console.log(`   Status: Active\n`);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create initial attendance period:', error);
      throw error;
    }
  }

  /**
   * Generate database statistics
   */
  async generateStatistics() {
    try {
      const stats = await db.query(`
        SELECT 
          role,
          COUNT(*) as count,
          AVG(salary) as avg_salary,
          MIN(salary) as min_salary,
          MAX(salary) as max_salary
        FROM users 
        WHERE role = 'employee'
        GROUP BY role
        UNION ALL
        SELECT 
          'admin' as role,
          COUNT(*) as count,
          NULL as avg_salary,
          NULL as min_salary,
          NULL as max_salary
        FROM users 
        WHERE role = 'admin'
      `);
      
      console.log(`📊 DATABASE STATISTICS:`);
      for (const stat of stats.rows) {
        if (stat.role === 'employee') {
          console.log(`   Employees: ${stat.count}`);
          console.log(`   Avg Salary: ${Math.round(stat.avg_salary).toLocaleString()}`);
          console.log(`   Salary Range: ${stat.min_salary.toLocaleString()} - ${stat.max_salary.toLocaleString()}`);
        } else {
          console.log(`   Admins: ${stat.count}`);
        }
      }
      
      const tables = await db.query(`
        SELECT schemaname,tablename,n_tup_ins as inserts 
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
      `);
      
      console.log(`\n📋 TABLE ROW COUNTS:`);
      for (const table of tables.rows) {
        console.log(`   ${table.tablename}: ${table.inserts} rows`);
      }
      
    } catch (error) {
      logger.error('Failed to generate statistics:', error);
    }
  }

  /**
   * Run all seeding operations
   */
  async run() {
    try {
      const startTime = Date.now();
      logger.info('Starting database seeding...');
      
      console.log('\n🌱 DATABASE SEEDING STARTED\n');
      console.log('Creating initial data as specified in requirements:');
      console.log('- 1 admin user');
      console.log('- 100 employee users');
      console.log('- 1 active attendance period for testing\n');
      
      // Clear existing data
      await this.clearExistingData();
      
      // Create admin
      const admin = await this.createAdmin();
      
      // Create employees
      const employees = await this.createEmployees();
      
      // Create initial attendance period
      const attendancePeriod = await this.createInitialAttendancePeriod(admin.id);
      
      // Generate statistics
      await this.generateStatistics();
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Total users created: ${employees.length + 1}`);
      console.log(`\n🚀 You can now start the server with: npm run dev`);
      console.log(`📚 API documentation will be available at: http://localhost:3000/api-docs\n`);
      
      logger.info('Database seeding completed successfully', {
        duration: `${duration}ms`,
        adminCreated: 1,
        employeesCreated: employees.length,
        attendancePeriodsCreated: 1
      });
      
    } catch (error) {
      logger.error('Database seeding failed:', error);
      console.error('\n❌ DATABASE SEEDING FAILED:', error.message);
      throw error;
    }
  }
}

/**
 * CLI execution
 */
async function runSeeder() {
  const seeder = new DatabaseSeeder();
  
  try {
    await seeder.run();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Run seeder if this file is executed directly
if (require.main === module) {
  runSeeder();
}

module.exports = DatabaseSeeder; 