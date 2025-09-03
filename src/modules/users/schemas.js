import Joi from "joi";

export const createUserSchema = Joi.object({
  firstName: Joi.string().min(1).required(),
  middleName: Joi.string().allow(""),
  lastName: Joi.string().min(1).required(),
  phone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15).required()
    .messages({
      "string.pattern.base": "Field phone must be a valid phone number",
    }),
  parentPhone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15).required()
    .messages({
      "string.pattern.base": "Field phone must be a valid phone number",
    }),
  email: Joi.string().email().optional(),
  gender: Joi.string().valid("MALE", "FEMALE").required(),
  location: Joi.string().required(),
  academicStage: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY").required(),
  password: Joi.string().min(8).required(),
  roles: Joi.array().items(Joi.string().valid("ADMIN", "TEACHER", "STUDENT", "CENTER_ADMIN", "PARENT")).min(1).required(),
  isActive: Joi.boolean().default(true),
}).unknown(false);

export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1),
  middleName: Joi.string().allow(""),
  lastName: Joi.string().min(1),
  phone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15)
    .messages({
      "string.pattern.base": "Field phone must be a valid phone number",
    }),
  parentPhone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15)
    .messages({
      "string.pattern.base": "Field phone must be a valid phone number",
    }),
  email: Joi.string().email(),
  gender: Joi.string().valid("MALE", "FEMALE"),
  location: Joi.string(),
  academicStage: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"),
  roles: Joi.array().items(Joi.string().valid("ADMIN", "TEACHER", "STUDENT", "CENTER_ADMIN", "PARENT")).min(1),
  isActive: Joi.boolean(),
}).unknown(false);

export const userIdSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);

export const userQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  role: Joi.string().valid("ADMIN", "TEACHER", "STUDENT", "CENTER_ADMIN", "PARENT"),
  isActive: Joi.boolean(),
  academicStage: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"),
}).unknown(false);

export const bulkActionSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).required(),
  action: Joi.string().valid("activate", "deactivate", "delete").required(),
}).unknown(false);