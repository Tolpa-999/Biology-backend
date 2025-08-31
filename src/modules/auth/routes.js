// Updated router code
import { Router } from 'express';
import {
  signup,
  login,
  refreshToken,
  logout,
  changePassword,
  getProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  telegramAuth, // Assuming keeping it
} from './controller.js';
import { 
  loginSchema, 
  signupSchema, 
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema 
} from './schemas.js';
import validateMiddleware from '../../middleware/validate.js';
import rateLimitMiddleware from '../../middleware/rateLimit.js';
import authMiddleware from '../../middleware/auth.js';

const router = Router();

// Public routes
router.post(
  '/signup',
  rateLimitMiddleware,
  validateMiddleware(signupSchema),
  signup
);

router.post(
  '/login',
  rateLimitMiddleware,
  validateMiddleware(loginSchema),
  login
);

router.post(
  '/telegram-auth',
  rateLimitMiddleware,
  telegramAuth // Assuming keeping the telegramAuth endpoint
);

router.post(
  '/verify-email',
  rateLimitMiddleware,
  validateMiddleware(verifyEmailSchema),
  verifyEmail
);

router.post(
  '/resend-verification',
  rateLimitMiddleware,
  validateMiddleware(resendVerificationSchema),
  resendVerification
);

router.post(
  '/forgot-password',
  rateLimitMiddleware,
  validateMiddleware(forgotPasswordSchema),
  forgotPassword
);

router.post(
  '/reset-password',
  rateLimitMiddleware,
  validateMiddleware(resetPasswordSchema),
  resetPassword
);

router.post(
  '/refresh',
  validateMiddleware(refreshSchema),
  refreshToken
);

// Protected routes (require authentication)
router.post(
  '/logout',
  authMiddleware,
  logout
);

router.post(
  '/change-password',
  authMiddleware,
  validateMiddleware(changePasswordSchema),
  changePassword
);

router.get(
  '/profile',
  authMiddleware,
  getProfile
);

export default router;