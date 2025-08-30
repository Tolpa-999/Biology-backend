// import { Queue, QueueEvents } from 'bullmq';
// import { getRedisClient } from './redis.js';
// import logger from '../utils/logger.js';

// let jobQueue = null;

// export const getJobQueue = async () => {
//   if (jobQueue) return jobQueue;

//   const redis = await getRedisClient();
//   jobQueue = new Queue('background-jobs', {
//     connection: redis,
//     defaultJobOptions: {
//       attempts: 3, // Retry up to 3 times
//       backoff: {
//         type: 'exponential',
//         delay: 1000, // Start at 1s
//       },
//       removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
//       removeOnFail: { count: 5000 }, // Keep last 5000 failed
//     },
//   });

//   // Logging via QueueEvents
//   const queueEvents = new QueueEvents('background-jobs', { connection: redis });
//   queueEvents.on('added', ({ jobId, name }) => logger.info(`Job added: ${name} (ID: ${jobId})`));
//   queueEvents.on('completed', ({ jobId }) => logger.info(`Job completed: ${jobId}`));
//   queueEvents.on('failed', ({ jobId, failedReason }) => logger.error(`Job failed: ${jobId}, Reason: ${failedReason}`));
//   queueEvents.on('error', (err) => logger.error(`Queue error: ${err.message}`));

//   logger.info('BullMQ queue initialized');
//   return jobQueue;
// };

// // Graceful shutdown
// process.on('SIGTERM', async () => {
//   if (jobQueue) {
//     await jobQueue.close();
//     logger.info('BullMQ queue closed on shutdown');
//   }
// });