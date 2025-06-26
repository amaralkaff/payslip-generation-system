/**
 * Minimal Payroll Routes
 * Only core endpoints required by README
 */

const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/admin/payroll/process:
 *   post:
 *     summary: Process payroll (Admin only)
 *     description: |
 *       🧮 **STEP 6: Process monthly payroll (Admin required)**
 *       
 *       **What this does:**
 *       - Calculates payroll for all employees in the period
 *       - Processes attendance, overtime, and reimbursements
 *       - Locks the period (no more submissions allowed)
 *       - Creates payslips for all employees
 *       
 *       **Auto-filled with active period:**
 *       - ✅ Period ID: 2 (July 2025 period)
 *       
 *       **Important:** Can only be run once per period. Period gets locked after processing.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attendance_period_id
 *             properties:
 *               attendance_period_id:
 *                 type: integer
 *                 example: 5
 *                 default: 5
 *                 description: "Use active period ID (5 for April 2025 period)"
 *           examples:
 *             default:
 *               summary: "Process payroll for active period"
 *               value:
 *                 attendance_period_id: 5
 *     responses:
 *       200:
 *         description: Payroll processed successfully
 *       400:
 *         description: Payroll already processed for this period
 *       404:
 *         description: Attendance period not found
 */
router.post('/admin/payroll/process', authenticateToken, requireAdmin, payrollController.processPayroll);

/**
 * @swagger
 * /api/v1/admin/payroll/summary/{payrollId}:
 *   get:
 *     summary: Generate payroll summary (Admin only)
 *     description: |
 *       📊 **STEP 8: Generate payroll summary (Admin required)**
 *       
 *       **What this does:**
 *       - Shows complete payroll summary for all employees
 *       - Displays total amounts, attendance statistics
 *       - Provides breakdown by employee with totals
 *       - Available after payroll processing
 *       
 *       **Auto-filled parameter:**
 *       - ✅ Payroll ID: 1 (first processed payroll)
 *       
 *       **Final step:** Complete overview of entire payroll processing results
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *           default: 1
 *         description: "The payroll ID (will be 1 after processing June 2025 period)"
 *     responses:
 *       200:
 *         description: Payroll summary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payroll_summary:
 *                       type: object
 *                     employee_payslips:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totals:
 *                       type: object
 *                       properties:
 *                         total_employees:
 *                           type: integer
 *                         total_take_home_pay:
 *                           type: number
 *       404:
 *         description: Payroll not found
 */
router.get('/admin/payroll/summary/:payrollId', authenticateToken, requireAdmin, payrollController.getPayrollSummary);

/**
 * @swagger
 * /api/v1/employee/payslip/{periodId}:
 *   get:
 *     summary: Generate payslip (Employee)
 *     description: |
 *       📄 **STEP 7: Generate employee payslip (Employee required)**
 *       
 *       **What this does:**
 *       - Generates detailed payslip for employee
 *       - Shows attendance days, overtime hours, reimbursements
 *       - Calculates prorated salary and take-home pay
 *       - Only available after payroll processing
 *       
 *       **Auto-filled parameter:**
 *       - ✅ Period ID: 2 (July 2025 period)
 *       
 *       **Note:** Must process payroll first (Step 6) before generating payslips
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 5
 *           default: 5
 *         description: "The attendance period ID (use 5 for April 2025 period)"
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     payslip:
 *                       type: object
 *                     attendance_breakdown:
 *                       type: object
 *                     overtime_breakdown:
 *                       type: object
 *                     reimbursements:
 *                       type: array
 *                     totals:
 *                       type: object
 *                       properties:
 *                         net_pay:
 *                           type: number
 *       404:
 *         description: Period not found or payroll not processed
 */
router.get('/employee/payslip/:periodId', authenticateToken, payrollController.generatePayslip);

module.exports = router;