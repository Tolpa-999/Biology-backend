// import prisma from '../../loaders/prisma.js';
// import catchAsync from '../../utils/cathAsync.js';
// import ErrorResponse from '../../utils/errorResponse.js';
// import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
// import logger from '../../utils/logger.js';

// export const getCourseContent = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const userId = req.user.userId;

//   // Get course with lessons and content
//   const course = await prisma.course.findUnique({
//     where: { id: courseId },
//     include: {
//       lessons: {
//         where: { isPublished: true },
//         orderBy: { order: 'asc' },
//         include: {
//           contents: {
//             where: { isPublished: true },
//             orderBy: { order: 'asc' },
//             include: {
//               contentProgress: {
//                 where: { userId }
//               }
//             }
//           },
//           _count: {
//             select: {
//               contents: true
//             }
//           }
//         }
//       },
//       // enrollment: {
//       //   where: { userId, status: 'ACTIVE' },
//       //   select: { id: true, status: true, userId: true, courseId: true }
//       // },
//       _count: {
//         select: {
//           lessons: true
//         }
//       }
//     }
//   });

//   if (!course) {
//     return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
//   }

//   // Reorganize content
//   const organizedLessons = course.lessons.map(lesson => {
//     const allContent = lesson.contents.map(content => ({
//       ...content,
//       type: content.type,
//       progress: content.contentProgress?.[0] || null
//     })).sort((a, b) => a.order - b.order);

//     return {
//       ...lesson,
//       allContent,
//       progress: lesson?.lessonProgress?.[0] || null
//     };
//   });

//   // Calculate total and completed content
//   const totalContents = organizedLessons.reduce(
//     (sum, lesson) => sum + lesson.allContent.length,
//     0
//   );

//   const completedContent = await prisma.contentProgress.count({
//     where: {
//       userId,
//       completed: true,
//       content: {
//         lesson: {
//           courseId,
//           isPublished: true
//         },
//         isPublished: true
//       }
//     }
//   });

//   const progressPercentage = totalContents > 0
//     ? (completedContent / totalContents) * 100
//     : 0;

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       course: {
//         ...course,
//         lessons: organizedLessons,
//         progress: {
//           percentage: Math.round(progressPercentage),
//           completed: completedContent,
//           total: totalContents
//         }
//       }
//     }
//   });
// });

// export const markContentCompleted = catchAsync(async (req, res, next) => {
//   const { contentId, enrollmentId, lessonId, completed = true } = req.body;
//   const userId = req.user.userId;

//   // Check if content exists and is published
//   const content = await prisma.content.findUnique({
//     where: { id: contentId },
//     include: {
//       lesson: {
//         include: {
//           course: true
//         }
//       }
//     }
//   });

//   if (!content) {
//     return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
//   }

//   if (!content.isPublished || !content.lesson.isPublished) {
//     return next(new ErrorResponse('Content or lesson not accessible', STATUS_CODE.NOT_FOUND));
//   }

//   let enrollment = null;
//   if (!content.isFree) {
//     // Validate enrollment for non-free content
//     if (enrollmentId) {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           id: enrollmentId,
//           userId,
//           status: 'ACTIVE',
//           courseId: content.lesson.courseId
//         }
//       });
//     } else {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           userId,
//           courseId: content.lesson.courseId,
//           status: 'ACTIVE'
//         }
//       });
//     }

//     if (!enrollment) {
//       return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
//     }
//   }

//   // Update or create content progress
//   const contentProgress = await prisma.contentProgress.upsert({
//     where: {
//       userId_contentId: {
//         userId,
//         contentId
//       }
//     },
//     update: {
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date(),
//       enrollmentId: enrollment ? enrollment.id : null,
//       lessonId: content.lessonId
//     },
//     create: {
//       userId,
//       contentId,
//       enrollmentId: enrollment ? enrollment.id : null,
//       lessonId: content.lessonId,
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     },
//     include: {
//       content: {
//         include: {
//           lesson: true
//         }
//       }
//     }
//   });

//   // Update lesson and course progress if enrolled
//   if (enrollment) {
//     await updateLessonProgress(userId, enrollment.id, content.lessonId);
//     await updateCourseProgress(userId, enrollment.id, content.lesson.courseId);
//   }

//   logger.info(`Content progress updated: ${contentId} for user: ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { contentProgress },
//     message: `Content marked as ${completed ? 'completed' : 'incomplete'}`
//   });
// });

// export const markLessonCompleted = catchAsync(async (req, res, next) => {
//   const { lessonId, enrollmentId, completed = true } = req.body;
//   const userId = req.user.userId;

//   // Check if lesson exists and is accessible
//   const lesson = await prisma.lesson.findUnique({
//     where: { id: lessonId },
//     include: { course: true }
//   });

//   if (!lesson || !lesson.isPublished) {
//     return next(new ErrorResponse('Lesson not found or not accessible', STATUS_CODE.NOT_FOUND));
//   }

//   // Validate enrollment
//   let enrollment;
//   if (enrollmentId) {
//     enrollment = await prisma.enrollment.findFirst({
//       where: {
//         id: enrollmentId,
//         userId,
//         status: 'ACTIVE',
//         courseId: lesson.courseId
//       }
//     });
//   } else {
//     enrollment = await prisma.enrollment.findFirst({
//       where: {
//         userId,
//         courseId: lesson.courseId,
//         status: 'ACTIVE'
//       }
//     });
//   }

//   if (!enrollment) {
//     return next(new ErrorResponse('Enrollment not found or inactive', STATUS_CODE.FORBIDDEN));
//   }

//   // Update lesson progress
//   const lessonProgress = await prisma.lessonProgress.upsert({
//     where: {
//       enrollmentId_lessonId_lessonEnrollmentId: {
//         enrollmentId: enrollment.id,
//         lessonId,
//         lessonEnrollmentId: null
//       }
//     },
//     update: {
//       completed,
//       progress: completed ? 100 : 0,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     },
//     create: {
//       enrollmentId: enrollment.id,
//       lessonId,
//       completed,
//       progress: completed ? 100 : 0,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     }
//   });

//   // If marking as completed, mark all content in lesson as completed
//   if (completed) {
//     const lessonContents = await prisma.content.findMany({
//       where: {
//         lessonId,
//         isPublished: true
//       }
//     });

//     await Promise.all(
//       lessonContents.map(content =>
//         prisma.contentProgress.upsert({
//           where: {
//             userId_contentId: {
//               userId,
//               contentId: content.id
//             }
//           },
//           update: {
//             completed: true,
//             completedAt: new Date(),
//             lastAccessed: new Date(),
//             enrollmentId: enrollment.id,
//             lessonId
//           },
//           create: {
//             userId,
//             contentId: content.id,
//             enrollmentId: enrollment.id,
//             lessonId,
//             completed: true,
//             completedAt: new Date(),
//             lastAccessed: new Date()
//           }
//         })
//       )
//     );
//   }

//   // Update course progress
//   await updateCourseProgress(userId, enrollment.id, lesson.courseId);

