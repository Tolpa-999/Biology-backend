// modules/quizzes/schemas.js
import Joi from "joi";

export const createQuizSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(""),
  timeLimit: Joi.number().integer().min(0).optional(),
  maxAttempts: Joi.number().integer().min(1).default(1),
  passingScore: Joi.number().min(0).max(100).default(60),
  isPublished: Joi.boolean().default(false),
}).unknown(false);

export const updateQuizSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().allow(""),
  timeLimit: Joi.number().integer().min(0),
  maxAttempts: Joi.number().integer().min(1),
  passingScore: Joi.number().min(0).max(100),
  isPublished: Joi.boolean(),
}).unknown(false);

export const quizIdSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(false);

export const lessonIdSchema = Joi.object({
  lessonId: Joi.string().required(),
}).unknown(false);

export const quizQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  isPublished: Joi.boolean(),
}).unknown(false);

export const createQuestionSchema = Joi.object({
  type: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE", "ESSAY").required(),
  text: Joi.string().required(),
  explanation: Joi.string().allow(""),
  order: Joi.number().integer().min(1).required(),
  points: Joi.number().min(1).default(1),
  choices: Joi.array().items(
    Joi.object({
      text: Joi.string().required(),
      isCorrect: Joi.boolean().required(),
    })
  ).when('type', {
    is: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE"),
    then: Joi.array().min(2).required(),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);

// modules/quizzes/schemas.js (updated updateQuestionSchema, add to existing file)

export const updateQuestionSchema = Joi.object({
  type: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE", "ESSAY"),
  text: Joi.string(),
  explanation: Joi.string().allow(""),
  order: Joi.number().integer().min(1),
  points: Joi.number().min(1),
  deleteQuestionImage: Joi.boolean().optional(),
  choices: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      text: Joi.string().required(),
      isCorrect: Joi.boolean().required(),
      order: Joi.number().integer().min(1).required(),
      deleteImage: Joi.boolean().optional(),
      imageIndex: Joi.number().integer().min(0).optional(),
    })
  ).when('type', {
    is: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE"),
    then: Joi.array().min(2),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);


export const submitQuizSchema = Joi.object({
  answers: Joi.array().items(
    Joi.object({
      questionId: Joi.string().required(),
      selectedChoiceId: Joi.string().optional(),
      textAnswer: Joi.string().optional(),
    })
  ).required().min(1),
}).unknown(false);

export const gradeSubmissionSchema = Joi.object({
  answers: Joi.array().items(
    Joi.object({
      answerId: Joi.string().required(),
      awardedPoints: Joi.number().min(0).required(),
      feedback: Joi.string().allow(""),
    })
  ).required().min(1),
}).unknown(false);

export const submissionIdSchema = Joi.object({
  submissionId: Joi.string().required(),
}).unknown(false);