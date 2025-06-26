/**
 * Minimal Overtime Routes
 * Only core endpoints required by README
 */

const express = require('express');
const router = express.Router();
const overtimeController = require('../controllers/overtime.controller');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/employee/overtime:
 *   post:
 *     summary: Submit overtime (Employee)
 *     description: |
 *       ⏰ **STEP 4: Submit overtime hours (Employee required)**
 *       
 *       **What this does:**
 *       - Records overtime work beyond regular 8-hour day
 *       - Pays 2x the regular hourly rate
 *       - Maximum 3 hours per day allowed
 *       
 *       **Auto-filled with realistic values:**
 *       - ✅ Date: July 15, 2025 (same day as attendance)
 *       - ✅ Hours: 2.5 hours (within 3-hour limit)
 *       - ✅ Reason: "Project deadline work"
 *       
 *       **Business rule:** 2x salary rate for overtime hours
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
 *               - overtime_date
 *               - hours_worked
 *               - description
 *             properties:
 *               overtime_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-04-16"
 *                 default: "2025-04-16"
 *                 description: "Date within active period (use April 2025 dates)"
 *               hours_worked:
 *                 type: number
 *                 format: float
 *                 minimum: 0.1
 *                 maximum: 3.0
 *                 example: 2.5
 *                 default: 2.5
 *                 description: "Hours worked (max 3 hours per day, 2x salary rate)"
 *               description:
 *                 type: string
 *                 example: "Project deadline work"
 *                 default: "Project deadline work"
 *                 description: "Reason for overtime work"
 *           examples:
 *             deadline:
 *               summary: "⏰ Project Deadline (2.5 hrs)"
 *               description: "Overtime for project deadline - 2.5 hours"
 *               value:
 *                 overtime_date: "2025-04-16"
 *                 hours_worked: 2.5
 *                 description: "Project deadline work"
 *             maintenance:
 *               summary: "⏰ System Maintenance (1.5 hrs)"
 *               description: "Overtime for system maintenance - 1.5 hours"
 *               value:
 *                 overtime_date: "2025-04-17"
 *                 hours_worked: 1.5
 *                 description: "Emergency system maintenance"
 *             maximum:
 *               summary: "⏰ Maximum Overtime (3 hrs)"
 *               description: "Maximum allowed overtime - 3 hours"
 *               value:
 *                 overtime_date: "2025-04-18"
 *                 hours_worked: 3.0
 *                 description: "Critical issue resolution"
 *     responses:
 *       201:
 *         description: Overtime submitted successfully
 *       400:
 *         description: Invalid overtime data or exceeds 3 hour limit
 *       409:
 *         description: Overtime already submitted for this date
 */
router.post('/employee/overtime', authenticateToken, overtimeController.submitOvertime);

module.exports = router;