//   logger.info(`Lesson progress updated: ${lessonId} for user: ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { lessonProgress },
//     message: `Lesson marked as ${completed ? 'completed' : 'incomplete'}`
//   });
// });

// export const markCourseCompleted = catchAsync(async (req, res, next) => {
//   const { courseId, enrollmentId, completed = true } = req.body;
//   const userId = req.user.userId;

//   // Validate enrollment access
//   let enrollment;
//   if (enrollmentId) {
//     enrollment = await prisma.enrollment.findFirst({
//       where: {
//         id: enrollmentId,
//         userId,
//         status: 'ACTIVE'
//       }
//     });
//   } else {
//     enrollment = await prisma.enrollment.findFirst({
//       where: {
//         userId,
//         courseId,
//         status: 'ACTIVE'
//       }
//     });
//   }

//   if (!enrollment) {
//     return next(new ErrorResponse('Enrollment not found or inactive', STATUS_CODE.FORBIDDEN));
//   }

//   // Check if course exists
//   const course = await prisma.course.findUnique({
//     where: { id: courseId }
//   });

//   if (!course) {
//     return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
//   }

//   // Update enrollment completion status
//   const updatedEnrollment = await prisma.enrollment.update({
//     where: { id: enrollment.id },
//     data: {
//       completedAt: completed ? new Date() : null,
//       progress: completed ? 100 : 0
//     }
//   });

//   // If marking as completed, mark all lessons and content as completed
//   if (completed) {
//     const lessons = await prisma.lesson.findMany({
//       where: {
//         courseId,
//         isPublished: true
//       }
//     });

//     await Promise.all(
//       lessons.map(lesson =>
//         prisma.lessonProgress.upsert({
//           where: {
//             enrollmentId_lessonId_lessonEnrollmentId: {
//               enrollmentId: enrollment.id,
//               lessonId: lesson.id,
//               lessonEnrollmentId: null
//             }
//           },
//           update: {
//             completed: true,
//             progress: 100,
//             completedAt: new Date(),
//             lastAccessed: new Date()
//           },
//           create: {
//             enrollmentId: enrollment.id,
//             lessonId: lesson.id,
//             completed: true,
//             progress: 100,
//             completedAt: new Date(),
//             lastAccessed: new Date()
//           }
//         })
//       )
//     );

//     const contents = await prisma.content.findMany({
//       where: {
//         lesson: {
//           courseId,
//           isPublished: true
//         },
//         isPublished: true
//       }
//     });

//     await Promise.all(
//       contents.map(content =>
//         prisma.contentProgress.upsert({
//           where: {
//             userId_contentId: {
//               userId,
//               contentId: content.id
//             }
//           },
//           update: {
//             completed: true,
//             completedAt: new Date(),
//             lastAccessed: new Date(),
//             enrollmentId: enrollment.id,
//             lessonId: content.lessonId
//           },
//           create: {
//             userId,
//             contentId: content.id,
//             enrollmentId: enrollment.id,
//             lessonId: content.lessonId,
//             completed: true,
//             completedAt: new Date(),
//             lastAccessed: new Date()
//           }
//         })
//       )
//     );
//   }

//   logger.info(`Course progress updated: ${courseId} for user: ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { enrollment: updatedEnrollment },
//     message: `Course marked as ${completed ? 'completed' : 'incomplete'}`
//   });
// });

// export const getCourseProgress = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const userId = req.user.userId;

//   // Check enrollment
//   const enrollment = await prisma.enrollment.findFirst({
//     where: {
//       userId,
//       courseId,
//       status: 'ACTIVE'
//     }
//   });

//   if (!enrollment) {
//     return next(new ErrorResponse('You are not enrolled in this course', STATUS_CODE.FORBIDDEN));
//   }

//   // Get course with content counts
//   const course = await prisma.course.findUnique({
//     where: { id: courseId },
//     include: {
//       _count: {
//         select: {
//           lessons: {
//             where: {
//               isPublished: true
//             }
//           }
//         }
//       }
//     }
//   });

//   if (!course) {
//     return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
//   }

//   // Get completed content count
//   const completedContent = await prisma.contentProgress.count({
//     where: {
//       userId,
//       enrollmentId: enrollment.id,
//       completed: true,
//       content: {
//         lesson: {
//           courseId,
//           isPublished: true
//         },
//         isPublished: true
//       }
//     }
//   });

//   // Get completed lessons count
//   const completedLessons = await prisma.lessonProgress.count({
//     where: {
//       enrollmentId: enrollment.id,
//       completed: true,
//       lesson: {
//         courseId,
//         isPublished: true
//       }
//     }
//   });

//   const totalContent = await prisma.content.count({
//     where: {
//       lesson: {
//         courseId,
//         isPublished: true
//       },
//       isPublished: true
//     }
//   });
//   const totalLessons = course._count.lessons;

