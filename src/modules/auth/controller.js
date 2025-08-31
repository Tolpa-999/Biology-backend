// src/modules/auth/controller.js
import prisma from '../../loaders/prisma.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { generateAccessToken } from '../../utils/jwt.js';
import { 
  setRefreshToken, 
  getRefreshToken, 
  deleteRefreshToken, 
  verifyRefreshToken,
  generateRefreshToken,
  validateRefreshToken 
} from '../../utils/refreshToken.js';
import crypto from 'crypto';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';
import sendEmail from '../../services/sendEmail.js';
import { generateEmailVerificationCode } from '../../services/GenerateEmailVerificationCode.js';
import { resetPasswordEmailBody, verifyEmailBody } from '../../services/generateEmailsText.js';

const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
const RESET_CODE_EXPIRY_MINUTES = 15;

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

const sendVerificationEmail = async (user) => {
  const code = generateEmailVerificationCode();
  const emailBody = verifyEmailBody(code);
  const info = await sendEmail({to: user.email,subject: emailBody.subject , html: emailBody.message});

  return code; // Return code for storage
};

const sendResetPasswordEmail = async (user) => {
  const code = generateEmailVerificationCode();
  const emailBody = resetPasswordEmailBody(code, user?.email);
  const info = await sendEmail({to: user.email,subject: emailBody.subject , html: emailBody.message});
  return code; // Return code for storage
};

const createVerificationToken = async (userId, type, code, expiryMinutes) => {
  const tokenHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Delete existing token for this type
    await tx.verificationToken.deleteMany({
      where: { userId, type },
    });

    // Create new token
    await tx.verificationToken.create({
      data: {
        tokenHash,
        userId,
        type,
        expiresAt,
      },
    });
  });
};

export const signup = catchAsync(async (req, res, next) => {
  const { phone, email, password, firstName, lastName, academicStage, parentPhone, ...otherData } = req.body;

  // Validate parentPhone against phone
  if (phone === parentPhone) {
    return next(new ErrorResponse('Student phone cannot be the same as parent phone', STATUS_CODE.CONFLICT));
  }

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

  // Validate email if provided
  if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return next(new ErrorResponse('Invalid email address', STATUS_CODE.BAD_REQUEST));
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with transaction
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { 
        firstName,
        lastName,
        phone, 
        email: email || null, // Store null if email is not provided
        passwordHash, 
        academicStage,
        parentPhone,
        isActive: true,
        ...otherData 
      },
    });

    // Assign student role by default
    await tx.userRole.create({
      data: {
        user: { connect: { id: user.id } },
        role: { connect: { name: 'STUDENT' } }
      }
    });

    return user;
  });

  // If email provided, send verification code
  if (email) {
    try {
      const code = await sendVerificationEmail(newUser);
      await createVerificationToken(newUser.id, 'EMAIL_VERIFICATION', code, VERIFICATION_CODE_EXPIRY_MINUTES);
    } catch (error) {
      // Log error but continue signup process
      logger.error(`Failed to send verification email for user ${newUser.id}: ${error.message}`);
    }
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: newUser.id });
  const refreshToken = generateRefreshToken({ userId: newUser.id });

  // Store refresh token
  await setRefreshToken(newUser.id, refreshToken);
  setRefreshCookie(res, refreshToken);

  // Remove sensitive data
  const { passwordHash: _, ...userWithoutPassword } = newUser;

  logger.info(`New user registered: ${newUser.phone}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      user: userWithoutPassword,
      accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    },
    message: email 
      ? 'Signup successful. A verification code has been sent to your email.'
      : 'Signup successful. No email provided, so verification is not required.',
  });
});

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  if (user.emailVerified) {
    return next(new ErrorResponse('Email already verified', STATUS_CODE.BAD_REQUEST));
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      userId_type: { userId: user.id, type: 'EMAIL_VERIFICATION' },
    },
  });

  if (!verificationToken) {
    return next(new ErrorResponse('No verification code found', STATUS_CODE.BAD_REQUEST));
  }

  if (new Date() > verificationToken.expiresAt) {
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    });
    return next(new ErrorResponse('Verification code expired', STATUS_CODE.BAD_REQUEST));
  }

  const isValid = await comparePassword(code, verificationToken.tokenHash);
  if (!isValid) {
    return next(new ErrorResponse('Invalid verification code', STATUS_CODE.BAD_REQUEST));
  }

  // Update user and delete token in transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await tx.verificationToken.delete({
      where: { id: verificationToken.id },
    });
  });

  logger.info(`Email verified for user: ${user.id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Email verified successfully',
  });
});

