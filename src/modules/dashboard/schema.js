// src/modules/dashboard/schemas.js
import Joi from "joi";

export const dashboardQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional(),
  role: Joi.string().valid("ADMIN", "TEACHER", "STUDENT", "CENTER_ADMIN", "PARENT").optional(),
  academicYear: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY").optional(),
  status: Joi.string().valid("ACTIVE", "EXPIRED", "REFUNDED", "PENDING").optional(),
  centerId: Joi.string().optional(),
}).unknown(false);

export const userIdSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);

export const courseIdSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);

// src/modules/dashboard/schemas.js - Add these coupon schemas

export const couponCreateSchema = Joi.object({
  code: Joi.string().uppercase().trim().min(3).max(20).required(),
  name: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').required(),
  discountValue: Joi.number().min(0).required(),
  maxUses: Joi.number().min(1).optional(),
  maxUsesPerUser: Joi.number().min(1).optional(),
  minPurchase: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  isActive: Joi.boolean().default(true),
  scope: Joi.string().valid('GLOBAL', 'COURSE', 'LESSON').default('GLOBAL'),
  courseId: Joi.string().when('scope', {
    is: 'COURSE',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  lessonId: Joi.string().when('scope', {
    is: 'LESSON',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  validForUserIds: Joi.array().items(Joi.string()).optional(),
  excludedUserIds: Joi.array().items(Joi.string()).optional()
});

export const couponUpdateSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').optional(),
  discountValue: Joi.number().min(0).optional(),
  maxUses: Joi.number().min(1).optional().allow(null),
  maxUsesPerUser: Joi.number().min(1).optional().allow(null),
  minPurchase: Joi.number().min(0).optional().allow(null),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  isActive: Joi.boolean().optional(),
  scope: Joi.string().valid('GLOBAL', 'COURSE', 'LESSON').optional(),
  courseId: Joi.string().optional().allow(null),
  lessonId: Joi.string().optional().allow(null),
  validForUserIds: Joi.array().items(Joi.string()).optional(),
  excludedUserIds: Joi.array().items(Joi.string()).optional()
});

export const couponIdSchema = Joi.object({
  id: Joi.string().required(),
});

export const couponCodeSchema = Joi.object({
  code: Joi.string().required(),
});

export const couponQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'EXPIRED', 'USED_UP').optional(),
  scope: Joi.string().valid('GLOBAL', 'COURSE', 'LESSON').optional(),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').optional(),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional(),
});