//   const contentProgress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;
//   const lessonProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
//   const overallProgress = (contentProgress + lessonProgress) / 2;

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       progress: {
//         overall: Math.round(overallProgress),
//         content: Math.round(contentProgress),
//         lessons: Math.round(lessonProgress),
//         completedContent,
//         totalContent,
//         completedLessons,
//         totalLessons,
//         enrollment
//       }
//     }
//   });
// });

// export const getUserProgress = catchAsync(async (req, res, next) => {
//   const { userId } = req.params;
//   const { page = 1, limit = 10, status, academicYear } = req.query;

//   // Check if user has permission to view this progress
//   if (userId !== req.user.userId && !req.user.roles?.includes('ADMIN') && !req.user.roles?.includes('CENTER_ADMIN')) {
//     return next(new ErrorResponse('You do not have permission to view this user\'s progress', STATUS_CODE.FORBIDDEN));
//   }

//   const pageNumber = parseInt(page, 10);
//   const limitNumber = parseInt(limit, 10);
//   const skip = (pageNumber - 1) * limitNumber;

//   const where = {
//     userId,
//     status: 'ACTIVE',
//     ...(status && {
//       ...(status === 'COMPLETED' && { completedAt: { not: null } }),
//       ...(status === 'IN_PROGRESS' && { 
//         completedAt: null,
//         progress: { gt: 0, lt: 100 }
//       }),
//       ...(status === 'NOT_STARTED' && { progress: 0 })
//     }),
//     ...(academicYear && {
//       course: { academicYear }
//     })
//   };

//   const [enrollments, totalCount] = await Promise.all([
//     prisma.enrollment.findMany({
//       where,
//       skip,
//       take: limitNumber,
//       include: {
//         course: {
//           select: {
//             id: true,
//             title: true,
//             academicYear: true,
//             thumbnail: true,
//             _count: {
//               select: {
//                 contents: {
//                   where: {
//                     lesson: { isPublished: true },
//                     isPublished: true
//                   }
//                 },
//                 lessons: {
//                   where: { isPublished: true }
//                 }
//               }
//             }
//           }
//         },
//         _count: {
//           select: {
//             contentProgress: {
//               where: { completed: true }
//             },
//             lessonProgress: {
//               where: { completed: true }
//             }
//           }
//         }
//       },
//       orderBy: { startedAt: 'desc' }
//     }),
//     prisma.enrollment.count({ where })
//   ]);

//   // Calculate progress for each enrollment
//   const progressData = enrollments.map(enrollment => {
//     const totalContent = enrollment.course._count.contents;
//     const completedContent = enrollment._count.contentProgress;
//     const contentProgress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;

//     return {
//       ...enrollment,
//       progress: {
//         content: Math.round(contentProgress),
//         completedContent,
//         totalContent
//       }
//     };
//   });

//   const totalPages = Math.ceil(totalCount / limitNumber);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       enrollments: progressData,
//       pagination: {
//         currentPage: pageNumber,
//         totalPages,
//         totalCount,
//         hasNext: pageNumber < totalPages,
//         hasPrev: pageNumber > 1,
//       }
//     }
//   });
// });

// export const getProgressStats = catchAsync(async (req, res, next) => {
//   const { courseId, enrollmentId, startDate, endDate } = req.query;

//   const where = {};
  
//   if (courseId) where.content = { lesson: { courseId } };
//   if (enrollmentId) where.enrollmentId = enrollmentId;
//   if (startDate || endDate) {
//     where.lastAccessed = {};
//     if (startDate) where.lastAccessed.gte = new Date(startDate);
//     if (endDate) where.lastAccessed.lte = new Date(endDate);
//   }

//   const [
//     totalContentProgress,
//     completedContentProgress,
//     averageCompletionRate,
//     popularContent,
//     recentActivity
//   ] = await Promise.all([
//     prisma.contentProgress.count({ where }),
//     prisma.contentProgress.count({
//       where: { ...where, completed: true }
//     }),
//     prisma.contentProgress.aggregate({
//       where,
//       _avg: { completed: true }
//     }),
//     prisma.contentProgress.groupBy({
//       by: ['contentId'],
//       where,
//       _count: { id: true },
//       orderBy: { _count: { id: 'desc' } },
//       take: 10
//     }),
//     prisma.contentProgress.findMany({
//       where,
//       orderBy: { lastAccessed: 'desc' },
//       take: 10,
//       include: {
//         content: {
//           include: {
//             lesson: {
//               include: {
//                 course: true
//               }
//             }
//           }
//         },
//         user: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             email: true
//           }
//         }
//       }
//     })
//   ]);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       totalProgressEntries: totalContentProgress,
//       completedEntries: completedContentProgress,
//       completionRate: averageCompletionRate._avg.completed || 0,
//       popularContent,
//       recentActivity
//     }
//   });
// });

// export const resetProgress = catchAsync(async (req, res, next) => {
//   const { enrollmentId, courseId, lessonId, contentId, confirm } = req.body;

//   if (!confirm) {
//     return next(new ErrorResponse('Confirmation required', STATUS_CODE.BAD_REQUEST));
//   }

//   if (contentId) {
//     // Check if content is free
//     const content = await prisma.content.findUnique({
//       where: { id: contentId }
//     });

//     if (!content) {
//       return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
//     }

//     // Reset specific content progress
//     await prisma.contentProgress.deleteMany({
//       where: {
//         userId: req.user.userId,
//         contentId,
//         ...(content.isFree ? {} : { enrollmentId })
//       }
//     });
//   } else if (lessonId) {
//     // Reset all progress for a lesson
//     await prisma.contentProgress.deleteMany({
//       where: {
//         enrollmentId,
//         lessonId
//       }
//     });
//     await prisma.lessonProgress.deleteMany({
//       where: {
//         enrollmentId,
//         lessonId
//       }
//     });
//   } else if (courseId) {
//     // Reset all progress for a course
//     await prisma.contentProgress.deleteMany({
//       where: {
//         enrollmentId,
//         content: {
//           lesson: { courseId }
//         }
//       }
//     });
//     await prisma.lessonProgress.deleteMany({
//       where: {
//         enrollmentId,
//         lesson: { courseId }
//       }
//     });
//     await prisma.enrollment.update({
//       where: { id: enrollmentId },
//       data: {
//         progress: 0,
//         completedAt: null
//       }
//     });
//   } else {
//     // Reset all progress for enrollment
//     await prisma.contentProgress.deleteMany({
//       where: { enrollmentId }
//     });
//     await prisma.lessonProgress.deleteMany({
//       where: { enrollmentId }
//     });
//     await prisma.enrollment.update({
//       where: { id: enrollmentId },
//       data: {
//         progress: 0,
//         completedAt: null
//       }
//     });
//   }

//   logger.info(`Progress reset for enrollment: ${enrollmentId} by admin: ${req.user.userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     message: 'Progress reset successfully'
//   });
// });

// export const syncProgress = catchAsync(async (req, res, next) => {
//   const { enrollmentId, courseId } = req.body;
//   const userId = req.user.userId;

//   // Verify enrollment belongs to user
//   const enrollment = await prisma.enrollment.findFirst({
//     where: {
//       id: enrollmentId,
//       userId,
//       courseId
//     }
//   });

//   if (!enrollment) {
//     return next(new ErrorResponse('Enrollment not found', STATUS_CODE.NOT_FOUND));
//   }

//   // Recalculate course progress
//   await updateCourseProgress(userId, enrollmentId, courseId);

//   const updatedEnrollment = await prisma.enrollment.findUnique({
//     where: { id: enrollmentId },
//     select: { progress: true, completedAt: true }
//   });

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { enrollment: updatedEnrollment },
//     message: 'Progress synced successfully'
//   });
// });

// export const bulkMarkContentCompleted = catchAsync(async (req, res, next) => {
//   const { contentIds, enrollmentId, lessonId, completed = true } = req.body;
//   const userId = req.user.userId;

//   // Validate enrollment access for non-free content
//   const contents = await prisma.content.findMany({
//     where: {
//       id: { in: contentIds },
//       isPublished: true,
//       lesson: { isPublished: true }
//     }
//   });

//   let enrollment = null;
//   const hasNonFreeContent = contents.some(content => !content.isFree);
//   if (hasNonFreeContent) {
//     enrollment = await prisma.enrollment.findFirst({
//       where: {
//         id: enrollmentId,
//         userId,
//         status: 'ACTIVE'
//       }
//     });

//     if (!enrollment) {
//       return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
//     }
//   }

//   // Process all content items
//   const results = await Promise.all(
//     contentIds.map(async (contentId) => {
//       try {
//         const content = contents.find(c => c.id === contentId);
//         if (!content) {
//           return { contentId, success: false, error: 'Content not found' };
//         }

//         const contentProgress = await prisma.contentProgress.upsert({
//           where: {
//             userId_contentId: {
//               userId,
//               contentId
//             }
//           },
//           update: {
//             completed,
//             completedAt: completed ? new Date() : null,
//             lastAccessed: new Date(),
//             enrollmentId: content.isFree ? null : enrollment.id,
//             lessonId
//           },
//           create: {
//             userId,
//             contentId,
//             enrollmentId: content.isFree ? null : enrollment.id,
//             lessonId,
//             completed,
//             completedAt: completed ? new Date() : null,
//             lastAccessed: new Date()
//           }
//         });
//         return { contentId, success: true, data: contentProgress };
//       } catch (error) {
//         return { contentId, success: false, error: error.message };
//       }
//     })
//   );

//   // Update lesson and course progress if enrolled
//   if (enrollment && lessonId) {
//     await updateLessonProgress(userId, enrollment.id, lessonId);
//     await updateCourseProgress(userId, enrollment.id, enrollment.courseId);
//   }

//   logger.info(`Bulk content progress updated for ${contentIds.length} items by user: ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { results },
//     message: `Bulk content progress update completed`
//   });
// });

// export const getProgressHistory = catchAsync(async (req, res, next) => {
//   const { page = 1, limit = 10, enrollmentId, courseId, lessonId, userId } = req.query;
//   const currentUserId = req.user.userId;

//   const pageNumber = parseInt(page, 10);
//   const limitNumber = parseInt(limit, 10);
//   const skip = (pageNumber - 1) * limitNumber;

//   const where = {
//     ...(userId && userId !== currentUserId ? {} : { userId: currentUserId }),
//     ...(enrollmentId && { enrollmentId }),
//     ...(courseId && { content: { lesson: { courseId } } }),
//     ...(lessonId && { lessonId })
//   };

//   const [progressHistory, totalCount] = await Promise.all([
//     prisma.contentProgress.findMany({
//       where,
//       skip,
//       take: limitNumber,
//       include: {
//         content: {
//           include: {
//             lesson: {
//               include: {
//                 course: true
//               }
//             }
//           }
//         },
//         enrollment: {
//           include: {
//             course: true
//           }
//         }
//       },
//       orderBy: { lastAccessed: 'desc' }
//     }),
//     prisma.contentProgress.count({ where })
//   ]);

//   const totalPages = Math.ceil(totalCount / limitNumber);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       progressHistory,
//       pagination: {
//         currentPage: pageNumber,
//         totalPages,
//         totalCount,
//         hasNext: pageNumber < totalPages,
//         hasPrev: pageNumber > 1,
//       }
//     }
//   });
// });

// export const startContent = catchAsync(async (req, res, next) => {
//   const { contentId } = req.params;
//   const { enrollmentId } = req.body;
//   const userId = req.user.userId;

//   const content = await prisma.content.findUnique({
//     where: { id: contentId },
//     include: { lesson: { include: { course: true } } }
//   });

//   if (!content) {
//     return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
//   }

//   if (!content.isPublished || !content.lesson.isPublished) {
//     return next(new ErrorResponse('Content or lesson not accessible', STATUS_CODE.NOT_FOUND));
//   }

//   let enrollment = null;
//   if (!content.isFree) {
//     // Validate enrollment for non-free content
//     if (enrollmentId) {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           id: enrollmentId,
//           userId,
//           status: 'ACTIVE',
//           courseId: content.lesson.courseId
//         }
//       });
//     } else {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           userId,
//           courseId: content.lesson.courseId,
//           status: 'ACTIVE'
//         }
//       });
//     }

//     if (!enrollment) {
//       return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
//     }
//   }

//   const progress = await prisma.contentProgress.upsert({
//     where: { userId_contentId: { userId, contentId } },
//     update: { lastAccessed: new Date() },
//     create: {
//       userId,
//       contentId,
//       enrollmentId: enrollment ? enrollment.id : null,
//       lessonId: content.lessonId,
//       lastAccessed: new Date()
//     }
//   });

//   logger.info(`Content ${contentId} started for user ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { progress },
//     message: 'Content access updated'
//   });
// });

// // Helper functions
// async function updateLessonProgress(userId, enrollmentId, lessonId) {
//   const lesson = await prisma.lesson.findUnique({
//     where: { id: lessonId },
//     include: {
//       _count: {
//         select: {
//           contents: {
//             where: { isPublished: true }
//           }
//         }
//       }
//     }
//   });

//   const completedContent = await prisma.contentProgress.count({
//     where: {
//       userId,
//       enrollmentId,
//       lessonId,
//       completed: true
//     }
//   });

//   const progress = lesson._count.contents > 0 ? (completedContent / lesson._count.contents) * 100 : 0;
//   const completed = progress === 100;

//   await prisma.lessonProgress.upsert({
//     where: {
//       enrollmentId_lessonId_lessonEnrollmentId: {
//         enrollmentId,
//         lessonId,
//         lessonEnrollmentId: null
//       }
//     },
//     update: {
//       progress,
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     },
//     create: {
//       enrollmentId,
//       lessonId,
//       progress,
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     }
//   });
// }

