// src/middleware/sessionValidator.js
import prisma from '../loaders/prisma.js';
import catchAsync from '../utils/cathAsync.js';
import ErrorResponse from '../utils/errorResponse.js';
import { STATUS_CODE } from '../utils/httpStatusCode.js';
import logger from '../utils/logger.js';

export default catchAsync(async (req, res, next) => {
  const { userId, sessionVersion } = req.user;  // From authMiddleware decoded JWT
  if (!userId || sessionVersion === undefined) {
    return next(new ErrorResponse('Invalid token', STATUS_CODE.UNAUTHORIZED));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });

  if (!user || user.sessionVersion !== sessionVersion) {
    logger.warn(`Invalid session for user ${userId}: version mismatch`);
    return next(new ErrorResponse('Session invalidated. Please log in again.', STATUS_CODE.UNAUTHORIZED));
  }

  next();
});