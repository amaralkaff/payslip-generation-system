/**
 * Minimal Authentication Routes
 * Only login endpoint as required for system access
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: |
 *       🔐 **STEP 1: Login to get JWT token**
 *       
 *       **Ready-to-use Demo Credentials (auto-filled):**
 *       - ✅ Admin: `admin` / `admin123` (pre-filled below)
 *       - ✅ Employee: `employee001` / `emp001pass` (available in examples)
 *       
 *       **Instructions:**
 *       1. Click "Execute" with pre-filled admin credentials
 *       2. Copy the `token` from response 
 *       3. Click 🔒 "Authorize" button above
 *       4. Enter: `Bearer <your-token>`
 *       5. Test other endpoints!
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *                 default: "admin"
 *                 description: "Username (auto-filled with admin)"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *                 default: "admin123"
 *                 description: "Password (auto-filled with admin123)"
 *           examples:
 *             admin:
 *               summary: "🔧 Admin Login (Recommended)"
 *               description: "Login as admin to access all endpoints"
 *               value:
 *                 username: "admin"
 *                 password: "admin123"
 *             employee:
 *               summary: "👤 Employee Login"
 *               description: "Login as employee to test employee endpoints"
 *               value:
 *                 username: "employee001"
 *                 password: "emp001pass"
 *             employee2:
 *               summary: "👤 Employee Login (Alternative)"
 *               description: "Another employee account for testing"
 *               value:
 *                 username: "employee002"
 *                 password: "emp002pass"
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         role:
 *                           type: string
 *                 request_id:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

module.exports = router;