// async function updateCourseProgress(userId, enrollmentId, courseId) {
//   const course = await prisma.course.findUnique({
//     where: { id: courseId },
//     include: {
//       _count: {
//         select: {
//           contents: {
//             where: {
//               lesson: { isPublished: true },
//               isPublished: true
//             }
//           }
//         }
//       }
//     }
//   });

//   const completedContent = await prisma.contentProgress.count({
//     where: {
//       userId,
//       enrollmentId,
//       completed: true,
//       content: {
//         lesson: {
//           courseId,
//           isPublished: true
//         },
//         isPublished: true
//       }
//     }
//   });

//   const progress = course._count.contents > 0 ? (completedContent / course._count.contents) * 100 : 0;
//   const completed = progress === 100;

//   await prisma.enrollment.update({
//     where: { id: enrollmentId },
//     data: {
//       progress,
//       completedAt: completed ? new Date() : null
//     }
//   });
// }



import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';
import { hasAccessToPaidContent } from '../lessons/controller.js';


// export const getCourseContent = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const userId = req.user.userId;

//   // Get course with lessons and content
//   const course = await prisma.course.findUnique({
//     where: { id: courseId },
//     include: {
//       lessons: {
//         where: { isPublished: true },
//         orderBy: { order: 'asc' },
//         include: {
//           contents: {
//             where: { isPublished: true },
//             orderBy: { order: 'asc' },
//             include: {
//               contentProgress: { where: { userId } },
//               submissions: {
//                 where: { userId },
//                 select: { id: true, passed: true },
//               },
//             },
//           },
//           _count: { select: { contents: { where: { isPublished: true } } } },
//         },
//       },
//       contents: {
//         where: { isPublished: true, lessonId: null }, // Course-level content
//         orderBy: { order: 'asc' },
//         include: {
//           contentProgress: { where: { userId } },
//           submissions: {
//             where: { userId },
//             select: { id: true, passed: true },
//           },
//         },
//       },
//       enrollments: {
//         where: { userId, status: 'ACTIVE' },
//         select: { id: true, status: true, userId: true, courseId: true },
//       },
//       _count: { select: { lessons: { where: { isPublished: true } } } },
//     },
//   });

//   if (!course) {
//     return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
//   }

