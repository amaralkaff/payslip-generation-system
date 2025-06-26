const express = require('express');
const attendanceController = require('../controllers/attendance.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');
const { validate } = require('../utils/validation');
const { attendanceSchemas } = require('../utils/validation');

/**
 * Attendance Routes
 * All routes for attendance and attendance period management
 */

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AttendancePeriod:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "January 2024"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *         is_active:
 *           type: boolean
 *           example: true
 *         payroll_processed:
 *           type: boolean
 *           example: false
 *         created_at:
 *           type: string
 *           format: date-time
 */

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

/**
 * @swagger
 * /api/v1/admin/attendance-periods:
 *   post:
 *     summary: Create attendance period (Admin only)
 *     tags: [Admin - Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - start_date
 *               - end_date
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "January 2024"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-31"
 *     responses:
 *       201:
 *         description: Attendance period created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Active period already exists
 */
router.post('/admin/attendance-periods', 
  requireRole('admin'), 
  validate(attendanceSchemas.period, 'body'),
  attendanceController.createPeriod
);

/**
 * @swagger
 * /api/v1/employee/attendance:
 *   post:
 *     summary: Submit daily attendance (Employee)
 *     tags: [Employee - Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attendance_date
 *             properties:
 *               attendance_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Working from office"
 *     responses:
 *       201:
 *         description: Attendance submitted successfully
 *       400:
 *         description: Invalid date or already submitted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active attendance period
 */
router.post('/employee/attendance', 
  requireRole('employee'), 
  validate(attendanceSchemas.submission, 'body'),
  attendanceController.submitAttendance
);

/**
 * @swagger
 * /api/v1/employee/attendance:
 *   get:
 *     summary: Get user attendance for active period (Employee)
 *     tags: [Employee - Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User attendance data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active period or no attendance records
 */
router.get('/employee/attendance', 
  requireRole('employee'), 
  attendanceController.getUserAttendance
);

/**
 * @swagger
 * /api/v1/employee/attendance/{periodId}:
 *   get:
 *     summary: Get user attendance for specific period (Employee)
 *     tags: [Employee - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance period ID
 *     responses:
 *       200:
 *         description: User attendance data for specific period
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Period not found
 */
router.get('/employee/attendance/:periodId', 
  requireRole('employee'), 
  attendanceController.getUserAttendanceInPeriod
);

/**
 * @swagger
 * /api/v1/attendance-periods:
 *   get:
 *     summary: List attendance periods
 *     tags: [Common - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of periods to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of periods to skip
 *       - in: query
 *         name: include_processed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include processed periods
 *     responses:
 *       200:
 *         description: List of attendance periods
 *       401:
 *         description: Unauthorized
 */
router.get('/attendance-periods', 
  attendanceController.listPeriods
);

/**
 * @swagger
 * /api/v1/attendance-periods/active:
 *   get:
 *     summary: Get active attendance period
 *     tags: [Common - Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active attendance period data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active period found
 */
router.get('/attendance-periods/active', 
  attendanceController.getActivePeriod
);

/**
 * @swagger
 * /api/v1/attendance-periods/working-days:
 *   get:
 *     summary: Calculate working days in a date range
 *     tags: [Common - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Working days calculation
 *       400:
 *         description: Missing or invalid date parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/attendance-periods/working-days', 
  attendanceController.calculateWorkingDays
);

/**
 * @swagger
 * /api/v1/attendance-periods/{id}:
 *   get:
 *     summary: Get attendance period by ID
 *     tags: [Common - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance period ID
 *     responses:
 *       200:
 *         description: Attendance period data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Period not found
 */
router.get('/attendance-periods/:id', 
  attendanceController.getPeriodById
);

// ===== ADMIN ROUTES =====

/**
 * @swagger
 * /api/v1/admin/attendance/{periodId}:
 *   get:
 *     summary: Get all attendance records for a period (Admin only)
 *     tags: [Admin - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance period ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records per page
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by specific user ID
 *     responses:
 *       200:
 *         description: Attendance records for the period
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
 *                     attendance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           attendance_date:
 *                             type: string
 *                             format: date
 *                           check_in_time:
 *                             type: string
 *                           notes:
 *                             type: string
 *                           user_id:
 *                             type: integer
 *                           username:
 *                             type: string
 *                           full_name:
 *                             type: string
 *                           email:
 *                             type: string
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: Attendance period not found
 */
router.get('/admin/attendance/:periodId', 
  requireRole('admin'), 
  attendanceController.getAttendanceForPeriod
);

/**
 * @swagger
 * /api/v1/admin/attendance/{periodId}/summary:
 *   get:
 *     summary: Get attendance summary for a period (Admin only)
 *     tags: [Admin - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance period ID
 *     responses:
 *       200:
 *         description: Attendance summary with statistics
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
 *                     period_id:
 *                       type: integer
 *                     period_name:
 *                       type: string
 *                     start_date:
 *                       type: string
 *                       format: date
 *                     end_date:
 *                       type: string
 *                       format: date
 *                     total_working_days:
 *                       type: integer
 *                     employees_with_attendance:
 *                       type: integer
 *                     total_attendance_records:
 *                       type: integer
 *                     total_employees:
 *                       type: integer
 *                     employee_breakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user_id:
 *                             type: integer
 *                           username:
 *                             type: string
 *                           full_name:
 *                             type: string
 *                           attendance_days:
 *                             type: integer
 *                           attendance_percentage:
 *                             type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: Attendance period not found
 */
router.get('/admin/attendance/:periodId/summary', 
  requireRole('admin'), 
  attendanceController.getAttendanceSummaryForPeriod
);

/**
 * @swagger
 * /api/v1/admin/attendance-periods:
 *   get:
 *     summary: Get all attendance periods (Admin only)
 *     tags: [Admin - Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of periods per page
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: payrollProcessed
 *         schema:
 *           type: boolean
 *         description: Filter by payroll processing status
 *     responses:
 *       200:
 *         description: List of attendance periods with metadata
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
 *                     periods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           start_date:
 *                             type: string
 *                             format: date
 *                           end_date:
 *                             type: string
 *                             format: date
 *                           is_active:
 *                             type: boolean
 *                           payroll_processed:
 *                             type: boolean
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                           created_by_username:
 *                             type: string
 *                           created_by_name:
 *                             type: string
 *                           total_attendance_records:
 *                             type: integer
 *                           employees_with_attendance:
 *                             type: integer
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 */
router.get('/admin/attendance-periods', 
  requireRole('admin'), 
  attendanceController.getAllPeriods
);

module.exports = router; 