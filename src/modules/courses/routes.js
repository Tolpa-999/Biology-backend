import { Router } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseUsers,
  enrollUserInCourse,
  removeUserFromCourse,
  getCourseStats,
} from './controller.js';
import {
  createCourseSchema,
  updateCourseSchema,
  courseIdSchema,
  courseQuerySchema,
  enrollUserSchema,
  courseUsersQuerySchema,
} from './schemas.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';
import parseJsonFields from '../../middleware/parseJsonFieldls.js';


import { upload } from "../../utils/uploadHandler.js";  // ✅ use global handler

const router = Router();



// All routes require authentication
router.use(authMiddleware);



// done
// Public routes (published courses)
router.get(
  '/',
  // validateMiddleware(courseQuerySchema, 'query'),
  getAllCourses
);


// done
router.get(
  '/:id',
  validateMiddleware(courseIdSchema, 'params'),
  getCourseById
);


// done
// Admin and center admin routes
router.post(
  '/',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  upload.single('thumbnail'),      
  parseJsonFields,
  validateMiddleware(createCourseSchema), // Then Joi sees req.body
  createCourse                         // Finally your controller
);




// done
router.put(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  upload.single('thumbnail'),
  // validateMiddleware(courseIdSchema, 'params'),
  validateMiddleware(updateCourseSchema, "body", true),
  updateCourse
);



// not done
router.delete(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(courseIdSchema, 'params'),
  deleteCourse
);


// not done
router.get(
  '/:id/users',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  // validateMiddleware(courseIdSchema, 'params'),
  // validateMiddleware(courseUsersQuerySchema, 'query'),
  getCourseUsers
);


// not done
router.post(
  '/:id/enroll',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  // validateMiddleware(courseIdSchema, 'params'),
  validateMiddleware(enrollUserSchema),
  enrollUserInCourse
);


// not done
router.delete(
  '/:id/users/:userId',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(courseIdSchema, 'params'),
  removeUserFromCourse
);


// not done
router.get(
  '/:id/stats',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(courseIdSchema, 'params'),
  getCourseStats
);

export default router;