// import { getJobQueue } from '../../loaders/bullmq.js';

// export async function handleWebhook(req, res) {
//   try {
//     const queue = await getJobQueue();
//     await queue.add('webhook', req.body);
//     res.status(200).json({ message: 'Webhook received' });
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// }