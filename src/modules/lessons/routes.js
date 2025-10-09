import { Router } from 'express';
import {
  getAllLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonContents,
  addContentToLesson,
  updateContent,
  deleteContent,
  getLessonStats,
  reorderLessons,
  createVideoContent,
  completeVideoUpload,
  getSignedUrl,
  getUploadByGuid,
  refreshUploadHeaders,
  saveUploadUrl,
} from './controller.js';
import {
  createLessonSchema,
  updateLessonSchema,
  lessonIdSchema,
  lessonQuerySchema,
  contentSchema,
  contentIdSchema,
} from './schema.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';
import parseJsonFields from '../../middleware/parseJsonFieldls.js';

import { upload } from "../../utils/uploadHandler.js";
import Joi from 'joi';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Public routes (published lessons)
router.get(
  '/',
  // validateMiddleware(lessonQuerySchema, 'query'),
  getAllLessons
);

router.get(
  '/:id',
  validateMiddleware(lessonIdSchema, 'params'),
  getLessonById
);

// Admin and center admin routes
router.post(
  '/',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
  validateMiddleware(createLessonSchema),
  createLesson
);

router.put(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  parseJsonFields,
//   validateMiddleware(lessonIdSchema, 'params'),
  validateMiddleware(updateLessonSchema),
  updateLesson
);

router.delete(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
//   validateMiddleware(lessonIdSchema, 'params'),
  deleteLesson
);

// Content management routes
router.get(
  '/:id/contents',
//   validateMiddleware(lessonIdSchema, 'params'),
  getLessonContents
);

router.post(
  '/:id/contents',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  upload.single('file'),
  parseJsonFields,
//   validateMiddleware(lessonIdSchema, 'params'),
  validateMiddleware(contentSchema),
  addContentToLesson
);

router.put(
  '/:id/contents/:contentId',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  upload.single('file'),
  parseJsonFields,
//   validateMiddleware(lessonIdSchema, 'params'),
//   validateMiddleware(contentIdSchema, 'params'),
  // validateMiddleware(contentSchema),
  updateContent
);

router.delete(
  '/:id/contents/:contentId',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
//   validateMiddleware(lessonIdSchema, 'params'),
//   validateMiddleware(contentIdSchema, 'params'),
  deleteContent
);

// Stats and utilities
router.get(
  '/:id/stats',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
//   validateMiddleware(lessonIdSchema, 'params'),
  getLessonStats
);

router.post(
  '/reorder',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(Joi.object({
    lessons: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      order: Joi.number().integer().min(0).required()
    })).required()
  })),
  reorderLessons
);






// bunny routes 
// ... existing ...
router.post(
  '/:id/contents/create-video',
   roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
    // validateMiddleware(/* schema */),
     createVideoContent
    );

router.post(
  '/:id/contents/complete-upload',
   roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
    // validateMiddleware(/* schema */),
     completeVideoUpload
    );


router.post(
  '/uploads/refresh',
   roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
    refreshUploadHeaders
  );
router.post(
  '/uploads/save',
   roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
    saveUploadUrl
  );
router.get(
  '/uploads/:guid', 
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']), 
  getUploadByGuid);
    



router.get(
  '/contents/:contentId/signed-url', 
  authMiddleware, 
  getSignedUrl
);


export default router
;
