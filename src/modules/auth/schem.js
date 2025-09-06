// Updated schemas.js
import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
    .messages({
      "string.empty": "Field password is required",
      "string.min": "Field password must be at least 8 characters",
    }),
}).unknown(false);

export const signupSchema = Joi.object({
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
}).unknown(false);

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(8).required(),
  newPassword: Joi.string().min(8).required(),
}).unknown(false);


export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().required(),
}).unknown(false);

export const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(false);

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(false);

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
}).unknown(false)

export const refreshSchema = Joi.object({}).unknown(false); // no fields allowed
