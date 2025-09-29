import Joi from "joi";

export const createCourseSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  academicYear: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY").required(),
  description: Joi.string().allow(""),
  price: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).optional(),
  isPublished: Joi.boolean().default(false),
  centerId: Joi.string().optional(),
}).unknown(false);

export const updateCourseSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  academicYear: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"),
  description: Joi.string().allow(""),
  price: Joi.number().min(0),
  discountPrice: Joi.optional(),
  isPublished: Joi.boolean(),
  centerId: Joi.string().optional(),
  thumbnail: Joi.string().optional(),
}).unknown(false);

export const courseIdSchema = Joi.object({
  id: Joi.string().optional(),
  userId: Joi.string().optional(),
}).unknown(false);

export const courseQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  academicYear: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"),
  isPublished: Joi.boolean(),
  centerId: Joi.string().optional(),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
}).unknown(false);

export const enrollUserSchema = Joi.object({
  userId: Joi.string().required(),
  couponCode: Joi.string().optional(),
  centerCode: Joi.string().optional(),
}).unknown(false);

export const courseUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  status: Joi.string().valid("ACTIVE", "EXPIRED", "REFUNDED", "PENDING"),
}).unknown(false);


export const validateCouponSchema = Joi.object({
      code: Joi.string().required().trim().uppercase()

})