// modules/quizzes/controller.js
import { randomUUID } from 'crypto';
import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js'; // Note: typo in provided code, assume catchAsync
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { unlink } from 'fs/promises';

export const getQuizzesForLesson = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const { page = 1, limit = 10, search, isPublished } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    lessonId,
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
    ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
  };

  const [quizzes, totalCount] = await Promise.all([
    prisma.quiz.findMany({
      where,
      skip,
      take: limit,
      include: {
        questions: {
          include: { choices: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quiz.count({ where }),
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quizzes, totalCount, page, limit },
  });
});

export const getQuizById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { choices: {
          select: {
            id: true,
            text: true,
            imageUrl: true
          }
        }},
      },
      lesson: true,
    },
  });

  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz },
  });
});

export const createQuiz = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const quizData = req.body;

  // Check if lesson exists and permission (similar to course)
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check (admin or center admin for lesson's center, etc.)
  // Assume similar logic as createCourse

  const quiz = await prisma.quiz.create({
    data: {
      ...quizData,
      lessonId,
    },
  });

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz },
    message: 'Quiz created successfully',
  });
});

export const updateQuiz = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check

  const updatedQuiz = await prisma.quiz.update({
    where: { id },
    data: updateData,
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz: updatedQuiz },
    message: 'Quiz updated successfully',
  });
});

export const deleteQuiz = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check

  await prisma.$transaction(async (tx) => {
    // Delete answers
    await tx.quizAnswer.deleteMany({
      where: { submission: { quizId: id } },
    });
    // Delete submissions
    await tx.quizSubmission.deleteMany({ where: { quizId: id } });
    // Delete choices
    await tx.choice.deleteMany({ where: { question: { quizId: id } } });
    // Delete questions
    await tx.question.deleteMany({ where: { quizId: id } });
    // Delete files
    const files = await tx.file.findMany({ where: { quizId: id } });
    for (const file of files) {
      const filePath = path.join(process.cwd(), file.path);
      await unlink(filePath).catch((err) => logger.error(`Failed to delete file: ${err}`));
    }
    await tx.file.deleteMany({ where: { quizId: id } });
    // Delete quiz
    await tx.quiz.delete({ where: { id } });
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Quiz deleted successfully',
  });
});

export const createQuestion = catchAsync(async (req, res, next) => {
  const { quizId } = req.params;
  const { type, text, explanation, order, points} = req.body;

  let { choices } = req.body


if (typeof choices === 'string') {
  try {
    choices = JSON.parse(choices);
  } catch (err) {
    return next(new ErrorResponse('Invalid JSON format for choices', STATUS_CODE.BAD_REQUEST));
  }
}

  choices = Array.isArray(choices) ? choices : [];

  const quiz = req.quiz; // From middleware

  if (type === 'ESSAY' && choices.length > 0) {
    return next(new ErrorResponse('Essay questions cannot have choices', STATUS_CODE.BAD_REQUEST));
  }
  if (['MCQ_TEXT', 'MCQ_IMAGE'].includes(type) && choices.length < 2) {
    return next(new ErrorResponse('MCQ questions must have at least 2 choices', STATUS_CODE.BAD_REQUEST));
  }
  if (type === 'MCQ_IMAGE' && req.files.choiceImages?.length !== choices.length) {
    return next(new ErrorResponse(`Must provide exactly ${choices.length} images for MCQ_IMAGE`, STATUS_CODE.BAD_REQUEST));
  }

  let questionImageUrl = null;
  if (req?.files?.questionImage?.[0]) {
    questionImageUrl = req.files.questionImage[0].path.replace(process.cwd(), ''); // Relative path
    await prisma.file.create({
      data: {
        category: 'QUIZ',
        type: 'IMAGE',
        quizId,
        originalName: req.files.questionImage[0].originalname,
        storedName: req.files.questionImage[0].filename,
        path: questionImageUrl,
        mimeType: req.files.questionImage[0].mimetype,
        size: req.files.questionImage[0].size,
      },
    });
  }

  const question = await prisma.question.create({
    data: {
      quizId,
      type,
      text,
      imageUrl: questionImageUrl,
      explanation,
      order,
      points,
    },
  });

  const createdChoices = [];
  for (let i = 0; i < choices.length; i++) {
    let choiceImageUrl = null;
    if (type === 'MCQ_IMAGE' && req.files.choiceImages[i]) {
      choiceImageUrl = req.files.choiceImages[i].path.replace(process.cwd(), '');
      await prisma.file.create({
        data: {
          category: 'QUIZ',
          type: 'IMAGE',
          quizId,
          originalName: req.files.choiceImages[i].originalname,
          storedName: req.files.choiceImages[i].filename,
          path: choiceImageUrl,
          mimeType: req.files.choiceImages[i].mimetype,
          size: req.files.choiceImages[i].size,
        },
      });
    }
    const choice = await prisma.choice.create({
      data: {
        questionId: question.id,
        text: choices[i].text,
        isCorrect: choices[i].isCorrect,
        imageUrl: choiceImageUrl,
      },
    });
    createdChoices.push(choice);
  }

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { question: { ...question, choices: createdChoices } },
    message: 'Question created successfully',
  });
});

