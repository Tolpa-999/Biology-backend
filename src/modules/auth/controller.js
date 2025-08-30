import prisma from '../../loaders/prisma.js';
import { hashPassword, comparePassword, 
  // validatePasswordStrength 
} from '../../utils/password.js';
import { generateAccessToken } from '../../utils/jwt.js';
import { 
  setRefreshToken, 
  getRefreshToken, 
  deleteRefreshToken, 
  verifyRefreshToken,
  generateRefreshToken,
  validateRefreshToken 
} from '../../utils/refreshToken.js';


import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // path: '/auth/refresh',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/api/auth/refresh',
  });
};

export const signup = catchAsync(async (req, res, next) => {
  const { phone, email, password, firstName, lastName, academicStage, ...otherData } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { 
      OR: [
        { phone }, 
        ...(email ? [{ email }] : [])
      ] 
    },
  });

  if (existingUser) {
    return next(new ErrorResponse('User already exists', STATUS_CODE.CONFLICT));
  }

  // Validate password strength

  // const passwordValidation = validatePasswordStrength(password);
  // if (!passwordValidation.isValid) {
  //   return next(new ErrorResponse(
  //     'Password does not meet strength requirements', 
  //     STATUS_CODE.BAD_REQUEST,
  //     { requirements: passwordValidation.requirements }
  //   ));
  // }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with transaction
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { 
        firstName,
        lastName,
        phone, 
        email, 
        passwordHash, 
        academicStage,
        isActive: true,
        ...otherData 
      },
    });

    // Assign student role by default
    await tx.userRole.create({
      data: {
        userId: user.id,
        role: { connect: { name: 'STUDENT' } }
      }
    });

    return user;
  });

  // Generate tokens
  // const accessToken = generateAccessToken({ userId: newUser.id });
  // const refreshToken = generateRefreshToken({ userId: newUser.id });

  // Store refresh token
  // await setRefreshToken(newUser.id, refreshToken);
  // setRefreshCookie(res, refreshToken);

  // Remove sensitive data
  const { passwordHash: _, ...userWithoutPassword } = newUser;

  logger.info(`New user registered: ${newUser.phone}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      user: userWithoutPassword,
      // accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    },
    message: 'Signup successful',
  });
});

// export const login = catchAsync(async (req, res, next) => {
//   const { phone, password } = req.body;

//   // Find user with roles
//   const user = await prisma.user.findUnique({
//     where: { phone },
//     include: {
//       userRoles: {
//         include: {
//           role: true
//         }
//       }
//     }
//   });

//   if (!user) {
//     return next(new ErrorResponse('Invalid credentials', STATUS_CODE.UNAUTHORIZED));
//   }

//   if (!user.isActive) {
//     return next(new ErrorResponse('Account is inactive', STATUS_CODE.FORBIDDEN));
//   }

//   // Verify password
//   const isPasswordValid = await comparePassword(password, user.passwordHash);
//   if (!isPasswordValid) {
//     return next(new ErrorResponse('Invalid credentials', STATUS_CODE.UNAUTHORIZED));
//   }

//   // Generate tokens
//   const accessToken = generateAccessToken({ userId: user.id });
//   const refreshToken = generateRefreshToken({ userId: user.id });

//   // Store refresh token and update last login
//   await Promise.all([
//     setRefreshToken(user.id, refreshToken),
//     prisma.user.update({
//       where: { id: user.id },
//       data: { lastLogin: new Date() },
//     })
//   ]);

//   setRefreshCookie(res, refreshToken);

//   // Remove sensitive data
//   const { passwordHash, ...userWithoutPassword } = user;

//   logger.info(`User logged in: ${user.phone}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       user: userWithoutPassword,
//       accessToken,
//       expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
//     },
//     message: 'Login successful',
//   });
// });

export const changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.userId;

  // Find user
  const user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Verify current password
  const isOldPasswordValid = await comparePassword(oldPassword, user.passwordHash);
  if (!isOldPasswordValid) {
    return next(new ErrorResponse('Current password is incorrect', STATUS_CODE.UNAUTHORIZED));
  }

  // Validate new password strength

  // const passwordValidation = validatePasswordStrength(newPassword);
  // if (!passwordValidation.isValid) {
  //   return next(new ErrorResponse(
  //     'New password does not meet strength requirements', 
  //     STATUS_CODE.BAD_REQUEST,
  //     { requirements: passwordValidation.requirements }
  //   ));
  // }

  // Hash new password
  const newHash = await hashPassword(newPassword);

  // Update password and invalidate all refresh tokens
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await tx.refreshToken.deleteMany({ 
      where: { userId } 
    });
  });

  // Clear cookies
  clearRefreshCookie(res);

  logger.info(`Password changed for user: ${userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Password changed successfully. Please log in again.',
  });
});

export const logout = catchAsync(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  const userId = req.user?.userId;

  if (refreshToken && userId) {
    try {
      // Verify and get user ID from token if not available in request
      const decoded = verifyRefreshToken(refreshToken);
      const targetUserId = userId || decoded.userId;
      
      await deleteRefreshToken(targetUserId);
    } catch (error) {
      // Ignore invalid tokens during logout
      logger.debug('Invalid refresh token during logout:', error.message);
    }
  }

  clearRefreshCookie(res);

  logger.info(`User logged out: ${userId}`);

  return res.status(STATUS_CODE.NO_CONTENT).json({
    message: "Signed out successfully"
  });
});

export const refreshToken = catchAsync(async (req, res, next) => {  
  console.log("cookies => ", req.cookies)
  const refreshToken = req?.cookies?.refreshToken || req?.body?.refreshToken;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token required', STATUS_CODE.UNAUTHORIZED));
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    clearRefreshCookie(res);
    return next(new ErrorResponse('Invalid refresh token', STATUS_CODE.UNAUTHORIZED));
  }

  // Validate refresh token against stored token
  const isValid = await validateRefreshToken(decoded.userId, refreshToken);
  if (!isValid) {
    await deleteRefreshToken(decoded.userId);
    clearRefreshCookie(res);
    return next(new ErrorResponse('Invalid refresh token', STATUS_CODE.UNAUTHORIZED));
  }

  // Check if user exists and is active
  const user = await prisma.user.findUnique({ 
    where: { id: decoded.userId },
    select: { id: true, isActive: true }
  });

  if (!user || !user.isActive) {
    await deleteRefreshToken(decoded.userId);
    clearRefreshCookie(res);
    return next(new ErrorResponse('User not found or inactive', STATUS_CODE.FORBIDDEN));
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken({ userId: user.id });
  const newRefreshToken = generateRefreshToken({ userId: user.id });

  // Update refresh token (token rotation)
  await setRefreshToken(user.id, newRefreshToken);
  setRefreshCookie(res, newRefreshToken);

  logger.debug(`Token refreshed for user: ${user.id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    },
    message: 'Token refreshed successfully',
  });
});

export const getProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      email: true,
      gender: true,
      academicStage: true,
      isActive: true,
      phoneVerified: true,
      emailVerified: true,
      avatar: true,
      lastLogin: true,
      themePreference: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user }
  });
});