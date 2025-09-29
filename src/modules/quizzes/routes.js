// modules/quizzes/routes.js
import { Router } from 'express';
import {
  getQuizzesForLesson,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitQuiz,
  getMySubmissions,
  getSubmissionDetails,
  getAllSubmissions,
  gradeSubmission,
} from './controller.js';
import {
  createQuizSchema,
  updateQuizSchema,
  quizIdSchema,
  lessonIdSchema,
  createQuestionSchema,
  updateQuestionSchema,
  submitQuizSchema,
  gradeSubmissionSchema,
  submissionIdSchema,
} from './schemas.js';
import validateMiddleware from '../../middleware/validate.js';
import authMiddleware from '../../middleware/auth.js';
import roleMiddleware from '../../middleware/roles.js';
import parseJsonFields from '../../middleware/parseJsonFieldls.js'; // Typo in provided, assume parseJsonFields
import { uploadQuizImage } from '../../utils/uploadHandler.js'; // Assume you add this
import catchAsync from '../../utils/cathAsync.js';
import prisma from '../../loaders/prisma.js';

const router = Router();

const getQuizMiddleware = catchAsync(async (req, res, next) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.quizId || req.params.id },
    include: { lesson: true },
  });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }
  req.quiz = quiz;
  next();
});

// All routes require auth
router.use(authMiddleware);

// Get quizzes for a lesson (user or admin)
router.get(
  '/:lessonId/quiz',
  validateMiddleware(lessonIdSchema, 'params'),
  getQuizzesForLesson
);

// Create quiz for lesson (admin)
router.post(
  '/:lessonId/quiz',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(lessonIdSchema, 'params'),
  validateMiddleware(createQuizSchema),
  createQuiz
);

// Get quiz by ID
router.get(
  '/:id',
  validateMiddleware(quizIdSchema, 'params'),
  getQuizById
);

// Update quiz
router.put(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(quizIdSchema, 'params'),
  validateMiddleware(updateQuizSchema),
  updateQuiz
);

// Delete quiz
router.delete(
  '/:id',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(quizIdSchema, 'params'),
  deleteQuiz
);

// Create question
router.post(
  '/:quizId/questions',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  getQuizMiddleware,
  uploadQuizImage.fields([
    { name: 'questionImage', maxCount: 1 },
    { name: 'choiceImages', maxCount: 10 },
  ]),
  parseJsonFields,
  validateMiddleware(createQuestionSchema),
  createQuestion
);

// Update question
router.put(
  '/:quizId/questions/:questionId',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  getQuizMiddleware,
  uploadQuizImage.fields([
    { name: 'questionImage', maxCount: 1 },
    { name: 'choiceImages', maxCount: 10 },
  ]),
  parseJsonFields,
  validateMiddleware(updateQuestionSchema),
  updateQuestion
);

// Delete question
router.delete(
  '/:quizId/questions/:questionId',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(quizIdSchema, 'params'),
  deleteQuestion
);

// Submit quiz (user)
router.post(
  '/:quizId/submit',
  validateMiddleware(quizIdSchema, 'params'),
  validateMiddleware(submitQuizSchema),
  submitQuiz
);

// Get my submissions (user)
router.get(
  '/:quizId/my-submissions',
  validateMiddleware(quizIdSchema, 'params'),
  getMySubmissions
);

// Get submission details (user)
router.get(
  '/:quizId/submissions/:submissionId',
  validateMiddleware(quizIdSchema, 'params'),
  validateMiddleware(submissionIdSchema, 'params'),
  getSubmissionDetails
);

// Get all submissions (admin)
router.get(
  '/:quizId/submissions',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(quizIdSchema, 'params'),
  getAllSubmissions
);

// Grade submission (admin)
router.post(
  '/:quizId/submissions/:submissionId/grade',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(quizIdSchema, 'params'),
  validateMiddleware(submissionIdSchema, 'params'),
  validateMiddleware(gradeSubmissionSchema),
  gradeSubmission
);

export default router;