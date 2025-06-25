const express = require('express');
const reimbursementController = require('../controllers/reimbursement.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');

/**
 * Reimbursement Routes
 * All routes for reimbursement management
 */

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ReimbursementRecord:
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
 *         description:
 *           type: string
 *           example: "Business lunch with client"
 *         amount:
 *           type: number
 *           format: float
 *           example: 250000.00
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           example: "pending"
 *         receipt_url:
 *           type: string
 *           example: "https://storage/receipts/receipt_123.pdf"
 *         submitted_at:
 *           type: string
 *           format: date-time
 *         processed_at:
 *           type: string
 *           format: date-time
 *         processed_by:
 *           type: integer
 *           example: 1
 *         admin_notes:
 *           type: string
 *           example: "Approved - valid business expense"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     
 *     ReimbursementSubmissionRequest:
 *       type: object
 *       required:
 *         - description
 *         - amount
 *       properties:
 *         description:
 *           type: string
 *           minLength: 1
 *           maxLength: 500
 *           example: "Business lunch with client"
 *         amount:
 *           type: number
 *           format: float
 *           minimum: 0.01
 *           example: 250000.00
 *         receipt_url:
 *           type: string
 *           format: uri
 *           example: "https://storage/receipts/receipt_123.pdf"
 *     
 *     ReimbursementStatusUpdateRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [approved, rejected]
 *           example: "approved"
 *         admin_notes:
 *           type: string
 *           maxLength: 500
 *           example: "Approved - valid business expense"
 *     
 *     ReimbursementSummary:
 *       type: object
 *       properties:
 *         period_id:
 *           type: integer
 *           example: 1
 *         period_name:
 *           type: string
 *           example: "January 2024"
 *         total_submissions:
 *           type: integer
 *           example: 45
 *         pending_count:
 *           type: integer
 *           example: 12
 *         approved_count:
 *           type: integer
 *           example: 28
 *         rejected_count:
 *           type: integer
 *           example: 5
 *         total_amount_submitted:
 *           type: number
 *           format: float
 *           example: 12500000.00
 *         total_amount_approved:
 *           type: number
 *           format: float
 *           example: 9800000.00
 *         total_amount_rejected:
 *           type: number
 *           format: float
 *           example: 750000.00
 *         employees_with_reimbursements:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               full_name:
 *                 type: string
 *               total_submissions:
 *                 type: integer
 *               approved_amount:
 *                 type: number
 *                 format: float
 */

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

/**
 * Employee Reimbursement Routes
 */

/**
 * @swagger
 * /api/v1/employee/reimbursements:
 *   post:
 *     summary: Submit reimbursement request (Employee)
 *     description: Submit a new reimbursement request for business expenses
 *     tags: [Employee - Reimbursements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReimbursementSubmissionRequest'
 *     responses:
 *       201:
 *         description: Reimbursement submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReimbursementRecord'
 *                 message:
 *                   type: string
 *                   example: "Reimbursement submitted successfully"
 *                 request_id:
 *                   type: string
 *       400:
 *         description: Invalid input data
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
 */
router.post('/employee/reimbursements', 
  requireRole('employee'), 
  reimbursementController.validateSubmitReimbursement,
  reimbursementController.submitReimbursement
);

