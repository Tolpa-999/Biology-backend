// duplication/routes.js
import { Router } from 'express';
import {
  copyContent,
  copyLesson,
  copyCourse,
} from './controller.js';
import {
  copyContentSchema,
  copyLessonSchema,
  copyCourseSchema,
  idSchema,
} from './schema.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';
import parseJsonFields from '../../middleware/parseJsonFieldls.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Copy content to a target lesson (Admin and Center Admin only)
router.post(
  '/content',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(copyContentSchema),
  copyContent
);

// Copy lesson to a target course (Admin and Center Admin only)
router.post(
  '/lesson',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(copyLessonSchema),
  copyLesson
);

// Copy entire course to a new course (Admin and Center Admin only)
router.post(
  '/course',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(copyCourseSchema),
  copyCourse
);

export default router;