// import IORedis from 'ioredis';
// import env from '../config/index.js'; // Assuming this exports your config
// import logger from '../utils/logger.js';

// let redisClient = null;
// let isConnecting = false;

// const retryStrategy = (times) => {
//   if (times > env.REDIS_RETRY_MAX || 5) {
//     logger.error(`Redis connection failed after ${times} attempts`);
//     return null; // Stop retrying
//   }
//   const delay = Math.min(Math.pow(2, times) * (env.REDIS_RETRY_BACKOFF_MS || 1000), 60000); // Max 1min
//   logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
//   return delay;
// };

// const createRedisClient = () => {
//   if (redisClient) return redisClient;

//   redisClient = new IORedis(env.REDIS_URL, {
//     retryStrategy,
//     maxRetriesPerRequest: null, // Disable per-command retries (use global)
//     enableAutoPipelining: true, // Performance boost
//   });

//   redisClient.on('ready', () => logger.info('Redis connected successfully'));
//   redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
//   redisClient.on('reconnecting', () => logger.info('Redis reconnecting...'));
//   redisClient.on('end', () => logger.warn('Redis connection closed'));

//   return redisClient;
// };

// export const getRedisClient = async () => {
//   if (!redisClient && !isConnecting) {
//     isConnecting = true;
//     createRedisClient();
//     try {
//       await redisClient.ping(); // Test connection
//       logger.info('Redis ping successful');
//     } catch (err) {
//       logger.error(`Redis initial connection failed: ${err.message}`);
//       throw err;
//     } finally {
//       isConnecting = false;
//     }
//   }
//   return redisClient;
// };

// // Graceful shutdown
// process.on('SIGTERM', async () => {
//   if (redisClient) {
//     await redisClient.quit();
//     logger.info('Redis disconnected on shutdown');
//   }
//   process.exit(0);
// });

// export default getRedisClient;











// src/loaders/redis.js (uncomment and keep as-is, but add export for pubsub)
// import IORedis from 'ioredis';
// import env from '../config/index.js';
// import logger from '../utils/logger.js';

// let redisClient = null;
// let isConnecting = false;

// const retryStrategy = (times) => {
//   if (times > env.REDIS_RETRY_MAX || 5) {
//     logger.error(`Redis connection failed after ${times} attempts`);
//     return null;
//   }
//   const delay = Math.min(Math.pow(2, times) * (env.REDIS_RETRY_BACKOFF_MS || 1000), 60000);
//   logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
//   return delay;
// };

// const createRedisClient = () => {
//   if (redisClient) return redisClient;

//   redisClient = new IORedis(env.REDIS_URL, {
//     retryStrategy,
//     maxRetriesPerRequest: null,
//     enableAutoPipelining: true,
//   });

//   redisClient.on('ready', () => logger.info('Redis connected successfully'));
//   redisClient.on('error', (err) => logger.error(`Redis error: ${err}`));
//   redisClient.on('reconnecting', () => logger.info('Redis reconnecting...'));
//   redisClient.on('end', () => logger.warn('Redis connection closed'));

//   return redisClient;
// };

// export const getRedisClient = async () => {
//   if (!redisClient && !isConnecting) {
//     isConnecting = true;
//     createRedisClient();
//     try {
//       await redisClient.ping();
//       logger.info('Redis ping successful');
//     } catch (err) {
//       logger.error(`Redis initial connection failed: ${err.message}`);
//       throw err;
//     } finally {
//       isConnecting = false;
//     }
//   }
//   return redisClient;
// };

// process.on('SIGTERM', async () => {
//   if (redisClient) {
//     await redisClient.quit();
//     logger.info('Redis disconnected on shutdown');
//   }
//   process.exit(0);
// });


// src/loaders/redis.js
import IORedis from 'ioredis';
import env from '../config/index.js';
import logger from '../utils/logger.js';

let redisClient = null;
let isConnecting = false;
let connectionPromise = null;

const retryStrategy = (times) => {
  if (times > (env.REDIS_RETRY_MAX || 5)) {
    logger.error(`Redis connection failed after ${times} attempts`);
    return null;
  }
  const delay = Math.min(Math.pow(2, times) * (env.REDIS_RETRY_BACKOFF_MS || 1000), 60000);
  logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
  return delay;
};

const createRedisClient = async () => {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    try {
      const client = new IORedis(env.REDIS_URL, {
        retryStrategy,
        maxRetriesPerRequest: 3,
        enableAutoPipelining: true,
        lazyConnect: true, // Important: don't connect immediately
        reconnectOnError: (err) => {
          logger.warn(`Redis reconnect on error: ${err.message}`);
          return true;
        },
      });

      client.on('ready', () => {
        logger.info('Redis connected successfully');
        isConnecting = false;
        resolve(client);
      });

      client.on('error', (err) => {
        logger.error(`Redis error: ${err.message}`);
        if (!client.connected) {
          isConnecting = false;
          connectionPromise = null;
          reject(err);
        }
      });

      client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      client.on('end', () => {
        logger.warn('Redis connection closed');
        isConnecting = false;
        connectionPromise = null;
      });

      client.on('connect', () => {
        logger.info('Redis connecting...');
        isConnecting = true;
      });

      // Actually connect
      client.connect().catch(reject);
      
    } catch (err) {
      reject(err);
    }
  });

  return connectionPromise;
};

export const getRedisClient = async () => {
  try {
    if (redisClient && redisClient.status === 'ready') {
      // Test if connection is actually alive
      try {
        await redisClient.ping();
        return redisClient;
      } catch (pingErr) {
        logger.warn('Redis ping failed, reconnecting...');
        redisClient = null;
        connectionPromise = null;
      }
    }

    if (!redisClient) {
      redisClient = await createRedisClient();
    }

    return redisClient;
  } catch (err) {
    logger.error('Failed to get Redis client:', err);
    throw err;
  }
};

export const isRedisConnected = () => {
  return redisClient && redisClient.status === 'ready';
};

// // Graceful shutdown
// process.on('SIGTERM', async () => {
//   if (redisClient) {
//     try {
//       await redisClient.quit();
//       logger.info('Redis disconnected gracefully on shutdown');
//     } catch (err) {
//       logger.error('Error disconnecting Redis:', err);
//     }
//   }
// });

// process.on('SIGINT', async () => {
//   if (redisClient) {
//     try {
//       await redisClient.quit();
//       logger.info('Redis disconnected gracefully on interrupt');
//     } catch (err) {
//       logger.error('Error disconnecting Redis:', err);
//     }
//   }
// });