import { verifyAccessToken } from '../utils/jwt.js';
import prisma from '../loaders/prisma.js';
import ErrorResponse from '../utils/errorResponse.js';
import { STATUS_CODE } from '../utils/httpStatusCode.js';
import logger from '../utils/logger.js';

export default async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new ErrorResponse('No token provided', STATUS_CODE.UNAUTHORIZED));
  }

  try {
    const decoded = verifyAccessToken(token);
    const { userId, sessionVersion } = decoded;

    if (!userId || sessionVersion === undefined) {
      return next(new ErrorResponse('Invalid token payload', STATUS_CODE.UNAUTHORIZED));
    }

    // Validate session version
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true, isActive: true },
    });

    console.log(user)

    

    if (!user || !user.isActive) {
      return next(new ErrorResponse('User not found or inactive', STATUS_CODE.FORBIDDEN));
    }

    if (user.sessionVersion !== sessionVersion) {
      logger.warn(`Session invalidated for user ${userId}: version mismatch`);
      return next(new ErrorResponse('Session invalidated. Please log in again.', STATUS_CODE.UNAUTHORIZED));
    }

    req.user = decoded; // Attach decoded payload (userId, role, sessionVersion)
    logger.debug(`Authenticated user: ${userId}`); // Optional; remove in prod if needed
    next();
  } catch (err) {
    logger.error(`Token verification failed: ${err.message}`);
    return next(new ErrorResponse('Invalid token', STATUS_CODE.UNAUTHORIZED));
  }
};