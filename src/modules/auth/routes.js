import { loginSchema, signupSchema, changePasswordSchema } from './schemas.js';
import { Router } from 'express';
import {
  signup,
//   login,
  refreshToken,
  logout,
  changePassword,
  getProfile
} from './controller.js';
import validateMiddleware from '../../middleware/validate.js';
import rateLimitMiddleware from '../../middleware/rateLimit.js';
import authMiddleware from '../../middleware/auth.js';

const router = Router();

// Public routes
router
    .post(
        '/signup',
        rateLimitMiddleware,
        validateMiddleware(signupSchema),
        signup
    )


router.post(
  '/login',
  rateLimitMiddleware,
  validateMiddleware(loginSchema),
//   login
);

router.post(
  '/refresh',
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