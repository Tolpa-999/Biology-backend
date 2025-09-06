// import { Worker } from 'bullmq';
// import { getRedisClient } from '../loaders/redis.js';
// import logger from '../utils/logger.js';

// (async () => {
//   const redis = await getRedisClient();
//   const worker = new Worker(
//     'background-jobs',
//     async (job) => {
//       logger.info(`Processing job: ${job.name}, ${JSON.stringify(job.data)}`);
//       // Handle jobs (send email, process webhook, etc.)
//     },
//     { connection: redis }
//   );

//   worker.on('completed', (job) => logger.info(`Worker completed job: ${job.id}`));
//   worker.on('failed', (job, err) => logger.error(`Worker failed job: ${job.id}, ${err.message}`));
//   worker.on('error', (err) => logger.error(`Worker error: ${err.message}`));

//   // Graceful shutdown
//   process.on('SIGTERM', async () => {
//     await worker.close();
//     logger.info('Worker closed on shutdown');
//   });
// })();









/*       