/**
 * @swagger
 * /api/v1/employee/reimbursements:
 *   get:
 *     summary: Get user reimbursements for active period (Employee)
 *     description: Retrieve all reimbursement requests for the current user in the active attendance period
 *     tags: [Employee - Reimbursements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User reimbursements retrieved successfully
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
 *                     reimbursements:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ReimbursementRecord'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_submissions:
 *                           type: integer
 *                           example: 3
 *                         pending_count:
 *                           type: integer
 *                           example: 1
 *                         approved_count:
 *                           type: integer
 *                           example: 2
 *                         rejected_count:
 *                           type: integer
 *                           example: 0
 *                         total_amount_submitted:
 *                           type: number
 *                           format: float
 *                           example: 750000.00
 *                         total_amount_approved:
 *                           type: number
 *                           format: float
 *                           example: 500000.00
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
 *         description: No active attendance period or no reimbursements found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/employee/reimbursements', 
  requireRole('employee'), 
  reimbursementController.getUserReimbursements
);

/**
 * @swagger
 * /api/v1/employee/reimbursements/{periodId}:
 *   get:
 *     summary: Get user reimbursements for specific period (Employee)
 *     description: Retrieve all reimbursement requests for the current user in a specific attendance period
 *     tags: [Employee - Reimbursements]
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
 *         description: User reimbursements for specific period retrieved successfully
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
 *                     reimbursements:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ReimbursementRecord'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_submissions:
 *                           type: integer
 *                           example: 3
 *                         pending_count:
 *                           type: integer
 *                           example: 1
 *                         approved_count:
 *                           type: integer
 *                           example: 2
 *                         rejected_count:
 *                           type: integer
 *                           example: 0
 *                         total_amount_submitted:
 *                           type: number
 *                           format: float
 *                           example: 750000.00
 *                         total_amount_approved:
 *                           type: number
 *                           format: float
 *                           example: 500000.00
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
 *         description: Period not found or no reimbursements found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/employee/reimbursements/:periodId', 
  requireRole('employee'), 
  reimbursementController.getUserReimbursementsInPeriod
);

/**
 * Admin Reimbursement Routes
 */

/**
 * @swagger
 * /api/v1/admin/reimbursements/{id}/status:
 *   patch:
 *     summary: Update reimbursement status (Admin)
 *     description: Approve or reject a reimbursement request
 *     tags: [Admin - Reimbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reimbursement ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReimbursementStatusUpdateRequest'
 *     responses:
 *       200:
 *         description: Reimbursement status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReimbursementRecord'
 *                 message:
 *                   type: string
 *                   example: "Reimbursement status updated successfully"
 *                 request_id:
 *                   type: string
 *       400:
 *         description: Invalid input data or reimbursement already processed
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
 *         description: Reimbursement not found
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
 */
router.patch('/admin/reimbursements/:id/status', 
  requireRole('admin'), 
  reimbursementController.validateUpdateStatus,
  reimbursementController.updateStatus
);

/**
 * @swagger
 * /api/v1/admin/reimbursements/{periodId}:
 *   get:
 *     summary: Get all reimbursements for period (Admin)
 *     description: Retrieve all reimbursement requests from all employees for a specific attendance period
 *     tags: [Admin - Reimbursements]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter by reimbursement status
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
 *         description: Reimbursements retrieved successfully
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
 *                     reimbursements:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/ReimbursementRecord'
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
router.get('/admin/reimbursements/:periodId', 
  requireRole('admin'), 
  reimbursementController.getReimbursementsByPeriod
);

/**
 * @swagger
 * /api/v1/admin/reimbursements/{periodId}/summary:
 *   get:
 *     summary: Get reimbursement summary for period (Admin)
 *     description: Get aggregated reimbursement statistics and summary for a specific attendance period
 *     tags: [Admin - Reimbursements]
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
 *         description: Reimbursement summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReimbursementSummary'
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
 *         description: Period not found or no reimbursements found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/admin/reimbursements/:periodId/summary', 
  requireRole('admin'), 
  reimbursementController.getReimbursementSummaryByPeriod
);

/**
 * @swagger
 * /api/v1/admin/reimbursements/pending/count:
 *   get:
 *     summary: Get pending reimbursements count (Admin)
 *     description: Get the count of all pending reimbursement requests across all periods
 *     tags: [Admin - Reimbursements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending reimbursements count retrieved successfully
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
 *                     pending_count:
 *                       type: integer
 *                       example: 15
 *                     total_pending_amount:
 *                       type: number
 *                       format: float
 *                       example: 2750000.00
 *                     oldest_pending_date:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-05T10:30:00Z"
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
router.get('/admin/reimbursements/pending/count', 
  requireRole('admin'), 
  reimbursementController.getPendingCount
);

module.exports = router; 