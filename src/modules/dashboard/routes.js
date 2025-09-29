// src/modules/dashboard/routes.js
import { Router } from 'express';
import {
  getPlatformStats,
  getUserStats,
  getAllUsers,
  getUserDetails,
  toggleUserRole,
  getCourseStats,
  getAllCourses,
  getCourseDetails,
  getEnrollmentStats,
  getPaymentStats,
  getActivityLogs,
  validateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  updateCoupon,
  createCoupon,
  getCouponDetails,
  getAllCoupons,
  getCouponStats,
  deleteUser,
  getCourseCoupons,
} from './controller.js';
import {
  dashboardQuerySchema,
  userIdSchema,
  courseIdSchema,
  couponQuerySchema,
  couponCreateSchema,
  couponIdSchema,
  couponUpdateSchema,
  couponCodeSchema,
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

router.patch(
  '/users/:id',
  // validateMiddleware(userIdSchema, 'params'),
  toggleUserRole
);


router.delete(
  '/users/:id',
  // validateMiddleware(userIdSchema, 'params'),
  deleteUser
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




router.post(
  '/coupons',
  validateMiddleware(couponCreateSchema),
  createCoupon
);


router.get(
  '/coupons',
  // validateMiddleware(couponQuerySchema, 'query'),
  getAllCoupons
);

router.get(
  '/coupons/:id',
  validateMiddleware(couponIdSchema, 'params'),
  getCouponDetails
);


router.put(
  '/coupons/:id',
  validateMiddleware(couponIdSchema, 'params'),
  validateMiddleware(couponUpdateSchema),
  updateCoupon
);

router.get(
  '/coupons/stats/get',
  // validateMiddleware(couponQuerySchema, 'query'),
  getCouponStats
);


router.patch(
  '/coupons/:id/toggle',
  validateMiddleware(couponIdSchema, 'params'),
  toggleCouponStatus
);

router.delete(
  '/coupons/:id',
  validateMiddleware(couponIdSchema, 'params'),
  deleteCoupon
);

router.post(
  '/coupons/validate',
  validateMiddleware(couponCodeSchema),
  validateCoupon
);


router.get(
  '/:id/coupons',
  getCourseCoupons
);


export default router;