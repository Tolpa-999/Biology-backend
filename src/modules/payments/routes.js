import { Router } from 'express';
import { createManualPayment, getManualPayments, initiatePayment, paymobWebhook } from './controller.js';
import authMiddleware from '../../middleware/auth.js';
import { manualPaymentQuerySchema, manualPaymentSchema } from './schema.js';
import roleMiddleware from '../../middleware/roles.js';
import validateMiddleware from '../../middleware/validate.js';
// ... validate, auth ...

const router = Router();
router.use(authMiddleware);


router.post('/paymob/initiate', initiatePayment);
router.post('/paymob/webhook', paymobWebhook); // No auth, relies on HMAC


router.post(
  '/manual',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
//   validateMiddleware(manualPaymentSchema),
  createManualPayment
);

router.get(
  '/manual',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
//   validateMiddleware(manualPaymentQuerySchema, 'query'),
  getManualPayments
);


export default router;