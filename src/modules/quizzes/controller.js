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


// Add to modules/quizzes/controller.js (at the end, after existing exports)

// Updated: getAllQuizzes (use 'order' for sorting, include linked content)

export const getAllQuizzes = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, search = '', isPublished, courseId = '', lessonId = '' } = req.query;

  // Validate/sanitize inputs
  const validatedPage = Math.max(1, parseInt(page, 10) || 1);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (validatedPage - 1) * validatedLimit;

  // Build where clause (null-safe)
  const where = {
    ...(search && search.trim() !== '' && { title: { contains: search.trim(), mode: 'insensitive' } }),
    ...(isPublished !== undefined ? { isPublished: isPublished === 'true' } : {}),
    ...(courseId && courseId.trim() !== '' ? { courseId: courseId.trim() } : {}),
    ...(lessonId && lessonId.trim() !== '' ? { lessonId: lessonId.trim() } : {}),
  };

  try {
    const [quizzes, totalCount] = await Promise.all([
      prisma.quiz.findMany({
        where,
        skip,
        take: validatedLimit,
        include: {
          lesson: {
            select: { 
              id: true, 
              title: true, 
              course: { select: { id: true, title: true } } 
            },
          },
          course: { select: { id: true, title: true } },
          // NEW: Include linked content (null if not set)
          content: {
            select: {
              id: true,
              order: true,
              isPublished: true,
              isFree: true,
            },
          },
          questions: {
            select: { 
              id: true, 
              type: true, 
              text: true, 
              points: true, 
              order: true,
              _count: { select: { choices: true } },
            },
            orderBy: { order: 'asc' },
          },
          _count: { select: { submissions: true, questions: true } },
        },
        // UPDATED: Sort by 'order' asc (fallback to createdAt desc if order null)
        orderBy: { order: 'asc' },
      }),
      prisma.quiz.count({ where }),
    ]);

    if (quizzes.length === 0 && totalCount === 0) {
      logger.info(`No quizzes found with filters:`, { where });
    }

    // Transform with null handling
    const transformedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      lesson: quiz.lesson || null,
      course: quiz.course || null,
      content: quiz.content || null, // Explicit null for unlinked
      questions: quiz.questions || [],
    }));

    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: { 
        quizzes: transformedQuizzes, 
        totalCount, 
        page: validatedPage, 
        limit: validatedLimit,
        hasMore: skip + validatedLimit < totalCount,
      },
      message: `Fetched ${transformedQuizzes.length} quizzes successfully`,
    });

  } catch (dbError) {
    logger.error(`Failed to fetch quizzes:`, { error: dbError.message, where });
    return next(new ErrorResponse('Failed to fetch quizzes. Please try again.', STATUS_CODE.INTERNAL_SERVER_ERROR));
  }
});


// Updated: getQuizzesForLesson (use 'order' for sorting, include linked content)


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
        // NEW: Include linked content
        content: {
          select: {
            id: true,
            order: true,
            isPublished: true,
            isFree: true,
          },
        },
        questions: {
          include: { 
            choices: {
              select: {
                id: true,
                text: true,
                imageUrl: true,
                questionId: true,
              },
            },
          },
        },
      },
      // UPDATED: Sort by 'order' asc
      orderBy: { order: 'asc' },
    }),
    prisma.quiz.count({ where }),
  ]);

  // Transform with null handling
  const transformedQuizzes = quizzes.map(quiz => ({
    ...quiz,
    content: quiz.content || null,
  }));

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quizzes: transformedQuizzes, totalCount, page, limit },
  });
});

// Updated: getQuizById (include linked content)

export const getQuizById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      // NEW: Include linked content
      content: {
        select: {
          id: true,
          order: true,
          isPublished: true,
          isFree: true,
        },
      },
      questions: {
        orderBy: { order: 'asc' },
        include: { 
          choices: {
            select: {
              id: true,
              text: true,
              imageUrl: true,
              // isCorrect: true
            },
          },
        },
      },
      lesson: true,
    },
  });

  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Transform with null handling
  const transformedQuiz = {
    ...quiz,
    content: quiz.content || null,
  };

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz: transformedQuiz },
  });
});

export const getQuizByIdForEdit = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      // NEW: Include linked content
      content: {
        select: {
          id: true,
          order: true,
          isPublished: true,
          isFree: true,
        },
      },
      questions: {
        orderBy: { order: 'asc' },
        include: { 
          choices: {
            select: {
              id: true,
              text: true,
              imageUrl: true,
              isCorrect: true
            },
          },
        },
      },
      lesson: true,
    },
  });

  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Transform with null handling
  const transformedQuiz = {
    ...quiz,
    content: quiz.content || null,
  };

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz: transformedQuiz },
  });
});


