const express = require('express');
const overtimeController = require('../controllers/overtime.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');

/**
 * Overtime Routes
 * All routes for overtime management
 */

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     OvertimeRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 5
 *         attendance_period_id:
 *           type: integer
 *           example: 1
 *         overtime_date:
 *           type: string
 *           format: date
 *           example: "2024-01-15"
 *         hours:
 *           type: number
 *           format: float
 *           minimum: 0.5
 *           maximum: 3.0
 *           example: 2.5
 *         description:
 *           type: string
 *           example: "Working on urgent project deadline"
 *         hourly_rate:
 *           type: number
 *           format: float
 *           example: 31250.00
 *         overtime_amount:
 *           type: number
 *           format: float
 *           example: 156250.00
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     
 *     OvertimeSubmissionRequest:
 *       type: object
 *       required:
 *         - overtime_date
 *         - hours
 *         - description
 *       properties:
 *         overtime_date:
 *           type: string
 *           format: date
 *           example: "2024-01-15"
 *         hours:
 *           type: number
 *           format: float
 *           minimum: 0.5
 *           maximum: 3.0
 *           example: 2.5
 *           description: "Maximum 3 hours per day allowed"
 *         description:
 *           type: string
 *           minLength: 1
 *           maxLength: 500
 *           example: "Working on urgent project deadline"
 *     
 *     OvertimeSummary:
 *       type: object
 *       properties:
 *         period_id:
 *           type: integer
 *           example: 1
 *         period_name:
 *           type: string
 *           example: "January 2024"
 *         total_employees:
 *           type: integer
 *           example: 25
 *         total_overtime_hours:
 *           type: number
 *           format: float
 *           example: 127.5
 *         total_overtime_amount:
 *           type: number
 *           format: float
 *           example: 7968750.00
 *         average_hours_per_employee:
 *           type: number
 *           format: float
 *           example: 5.1
 *         employees_with_overtime:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               full_name:
 *                 type: string
 *               total_hours:
 *                 type: number
 *                 format: float
 *               total_amount:
 *                 type: number
 *                 format: float
 */

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

/**
 * @swagger
 * /api/v1/employee/overtime:
 *   post:
 *     summary: Submit overtime record (Employee)
 *     description: Submit overtime hours for a specific date. Maximum 3 hours per day allowed.
 *     tags: [Employee - Overtime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OvertimeSubmissionRequest'
 *     responses:
 *       201:
 *         description: Overtime submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/OvertimeRecord'
 *                 message:
 *                   type: string
 *                   example: "Overtime submitted successfully"
 *                 request_id:
 *                   type: string
 *       400:
 *         description: Invalid input data (date restrictions, hour limits, etc.)
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
 *         description: Employee access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No active attendance period found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Overtime already submitted for this date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/employee/overtime', 
  requireRole('employee'), 
  overtimeController.validateSubmitOvertime,
  overtimeController.submitOvertime
);

/**
 * @swagger
 * /api/v1/employee/overtime:
 *   get:
 *     summary: Get user overtime for active period (Employee)
 *     description: Retrieve all overtime records for the current user in the active attendance period
 *     tags: [Employee - Overtime]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User overtime records retrieved successfully
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
 *                     period:
 *                       $ref: '#/components/schemas/AttendancePeriod'
 *                     overtime_records:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OvertimeRecord'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_hours:
 *                           type: number
 *                           format: float
 *                           example: 12.5
 *                         total_amount:
 *                           type: number
 *                           format: float
 *                           example: 781250.00
 *                         days_with_overtime:
 *                           type: integer
 *                           example: 5
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Employee access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No active attendance period or no overtime records found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/employee/overtime', 
  requireRole('employee'), 
  overtimeController.getUserOvertime
);

/**
 * @swagger
 * /api/v1/employee/overtime/{periodId}:
 *   get:
 *     summary: Get user overtime for specific period (Employee)
 *     description: Retrieve all overtime records for the current user in a specific attendance period
 *     tags: [Employee - Overtime]
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
 *     responses:
 *       200:
 *         description: User overtime records for specific period retrieved successfully
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
 *                     period:
 *                       $ref: '#/components/schemas/AttendancePeriod'
 *                     overtime_records:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OvertimeRecord'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_hours:
 *                           type: number
 *                           format: float
 *                           example: 12.5
 *                         total_amount:
 *                           type: number
 *                           format: float
 *                           example: 781250.00
 *                         days_with_overtime:
 *                           type: integer
 *                           example: 5
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Employee access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Period not found or no overtime records found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/employee/overtime/:periodId', 
  requireRole('employee'), 
  overtimeController.getUserOvertimeInPeriod
);

/**
 * @swagger
 * /api/v1/admin/overtime/{periodId}:
 *   get:
 *     summary: Get all overtime records for period (Admin)
 *     description: Retrieve all overtime records from all employees for a specific attendance period
 *     tags: [Admin - Overtime]
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by specific user ID
 *     responses:
 *       200:
 *         description: Overtime records retrieved successfully
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
 *                     period:
 *                       $ref: '#/components/schemas/AttendancePeriod'
 *                     overtime_records:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/OvertimeRecord'
 *                           - type: object
 *                             properties:
 *                               user:
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
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         has_more:
 *                           type: boolean
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
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/overtime/:periodId', 
  requireRole('admin'), 
  overtimeController.getOvertimeByPeriod
);

/**
 * @swagger
 * /api/v1/admin/overtime/{periodId}/summary:
 *   get:
 *     summary: Get overtime summary for period (Admin)
 *     description: Get aggregated overtime statistics and summary for a specific attendance period
 *     tags: [Admin - Overtime]
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
 *     responses:
 *       200:
 *         description: Overtime summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/OvertimeSummary'
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
 *         description: Period not found or no overtime records found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/overtime/:periodId/summary', 
  requireRole('admin'), 
  overtimeController.getOvertimeSummary
);

module.exports = router;