// modules/quizzes/controller.js (updated updateQuestion function, others remain the same)

export const updateQuestion = catchAsync(async (req, res, next) => {
  const { quizId, questionId } = req.params;
  const { type, text, explanation, order, points, choices: choicesStr, deleteQuestionImage } = req.body;
  const choices = choicesStr ? JSON.parse(choicesStr) : [];

  // Similar validation as create
  if (type === 'ESSAY' && choices.length > 0) {
    return next(new ErrorResponse('Essay questions cannot have choices', STATUS_CODE.BAD_REQUEST));
  }
  if (['MCQ_TEXT', 'MCQ_IMAGE'].includes(type) && choices.length < 2) {
    return next(new ErrorResponse('MCQ questions must have at least 2 choices', STATUS_CODE.BAD_REQUEST));
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { choices: true, quiz: true },
  });
  if (!question || question.quizId !== quizId) {
    return next(new ErrorResponse('Question not found', STATUS_CODE.NOT_FOUND));
  }

  // Handle question image
  let questionImageUrl = question.imageUrl;
  if (deleteQuestionImage) {
    if (question.imageUrl) {
      const oldPath = path.join(process.cwd(), question.imageUrl);
      await unlink(oldPath).catch((err) => logger.error(`Failed to delete old image: ${err}`));
      await prisma.file.deleteMany({ where: { path: question.imageUrl } });
    }
    questionImageUrl = null;
  }
  if (req.files.questionImage?.[0]) {
    if (questionImageUrl) {
      const oldPath = path.join(process.cwd(), questionImageUrl);
      await unlink(oldPath).catch((err) => logger.error(`Failed to delete old image: ${err}`));
      await prisma.file.deleteMany({ where: { path: questionImageUrl } });
    }
    questionImageUrl = req.files.questionImage[0].path.replace(process.cwd(), '');
    await prisma.file.create({
      data: {
        category: 'QUIZ',
        type: 'IMAGE',
        quizId,
        originalName: req.files.questionImage[0].originalname,
        storedName: req.files.questionImage[0].filename,
        path: questionImageUrl,
        mimeType: req.files.questionImage[0].mimetype,
        size: req.files.questionImage[0].size,
      },
    });
  }

  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: { type, text, imageUrl: questionImageUrl, explanation, order, points },
  });

  // Handle choices: update existing, create new, delete removed or marked
  const currentChoices = question.choices;
  const bodyChoiceIds = choices.filter(c => c.id).map(c => c.id);
  const toDelete = currentChoices.filter(c => !bodyChoiceIds.includes(c.id));

  // Delete removed choices
  for (const choice of toDelete) {
    if (choice.imageUrl) {
      const oldPath = path.join(process.cwd(), choice.imageUrl);
      await unlink(oldPath).catch((err) => logger.error(`Failed to delete old choice image: ${err}`));
      await prisma.file.deleteMany({ where: { path: choice.imageUrl } });
    }
    await prisma.choice.delete({ where: { id: choice.id } });
  }

  const updatedChoices = [];
  for (const choiceData of choices) {
    let choiceImageUrl;
    if (choiceData.id) {
      // Update existing
      const existing = currentChoices.find(c => c.id === choiceData.id);
      if (!existing) continue;
      choiceImageUrl = existing.imageUrl;
      if (choiceData.deleteImage) {
        if (choiceImageUrl) {
          const oldPath = path.join(process.cwd(), choiceImageUrl);
          await unlink(oldPath).catch((err) => logger.error(`Failed to delete old choice image: ${err}`));
          await prisma.file.deleteMany({ where: { path: choiceImageUrl } });
        }
        choiceImageUrl = null;
      }
      if (choiceData.imageIndex !== undefined && req.files?.choiceImages?.[choiceData.imageIndex]) {
        if (choiceImageUrl) {
          const oldPath = path.join(process.cwd(), choiceImageUrl);
          await unlink(oldPath).catch((err) => logger.error(`Failed to delete old choice image: ${err}`));
          await prisma.file.deleteMany({ where: { path: choiceImageUrl } });
        }
        const file = req.files.choiceImages[choiceData.imageIndex];
        choiceImageUrl = file.path.replace(process.cwd(), '');
        await prisma.file.create({
          data: {
            category: 'QUIZ',
            type: 'IMAGE',
            quizId,
            originalName: file.originalname,
            storedName: file.filename,
            path: choiceImageUrl,
            mimeType: file.mimetype,
            size: file.size,
          },
        });
      }
      const updatedChoice = await prisma.choice.update({
        where: { id: choiceData.id },
        data: {
          text: choiceData.text,
          isCorrect: choiceData.isCorrect,
          order: choiceData.order,
          imageUrl: choiceImageUrl,
        },
      });
      updatedChoices.push(updatedChoice);
    } else {
      // Create new
      choiceImageUrl = null;
      if (choiceData.imageIndex !== undefined && req.files?.choiceImages?.[choiceData.imageIndex]) {
        const file = req.files.choiceImages[choiceData.imageIndex];
        choiceImageUrl = file.path.replace(process.cwd(), '');
        await prisma.file.create({
          data: {
            category: 'QUIZ',
            type: 'IMAGE',
            quizId,
            originalName: file.originalname,
            storedName: file.filename,
            path: choiceImageUrl,
            mimeType: file.mimetype,
            size: file.size,
          },
        });
      }
      const newChoice = await prisma.choice.create({
        data: {
          questionId,
          text: choiceData.text,
          isCorrect: choiceData.isCorrect,
          order: choiceData.order,
          imageUrl: choiceImageUrl,
        },
      });
      updatedChoices.push(newChoice);
    }
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { question: { ...updatedQuestion, choices: updatedChoices } },
    message: 'Question updated successfully',
  });
});


