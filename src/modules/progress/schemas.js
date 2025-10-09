import Joi from "joi";

export const progressQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  enrollmentId: Joi.string().optional(),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  userId: Joi.string().optional(),
}).unknown(false);

export const contentProgressSchema = Joi.object({
  contentId: Joi.string().required(),
  enrollmentId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  completed: Joi.boolean().default(true),
}).unknown(false);

export const lessonProgressSchema = Joi.object({
  lessonId: Joi.string().required(),
  enrollmentId: Joi.string().optional(),
  completed: Joi.boolean().default(true),
}).unknown(false);

export const courseProgressSchema = Joi.object({
  courseId: Joi.string().required(),
  enrollmentId: Joi.string().optional(),
  completed: Joi.boolean().default(true),
}).unknown(false);

export const progressIdSchema = Joi.object({
  id: Joi.string().optional(),
  enrollmentId: Joi.string().optional(),
  courseId: Joi.string().optional(),
  userId: Joi.string().optional(),
}).unknown(false);

export const userProgressQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid("IN_PROGRESS", "COMPLETED", "NOT_STARTED"),
  academicYear: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"),
}).unknown(false);

export const bulkProgressSchema = Joi.object({
  contentIds: Joi.array().items(Joi.string()).min(1).required(),
  enrollmentId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  completed: Joi.boolean().default(true),
}).unknown(false);

export const progressStatsSchema = Joi.object({
  courseId: Joi.string().optional(),
  enrollmentId: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
}).unknown(false);

export const resetProgressSchema = Joi.object({
  enrollmentId: Joi.string().required(),
  courseId: Joi.string().optional(),
  lessonId: Joi.string().optional(),
  contentId: Joi.string().optional(),
}).unknown(false);

export const syncProgressSchema = Joi.object({
  enrollmentId: Joi.string().required(),
  courseId: Joi.string().required(),
}).unknown(false);