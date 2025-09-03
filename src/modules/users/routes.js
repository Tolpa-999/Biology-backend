import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  bulkUserAction,
  getUserStats
} from './controller.js';

import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userQuerySchema,
  bulkActionSchema
} from './schemas.js';

import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
// import authorize from '../../middleware/authorize.js';

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
// router.use(authorize(['ADMIN']));

// User management routes
router.get(
  '/',
  validateMiddleware(userQuerySchema, 'query'),
  getAllUsers
);

router.get(
  '/stats',
  getUserStats
);

router.get(
  '/:id',
  validateMiddleware(userIdSchema, 'params'),
  getUserById
);

router.post(
  '/',
  validateMiddleware(createUserSchema),
  createUser
);

router.put(
  '/:id',
  validateMiddleware(userIdSchema, 'params'),
  validateMiddleware(updateUserSchema),
  updateUser
);

router.delete(
  '/:id',
  validateMiddleware(userIdSchema, 'params'),
  deleteUser
);

router.patch(
  '/:id/toggle-status',
  validateMiddleware(userIdSchema, 'params'),
  toggleUserStatus
);

router.post(
  '/bulk-actions',
  validateMiddleware(bulkActionSchema),
  bulkUserAction
);

export default router;