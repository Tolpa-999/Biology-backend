import prisma from '../loaders/prisma.js';
import jwt from 'jsonwebtoken';
import env from '../config/index.js';
import logger from './logger.js';

// Generate refresh token
export const generateRefreshToken = (payload) => {
  return jwt.sign(
    { 
      ...payload, 
      type: 'refresh' 
    }, 
    env.JWT_REFRESH_SECRET || env.JWT_SECRET, 
    { 
      expiresIn: env.JWT_REFRESH_EXPIRY || '7d',
      issuer: 'ur-doc-platform',
      audience: 'ur-doc-users'
    }
  );
};

// Verify refresh token
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
      issuer: 'ur-doc-platform',
      audience: 'ur-doc-users'
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    
    return decoded;
  } catch (error) {
    logger.warn('Refresh token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
    
    throw new Error('REFRESH_TOKEN_VERIFICATION_ERROR');
  }
};

// Store refresh token in database
export const setRefreshToken = async (userId, token, expiresInDays = 7) => {
  try {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    
    // Store in database
    await prisma.refreshToken.create({
      data: { 
        userId, 
        token, 
        expiresAt 
      },
    });
    
    logger.debug(`Refresh token stored for user: ${userId}`);
  } catch (error) {
    logger.error('Failed to store refresh token:', error);
    throw new Error('FAILED_TO_STORE_REFRESH_TOKEN');
  }
};

// Get refresh token from database
export const getRefreshToken = async (userId) => {
  try {
    const record = await prisma.refreshToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { token: true }
    });
    
    return record ? record.token : null;
  } catch (error) {
    logger.error('Failed to get refresh token:', error);
    throw new Error('FAILED_TO_GET_REFRESH_TOKEN');
  }
};

// Delete refresh token from database
export const deleteRefreshToken = async (userId) => {
  try {
    await prisma.refreshToken.deleteMany({ 
      where: { userId } 
    });
    
    logger.debug(`Refresh tokens deleted for user: ${userId}`);
  } catch (error) {
    logger.error('Failed to delete refresh token:', error);
    throw new Error('FAILED_TO_DELETE_REFRESH_TOKEN');
  }
};

// Clean up expired refresh tokens (to be run periodically)
export const cleanupExpiredRefreshTokens = async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    logger.info(`Cleaned up ${result.count} expired refresh tokens`);
    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup expired refresh tokens:', error);
    throw new Error('FAILED_TO_CLEANUP_REFRESH_TOKENS');
  }
};

// Validate refresh token against stored token
export const validateRefreshToken = async (userId, token) => {
  try {
    const storedToken = await getRefreshToken(userId);
    return storedToken === token;
  } catch (error) {
    logger.error('Failed to validate refresh token:', error);
    return false;
  }
};