//   // Reorganize lesson content
//   const organizedLessons = course.lessons.map(lesson => {
//     const hasQuizzes = lesson.contents?.length > 0 ? lesson.contents.some(content => content.type === 'QUIZ') : false;
//     const hasPassedQuiz = lesson.contents?.length > 0 ? lesson.contents.some(content => 
//       content.type === 'QUIZ' && content.submissions.some(submission => submission.passed === true)
//     ) : false;

//     const allContent = lesson.contents?.length > 0 ? lesson.contents.map(content => {
//       const requiresQuizPass = hasQuizzes && !hasPassedQuiz;

//       // Check if lesson requires quiz pass and user hasn't passed
//       if (requiresQuizPass && content.type !== 'QUIZ') {
//         // Content is inaccessible if quiz not passed (except for quiz content)
//         return {
//           ...content,
//           type: content.type,
//           progress: content.contentProgress?.[0] || null,
//           isAccessible: false,
//           requiresQuizPass: true,
//         };
//       }

//       return {
//         ...content,
//         type: content.type,
//         progress: content.contentProgress?.[0] || null,
//         isAccessible: true,
//         requiresQuizPass: hasQuizzes && !hasPassedQuiz,
//       };
//     }).sort((a, b) => a.order - b.order) : [];

//     return {
//       ...lesson,
//       allContent,
//       progress: lesson?.lessonProgress?.[0] || null,
//       requiresQuizPass: hasQuizzes && !hasPassedQuiz,
//     };
//   });

//   // Reorganize course-level content
//   const courseLevelContent = course.contents.map(content => {
//     const requiresQuizPass = content.type === 'QUIZ' && !content.submissions.some(submission => submission.passed === true);

//     return {
//       ...content,
//       type: content.type,
//       progress: content.contentProgress?.[0] || null,
//       isAccessible: content.type === 'QUIZ' || !requiresQuizPass,
//       requiresQuizPass,
//       lessonId: null,
//     };
//   }).sort((a, b) => a.order - b.order);

//   // Combine lesson and course-level content for total count
//   const allContent = [
//     ...organizedLessons.flatMap(lesson => lesson.allContent),
//     ...courseLevelContent,
//   ];

//   // Calculate total and completed content
//   const totalContents = allContent.length;
//   const completedContent = await prisma.contentProgress.count({
//     where: {
//       userId,
//       completed: true,
//       content: { courseId, isPublished: true },
//     },
//   });
//   const progressPercentage = totalContents > 0 ? (completedContent / totalContents) * 100 : 0;

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: {
//       course: {
//         ...course,
//         lessons: organizedLessons,
//         contents: courseLevelContent, // Include course-level content
//         enrollment: course.enrollments[0] || null,
//         progress: {
//           percentage: Math.round(progressPercentage),
//           completed: completedContent,
//           total: totalContents,
//         },
//       },
//     },
//   });
// });


// export const markContentCompleted = catchAsync(async (req, res, next) => {
//   const { contentId, enrollmentId, lessonId, completed = true } = req.body;
//   const userId = req.user.userId;

//   // Check if content exists and is published
//   const content = await prisma.content.findUnique({
//     where: { id: contentId },
//     include: {
//       lesson: {
//         include: {
//           course: true
//         }
//       }
//     }
//   });

//   if (!content) {
//     return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
//   }

//   if (!content.isPublished || (content.lesson && !content.lesson.isPublished)) {
//     return next(new ErrorResponse('Content or lesson not accessible', STATUS_CODE.NOT_FOUND));
//   }

//   let enrollment = null;
//   if (!content.isFree) {
//     // Validate enrollment for non-free content
//     if (enrollmentId) {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           id: enrollmentId,
//           userId,
//           status: 'ACTIVE',
//           courseId: content.lesson?.courseId || content.courseId
//         }
//       });
//     } else {
//       enrollment = await prisma.enrollment.findFirst({
//         where: {
//           userId,
//           courseId: content.lesson?.courseId || content.courseId,
//           status: 'ACTIVE'
//         }
//       });
//     }

//     console.log("req.user => ", req.user.role)

//     const isAdmin = req.user.role.some(roleObj => 
//     roleObj.role.name === 'ADMIN' || roleObj.role.name === 'CENTER_ADMIN'
//   );




//     if (!enrollment && !isAdmin ) {
//       return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
//     }
//   }

//   // Update or create content progress
//   const contentProgress = await prisma.contentProgress.upsert({
//     where: {
//       unique_user_content_progress: {
//         userId,
//         contentId
//       }
//     },
//     update: {
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date(),
//       enrollmentId: enrollment ? enrollment.id : null,
//       lessonId: content.lessonId
//     },
//     create: {
//       userId,
//       contentId,
//       enrollmentId: enrollment ? enrollment.id : null,
//       lessonId: content.lessonId,
//       completed,
//       completedAt: completed ? new Date() : null,
//       lastAccessed: new Date()
//     },
//     include: {
//       content: {
//         include: {
//           lesson: true
//         }
//       }
//     }
//   });

//   // Update lesson and course progress if enrolled
//   if (enrollment && content.lessonId) {
//     await updateLessonProgress(userId, enrollment.id, content.lessonId);
//     await updateCourseProgress(userId, enrollment.id, content.lesson?.courseId || content.courseId);
//   }

//   logger.info(`Content progress updated: ${contentId} for user: ${userId}`);

//   return res.status(STATUS_CODE.OK).json({
//     status: STATUS_MESSAGE.SUCCESS,
//     data: { contentProgress },
//     message: `Content marked as ${completed ? 'completed' : 'incomplete'}`
//   });
// });



export const getCourseContent = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const userId = req.user.userId;

  // Get course with lessons and content
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        include: {
          contents: {
            where: { isPublished: true },
            orderBy: { order: 'asc' },
            include: {
              contentProgress: { where: { userId } },
              submissions: {
                where: { userId },
                select: { id: true, passed: true },
              },
            },
          },
          _count: { select: { contents: { where: { isPublished: true } } } },
        },
      },
      contents: {
        where: { isPublished: true, lessonId: null },
        orderBy: { order: 'asc' },
        include: {
          contentProgress: { where: { userId } },
          submissions: {
            where: { userId },
            select: { id: true, passed: true },
          },
        },
      },
      enrollments: {
        where: { userId, status: 'ACTIVE' },
        select: { id: true, status: true, userId: true, courseId: true },
      },
      _count: { select: { lessons: { where: { isPublished: true } } } },
    },
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Reorganize lesson content
  const organizedLessons = course.lessons.map(lesson => {
    const hasQuizzes = lesson.contents?.length > 0 ? lesson.contents.some(content => content.type === 'QUIZ') : false;
    const hasPassedQuiz = lesson.contents?.length > 0 ? lesson.contents.some(content => 
      content.type === 'QUIZ' && content.submissions.some(submission => submission.passed === true)
    ) : false;

    const allContent = lesson.contents?.length > 0 ? lesson.contents.map(content => {
      const requiresQuizPass = hasQuizzes && !hasPassedQuiz;

      return {
        ...content,
        type: content.type,
        progress: content.contentProgress?.[0] || null,
        isAccessible: content.type === 'QUIZ' || !requiresQuizPass,
        requiresQuizPass,
      };
    }).sort((a, b) => a.order - b.order) : [];

    return {
      ...lesson,
      allContent,
      progress: lesson?.lessonProgress?.[0] || null,
      requiresQuizPass: hasQuizzes && !hasPassedQuiz,
    };
  });

  // Reorganize course-level content
  const courseLevelContent = course.contents.map(content => {
    const requiresQuizPass = content.type === 'QUIZ' && !content.submissions.some(submission => submission.passed === true);

    return {
      ...content,
      type: content.type,
      progress: content.contentProgress?.[0] || null,
      isAccessible: !requiresQuizPass,
      requiresQuizPass,
      lessonId: null,
    };
  }).sort((a, b) => a.order - b.order);

  // Combine lesson and course-level content for total count
  const allContent = [
    ...organizedLessons.flatMap(lesson => lesson.allContent),
    ...courseLevelContent,
  ];

  // Calculate total and completed content
  const totalContents = allContent.length;
  const completedContent = await prisma.contentProgress.count({
    where: {
      userId,
      completed: true,
      OR: [
        { content: { courseId, isPublished: true } }, // Course-level content
        { content: { lesson: { courseId }, isPublished: true } }, // Lesson-level content
      ],
    },
  });
  
  const progressPercentage = totalContents > 0 ? (completedContent / totalContents) * 100 : 0;

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      course: {
        ...course,
        lessons: organizedLessons,
        contents: courseLevelContent,
        enrollment: course.enrollments[0] || null,
        progress: {
          percentage: Math.round(progressPercentage),
          completed: completedContent,
          total: totalContents,
        },
      },
    },
  });
});

