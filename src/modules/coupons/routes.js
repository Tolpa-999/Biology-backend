import { Router } from 'express';
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponById,
  getCouponByCode,
  getAllCoupons,
  applyCoupon,
  deactivateCoupon,
  activateCoupon,
  assignUsersToCoupon,
  getCouponUsage,
  getCouponUsageStats,
  getUserCouponUsage,
  validateCoupon,
  getCouponEnrollments,
  bulkCreateCoupons,
} from './controller.js';
import {
  createCouponSchema,
  updateCouponSchema,
  couponIdSchema,
  couponCodeSchema,
  applyCouponSchema,
  assignUsersToCouponSchema,
  couponQuerySchema,
  couponUsageQuerySchema,
} from './schema.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';
import parseJsonFields from '../../middleware/parseJsonFieldls.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Public routes - coupon validation and application
router.post(
  '/validate',
  validateMiddleware(applyCouponSchema),
  validateCoupon
);

router.post(
  '/apply',
  validateMiddleware(applyCouponSchema),
  applyCoupon
);

// Admin and center admin routes
router.post(
  '/',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(createCouponSchema),
  createCoupon
);

router.post(
  '/bulk',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  bulkCreateCoupons
);

router.get(
  '/',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponQuerySchema, 'query'),
  getAllCoupons
);

router.get(
  '/usage',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponUsageQuerySchema, 'query'),
  getCouponUsage
);

router.get(
  '/usage/stats',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  getCouponUsageStats
);

router.get(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  getCouponById
);

router.get(
  '/code/:code',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponCodeSchema, 'params'),
  getCouponByCode
);

router.put(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(couponIdSchema, 'params'),
  validateMiddleware(updateCouponSchema),
  updateCoupon
);

router.delete(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  deleteCoupon
);

router.patch(
  '/:id/deactivate',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  deactivateCoupon
);

router.patch(
  '/:id/activate',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  activateCoupon
);

router.post(
  '/:id/assign-users',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  validateMiddleware(assignUsersToCouponSchema),
  assignUsersToCoupon
);

router.get(
  '/:id/enrollments',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(couponIdSchema, 'params'),
  getCouponEnrollments
);

// User-specific routes
router.get(
  '/user/usage',
  getUserCouponUsage
);

export default router;