// // Updated schemas.js
// import Joi from "joi";

// export const loginSchema = Joi.object({
//   email: Joi.string().email().required().max(70),
//   password: Joi.string().min(8).required()
//     .messages({
//       "string.empty": "Field password is required",
//       "string.min": "Field password must be at least 8 characters",
//     }),
// }).unknown(false);

// export const signupSchema = Joi.object({
//   firstName: Joi.string().min(1).required().max(15),
//   middleName: Joi.string().allow("").max(15),
//   lastName: Joi.string().min(1).required().max(15),
//   phone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15).required()
//     .messages({
//       "string.pattern.base": "Field phone must be a valid phone number",
//     }),
//   parentPhone: Joi.string().pattern(/^\+?\d+$/).min(10).max(15).required()
//     .messages({
//       "string.pattern.base": "Field phone must be a valid phone number",
//     }),
//   email: Joi.string().email().optional().max(50),
//   gender: Joi.string().valid("MALE", "FEMALE").required(),
//   location: Joi.string().required().max(15),
//   academicStage: Joi.string().valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY").required(),
//   password: Joi.string().min(8).required().max(40),
// }).unknown(false);

// export const changePasswordSchema = Joi.object({
//   oldPassword: Joi.string().min(8).required().max(40),
//   newPassword: Joi.string().min(8).required().max(40),
// }).unknown(false);


// export const verifyEmailSchema = Joi.object({
//   email: Joi.string().email().required().max(40),
//   code: Joi.string().required().max(15),
// }).unknown(false);

// export const resendVerificationSchema = Joi.object({
//   email: Joi.string().email().required().max(40),
// }).unknown(false);

// export const forgotPasswordSchema = Joi.object({
//   email: Joi.string().email().required().max(40),
// }).unknown(false);

// export const resetPasswordSchema = Joi.object({
//   email: Joi.string().email().required().max(40),
//   code: Joi.string().required().max(10),
//   newPassword: Joi.string().min(8).required().max(40),
// }).unknown(false)

// export const refreshSchema = Joi.object({}).unknown(false); // no fields allowed


// schemas.js
import Joi from "joi";

/**
 * Common reusable patterns
 */
const email = Joi.string()
  .trim()
  .lowercase()
  .email({ minDomainSegments: 2, tlds: { allow: true } })
  .max(70)
  .messages({
    "string.email": "من فضلك دخل إيميل صحيح",
    "string.empty": "الإيميل مطلوب",
    "string.max": "الإيميل ماينفعش يعدي {#limit} حرف",
  });

const password = Joi.string()
  .trim()
  .min(8)
  .max(40)
  // .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-])[A-Za-z\d@$!%*?&#^()_\-]+$/)
  // .messages({
  //   "string.pattern.base": "الباسورد لازم يبقى فيه حرف كابيتال، حرف سمول، رقم، وعلامة خاصة",
  //   "string.min": "الباسورد لازم يبقى على الأقل {#limit} حروف",
  //   "string.max": "الباسورد ماينفعش يعدي {#limit} حرف",
  //   "string.empty": "الباسورد مطلوب",
  // });

const nameField = Joi.string()
  .trim()
  .pattern(/^[A-Za-z\u0600-\u06FF\s'-]+$/)
  .min(1)
  .max(30)
  .messages({
    "string.pattern.base": "الاسم ينفع يحتوي حروف بس (عربي أو إنجليزي) مع مسافات أو شرطه",
    "string.empty": "الاسم مطلوب",
    "string.max": "الاسم ماينفعش يعدي {#limit} حرف",
  });

const phone = Joi.string()
  .trim()
  .pattern(/^\+?[0-9]{10,15}$/)
  .messages({
    "string.pattern.base": "رقم التليفون لازم يكون صحيح ومابين 10 لـ 15 رقم",
    "string.empty": "رقم التليفون مطلوب",
  });

const code = Joi.string()
  .trim()
  .alphanum()
  .min(4)
  .max(10)
  .messages({
    "string.alphanum": "الكود لازم يبقى حروف وأرقام بس",
    "string.empty": "الكود مطلوب",
    "string.min": "الكود لازم يكون على الأقل {#limit} حروف/أرقام",
    "string.max": "الكود ماينفعش يعدي {#limit} حروف/أرقام",
  });

/**
 * Schemas
 */
export const loginSchema = Joi.object({
  email: email.required(),
  password: password.required(),
}).unknown(false);

export const signupSchema = Joi.object({
  firstName: nameField.required(),
  middleName: nameField.allow("").optional(),
  lastName: nameField.required(),
  phone: phone.required(),
  parentPhone: phone.required(),
  email: email.optional(),
  gender: Joi.string().valid("MALE", "FEMALE").required()
    .messages({ "any.only": "النوع لازم يبقى MALE أو FEMALE" }),
  location: Joi.string().trim().max(50).required()
    .messages({ "string.empty": "المكان مطلوب" }),
  academicStage: Joi.string()
    .valid("FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY")
    .required()
    .messages({
      "any.only": "المرحلة الدراسية لازم تبقى أولى أو تانية أو تالتة ثانوي",
    }),
  password: password.required(),
}).unknown(false);

export const changePasswordSchema = Joi.object({
  oldPassword: password.required(),
  newPassword: password.disallow(Joi.ref("oldPassword")).required()
    .messages({
      "any.invalid": "الباسورد الجديد ماينفعش يبقى زي القديم",
    }),
}).unknown(false);

export const verifyEmailSchema = Joi.object({
  email: email.required(),
  code: code.required(),
}).unknown(false);

export const resendVerificationSchema = Joi.object({
  email: email.required(),
}).unknown(false);

export const forgotPasswordSchema = Joi.object({
  email: email.required(),
}).unknown(false);

export const resetPasswordSchema = Joi.object({
  email: email.required(),
  code: code.required(),
  newPassword: password.required(),
}).unknown(false);

export const refreshSchema = Joi.object({}).unknown(false);