export const markContentCompleted = catchAsync(async (req, res, next) => {
  const { contentId, enrollmentId, lessonId, completed = true } = req.body;
  const userId = req.user.userId;

  // Check if content exists and is published
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      lesson: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!content) {
    return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
  }

  if (!content.isPublished || (content.lesson && !content.lesson.isPublished)) {
    return next(new ErrorResponse('Content or lesson not accessible', STATUS_CODE.NOT_FOUND));
  }

  let enrollment = null;
  if (!content.isFree) {
    // Validate enrollment for non-free content
    if (enrollmentId) {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          id: enrollmentId,
          userId,
          status: 'ACTIVE',
          courseId: content.lesson?.courseId || content.courseId,
        },
      });
    } else {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          userId,
          courseId: content.lesson?.courseId || content.courseId,
          status: 'ACTIVE',
        },
      });
    }

    const isAdmin = req.user.role.some(roleObj => 
      roleObj.role.name === 'ADMIN' || roleObj.role.name === 'CENTER_ADMIN'
    );

    if (!enrollment && !isAdmin) {
      console.log(`Enrollment check failed for user ${userId}, content ${contentId}`);
      return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
    }
  }

  // Update or create content progress
  const contentProgress = await prisma.contentProgress.upsert({
    where: {
      unique_user_content_progress: {
        userId,
        contentId,
      },
    },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date(),
      enrollmentId: enrollment ? enrollment.id : null,
      lessonId: content.lessonId,
    },
    create: {
      userId,
      contentId,
      enrollmentId: enrollment ? enrollment.id : null,
      lessonId: content.lessonId,
      completed,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date(),
    },
    include: {
      content: {
        include: {
          lesson: true,
        },
      },
    },
  });

  // Update lesson and course progress if enrolled
  if (enrollment && content.lessonId) {
    await updateLessonProgress(userId, enrollment.id, content.lessonId);
    await updateCourseProgress(userId, enrollment.id, content.lesson?.courseId || content.courseId);
  }

  console.log(`Content progress updated: ${contentId} for user: ${userId}, completed: ${completed}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { contentProgress },
    message: `Content marked as ${completed ? 'completed' : 'incomplete'}`,
  });
});







export const markLessonCompleted = catchAsync(async (req, res, next) => {
  const { lessonId, enrollmentId, completed = true } = req.body;
  const userId = req.user.userId;

  // Check if lesson exists and is accessible
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true }
  });

  if (!lesson || !lesson.isPublished) {
    return next(new ErrorResponse('Lesson not found or not accessible', STATUS_CODE.NOT_FOUND));
  }

  // Validate enrollment
  let enrollment;
  if (enrollmentId) {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId,
        status: 'ACTIVE',
        courseId: lesson.courseId
      }
    });
  } else {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId: lesson.courseId,
        status: 'ACTIVE'
      }
    });
  }

  if (!enrollment) {
    return next(new ErrorResponse('Enrollment not found or inactive', STATUS_CODE.FORBIDDEN));
  }

  // Update lesson progress
  const lessonProgress = await prisma.lessonProgress.upsert({
    where: {
      unique_progress: {
        enrollmentId: enrollment.id,
        lessonId,
        lessonEnrollmentId: null
      }
    },
    update: {
      completed,
      progress: completed ? 100 : 0,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date()
    },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      completed,
      progress: completed ? 100 : 0,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date()
    }
  });

  // If marking as completed, mark all content in lesson as completed
  if (completed) {
    const lessonContents = await prisma.content.findMany({
      where: {
        lessonId,
        isPublished: true
      }
    });

    await Promise.all(
      lessonContents.map(content =>
        prisma.contentProgress.upsert({
          where: {
            unique_user_content_progress: {
              userId,
              contentId: content.id
            }
          },
          update: {
            completed: true,
            completedAt: new Date(),
            lastAccessed: new Date(),
            enrollmentId: enrollment.id,
            lessonId
          },
          create: {
            userId,
            contentId: content.id,
            enrollmentId: enrollment.id,
            lessonId,
            completed: true,
            completedAt: new Date(),
            lastAccessed: new Date()
          }
        })
      )
    );
  }

  // Update course progress
  await updateCourseProgress(userId, enrollment.id, lesson.courseId);

  logger.info(`Lesson progress updated: ${lessonId} for user: ${userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { lessonProgress },
    message: `Lesson marked as ${completed ? 'completed' : 'incomplete'}`
  });
});