export const resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  if (user.emailVerified) {
    return next(new ErrorResponse('Email already verified', STATUS_CODE.BAD_REQUEST));
  }

  try {
    const code = await sendVerificationEmail(user);
    await createVerificationToken(user.id, 'EMAIL_VERIFICATION', code, VERIFICATION_CODE_EXPIRY_MINUTES);
  } catch (error) {
    logger.error(`Failed to resend verification email for user ${user.id}: ${error.message}`);
    return next(new ErrorResponse('Failed to send verification email', STATUS_CODE.INTERNAL_SERVER_ERROR));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Verification code resent successfully',
  });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  console.log(user)

  if (!user?.id) {
    // Silent fail for security
    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      message: 'If the email exists, a reset code has been sent',
    });
  }

  try {
    const code = await sendResetPasswordEmail(user);
    await createVerificationToken(user.id, 'PASSWORD_RESET', code, RESET_CODE_EXPIRY_MINUTES);
  } catch (error) {
    logger.error(`Failed to send reset password email for user ${user.id}: ${error.message}`);
    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      message: 'If the email exists, a reset code has been sent',
    });
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'If the email exists, a reset code has been sent',
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      userId_type: { userId: user.id, type: 'PASSWORD_RESET' },
    },
  });

  if (!verificationToken) {
    return next(new ErrorResponse('No reset code found', STATUS_CODE.BAD_REQUEST));
  }

  if (new Date() > verificationToken.expiresAt) {
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    });
    return next(new ErrorResponse('Reset code expired', STATUS_CODE.BAD_REQUEST));
  }

  const isValid = await comparePassword(code, verificationToken.tokenHash);
  if (!isValid) {
    return next(new ErrorResponse('Invalid reset code', STATUS_CODE.BAD_REQUEST));
  }

  const newHash = await hashPassword(newPassword);

  // Update password, delete all refresh tokens, and delete verification token
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await tx.refreshToken.deleteMany({ 
      where: { userId: user.id } 
    });

    await tx.verificationToken.delete({
      where: { id: verificationToken.id },
    });
  });

  // Clear any existing refresh token cookies
  clearRefreshCookie(res);

  logger.info(`Password reset for user: ${user.id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Password reset successfully. Please log in with your new password.',
  });
});

// ... (other functions like telegramAuth, changePassword, logout, refreshToken, getProfile remain unchanged)
// ... (keep other functions like telegramAuth, changePassword, logout, refreshToken, getProfile as is, except for any minor adjustments if needed)
// Verify Telegram authentication data

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;



  // Log request body for debugging
  logger.debug(`Login request body: ${JSON.stringify(req.body)}`);

  // Find user with roles
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', STATUS_CODE.UNAUTHORIZED));
  }

  if (user.email && !user.emailVerified) {
    return next(new ErrorResponse('Email not verified', STATUS_CODE.FORBIDDEN));
  }

  if (!user.isActive) {
    return next(new ErrorResponse('Account is inactive', STATUS_CODE.FORBIDDEN));
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return next(new ErrorResponse('Invalid credentials', STATUS_CODE.UNAUTHORIZED));
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({ userId: user.id });

  await Promise.all([
    setRefreshToken(user.id, refreshToken),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })
  ]);

  setRefreshCookie(res, refreshToken);

  const { passwordHash, ...userWithoutPassword } = user;

  logger.info(`User logged in: ${user.phone}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      user: userWithoutPassword,
      accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    },
    message: 'Login successful',
  });
});







const verifyTelegramData = (data, botToken) => {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');
  
  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return hmac === data.hash;
};

// Telegram authentication endpoint
export const telegramAuth = catchAsync(async (req, res, next) => {
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;

  // Verify the data is not too old (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - auth_date > 300) {
    return next(new ErrorResponse('Authentication data expired', STATUS_CODE.UNAUTHORIZED));
  }

  // Verify the authentication data
  const isValid = verifyTelegramData({
    id, first_name, last_name, username, photo_url, auth_date, hash
  }, process.env.TELEGRAM_BOT_TOKEN);

  if (!isValid) {
    return next(new ErrorResponse('Invalid Telegram authentication', STATUS_CODE.UNAUTHORIZED));
  }

  // Check if user already exists with this Telegram ID
  const existingUser = await prisma.user.findUnique({
    where: { telegramId: id.toString() }
  });

  if (existingUser) {
    // User exists, log them in
    const accessToken = generateAccessToken({ userId: existingUser.id });
    const refreshToken = generateRefreshToken({ userId: existingUser.id });

    await setRefreshToken(existingUser.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    // Update last login
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLogin: new Date() },
    });

    const { passwordHash, ...userWithoutPassword } = existingUser;

    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: {
        user: userWithoutPassword,
        accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
      },
      message: 'Login successful',
    });
  }

  // User doesn't exist, return Telegram data for registration
  res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      telegramUser: {
        id: id.toString(),
        first_name,
        last_name,
        username,
        photo_url,
        auth_date
      },
      requiresRegistration: true
    },
    message: 'Telegram authentication successful. Please complete registration.',
  });
});



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

