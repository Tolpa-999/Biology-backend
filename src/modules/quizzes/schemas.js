// modules/quizzes/schemas.js
import Joi from "joi";


// Add to modules/quizzes/schemas.js (at the end, after existing exports)

export const getAllQuizzesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(""),
  isPublished: Joi.boolean(),
  courseId: Joi.string().allow(""), // Optional filter by course
  lessonId: Joi.string().allow(""), // Optional filter by lesson
}).unknown(false);

export const createQuizSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(""),
  timeLimit: Joi.number().integer().min(0).optional(),
  maxAttempts: Joi.number().integer().min(1).default(1),
  passingScore: Joi.number().min(0).max(100).default(60),
  isPublished: Joi.boolean().default(false),
  isFree: Joi.boolean(),
  score: Joi.number().integer(),
  order: Joi.number().integer().required(),
  lessonId: Joi.string().required(),
  imageUrl: Joi.string(),
  choises: Joi.string()
}).unknown(false);

export const updateQuizSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().allow(""),
  timeLimit: Joi.number().integer().min(0).optional(),
  maxAttempts: Joi.number().integer().min(1).default(1),
  passingScore: Joi.number().min(0).max(100).default(60),
  isPublished: Joi.boolean().default(false),
  isFree: Joi.boolean(),
  score: Joi.number().integer(),
  order: Joi.number().integer(),
  lessonId: Joi.string(),
  choises: Joi.string(),
  imageUrl: Joi.string()
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
  type: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE").required(),
  text: Joi.string().required(),
  explanation: Joi.string().allow(""),
  order: Joi.number().integer().min(1).required(),
  points: Joi.number().min(1).default(1),
  imageUrl: Joi.string(),
  choices: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      text: Joi.string().required(),
      isCorrect: Joi.boolean().required(),
      // order: Joi.number().integer().min(1).required(),
      deleteImage: Joi.boolean().optional(),
      imageIndex: Joi.number().integer().min(0).optional(),
      imageUrl: Joi.string().allow(null),
    })
  ).when('type', {
    is: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE"),
    then: Joi.array().min(2).required(), // Min 2 for MCQ
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);

// modules/quizzes/schemas.js (updated updateQuestionSchema, add to existing file)

export const updateQuestionSchema = Joi.object({
  id: Joi.string(),
  type: Joi.string().valid("MCQ_TEXT", "MCQ_IMAGE"),
  text: Joi.string(),
  explanation: Joi.string().allow(""),
  order: Joi.number().integer().min(1),
  points: Joi.number().min(1),
  imageUrl: Joi.string().allow(null),
  deleteQuestionImage: Joi.boolean().optional(),
  choices: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      text: Joi.string().required(),
      isCorrect: Joi.boolean().required(),
      // order: Joi.number().integer().min(1).required(),
      deleteImage: Joi.boolean().optional(),
      imageIndex: Joi.number().integer().min(0).optional(),
      imageUrl: Joi.string().allow(null),
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
  ).optional(),
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