export const markCourseCompleted = catchAsync(async (req, res, next) => {
  const { courseId, enrollmentId, completed = true } = req.body;
  const userId = req.user.userId;

  // Validate enrollment access
  let enrollment;
  if (enrollmentId) {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId,
        status: 'ACTIVE'
      }
    });
  } else {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
        status: 'ACTIVE'
      }
    });
  }

  if (!enrollment) {
    return next(new ErrorResponse('Enrollment not found or inactive', STATUS_CODE.FORBIDDEN));
  }

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Update enrollment completion status
  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      completedAt: completed ? new Date() : null,
      progress: completed ? 100 : 0
    }
  });

  // If marking as completed, mark all lessons and content as completed
  if (completed) {
    const lessons = await prisma.lesson.findMany({
      where: {
        courseId,
        isPublished: true
      }
    });

    await Promise.all(
      lessons.map(lesson =>
        prisma.lessonProgress.upsert({
          where: {
            unique_progress: {
              enrollmentId: enrollment.id,
              lessonId: lesson.id,
              lessonEnrollmentId: null
            }
          },
          update: {
            completed: true,
            progress: 100,
            completedAt: new Date(),
            lastAccessed: new Date()
          },
          create: {
            enrollmentId: enrollment.id,
            lessonId: lesson.id,
            completed: true,
            progress: 100,
            completedAt: new Date(),
            lastAccessed: new Date()
          }
        })
      )
    );

    const contents = await prisma.content.findMany({
      where: {
        OR: [
          { lesson: { courseId, isPublished: true }, isPublished: true },
          { courseId, isPublished: true }
        ]
      }
    });

    await Promise.all(
      contents.map(content =>
        prisma.contentProgress.upsert({
          where: {
            unique_user_content_progress: {
              userId,
              contentId: content.id
            }
          },
          update: {
            completed: true,
            completedAt: new Date(),
            lastAccessed: new Date(),
            enrollmentId: enrollment.id,
            lessonId: content.lessonId
          },
          create: {
            userId,
            contentId: content.id,
            enrollmentId: enrollment.id,
            lessonId: content.lessonId,
            completed: true,
            completedAt: new Date(),
            lastAccessed: new Date()
          }
        })
      )
    );
  }

  logger.info(`Course progress updated: ${courseId} for user: ${userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { enrollment: updatedEnrollment },
    message: `Course marked as ${completed ? 'completed' : 'incomplete'}`
  });
});

export const getCourseProgress = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const userId = req.user.userId;

  // Check enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId,
      status: 'ACTIVE'
    }
  });

  if (!enrollment) {
    return next(new ErrorResponse('You are not enrolled in this course', STATUS_CODE.FORBIDDEN));
  }

  // Get course with content counts
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      _count: {
        select: {
          lessons: { where: { isPublished: true } },
          contents: { where: { isPublished: true } }
        }
      }
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Get completed content count
  const completedContent = await prisma.contentProgress.count({
    where: {
      userId,
      enrollmentId: enrollment.id,
      completed: true,
      content: {
        OR: [
          { lesson: { courseId, isPublished: true }, isPublished: true },
          { courseId, isPublished: true }
        ]
      }
    }
  });

  // Get completed lessons count
  const completedLessons = await prisma.lessonProgress.count({
    where: {
      enrollmentId: enrollment.id,
      completed: true,
      lesson: { courseId, isPublished: true }
    }
  });

  const totalContent = await prisma.content.count({
    where: {
      OR: [
        { lesson: { courseId, isPublished: true }, isPublished: true },
        { courseId, isPublished: true }
      ]
    }
  });
  const totalLessons = course._count.lessons;

  const contentProgress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;
  const lessonProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const overallProgress = (contentProgress + lessonProgress) / 2;

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      progress: {
        overall: Math.round(overallProgress),
        content: Math.round(contentProgress),
        lessons: Math.round(lessonProgress),
        completedContent,
        totalContent,
        completedLessons,
        totalLessons,
        enrollment
      }
    }
  });
});

export const getUserProgress = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, status, academicYear } = req.query;

  // Check if user has permission to view this progress
  if (userId !== req.user.userId && !req.user.roles?.includes('ADMIN') && !req.user.roles?.includes('CENTER_ADMIN')) {
    return next(new ErrorResponse('You do not have permission to view this user\'s progress', STATUS_CODE.FORBIDDEN));
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const where = {
    userId,
    status: 'ACTIVE',
    ...(status && {
      ...(status === 'COMPLETED' && { completedAt: { not: null } }),
      ...(status === 'IN_PROGRESS' && { 
        completedAt: null,
        progress: { gt: 0, lt: 100 }
      }),
      ...(status === 'NOT_STARTED' && { progress: 0 })
    }),
    ...(academicYear && {
      course: { academicYear }
    })
  };

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take: limitNumber,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            academicYear: true,
            thumbnail: true,
            _count: {
              select: {
                contents: { where: { isPublished: true } },
                lessons: { where: { isPublished: true } }
              }
            }
          }
        },
        _count: {
          select: {
            contentProgress: { where: { completed: true } },
            lessonProgress: { where: { completed: true } }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.enrollment.count({ where })
  ]);

  // Calculate progress for each enrollment
  const progressData = enrollments.map(enrollment => {
    const totalContent = enrollment.course._count.contents;
    const completedContent = enrollment._count.contentProgress;
    const contentProgress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;

    return {
      ...enrollment,
      progress: {
        content: Math.round(contentProgress),
        completedContent,
        totalContent
      }
    };
  });

  const totalPages = Math.ceil(totalCount / limitNumber);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      enrollments: progressData,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
      }
    }
  });
});

export const getProgressStats = catchAsync(async (req, res, next) => {
  const { courseId, enrollmentId, startDate, endDate } = req.query;

  const where = {
    ...(courseId && { content: { OR: [{ lesson: { courseId } }, { courseId }] } }),
    ...(enrollmentId && { enrollmentId }),
    ...(startDate || endDate) && {
      lastAccessed: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) })
      }
    }
  };

  const [
    totalContentProgress,
    completedContentProgress,
    averageCompletionRate,
    popularContent,
    recentActivity
  ] = await Promise.all([
    prisma.contentProgress.count({ where }),
    prisma.contentProgress.count({
      where: { ...where, completed: true }
    }),
    prisma.contentProgress.aggregate({
      where,
      _avg: { completed: true }
    }),
    prisma.contentProgress.groupBy({
      by: ['contentId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),
    prisma.contentProgress.findMany({
      where,
      orderBy: { lastAccessed: 'desc' },
      take: 10,
      include: {
        content: {
          include: {
            lesson: { include: { course: true } },
            course: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalProgressEntries: totalContentProgress,
      completedEntries: completedContentProgress,
      completionRate: averageCompletionRate._avg.completed || 0,
      popularContent,
      recentActivity
    }
  });
});

export const resetProgress = catchAsync(async (req, res, next) => {
  const { enrollmentId, courseId, lessonId, contentId, confirm } = req.body;

  if (!confirm) {
    return next(new ErrorResponse('Confirmation required', STATUS_CODE.BAD_REQUEST));
  }

  if (contentId) {
    // Check if content is free
    const content = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content) {
      return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
    }

    // Reset specific content progress
    await prisma.contentProgress.deleteMany({
      where: {
        userId: req.user.userId,
        contentId,
        ...(content.isFree ? {} : { enrollmentId })
      }
    });
  } else if (lessonId) {
    // Reset all progress for a lesson
    await prisma.contentProgress.deleteMany({
      where: {
        enrollmentId,
        lessonId
      }
    });
    await prisma.lessonProgress.deleteMany({
      where: {
        enrollmentId,
        lessonId
      }
    });
  } else if (courseId) {
    // Reset all progress for a course
    await prisma.contentProgress.deleteMany({
      where: {
        enrollmentId,
        content: {
          OR: [
            { lesson: { courseId } },
            { courseId }
          ]
        }
      }
    });
    await prisma.lessonProgress.deleteMany({
      where: {
        enrollmentId,
        lesson: { courseId }
      }
    });
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: 0,
        completedAt: null
      }
    });
  } else {
    // Reset all progress for enrollment
    await prisma.contentProgress.deleteMany({
      where: { enrollmentId }
    });
    await prisma.lessonProgress.deleteMany({
      where: { enrollmentId }
    });
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: 0,
        completedAt: null
      }
    });
  }

  logger.info(`Progress reset for enrollment: ${enrollmentId} by admin: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Progress reset successfully'
  });
});