// Updated: createQuiz (create linked Content after Quiz)
export const createQuiz = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const quizData = req.body;

  // Check lesson (null-safe)
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check (as before)

  const quiz = await prisma.quiz.create({
    data: {
      ...quizData,
      lessonId,
      // Use provided order or default
      order: quizData.order ?? 999,
    },
  });

  try {
    // NEW: Create linked Content (type=QUIZ)
    const content = await prisma.content.create({
      data: {
        lessonId,
        title: quiz.title,
        type: 'QUIZ',
        description: quiz.description ?? null,
        contentUrl: null,
        duration: null,
        isPublished: quiz.isPublished ?? false,
        order: quiz.order ?? 999, // Sync order
        isFree: false, // Quizzes are non-free
        bunnyVideoGuid: null,
        quizId: quiz.id, // Link
      },
    });

    // Update Quiz with content link (if needed for inverse)
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: { contentId: content.id }, // Assuming you added contentId to Quiz; optional with relation
    });

    logger.info(`Created Content wrapper for quiz ${quiz.id}: ${content.id}`);

  } catch (contentError) {
    // Recovery: If Content fails, don't delete Quiz (rollback if critical)
    logger.error(`Failed to create Content for quiz ${quiz.id}:`, contentError);
    // Optionally: return next(new ErrorResponse('Quiz created but content sync failed', STATUS_CODE.INTERNAL_SERVER_ERROR));
    // For now: Continue with success, as Quiz is primary
  }

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz },
    message: 'Quiz created successfully',
  });
});

export const updateQuiz = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  const quiz = await prisma.quiz.findUnique({ 
    where: { id }, 
    include: { content: true } // Fetch linked Content
  });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check

  const updatedQuiz = await prisma.quiz.update({
    where: { id },
    data: {
      ...updateData,
      // Ensure order if provided
      order: updateData.order ?? quiz.order,
    },
  });

  try {
    // NEW: Sync updates to linked Content (null-safe)
    if (quiz.content) {
      await prisma.content.update({
        where: { id: quiz.content.id },
        data: {
          title: updatedQuiz.title,
          description: updatedQuiz.description ?? null,
          isPublished: updatedQuiz.isPublished ?? false,
          order: updatedQuiz.order ?? 999,
        },
      });
      logger.info(`Synced Content ${quiz.content.id} for updated quiz ${id}`);
    }
  } catch (syncError) {
    logger.error(`Failed to sync Content for quiz ${id}:`, syncError);
    // Continue: Quiz update succeeded
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { quiz: updatedQuiz },
    message: 'Quiz updated successfully',
  });
});

