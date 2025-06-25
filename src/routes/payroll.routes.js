const express = require('express');
const payrollController = require('../controllers/payroll.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');

/**
 * Payroll Routes
 * All routes for payroll processing and payslip generation
 */

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PayrollRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         attendance_period_id:
 *           type: integer
 *           example: 1
 *         processed_by:
 *           type: integer
 *           example: 1
 *         total_employees:
 *           type: integer
 *           example: 100
 *         total_gross_salary:
 *           type: number
 *           format: float
 *           example: 425000000.00
 *         total_overtime_amount:
 *           type: number
 *           format: float
 *           example: 125000000.00
 *         total_reimbursement_amount:
 *           type: number
 *           format: float
 *           example: 75000000.00
 *         total_net_pay:
 *           type: number
 *           format: float
 *           example: 625000000.00
 *         processed_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *     
 *     PayslipRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         payroll_id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 5
 *         attendance_period_id:
 *           type: integer
 *           example: 1
 *         base_salary:
 *           type: number
 *           format: float
 *           example: 5000000.00
 *         prorated_salary:
 *           type: number
 *           format: float
 *           example: 4500000.00
 *         overtime_amount:
 *           type: number
 *           format: float
 *           example: 750000.00
 *         reimbursement_amount:
 *           type: number
 *           format: float
 *           example: 500000.00
 *         total_take_home_pay:
 *           type: number
 *           format: float
 *           example: 5750000.00
 *         working_days_in_period:
 *           type: integer
 *           example: 22
 *         attendance_days:
 *           type: integer
 *           example: 20
 *         attendance_percentage:
 *           type: number
 *           format: float
 *           example: 90.91
 *         total_overtime_hours:
 *           type: number
 *           format: float
 *           example: 12.0
 *         hourly_rate:
 *           type: number
 *           format: float
 *           example: 31250.00
 *         created_at:
 *           type: string
 *           format: date-time
 *     
 *     PayrollProcessRequest:
 *       type: object
 *       required:
 *         - attendance_period_id
 *       properties:
 *         attendance_period_id:
 *           type: integer
 *           example: 1
 *           description: "The attendance period to process payroll for"
 *     
 *     PayrollSummary:
 *       type: object
 *       properties:
 *         payroll:
 *           $ref: '#/components/schemas/PayrollRecord'
 *         period:
 *           $ref: '#/components/schemas/AttendancePeriod'
 *         payslips:
 *           type: array
 *           items:
 *             allOf:
 *               - $ref: '#/components/schemas/PayslipRecord'
 *               - type: object
 *                 properties:
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       email:
 *                         type: string
 *         statistics:
 *           type: object
 *           properties:
 *             average_attendance_percentage:
 *               type: number
 *               format: float
 *               example: 87.5
 *             employees_with_overtime:
 *               type: integer
 *               example: 45
 *             employees_with_reimbursements:
 *               type: integer
 *               example: 23
 *             highest_take_home_pay:
 *               type: number
 *               format: float
 *               example: 8500000.00
 *             lowest_take_home_pay:
 *               type: number
 *               format: float
 *               example: 3200000.00
 *             average_take_home_pay:
 *               type: number
 *               format: float
 *               example: 6250000.00
 */

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

/**
 * Admin Payroll Routes
 */

