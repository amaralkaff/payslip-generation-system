const express = require('express');
const userController = require('../controllers/user.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');
const { validate } = require('../utils/validation');
const { userSchemas } = require('../utils/validation');

/**
 * User Routes
 * Routes for user profile management and admin user operations
 */

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         username:
 *           type: string
 *           example: "john_doe"
 *         role:
 *           type: string
 *           enum: [admin, employee]
 *           example: "employee"
 *         salary:
 *           type: number
 *           format: decimal
 *           example: 5000.00
 *         full_name:
 *           type: string
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@company.com"
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     UserUpdate:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           example: "john_doe_updated"
 *         full_name:
 *           type: string
 *           example: "John Updated Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.updated@company.com"
 *         role:
 *           type: string
 *           enum: [admin, employee]
 *           example: "employee"
 *         salary:
 *           type: number
 *           format: decimal
 *           example: 5500.00
 *         is_active:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', userController.getProfile);

/**
 * @swagger
 * /api/v1/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: "John Updated Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.updated@company.com"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email already exists
 */
router.put('/profile', userController.updateProfile);

// ===== ADMIN ROUTES =====

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin - Users]
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
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, employee]
 *         description: Filter by user role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in username, full name, or email
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, username, full_name, role]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of users
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 */
router.get('/admin/users', 
  requireRole('admin'), 
  userController.getAllUsers
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: User not found
 */
router.get('/admin/users/:id', 
  requireRole('admin'), 
  userController.getUserById
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   put:
 *     summary: Update user (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email already exists
 */
router.put('/admin/users/:id', 
  requireRole('admin'), 
  userController.updateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate user (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deactivated successfully
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
 *                     message:
 *                       type: string
 *                       example: "User deactivated successfully"
 *                     userId:
 *                       type: integer
 *                       example: 123
 *       400:
 *         description: Cannot deactivate self
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:id/deactivate', 
  requireRole('admin'), 
  userController.deactivateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/activate:
 *   patch:
 *     summary: Activate user (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:id/activate', 
  requireRole('admin'), 
  userController.activateUser
);

/**
 * @swagger
 * /api/v1/admin/users/statistics:
 *   get:
 *     summary: Get user statistics (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
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
 *                     total_users:
 *                       type: integer
 *                       example: 101
 *                     total_employees:
 *                       type: integer
 *                       example: 100
 *                     total_admins:
 *                       type: integer
 *                       example: 1
 *                     active_users:
 *                       type: integer
 *                       example: 95
 *                     inactive_users:
 *                       type: integer
 *                       example: 6
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Admin only)
 */
router.get('/admin/users/statistics', 
  requireRole('admin'), 
  userController.getUserStatistics
);

module.exports = router; 