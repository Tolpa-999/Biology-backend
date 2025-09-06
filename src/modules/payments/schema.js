import Joi from "joi";

export const manualPaymentSchema = Joi.object({
  userEmail: Joi.string().email().required(),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  amount: Joi.number().min(0).optional(),
  description: Joi.string().optional(),
  paymentDate: Joi.date().optional()
}).or('courseId', 'lessonId'); // Require at least one of courseId or lessonId

export const manualPaymentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  userId: Joi.string().optional(),
  status: Joi.string().valid("INITIATED", "PAID", "FAILED", "EXPIRED", "REFUNDED").optional()
}).unknown(false);