/**
 * @swagger
 * /api/v1/admin/payroll/process:
 *   post:
 *     summary: Process payroll for attendance period (Admin)
 *     description: |
 *       Process payroll for a specific attendance period. This will:
 *       - Calculate prorated salaries based on attendance
 *       - Calculate overtime payments (2x hourly rate)
 *       - Include approved reimbursements
 *       - Generate payslips for all employees
 *       - Lock the attendance period (prevent further modifications)
 *       
 *       **Warning**: This operation is irreversible. Once payroll is processed, attendance, overtime, and reimbursement data for this period cannot be modified.
 *     tags: [Admin - Payroll]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayrollProcessRequest'
 *     responses:
 *       201:
 *         description: Payroll processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payroll:
 *                       $ref: '#/components/schemas/PayrollRecord'
 *                     message:
 *                       type: string
 *                       example: "Payroll processed successfully for 100 employees"
 *                     processing_summary:
 *                       type: object
 *                       properties:
 *                         employees_processed:
 *                           type: integer
 *                           example: 100
 *                         total_payslips_generated:
 *                           type: integer
 *                           example: 100
 *                         processing_time_ms:
 *                           type: number
 *                           example: 2450
 *                 request_id:
 *                   type: string
 *       400:
 *         description: Invalid input data or period validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Attendance period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Payroll already processed for this period
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Payroll processing failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/admin/payroll/process', 
  requireRole('admin'), 
  payrollController.validateProcessPayroll,
  payrollController.processPayroll
);

/**
 * @swagger
 * /api/v1/admin/payroll/summary/{payrollId}:
 *   get:
 *     summary: Get payroll summary (Admin)
 *     description: Get detailed payroll summary including all payslips and statistics for a processed payroll
 *     tags: [Admin - Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Payroll ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Payroll summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PayrollSummary'
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Payroll not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/payroll/summary/:payrollId', 
  requireRole('admin'), 
  payrollController.getPayrollSummary
);

/**
 * @swagger
 * /api/v1/admin/payroll:
 *   get:
 *     summary: List all payrolls (Admin)
 *     description: Retrieve a list of all processed payrolls with pagination
 *     tags: [Admin - Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of payrolls to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of payrolls to skip
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [processed_at, created_at, total_net_pay, total_employees]
 *           default: processed_at
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Payrolls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payrolls:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/PayrollRecord'
 *                           - type: object
 *                             properties:
 *                               period:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   name:
 *                                     type: string
 *                                   start_date:
 *                                     type: string
 *                                     format: date
 *                                   end_date:
 *                                     type: string
 *                                     format: date
 *                               processed_by_user:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   username:
 *                                     type: string
 *                                   full_name:
 *                                     type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         offset:
 *                           type: integer
 *                           example: 0
 *                         has_more:
 *                           type: boolean
 *                           example: true
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/payroll', 
  requireRole('admin'), 
  payrollController.listPayrolls
);

/**
 * @swagger
 * /api/v1/admin/payroll/{id}:
 *   get:
 *     summary: Get payroll by ID (Admin)
 *     description: Retrieve detailed information about a specific payroll record
 *     tags: [Admin - Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Payroll ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Payroll retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PayrollRecord'
 *                     - type: object
 *                       properties:
 *                         period:
 *                           $ref: '#/components/schemas/AttendancePeriod'
 *                         processed_by_user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             username:
 *                               type: string
 *                             full_name:
 *                               type: string
 *                             email:
 *                               type: string
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Payroll not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/payroll/:id', 
  requireRole('admin'), 
  payrollController.getPayrollById
);

/**
 * Employee Payslip Routes
 */

/**
 * @swagger
 * /api/v1/employee/payslip/{periodId}:
 *   get:
 *     summary: Generate payslip for specific period (Employee)
 *     description: |
 *       Generate and retrieve payslip for the current employee for a specific attendance period.
 *       The payslip includes:
 *       - Base salary and prorated calculation
 *       - Attendance breakdown and percentage
 *       - Overtime hours and payment (2x rate)
 *       - Approved reimbursements
 *       - Total take-home pay calculation
 *       
 *       **Note**: Payslip can only be generated after payroll has been processed for the period.
 *     tags: [Employee - Payslip]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance period ID
 *         example: 1
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, pdf]
 *           default: json
 *         description: Response format (json for API, pdf for download)
 *     responses:
 *       200:
 *         description: Payslip generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payslip:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PayslipRecord'
 *                         - type: object
 *                           properties:
 *                             user:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 username:
 *                                   type: string
 *                                 full_name:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                             period:
 *                               $ref: '#/components/schemas/AttendancePeriod'
 *                             attendance_breakdown:
 *                               type: object
 *                               properties:
 *                                 total_working_days:
 *                                   type: integer
 *                                 attended_days:
 *                                   type: integer
 *                                 attendance_percentage:
 *                                   type: number
 *                                   format: float
 *                                 missed_days:
 *                                   type: integer
 *                             overtime_breakdown:
 *                               type: object
 *                               properties:
 *                                 total_hours:
 *                                   type: number
 *                                   format: float
 *                                 hourly_rate:
 *                                   type: number
 *                                   format: float
 *                                 overtime_rate_multiplier:
 *                                   type: number
 *                                   example: 2.0
 *                                 total_amount:
 *                                   type: number
 *                                   format: float
 *                                 days_with_overtime:
 *                                   type: integer
 *                             reimbursement_breakdown:
 *                               type: object
 *                               properties:
 *                                 total_approved:
 *                                   type: number
 *                                   format: float
 *                                 number_of_claims:
 *                                   type: integer
 *                                 approved_claims:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       description:
 *                                         type: string
 *                                       amount:
 *                                         type: number
 *                                         format: float
 *                                       approved_date:
 *                                         type: string
 *                                         format: date-time
 *                             salary_calculation:
 *                               type: object
 *                               properties:
 *                                 base_monthly_salary:
 *                                   type: number
 *                                   format: float
 *                                 prorated_salary:
 *                                   type: number
 *                                   format: float
 *                                 overtime_amount:
 *                                   type: number
 *                                   format: float
 *                                 reimbursement_amount:
 *                                   type: number
 *                                   format: float
 *                                 total_gross_pay:
 *                                   type: number
 *                                   format: float
 *                                 total_take_home_pay:
 *                                   type: number
 *                                   format: float
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                 request_id:
 *                   type: string
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *               description: PDF payslip document
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Employee access required or access to other employee's payslip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Period not found or payroll not yet processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/employee/payslip/:periodId', 
  requireRole('employee'), 
  payrollController.generatePayslip
);

module.exports = router; 