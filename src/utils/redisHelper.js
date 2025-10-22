// src/utils/redisHelper.js
import { getRedisClient } from '../loaders/redis.js';
import logger from './logger.js';

export const safeRedisOperation = async (operation, fallback = null) => {
  try {
    const redis = await getRedisClient();
    if (redis && redis.status === 'ready') {
      return await operation(redis);
    }
    return fallback;
  } catch (error) {
    logger.error('Redis operation failed:', error);
    return fallback;
  }
};

// Usage in your login endpoint:
// await safeRedisOperation(async (redis) => {
//   await redis.publish(`user:force_logout`, JSON.stringify({ 
//     event: 'force_logout',
//     userId: updatedUser.id,
//     timestamp: new Date().toISOString(),
//     reason: 'New login from different device'
//   }));
// });