export const deleteQuestion = catchAsync(async (req, res, next) => {
  const { quizId, questionId } = req.params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { choices: true },
  });
  if (!question || question.quizId !== quizId) {
    return next(new ErrorResponse('Question not found', STATUS_CODE.NOT_FOUND));
  }

  await prisma.$transaction(async (tx) => {
    await tx.quizAnswer.deleteMany({ where: { questionId } });
    for (const choice of question.choices) {
      if (choice.imageUrl) {
        const filePath = path.join(process.cwd(), choice.imageUrl);
        await unlink(filePath).catch((err) => logger.error(`Failed to delete: ${err}`));
      }
    }
    await tx.choice.deleteMany({ where: { questionId } });
    if (question.imageUrl) {
      const filePath = path.join(process.cwd(), question.imageUrl);
      await unlink(filePath).catch((err) => logger.error(`Failed to delete: ${err}`));
    }
    await tx.file.deleteMany({ where: { quizId, path: { in: [question.imageUrl, ...question.choices.map(c => c.imageUrl)].filter(Boolean) } } });
    await tx.question.delete({ where: { id: questionId } });
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Question deleted successfully',
  });
});

export const submitQuiz = catchAsync(async (req, res, next) => {
  const { quizId } = req.params;
  const userId = req.user.userId;
  const { answers } = req.body;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { choices: true } }, lesson: { include: { course: true } } },
  });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Check enrollment (assume user enrolled in course/lesson)
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId: quiz.lesson?.courseId, status: 'ACTIVE' },
  });
  if (!enrollment) {
    return next(new ErrorResponse('Not enrolled in the course', STATUS_CODE.FORBIDDEN));
  }

  const attempts = await prisma.quizSubmission.count({ where: { quizId, userId } });
  if (attempts >= quiz.maxAttempts) {
    return next(new ErrorResponse('Maximum attempts reached', STATUS_CODE.BAD_REQUEST));
  }

  if (answers.length !== quiz.questions.length) {
    return next(new ErrorResponse('Must answer all questions', STATUS_CODE.BAD_REQUEST));
  }

  const submission = await prisma.quizSubmission.create({
    data: {
      quizId,
      userId,
      startedAt: new Date(),
      completedAt: new Date(),
      score: 0,
      totalPoints: 0,
    },
  });

  let totalPoints = 0;
  let score = 0;
  let hasEssay = false;
  const createdAnswers = [];

  for (const ans of answers) {
    const question = quiz.questions.find(q => q.id === ans.questionId);
    if (!question) {
      return next(new ErrorResponse(`Invalid question ID: ${ans.questionId}`, STATUS_CODE.BAD_REQUEST));
    }
    totalPoints += question.points;

    let isCorrect = null;
    let awardedPoints = null;

    if (question.type === 'ESSAY') {
      if (!ans.textAnswer) {
        return next(new ErrorResponse('Text answer required for essay', STATUS_CODE.BAD_REQUEST));
      }
      hasEssay = true;
    } else {
      if (!ans.selectedChoiceId) {
        return next(new ErrorResponse('Selected choice required for MCQ', STATUS_CODE.BAD_REQUEST));
      }
      const choice = question.choices.find(c => c.id === ans.selectedChoiceId);
      if (!choice) {
        return next(new ErrorResponse(`Invalid choice ID: ${ans.selectedChoiceId}`, STATUS_CODE.BAD_REQUEST));
      }
      isCorrect = choice.isCorrect;
      awardedPoints = isCorrect ? question.points : 0;
      score += awardedPoints;
    }

    const quizAnswer = await prisma.quizAnswer.create({
      data: {
        submissionId: submission.id,
        questionId: question.id,
        selectedChoiceId: question.type !== 'ESSAY' ? ans.selectedChoiceId : null,
        textAnswer: question.type === 'ESSAY' ? ans.textAnswer : null,
        isCorrect,
        awardedPoints,
      },
    });
    createdAnswers.push(quizAnswer);
  }

  const updateData = { totalPoints };
  if (!hasEssay) {
    updateData.score = (score / totalPoints) * 100;
  }

  const updatedSubmission = await prisma.quizSubmission.update({
    where: { id: submission.id },
    data: updateData,
  });

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { submission: updatedSubmission },
    message: hasEssay ? 'Quiz submitted, awaiting grading for essay questions' : 'Quiz submitted with instant results',
  });
});

