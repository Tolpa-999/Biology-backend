import Joi from "joi";

export const createCouponSchema = Joi.object({
  code: Joi.string().min(3).max(50).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional().allow(''),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').required(),
  discountValue: Joi.number().min(0).required(),
  maxUses: Joi.number().integer().min(1).optional(),
  maxUsesPerUser: Joi.number().integer().min(1).optional(),
  minPurchase: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  scope: Joi.string().valid('GLOBAL', 'COURSE', 'LESSON').default('GLOBAL'),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  validUserIds: Joi.array().items(Joi.string()).optional(),
  excludedUserIds: Joi.array().items(Joi.string()).optional(),
}).unknown(false);

export const updateCouponSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional().allow(''),
  discountValue: Joi.number().min(0).optional(),
  maxUses: Joi.number().integer().min(1).optional(),
  maxUsesPerUser: Joi.number().integer().min(1).optional(),
  minPurchase: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  isActive: Joi.boolean().optional(),
  validUserIds: Joi.array().items(Joi.string()).optional(),
  excludedUserIds: Joi.array().items(Joi.string()).optional(),
}).unknown(false);

export const couponIdSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);

export const couponCodeSchema = Joi.object({
  code: Joi.string().required(),
}).unknown(false);

export const applyCouponSchema = Joi.object({
  code: Joi.string().required(),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  purchaseAmount: Joi.number().min(0).required(),
}).unknown(false);

export const assignUsersToCouponSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).required(),
  action: Joi.string().valid('ADD_VALID', 'ADD_EXCLUDED', 'REMOVE_VALID', 'REMOVE_EXCLUDED').required(),
}).unknown(false);

export const couponQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'EXPIRED', 'USED_UP'),
  scope: Joi.string().valid('GLOBAL', 'COURSE', 'LESSON'),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT'),
  isActive: Joi.boolean(),
}).unknown(false);

export const couponUsageQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  userId: Joi.string().optional(),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
}).unknown(false);