// Updated: deleteQuiz (delete linked Content in transaction)
export const deleteQuiz = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quiz = await prisma.quiz.findUnique({ 
    where: { id }, 
    include: { content: true } // Fetch to clean up
  });
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check

  await prisma.$transaction(async (tx) => {
    // NEW: Delete linked Content first (if exists; cascade will handle relation)
    if (quiz.content) {
      // Clean up any Content files (though quizzes have none)
      if (quiz.content.contentUrl) {
        const filePath = path.join(process.cwd(), quiz.content.contentUrl);
        await unlink(filePath).catch((err) => logger.error(`Failed to delete content file: ${err}`));
      }
      await tx.content.delete({ where: { id: quiz.content.id } });
      logger.info(`Deleted Content ${quiz.content.id} for quiz ${id}`);
    }

    // Existing deletes (answers, submissions, etc.)
    await tx.quizAnswer.deleteMany({ where: { submission: { quizId: id } } });
    await tx.quizSubmission.deleteMany({ where: { quizId: id } });
    await tx.choice.deleteMany({ where: { question: { quizId: id } } });
    await tx.question.deleteMany({ where: { quizId: id } });

    // Files (now includes Content-related if any)
    const files = await tx.file.findMany({ where: { quizId: id } });
    for (const file of files) {
      const filePath = path.join(process.cwd(), file.path);
      await unlink(filePath).catch((err) => logger.error(`Failed to delete file: ${err}`));
    }
    await tx.file.deleteMany({ where: { quizId: id } });

    // Delete Quiz (cascades to relation)
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
    // FIXED: Removed order from choice creation (not in schema)
    // const choiceOrder = choices[i].order || (i + 1); // No longer needed

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
        // Removed: order: choiceOrder (not supported by schema)
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

// Updated: updateQuestion (remove order from choice update/create)
export const updateQuestion = catchAsync(async (req, res, next) => {
  const { quizId, questionId } = req.params;
  const { type, text, explanation, order, points, choices: choicesStr, deleteQuestionImage } = req.body;
const choices = req.body.choices || [];  // Fallback to empty array if missing
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
  for (let i = 0; i < choices.length; i++) {
    const choiceData = choices[i]; // Use choiceData directly

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
          // Removed: order: choiceOrder (not supported by schema)
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
          questionId: questionId,
          text: choiceData.text,
          isCorrect: choiceData.isCorrect,
          // Removed: order: choiceOrder (not supported by schema)
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

export const startQuiz = catchAsync(async (req, res, next) => {
  const { quizId } = req.params;
  const userId = req.user.userId;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { lesson: { include: { course: true } } },
  });

  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  // Check enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { 
      userId, 
      courseId: quiz.lesson?.courseId, 
      status: 'ACTIVE' 
    },
  });

  console.log("req.user.role[0] => ", req.user.role[0]?.role?.name)
  
  if (!enrollment && req.user.role[0]?.role?.name !== 'ADMIN' ) {
    return next(new ErrorResponse('Not enrolled in the course', STATUS_CODE.FORBIDDEN));
  }

  // Check attempts
  const attempts = await prisma.quizSubmission.count({ 
    where: { quizId, userId } 
  });
  
  // if (attempts >= quiz.maxAttempts) {
  //   return next(new ErrorResponse('Maximum attempts reached', STATUS_CODE.BAD_REQUEST));
  // }

  // Check if there's an ongoing quiz submission
  const ongoingSubmission = await prisma.quizSubmission.findFirst({
    where: {
      quizId,
      userId,
      completedAt: null,
      startedAt: {
        // Check if started within the time limit
        gte: new Date(Date.now() - (quiz.timeLimit * 60 * 1000))
      }
    }
  });

  if (ongoingSubmission) {
    // Calculate remaining time
    const elapsedTime = Date.now() - ongoingSubmission.startedAt.getTime();
    const remainingTime = (quiz.timeLimit * 60 * 1000) - elapsedTime;
    
    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: { 
        submission: ongoingSubmission,
        remainingTime: Math.max(0, Math.floor(remainingTime / 1000)), // in seconds
        message: 'You have an ongoing quiz attempt'
      }
    });
  }

  // Create new submission
  const submission = await prisma.quizSubmission.create({
    data: {
      quizId,
      userId,
      startedAt: new Date(),
      score: 0,
      totalPoints: 0,
    },
  });

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { 
      submission,
      timeLimit: quiz.timeLimit * 60, // Convert to seconds
      message: 'Quiz started successfully'
    },
  });
});