export const syncProgress = catchAsync(async (req, res, next) => {
  const { enrollmentId, courseId } = req.body;
  const userId = req.user.userId;

  // Verify enrollment belongs to user
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      userId,
      courseId
    }
  });

  if (!enrollment) {
    return next(new ErrorResponse('Enrollment not found', STATUS_CODE.NOT_FOUND));
  }

  // Recalculate course progress
  await updateCourseProgress(userId, enrollmentId, courseId);

  const updatedEnrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { progress: true, completedAt: true }
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { enrollment: updatedEnrollment },
    message: 'Progress synced successfully'
  });
});

export const bulkMarkContentCompleted = catchAsync(async (req, res, next) => {
  const { contentIds, enrollmentId, lessonId, completed = true } = req.body;
  const userId = req.user.userId;

  // Validate enrollment access for non-free content
  const contents = await prisma.content.findMany({
    where: {
      id: { in: contentIds },
      isPublished: true,
      OR: [
        { lesson: { isPublished: true } },
        { courseId: { not: null } }
      ]
    }
  });

  let enrollment = null;
  const hasNonFreeContent = contents.some(content => !content.isFree);
  if (hasNonFreeContent) {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId,
        status: 'ACTIVE'
      }
    });

    if (!enrollment) {
      return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
    }
  }

  // Process all content items
  const results = await Promise.all(
    contentIds.map(async (contentId) => {
      try {
        const content = contents.find(c => c.id === contentId);
        if (!content) {
          return { contentId, success: false, error: 'Content not found' };
        }

        const contentProgress = await prisma.contentProgress.upsert({
          where: {
            unique_user_content_progress: {
              userId,
              contentId
            }
          },
          update: {
            completed,
            completedAt: completed ? new Date() : null,
            lastAccessed: new Date(),
            enrollmentId: content.isFree ? null : enrollment.id,
            lessonId: content.lessonId
          },
          create: {
            userId,
            contentId,
            enrollmentId: content.isFree ? null : enrollment.id,
            lessonId: content.lessonId,
            completed,
            completedAt: completed ? new Date() : null,
            lastAccessed: new Date()
          }
        });
        return { contentId, success: true, data: contentProgress };
      } catch (error) {
        return { contentId, success: false, error: error.message };
      }
    })
  );

  // Update lesson and course progress if enrolled
  if (enrollment && lessonId) {
    await updateLessonProgress(userId, enrollment.id, lessonId);
    await updateCourseProgress(userId, enrollment.id, enrollment.courseId);
  }

  logger.info(`Bulk content progress updated for ${contentIds.length} items by user: ${userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { results },
    message: `Bulk content progress update completed`
  });
});

export const getProgressHistory = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, enrollmentId, courseId, lessonId, userId } = req.query;
  const currentUserId = req.user.userId;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const where = {
    ...(userId && userId !== currentUserId ? {} : { userId: currentUserId }),
    ...(enrollmentId && { enrollmentId }),
    ...(courseId && { content: { OR: [{ lesson: { courseId } }, { courseId }] } }),
    ...(lessonId && { lessonId })
  };

  const [progressHistory, totalCount] = await Promise.all([
    prisma.contentProgress.findMany({
      where,
      skip,
      take: limitNumber,
      include: {
        content: {
          include: {
            lesson: { include: { course: true } },
            course: true
          }
        },
        enrollment: {
          include: {
            course: true
          }
        }
      },
      orderBy: { lastAccessed: 'desc' }
    }),
    prisma.contentProgress.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limitNumber);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      progressHistory,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
      }
    }
  });
});

export const startContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const { enrollmentId } = req.body;
  const userId = req.user.userId;

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { lesson: { include: { course: true } }, course: true }
  });

  if (!content) {
    return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
  }

  if (!content.isPublished || (content.lesson && !content.lesson.isPublished)) {
    return next(new ErrorResponse('Content or lesson not accessible', STATUS_CODE.NOT_FOUND));
  }

  let enrollment = null;
  if (!content.isFree) {
    // Validate enrollment for non-free content
    if (enrollmentId) {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          id: enrollmentId,
          userId,
          status: 'ACTIVE',
          courseId: content.lesson?.courseId || content.courseId
        }
      });
    } else {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          userId,
          courseId: content.lesson?.courseId || content.courseId,
          status: 'ACTIVE'
        }
      });
    }

    if (!enrollment) {
      return next(new ErrorResponse('Enrollment not found or inactive for non-free content', STATUS_CODE.FORBIDDEN));
    }
  }

  const progress = await prisma.contentProgress.upsert({
    where: {
      unique_user_content_progress: {
        userId,
        contentId
      }
    },
    update: { lastAccessed: new Date() },
    create: {
      userId,
      contentId,
      enrollmentId: enrollment ? enrollment.id : null,
      lessonId: content.lessonId,
      lastAccessed: new Date()
    }
  });

  logger.info(`Content ${contentId} started for user ${userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { progress },
    message: 'Content access updated'
  });
});

// Helper functions
async function updateLessonProgress(userId, enrollmentId, lessonId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      _count: {
        select: {
          contents: { where: { isPublished: true } }
        }
      }
    }
  });

  if (!lesson) return;

  const completedContent = await prisma.contentProgress.count({
    where: {
      userId,
      enrollmentId,
      lessonId,
      completed: true,
      content: { isPublished: true }
    }
  });

  const progress = lesson._count.contents > 0 ? (completedContent / lesson._count.contents) * 100 : 0;
  const completed = progress === 100;

  await prisma.lessonProgress.upsert({
    where: {
      unique_progress: {
        enrollmentId,
        lessonId,
        lessonEnrollmentId: null
      }
    },
    update: {
      progress,
      completed,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date()
    },
    create: {
      enrollmentId,
      lessonId,
      progress,
      completed,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date()
    }
  });
}

async function updateCourseProgress(userId, enrollmentId, courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      _count: {
        select: {
          contents: { where: { isPublished: true } },
          lessons: { where: { isPublished: true } }
        }
      }
    }
  });

  if (!course) return;

  const completedContent = await prisma.contentProgress.count({
    where: {
      userId,
      enrollmentId,
      completed: true,
      content: {
        OR: [
          { lesson: { courseId, isPublished: true }, isPublished: true },
          { courseId, isPublished: true }
        ]
      }
    }
  });

  const totalContent = course._count.contents;
  const progress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;
  const completed = progress === 100;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progress,
      completedAt: completed ? new Date() : null
    }
  });
}