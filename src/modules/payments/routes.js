import { Router } from 'express';
import { createManualPayment, getManualPayments, initiatePayment, paymobWebhook, removeEnrollment, mobileWallet } from './controller.js';
import authMiddleware from '../../middleware/auth.js';
import { manualPaymentQuerySchema, manualPaymentSchema, removeEnrollmentSchema } from './schema.js';
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

router.post(
  '/remove',
  roleMiddleware(['ADMIN', 'CENTER_ADMIN']),
  validateMiddleware(removeEnrollmentSchema),
  removeEnrollment
);

router.post(
  '/full-wallet',
  mobileWallet

)


export default router;