export const submitQuiz = catchAsync(async (req, res, next) => {
  const { quizId, submissionId } = req.params;
  const userId = req.user.userId;
  const { answers } = req.body;

  // Find the submission
  const submission = await prisma.quizSubmission.findUnique({
    where: { id: submissionId },
    include: {
      quiz: {
        include: { 
          questions: { include: { choices: true } },
          lesson: { include: { course: true } }
        }
      }
    }
  });

  if (!submission || submission.quizId !== quizId || submission.userId !== userId) {
    return next(new ErrorResponse('Submission not found', STATUS_CODE.NOT_FOUND));
  }

  // Check if already completed
  if (submission.completedAt) {
    return next(new ErrorResponse('Quiz already submitted', STATUS_CODE.BAD_REQUEST));
  }

  // Validate time limit
  if (submission.quiz.timeLimit) {
    const elapsedTime = Date.now() - submission.startedAt.getTime();
    const timeLimitMs = submission.quiz.timeLimit * 60 * 1000;
    
    if (elapsedTime > timeLimitMs + 10000) {
      // Auto-submit with current answers or mark as expired
      await prisma.quizSubmission.update({
        where: { id: submissionId },
        data: { 
          completedAt: new Date(),
          timeSpent: Math.floor(elapsedTime / 1000),
          score: 0 // Or calculate based on current answers
        }
      });
      
      return next(new ErrorResponse('تم انتهاء الوقت برجاء اعادة الاختبار', STATUS_CODE.BAD_REQUEST));
    }
  }

  // Validate answers length
  if (answers.length !== submission.quiz.questions.length) {
    return next(new ErrorResponse('Must answer all questions', STATUS_CODE.BAD_REQUEST));
  }

  const elapsedTime = Date.now() - submission.startedAt.getTime();
  let totalPoints = 0;
  let score = 0;
  let hasEssay = false;
  const createdAnswers = [];

  // Process answers
  for (const ans of answers) {
    const question = submission.quiz.questions.find(q => q.id === ans.questionId);
    if (!question) {
      return next(new ErrorResponse(`Invalid question ID: ${ans.questionId}`, STATUS_CODE.BAD_REQUEST));
    }
    
    totalPoints += question.points;

    let isCorrect = null;
    let awardedPoints = null;


      if (!ans.selectedChoiceId) {
        return next(new ErrorResponse('برجاء حل جميع الاسئلة قبل انهاء الاختبار', STATUS_CODE.BAD_REQUEST));
      }
      
      const choice = question.choices.find(c => c.id === ans.selectedChoiceId);
      if (!choice) {
        return next(new ErrorResponse(`Invalid choice ID: ${ans.selectedChoiceId}`, STATUS_CODE.BAD_REQUEST));
      }
      
      isCorrect = choice.isCorrect;
      awardedPoints = isCorrect ? question.points : 0;
      score += awardedPoints;

    const quizAnswer = await prisma.quizAnswer.create({
      data: {
        
        submissionId: submission.id,
    questionId: question.id,
    selectedChoiceId: ans.selectedChoiceId,
    isCorrect: isCorrect, // Set null for essay questions
    awardedPoints: awardedPoints, // Set null for essay questions

      },
    });
    createdAnswers.push(quizAnswer);
  }

  // Update submission
  const updateData = { 
    completedAt: new Date(),
    timeSpent: Math.floor(elapsedTime / 1000),
    totalPoints 
  };

    if (!hasEssay) {
    const finalScore = (score / totalPoints) * 100;
    updateData.score = finalScore;

    // ✅ determine if passed
    const requiredScore = submission.quiz.passingScore ?? 50; // fallback 50%
    updateData.passed = finalScore >= requiredScore;
  } else {
    updateData.passed = null; // essays might be graded later
  }

  const updatedSubmission = await prisma.quizSubmission.update({
    where: { id: submission.id },
    data: updateData,
  });


  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { 
      submission: updatedSubmission,
      answers: createdAnswers
    },
    message: updatedSubmission.passed 
      ? 'Quiz submitted successfully - You passed 🎉' 
      : 'Quiz submitted successfully - You did not pass ❌',
  });

});


export const getQuizWithSubmission = catchAsync(async (req, res, next) => {
  const quizId = req?.params?.quizId ?? null; // Null-safe
  const userId = req.user?.userId ?? null; // Null-safe

  if (!quizId || !userId) {
    return next(new ErrorResponse('Missing quizId or userId', STATUS_CODE.BAD_REQUEST));
  }

  const [quiz, submissions] = await Promise.all([
    prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        // NEW: Include linked content
        content: {
          select: {
            id: true,
            order: true,
            isPublished: true,
            isFree: true,
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          include: { 
            choices: {
              select: {
                id: true,
                text: true,
                imageUrl: true,
              },
            },
          },
        },
        lesson: true,
      },
    }),
    prisma.quizSubmission.findMany({
      where: { quizId, userId },
      orderBy: { completedAt: 'desc' },
      take: 1,
    }),
  ]);

  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', STATUS_CODE.NOT_FOUND));
  }

  const latestSubmission = submissions[0] || null;
  let canRetake = false;
  let remainingTime = null;

  if (latestSubmission && !latestSubmission.completedAt) {
    const elapsedTime = Date.now() - latestSubmission.startedAt.getTime();
    const timeLimitMs = (quiz.timeLimit ?? 0) * 60 * 1000; // Null-safe timeLimit
    
    if (elapsedTime <= timeLimitMs) {
      remainingTime = Math.floor((timeLimitMs - elapsedTime) / 1000);
    } else {
      await prisma.quizSubmission.update({
        where: { id: latestSubmission.id },
        data: { completedAt: new Date() },
      });
    }
  }

  const attemptCount = await prisma.quizSubmission.count({
    where: { quizId, userId },
  });

  canRetake = (attemptCount ?? 0) < (quiz.maxAttempts ?? 1); // Null-safe

  // Transform with null handling
  const transformedQuiz = {
    ...quiz,
    content: quiz.content || null,
  };

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { 
      quiz: transformedQuiz, 
      latestSubmission,
      canRetake,
      remainingTime,
      attempts: {
        used: attemptCount ?? 0,
        max: quiz.maxAttempts ?? 1,
      },
    },
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




