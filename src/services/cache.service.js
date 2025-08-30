// import { getRedisClient } from '../loaders/redis.js';
// import logger from '../utils/logger.js';

// export const setCache = async (key, value, ttl = 3600) => {
//   try {
//     const redis = await getRedisClient();
//     await redis.set(key, JSON.stringify(value), 'EX', ttl);
//     logger.info(`Cache set: ${key} (TTL: ${ttl}s)`);
//   } catch (err) {
//     logger.error(`Cache set failed for ${key}: ${err.message}`);
//     throw err;
//   }
// };

// export const getCache = async (key) => {
//   try {
//     const redis = await getRedisClient();
//     const data = await redis.get(key);
//     if (data) {
//       logger.info(`Cache hit: ${key}`);
//       return JSON.parse(data);
//     }
//     logger.info(`Cache miss: ${key}`);
//     return null;
//   } catch (err) {
//     logger.error(`Cache get failed for ${key}: ${err.message}`);
//     throw err;
//   }
// };

// export const deleteCache = async (key) => {
//   try {
//     const redis = await getRedisClient();
//     await redis.del(key);
//     logger.info(`Cache deleted: ${key}`);
//   } catch (err) {
//     logger.error(`Cache delete failed for ${key}: ${err.message}`);
//     throw err;
//   }
// };