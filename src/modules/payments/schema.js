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


export const removeEnrollmentSchema = Joi.object({
  // Either provide enrollmentId for direct removal OR provide userId + (courseId | lessonId)
  enrollmentId: Joi.string().optional(),
  userId: Joi.string().optional(),
  type: Joi.string().valid('course', 'lesson').when('enrollmentId', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  courseId: Joi.string().when('type', { is: 'course', then: Joi.required(), otherwise: Joi.forbidden() }),
  lessonId: Joi.string().when('type', { is: 'lesson', then: Joi.required(), otherwise: Joi.forbidden() }),

  // Refund options
  refund: Joi.boolean().default(false),
  refundAmount: Joi.number().min(0).optional(), // override auto-calculated refund
  refundReason: Joi.string().max(1000).optional(),

  // Cleanup options
  cascadeLessonEnrollments: Joi.boolean().default(true), // when removing course enrollment
  removeProgress: Joi.boolean().default(true),

}).or('enrollmentId', 'userId'); // must have at least one identifying field
