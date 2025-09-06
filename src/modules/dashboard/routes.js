// src/modules/dashboard/routes.js
import { Router } from 'express';
import {
  getPlatformStats,
  getUserStats,
  getAllUsers,
  getUserDetails,
  getCourseStats,
  getAllCourses,
  getCourseDetails,
  getEnrollmentStats,
  getPaymentStats,
  getActivityLogs,
} from './controller.js';
import {
  dashboardQuerySchema,
  userIdSchema,
  courseIdSchema,
} from './schema.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);

router.use(roleMiddleware(['ADMIN']));

// Platform overview
router.get(
  '/stats',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getPlatformStats
);

// Users management
router.get(
  '/users/stats',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getUserStats
);

router.get(
  '/users',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getAllUsers
);

router.get(
  '/users/:id',
  validateMiddleware(userIdSchema, 'params'),
  getUserDetails
);

// Courses management
router.get(
  '/courses/stats',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getCourseStats
);

router.get(
  '/courses',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getAllCourses
);

router.get(
  '/courses/:id',
  validateMiddleware(courseIdSchema, 'params'),
  getCourseDetails
);

// Enrollments
router.get(
  '/enrollments/stats',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getEnrollmentStats
);

// Payments
router.get(
  '/payments/stats',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getPaymentStats
);

// Activity logs
router.get(
  '/activity',
  // validateMiddleware(dashboardQuerySchema, 'query'),
  getActivityLogs
);

export default router;