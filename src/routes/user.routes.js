const express = require('express');
const authController = require('../controllers/auth.controller');
const { 
  authenticateToken, 
  requireRole, 
  addUserContext 
} = require('../middleware/auth');

/**
 * User Routes
 * Routes for user profile management
 */

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(addUserContext);

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
router.get('/profile', authController.getProfile);

module.exports = router; 