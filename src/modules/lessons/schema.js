import Joi from "joi";

export const createLessonSchema = Joi.object({
  courseId: Joi.string().required(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().required(),
  order: Joi.number().integer().min(0).required(),
  isPublished: Joi.boolean().default(false),
  requiresQuizPass: Joi.boolean()
}).unknown(false);

export const updateLessonSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().allow(""),
  order: Joi.number().integer().min(0),
  price: Joi.number(),
  discountPrice: Joi.number(),
  isPublished: Joi.boolean(),
  requiresQuizPass: Joi.boolean()
}).unknown(false);

export const lessonIdSchema = Joi.object({
  id: Joi.string().required(),
  courseId: Joi.string().optional(),
}).unknown(false);

export const lessonQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  isPublished: Joi.boolean(),
  courseId: Joi.string().optional(),
}).unknown(false);

export const contentSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  type: Joi.string().valid("VIDEO", "PDF", "IMAGE", "TEXT", "QUIZ").optional(),
  contentUrl: Joi.optional(),
  duration: Joi.number().min(0).optional(),
  order: Joi.number().integer().min(0).optional(),
  isFree: Joi.boolean().default(false),
  isPublished: Joi.boolean().default(true),
}).unknown(false);

export const contentIdSchema = Joi.object({
  contentId: Joi.string().required(),
}).unknown(false);