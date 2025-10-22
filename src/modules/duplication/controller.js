// duplication/controller.js
import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

export const copyContent = catchAsync(async (req, res, next) => {
  const { sourceContentId, targetLessonId } = req.body;

  // Check if source content exists
  const sourceContent = await prisma.content.findUnique({
    where: { id: sourceContentId },
    include: {
      lesson: {
        include: {
          course: {
            include: { center: true }
          }
        }
      },
      questions: {
        include: { choices: true }
      },
      files: true,
    }
  });

  if (!sourceContent) {
    return next(new ErrorResponse('Source content not found', STATUS_CODE.NOT_FOUND));
  }

  // Check if target lesson exists
  const targetLesson = await prisma.lesson.findUnique({
    where: { id: targetLessonId },
    include: {
      course: {
        include: { center: true }
      }
    }
  });

  if (!targetLesson) {
    return next(new ErrorResponse('Target lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check for center admins (source and target must be in their center)
  if (req.user.role === 'CENTER_ADMIN') {
    const sourceCenterId = sourceContent.lesson.course.centerId;
    const targetCenterId = targetLesson.course.centerId;

    if (sourceCenterId !== targetCenterId) {
      return next(new ErrorResponse('Source and target must belong to the same center', STATUS_CODE.FORBIDDEN));
    }

    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: sourceCenterId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to copy this content', STATUS_CODE.FORBIDDEN));
    }
  }

  // Get the highest order in target lesson
  const lastContent = await prisma.content.findFirst({
    where: { lessonId: targetLessonId },
    orderBy: { order: 'desc' }
  });
  const newOrder = lastContent ? lastContent.order + 1 : 0;

  // Use transaction to copy content, questions, choices, files
  const newContent = await prisma.$transaction(async (tx) => {
    // Copy content
    const createdContent = await tx.content.create({
      data: {
        title: sourceContent.title,
        type: sourceContent.type,
        contentUrl: sourceContent.contentUrl,
        duration: sourceContent.duration,
        order: newOrder,
        isFree: sourceContent.isFree,
        isPublished: sourceContent.isPublished,
        bunnyVideoGuid: sourceContent.bunnyVideoGuid,
        outsideLink: sourceContent.outsideLink,
        youtubeVideoID: sourceContent.youtubeVideoID,
        description: sourceContent.description,
        timeLimit: sourceContent.timeLimit,
        maxAttempts: sourceContent.maxAttempts,
        passingScore: sourceContent.passingScore,
        passThreshold: sourceContent.passThreshold,
        lesson: { connect: { id: targetLessonId } },
      }
    });

    // Copy files if any
    for (const file of sourceContent.files) {
      await tx.file.create({
        data: {
          category: file.category,
          type: file.type,
          originalName: file.originalName,
          storedName: file.storedName,
          path: file.path,
          mimeType: file.mimeType,
          size: file.size,
          isFree: file.isFree,
          content: { connect: { id: createdContent.id } },
        }
      });
    }

    // Copy questions and choices
    for (const question of sourceContent.questions) {
      const createdQuestion = await tx.question.create({
        data: {
          type: question.type,
          text: question.text,
          imageUrl: question.imageUrl,
          explanation: question.explanation,
          order: question.order,
          points: question.points,
          modelAnswer: question.modelAnswer,
          content: { connect: { id: createdContent.id } },
        }
      });

      for (const choice of question.choices) {
        await tx.choice.create({
          data: {
            text: choice.text,
            isCorrect: choice.isCorrect,
            imageUrl: choice.imageUrl,
            question: { connect: { id: createdQuestion.id } },
          }
        });
      }
    }

    return createdContent;
  });

  logger.info(`Content copied: ${sourceContentId} to lesson ${targetLessonId} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { content: newContent },
    message: 'Content copied successfully'
  });
});

export const copyLesson = catchAsync(async (req, res, next) => {
  const { sourceLessonId, targetCourseId } = req.body;

  // Check if source lesson exists
  const sourceLesson = await prisma.lesson.findUnique({
    where: { id: sourceLessonId },
    include: {
      course: {
        include: { center: true }
      },
      contents: {
        include: {
          questions: { include: { choices: true } },
          files: true,
        }
      },
      homeworks: true,
    }
  });

  if (!sourceLesson) {
    return next(new ErrorResponse('Source lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check if target course exists
  const targetCourse = await prisma.course.findUnique({
    where: { id: targetCourseId },
    include: { center: true }
  });

  if (!targetCourse) {
    return next(new ErrorResponse('Target course not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    const sourceCenterId = sourceLesson.course.centerId;
    const targetCenterId = targetCourse.centerId;

    if (sourceCenterId !== targetCenterId) {
      return next(new ErrorResponse('Source and target must belong to the same center', STATUS_CODE.FORBIDDEN));
    }

    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: sourceCenterId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to copy this lesson', STATUS_CODE.FORBIDDEN));
    }
  }

  // Get the highest order in target course
  const lastLesson = await prisma.lesson.findFirst({
    where: { courseId: targetCourseId },
    orderBy: { order: 'desc' }
  });
  const newOrder = lastLesson ? lastLesson.order + 1 : 0;

  // Use transaction to copy lesson, contents, questions, choices, files, homeworks
  const newLesson = await prisma.$transaction(async (tx) => {
    // Copy lesson
    const createdLesson = await tx.lesson.create({
      data: {
        title: sourceLesson.title,
        description: sourceLesson.description,
        order: newOrder,
        isPublished: sourceLesson.isPublished,
        price: sourceLesson.price,
        discountPrice: sourceLesson.discountPrice,
        requiresQuizPass: sourceLesson.requiresQuizPass,
        completed: sourceLesson.completed,
        course: { connect: { id: targetCourseId } },
        center: sourceLesson.centerId ? { connect: { id: sourceLesson.centerId } } : undefined,
      }
    });

    // Copy contents
    for (const content of sourceLesson.contents) {
      const createdContent = await tx.content.create({
        data: {
          title: content.title,
          type: content.type,
          contentUrl: content.contentUrl,
          duration: content.duration,
          order: content.order,
          isFree: content.isFree,
          isPublished: content.isPublished,
          bunnyVideoGuid: content.bunnyVideoGuid,
          outsideLink: content.outsideLink,
          youtubeVideoID: content.youtubeVideoID,
          description: content.description,
          timeLimit: content.timeLimit,
          maxAttempts: content.maxAttempts,
          passingScore: content.passingScore,
          passThreshold: content.passThreshold,
          lesson: { connect: { id: createdLesson.id } },
        }
      });

      // Copy files
      for (const file of content.files) {
        await tx.file.create({
          data: {
            category: file.category,
            type: file.type,
            originalName: file.originalName,
            storedName: file.storedName,
            path: file.path,
            mimeType: file.mimeType,
            size: file.size,
            isFree: file.isFree,
            content: { connect: { id: createdContent.id } },
          }
        });
      }

      // Copy questions and choices
      for (const question of content.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            type: question.type,
            text: question.text,
            imageUrl: question.imageUrl,
            explanation: question.explanation,
            order: question.order,
            points: question.points,
            modelAnswer: question.modelAnswer,
            content: { connect: { id: createdContent.id } },
          }
        });

        for (const choice of question.choices) {
          await tx.choice.create({
            data: {
              text: choice.text,
              isCorrect: choice.isCorrect,
              imageUrl: choice.imageUrl,
              question: { connect: { id: createdQuestion.id } },
            }
          });
        }
      }
    }

    // Copy homeworks
    for (const homework of sourceLesson.homeworks) {
      await tx.homework.create({
        data: {
          title: homework.title,
          description: homework.description,
          dueDate: homework.dueDate,
          maxPoints: homework.maxPoints,
          isPublished: homework.isPublished,
          lesson: { connect: { id: createdLesson.id } },
        }
      });
    }

    return createdLesson;
  });

  logger.info(`Lesson copied: ${sourceLessonId} to course ${targetCourseId} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { lesson: newLesson },
    message: 'Lesson copied successfully'
  });
});

export const copyCourse = catchAsync(async (req, res, next) => {
  const { sourceCourseId, newTitle, newDescription } = req.body;

  // Check if source course exists
  const sourceCourse = await prisma.course.findUnique({
    where: { id: sourceCourseId },
    include: {
      center: true,
      lessons: {
        include: {
          contents: {
            include: {
              questions: { include: { choices: true } },
              files: true,
            }
          },
          homeworks: true,
        },
        orderBy: { order: 'asc' }
      },
      files: true,
      homeworks: true,
      contents: {
        include: {
          questions: { include: { choices: true } },
          files: true,
        }
      },
    }
  });

  if (!sourceCourse) {
    return next(new ErrorResponse('Source course not found', STATUS_CODE.NOT_FOUND));
  }

  // Permission check for center admins
  if (req.user.role === 'CENTER_ADMIN' && sourceCourse.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: sourceCourse.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to copy this course', STATUS_CODE.FORBIDDEN));
    }
  }

  // Use transaction to copy course, lessons, contents, etc.
  const newCourse = await prisma.$transaction(async (tx) => {
    // Copy course
    const createdCourse = await tx.course.create({
      data: {
        title: newTitle,
        academicYear: sourceCourse.academicYear,
        description: newDescription || sourceCourse.description,
        thumbnail: sourceCourse.thumbnail,
        price: sourceCourse.price,
        discountPrice: sourceCourse.discountPrice,
        isPublished: false, // New course starts unpublished
        center: sourceCourse.centerId ? { connect: { id: sourceCourse.centerId } } : undefined,
        isFree: sourceCourse.isFree,
        completed: sourceCourse.completed,
      }
    });

    // Copy course files
    for (const file of sourceCourse.files) {
      await tx.file.create({
        data: {
          category: file.category,
          type: file.type,
          originalName: file.originalName,
          storedName: file.storedName,
          path: file.path,
          mimeType: file.mimeType,
          size: file.size,
          isFree: file.isFree,
          course: { connect: { id: createdCourse.id } },
        }
      });
    }

    // Copy course-level contents (e.g., quizzes)
    for (const content of sourceCourse.contents) {
      const createdContent = await tx.content.create({
        data: {
          title: content.title,
          type: content.type,
          contentUrl: content.contentUrl,
          duration: content.duration,
          order: content.order,
          isFree: content.isFree,
          isPublished: content.isPublished,
          bunnyVideoGuid: content.bunnyVideoGuid,
          outsideLink: content.outsideLink,
          youtubeVideoID: content.youtubeVideoID,
          description: content.description,
          timeLimit: content.timeLimit,
          maxAttempts: content.maxAttempts,
          passingScore: content.passingScore,
          passThreshold: content.passThreshold,
          course: { connect: { id: createdCourse.id } },
        }
      });

      // Copy files for course content
      for (const file of content.files) {
        await tx.file.create({
          data: {
            category: file.category,
            type: file.type,
            originalName: file.originalName,
            storedName: file.storedName,
            path: file.path,
            mimeType: file.mimeType,
            size: file.size,
            isFree: file.isFree,
            content: { connect: { id: createdContent.id } },
          }
        });
      }

      // Copy questions and choices for course content
      for (const question of content.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            type: question.type,
            text: question.text,
            imageUrl: question.imageUrl,
            explanation: question.explanation,
            order: question.order,
            points: question.points,
            modelAnswer: question.modelAnswer,
            content: { connect: { id: createdContent.id } },
          }
        });

        for (const choice of question.choices) {
          await tx.choice.create({
            data: {
              text: choice.text,
              isCorrect: choice.isCorrect,
              imageUrl: choice.imageUrl,
              question: { connect: { id: createdQuestion.id } },
            }
          });
        }
      }
    }

    // Copy course-level homeworks
    for (const homework of sourceCourse.homeworks) {
      await tx.homework.create({
        data: {
          title: homework.title,
          description: homework.description,
          dueDate: homework.dueDate,
          maxPoints: homework.maxPoints,
          isPublished: homework.isPublished,
          course: { connect: { id: createdCourse.id } },
        }
      });
    }

    // Copy lessons
    for (const lesson of sourceCourse.lessons) {
      const createdLesson = await tx.lesson.create({
        data: {
          title: lesson.title,
          description: lesson.description,
          order: lesson.order,
          isPublished: lesson.isPublished,
          price: lesson.price,
          discountPrice: lesson.discountPrice,
          requiresQuizPass: lesson.requiresQuizPass,
          completed: lesson.completed,
          course: { connect: { id: createdCourse.id } },
          center: lesson.centerId ? { connect: { id: lesson.centerId } } : undefined,
        }
      });

      // Copy lesson contents
      for (const content of lesson.contents) {
        const createdContent = await tx.content.create({
          data: {
            title: content.title,
            type: content.type,
            contentUrl: content.contentUrl,
            duration: content.duration,
            order: content.order,
            isFree: content.isFree,
            isPublished: content.isPublished,
            bunnyVideoGuid: content.bunnyVideoGuid,
            outsideLink: content.outsideLink,
            youtubeVideoID: content.youtubeVideoID,
            description: content.description,
            timeLimit: content.timeLimit,
            maxAttempts: content.maxAttempts,
            passingScore: content.passingScore,
            passThreshold: content.passThreshold,
            lesson: { connect: { id: createdLesson.id } },
          }
        });

        // Copy files for lesson content
        for (const file of content.files) {
          await tx.file.create({
            data: {
              category: file.category,
              type: file.type,
              originalName: file.originalName,
              storedName: file.storedName,
              path: file.path,
              mimeType: file.mimeType,
              size: file.size,
              isFree: file.isFree,
              content: { connect: { id: createdContent.id } },
            }
          });
        }

        // Copy questions and choices for lesson content
        for (const question of content.questions) {
          const createdQuestion = await tx.question.create({
            data: {
              type: question.type,
              text: question.text,
              imageUrl: question.imageUrl,
              explanation: question.explanation,
              order: question.order,
              points: question.points,
              modelAnswer: question.modelAnswer,
              content: { connect: { id: createdContent.id } },
            }
          });

          for (const choice of question.choices) {
            await tx.choice.create({
              data: {
                text: choice.text,
                isCorrect: choice.isCorrect,
                imageUrl: choice.imageUrl,
                question: { connect: { id: createdQuestion.id } },
              }
            });
          }
        }
      }

      // Copy lesson homeworks
      for (const homework of lesson.homeworks) {
        await tx.homework.create({
          data: {
            title: homework.title,
            description: homework.description,
            dueDate: homework.dueDate,
            maxPoints: homework.maxPoints,
            isPublished: homework.isPublished,
            lesson: { connect: { id: createdLesson.id } },
          }
        });
      }
    }

    return createdCourse;
  });

  logger.info(`Course copied: ${sourceCourseId} to new course ${newCourse.id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { course: newCourse },
    message: 'Course copied successfully'
  });
});