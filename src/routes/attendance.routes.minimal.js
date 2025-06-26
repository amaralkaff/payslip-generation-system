/**
 * Minimal Attendance Routes
 * Only core endpoints required by README
 */

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/admin/attendance-periods:
 *   post:
 *     summary: Create attendance period (Admin only)
 *     description: |
 *       📅 **STEP 2: Create new attendance period (Admin required)**
 *       
 *       **What this does:**
 *       - Creates a new attendance period for employee submissions
 *       - Automatically deactivates any existing active period
 *       - Sets up July 2025 as the new active period
 *       
 *       **Auto-filled with working dates:**
 *       - ✅ July 2025 period (pre-filled)
 *       - ✅ Working dates: July 1-31, 2025
 *       
 *       **Usage:** Just click "Execute" - all fields are pre-filled!
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
 *               - name
 *               - start_date
 *               - end_date
 *             properties:
 *               name:
 *                 type: string
 *                 example: "June 2025 Test"
 *                 default: "June 2025 Test"
 *                 description: "Period name (auto-filled)"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-01"
 *                 default: "2025-06-01"
 *                 description: "Start date (auto-filled)"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-30"
 *                 default: "2025-06-30"
 *                 description: "End date (auto-filled)"
 *           examples:
 *             june2025test:
 *               summary: "📅 June 2025 Test Period (Recommended)"
 *               description: "Create fresh June 2025 period for complete testing"
 *               value:
 *                 name: "June 2025 Test"
 *                 start_date: "2025-06-01"
 *                 end_date: "2025-06-30"
 *             may2025test:
 *               summary: "📅 May 2025 Test Period"
 *               description: "Alternative fresh period for additional testing"
 *               value:
 *                 name: "May 2025 Test"
 *                 start_date: "2025-05-01"
 *                 end_date: "2025-05-31"
 *     responses:
 *       201:
 *         description: Attendance period created successfully
 *       409:
 *         description: There is already an active attendance period
 */
router.post('/admin/attendance-periods', authenticateToken, requireAdmin, attendanceController.createPeriod);

/**
 * @swagger
 * /api/v1/employee/attendance:
 *   post:
 *     summary: Submit attendance (Employee)
 *     description: |
 *       👤 **STEP 3: Submit daily attendance (Employee required)**
 *       
 *       **What this does:**
 *       - Records employee attendance for a specific date
 *       - Must be within the active attendance period
 *       - Only weekdays allowed (Monday-Friday)
 *       
 *       **Auto-filled with working values:**
 *       - ✅ Date: July 15, 2025 (Monday)
 *       - ✅ Notes: "Regular work day"
 *       
 *       **Note:** Must create attendance period first (Step 2) and login as employee
 *     tags: [Employee]
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
 *                 example: "2025-04-15"
 *                 default: "2025-04-15"
 *                 description: "Attendance date (auto-filled with April 15)"
 *               notes:
 *                 type: string
 *                 example: "Regular work day"
 *                 default: "Regular work day"
 *                 description: "Optional notes (auto-filled)"
 *           examples:
 *             today:
 *               summary: "📅 Today's Attendance (Recommended)"
 *               description: "Submit attendance for today June 26"
 *               value:
 *                 attendance_date: "2025-06-26"
 *                 notes: "Regular work day"
 *             yesterday:
 *               summary: "📅 Yesterday's Attendance"
 *               description: "Submit attendance for yesterday June 25"
 *               value:
 *                 attendance_date: "2025-06-25"
 *                 notes: "Regular work day"
 *             lastweek:
 *               summary: "📅 Last Week Attendance"
 *               description: "Submit attendance for last week June 20"
 *               value:
 *                 attendance_date: "2025-06-20"
 *                 notes: "On time arrival"
 *     responses:
 *       201:
 *         description: Attendance submitted successfully
 *       400:
 *         description: Invalid attendance data or weekend submission
 *       409:
 *         description: Attendance already submitted for this date
 */
router.post('/employee/attendance', authenticateToken, attendanceController.submitAttendance);

module.exports = router;