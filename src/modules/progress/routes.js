import { Router } from 'express';
import {
  getCourseContent,
  markContentCompleted,
  markLessonCompleted,
  markCourseCompleted,
  getCourseProgress,
  getUserProgress,
  getProgressStats,
  resetProgress,
  syncProgress,
  bulkMarkContentCompleted,
  getProgressHistory
} from './controller.js';
import {
  progressQuerySchema,
  contentProgressSchema,
  lessonProgressSchema,
  courseProgressSchema,
  progressIdSchema,
  userProgressQuerySchema,
  bulkProgressSchema,
  progressStatsSchema,
  resetProgressSchema,
  syncProgressSchema
} from './schemas.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get course content in order (quizzes at top of lessons)
router.get(
  '/course/:courseId',
  validateMiddleware(progressIdSchema, 'params'),
  getCourseContent
);

// Mark content as completed
router.post(
  '/content/completed',
  validateMiddleware(contentProgressSchema),
  markContentCompleted
);

// Mark lesson as completed
router.post(
  '/lesson/completed',
  validateMiddleware(lessonProgressSchema),
  markLessonCompleted
);

// Mark course as completed
router.post(
  '/course/completed',
  validateMiddleware(courseProgressSchema),
  markCourseCompleted
);

// Get course completion percentage
router.get(
  '/course/:courseId/progress',
  validateMiddleware(progressIdSchema, 'params'),
  getCourseProgress
);

// Get user progress across all courses
router.get(
  '/user/:userId/progress',
  validateMiddleware(progressIdSchema, 'params'),
  validateMiddleware(userProgressQuerySchema, 'query'),
  getUserProgress
);

// Get progress statistics (admin only)
router.get(
  '/stats',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(progressStatsSchema, 'query'),
  getProgressStats
);

// Reset progress
router.delete(
  '/reset',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(resetProgressSchema),
  resetProgress
);

// Sync progress across enrollments
router.post(
  '/sync',
  validateMiddleware(syncProgressSchema),
  syncProgress
);

// Bulk mark content as completed
router.post(
  '/content/bulk-completed',
  validateMiddleware(bulkProgressSchema),
  bulkMarkContentCompleted
);

// Get progress history
router.get(
  '/history',
  validateMiddleware(progressQuerySchema, 'query'),
  getProgressHistory
);

export default router;