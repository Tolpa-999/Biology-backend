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