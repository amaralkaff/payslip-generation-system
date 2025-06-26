/**
 * Minimal Reimbursement Routes
 * Only core endpoints required by README
 */

const express = require('express');
const router = express.Router();
const reimbursementController = require('../controllers/reimbursement.controller');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/employee/reimbursements:
 *   post:
 *     summary: Submit reimbursement (Employee)
 *     description: |
 *       💰 **STEP 5: Submit expense reimbursement (Employee required)**
 *       
 *       **What this does:**
 *       - Records business expenses for reimbursement
 *       - Adds to employee's total take-home pay
 *       - Supports various expense categories
 *       
 *       **Auto-filled with realistic values:**
 *       - ✅ Amount: 150,000 IDR (travel expense)
 *       - ✅ Description: "Travel expenses for client meeting"
 *       - ✅ Category: "travel"
 *       
 *       **Available categories:** travel, meals, accommodation, equipment, training, communication, other
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
 *               - amount
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 example: 150000
 *                 default: 150000
 *                 description: "Reimbursement amount in IDR (Indonesian Rupiah)"
 *               description:
 *                 type: string
 *                 example: "Travel expenses for client meeting"
 *                 default: "Travel expenses for client meeting"
 *                 description: "Description of expense to be reimbursed"
 *               category:
 *                 type: string
 *                 enum: [travel, meals, accommodation, equipment, training, communication, other]
 *                 example: "travel"
 *                 default: "travel"
 *                 description: "Category of reimbursement expense"
 *           examples:
 *             travel:
 *               summary: "Travel expense reimbursement"
 *               value:
 *                 amount: 150000
 *                 description: "Travel expenses for client meeting"
 *                 category: "travel"
 *             meals:
 *               summary: "Meal expense reimbursement"
 *               value:
 *                 amount: 75000
 *                 description: "Business lunch with client"
 *                 category: "meals"
 *     responses:
 *       201:
 *         description: Reimbursement submitted successfully
 *       400:
 *         description: Invalid reimbursement data
 */
router.post('/employee/reimbursements', authenticateToken, reimbursementController.submitReimbursement);

module.exports = router;