// duplication/schema.js
import Joi from "joi";

export const copyContentSchema = Joi.object({
  sourceContentId: Joi.string().required(),
  targetLessonId: Joi.string().required(),
}).unknown(false);

export const copyLessonSchema = Joi.object({
  sourceLessonId: Joi.string().required(),
  targetCourseId: Joi.string().required(),
}).unknown(false);

export const copyCourseSchema = Joi.object({
  sourceCourseId: Joi.string().required(),
  newTitle: Joi.string().min(1).max(255).required(),
  newDescription: Joi.string().allow(""),
}).unknown(false);

export const idSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);