export const getMySubmissions = catchAsync(async (req, res, next) => {
  const { quizId } = req.params;
  const userId = req.user.userId;

  const submissions = await prisma.quizSubmission.findMany({
    where: { quizId, userId },
    orderBy: { completedAt: 'desc' },
    include: {
      answers: {
        include: {
          question: {
            include: {
              choices: true, // To show correct answers
            },
          },
        },
      },
    },
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { submissions },
  });
});

export const getSubmissionDetails = catchAsync(async (req, res, next) => {
  const { quizId, submissionId } = req.params;
  const userId = req.user.userId;

  const submission = await prisma.quizSubmission.findUnique({
    where: { id: submissionId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              choices: true,
            },
          },
          selectedChoice: true,
        },
      },
    },
  });

  if (!submission || submission.quizId !== quizId || submission.userId !== userId) {
    return next(new ErrorResponse('Submission not found or access denied', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { submission },
  });
});

export const getAllSubmissions = catchAsync(async (req, res, next) => {
  const { quizId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;

  const [submissions, totalCount] = await Promise.all([
    prisma.quizSubmission.findMany({
      where: { quizId },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        answers: true,
      },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.quizSubmission.count({ where: { quizId } }),
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { submissions, totalCount, page, limit },
  });
});

export const gradeSubmission = catchAsync(async (req, res, next) => {
  const { quizId, submissionId } = req.params;
  const { answers } = req.body;

  const submission = await prisma.quizSubmission.findUnique({
    where: { id: submissionId },
    include: { answers: true, quiz: true },
  });

  if (!submission || submission.quizId !== quizId) {
    return next(new ErrorResponse('Submission not found', STATUS_CODE.NOT_FOUND));
  }

  let totalAwarded = 0;
  let totalPoints = submission.totalPoints;
  let allGraded = true;

  for (const grade of answers) {
    const answer = submission.answers.find(a => a.id === grade.answerId);
    if (!answer) {
      return next(new ErrorResponse(`Invalid answer ID: ${grade.answerId}`, STATUS_CODE.BAD_REQUEST));
    }
    if (answer.awardedPoints !== null) continue; // Already graded (e.g., MCQ)

    await prisma.quizAnswer.update({
      where: { id: grade.answerId },
      data: {
        awardedPoints: grade.awardedPoints,
        feedback: grade.feedback,
        isCorrect: grade.awardedPoints > 0, // Simplistic
      },
    });
    totalAwarded += grade.awardedPoints;
  }

  // Check if all answers graded
  submission.answers.forEach(a => {
    if (a.awardedPoints === null) allGraded = false;
  });

  if (allGraded) {
    const score = (totalAwarded / totalPoints) * 100;
    await prisma.quizSubmission.update({
      where: { id: submissionId },
      data: { score },
    });
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: allGraded ? 'Submission fully graded' : 'Partial grading applied',
  });
});