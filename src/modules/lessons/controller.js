import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';
import { createBunnyVideo, generateBunnySignedUrl, generateBunnyAuthHeadersForGuid } from '../../utils/bunny.js';
import { unlink } from 'fs/promises';
import path from 'path';

export const getAllLessons = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { search, isPublished, courseId } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
    ...(courseId && { courseId }),
  };

  const [lessons, totalCount] = await Promise.all([
    prisma.lesson.findMany({
      where,
      skip,
      take: limit,
      include: {
        course: {
          select: { id: true, title: true, academicYear: true }
        },
        _count: {
          select: {
            contents: true,
            quizzes: true,
            homeworks: true,
          }
        }
      },
      orderBy: { order: 'asc' }
    }),
    prisma.lesson.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      lessons,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    }
  });
});



export const createLesson = catchAsync(async (req, res, next) => {
  const { courseId, ...lessonData } = req.body;

  // Check if course exists and user has permission
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to create lessons for this course', STATUS_CODE.FORBIDDEN));
    }
  }

  // Get the highest order to place new lesson at the end
  const lastLesson = await prisma.lesson.findFirst({
    where: { courseId },
    orderBy: { order: 'desc' }
  });

  const order = lastLesson ? lastLesson.order + 1 : 0;

  const lesson = await prisma.lesson.create({
    data: {
      ...lessonData,
      order,
      course: { connect: { id: courseId } }
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          academicYear: true,
        }
      }
    }
  });

  logger.info(`Lesson created: ${lesson.id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { lesson },
    message: 'Lesson created successfully'
  });
});

export const updateLesson = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to update this lesson', STATUS_CODE.FORBIDDEN));
    }
  }

  const updatedLesson = await prisma.lesson.update({
    where: { id },
    data: updateData,
    include: {
      course: {
        select: {
          id: true,
          title: true,
          academicYear: true,
        }
      }
    }
  });

  logger.info(`Lesson updated: ${id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { lesson: updatedLesson },
    message: 'Lesson updated successfully'
  });
});

export const deleteLesson = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      },
      _count: {
        select: {
          contents: true,
          quizzes: true,
          homeworks: true,
          lessonProgress: true,
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to delete this lesson', STATUS_CODE.FORBIDDEN));
    }
  }

  // Check if lesson has content that can't be deleted
  if (lesson._count.contents > 0 || lesson._count.quizzes > 0 || lesson._count.homeworks > 0) {
    return next(new ErrorResponse('Cannot delete lesson with associated content. Please delete all content first.', STATUS_CODE.CONFLICT));
  }

  await prisma.lesson.delete({
    where: { id }
  });

  // Reorder remaining lessons in the course
  const remainingLessons = await prisma.lesson.findMany({
    where: { courseId: lesson.courseId },
    orderBy: { order: 'asc' }
  });

  for (let i = 0; i < remainingLessons.length; i++) {
    await prisma.lesson.update({
      where: { id: remainingLessons[i].id },
      data: { order: i }
    });
  }

  logger.info(`Lesson deleted: ${id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Lesson deleted successfully'
  });
});




// Helper function to check if user has access to paid content
const hasAccessToPaidContent = async (userId, courseId, lessonId = null) => {
  // Check if user is admin or center admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  const isAdmin = user.userRoles.some(roleObj => 
    roleObj.role.name === 'ADMIN' || roleObj.role.name === 'CENTER_ADMIN'
  );

  if (isAdmin) {
    return true;
  }

  // Check course enrollment
  if (courseId) {
    const courseEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date()
        }
      }
    });


    console.log(courseEnrollment)

    if (courseEnrollment) {
      return true;
    }
  }

  // Check lesson enrollment if specific lesson is provided
  if (lessonId) {
    const lessonEnrollment = await prisma.lessonEnrollment.findFirst({
      where: {
        userId,
        lessonId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date()
        }
      }
    });

        console.log(lessonEnrollment)


    if (lessonEnrollment) {
      return true;
    }
  }

  return false;
};

export const getLessonById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          academicYear: true,
          isPublished: true,
        }
      },
      contents: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          contentUrl: true,
          duration: true,
          order: true,
          isFree: true,
        }
      },
      quizzes: {
        where: { isPublished: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          timeLimit: true,
          maxAttempts: true,
          _count: {
            select: {
              questions: true,
            }
          }
        }
      },
      homeworks: {
        where: { isPublished: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          maxPoints: true,
        }
      },
      _count: {
        select: {
          contents: true,
          quizzes: true,
          homeworks: true,
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check if lesson contains paid content and user doesn't have access
  // if (userId) {
  //   const hasPaidContent = lesson.contents.some(content => !content.isFree);
    
  //   if (hasPaidContent) {
  //     const hasAccess = await hasAccessToPaidContent(userId, lesson.course.id, id);
      
  //     if (!hasAccess) {
  //       return next(
  //         new ErrorResponse("المحتوى الحصري والمميز ل       المشتركين لدينا فقط", STATUS_CODE.FORBIDDEN)
  //       );
  //     }
  //   }
  // } else {
  //   // Anonymous user - check if lesson contains paid content
  //   const hasPaidContent = lesson.contents.some(content => !content.isFree);
    
  //   if (hasPaidContent) {
  //     return next(
  //       new ErrorResponse("المحتوى الحصري والمميز ل       المشتركين لدينا فقط", STATUS_CODE.FORBIDDEN)
  //     );
  //   }
  // }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { lesson }
  });
});

export const getLessonContents = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          isPublished: true,
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  const contents = await prisma.content.findMany({
    where: { lessonId: id },
    orderBy: { order: 'asc' }
  });

  // Check if lesson contains paid content and user doesn't have access
  // if (userId) {
  //   const hasPaidContent = contents.some(content => !content.isFree);
    
  //   if (hasPaidContent) {
  //     const hasAccess = await hasAccessToPaidContent(userId, lesson.courseId, id);

  //     console.log("hasAccess   => ", hasAccess)
      
  //     if (!hasAccess) {
  //       return next(
  //         new ErrorResponse("المحتوى الحصري والمميز ل       المشتركين لدينا فقط", STATUS_CODE.FORBIDDEN)
  //       );
  //     }
  //   }
  // } else {
  //   // Anonymous user - check if lesson contains paid content
  //   const hasPaidContent = contents.some(content => !content.isFree);
    
  //   if (hasPaidContent) {
  //     return next(
  //       new ErrorResponse("المحتوى الحصري والمميز ل       المشتركين لدينا فقط", STATUS_CODE.FORBIDDEN)
  //     );
  //   }
  // }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { contents }
  });
});


export const addContentToLesson = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, type, duration, order, isFree } = req.body;
  let contentUrl = null;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to add content to this lesson', STATUS_CODE.FORBIDDEN));
    }
  }

  // Handle file upload if provided
  if (req.file) {
    const newFilename = req.file.filename;
    contentUrl = `/uploads/contents/${newFilename}`;

    // Create File entry
    const file = await prisma.file.create({
      data: {
        category: 'DOCUMENT',
        type: type === 'PDF' ? 'PDF' : type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        originalName: req.file.originalname,
        storedName: newFilename,
        path: contentUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
        isFree: isFree,
      }
    });
    console.log("file => ", file)
  }


  const content = await prisma.content.create({
    data: {
      title,
      type,
      contentUrl,
      duration: duration ? parseInt(duration) : null,
      order: parseInt(order),
      isFree: isFree,
      lesson: { connect: { id } }
    }
  });

  console.log("content => ", content)

  logger.info(`Content added to lesson ${id}: ${content.id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { content },
    message: 'Content added successfully'
  });
});





// Create video content and initiate Bunny upload
export const createVideoContent = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, duration, order, isFree } = req.body;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true,
        },
      },
    },
  });

  if (!lesson) {
    return next(new ErrorResponse("الدرس غير موجود", STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === "CENTER_ADMIN" && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      },
    });

    if (!userCenter) {
      return next(
        new ErrorResponse(
          "ليس لديك إذن لإضافة محتوى لهذا الدرس",
          STATUS_CODE.FORBIDDEN
        )
      );
    }
  }
  try {
    const { guid, tusUrl, headers } = await createBunnyVideo(title);
    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: { guid, tusUrl, headers },
      message: "تم بدء الرفع إلى Bunny. استخدم TUS للرفع.",
    });
  } catch (err) {
    console.error("createVideoContent error:", err.message);
    return next(
      new ErrorResponse(
        `فشل إنشاء الفيديو في Bunny: ${err.message}`,
        STATUS_CODE.INTERNAL_SERVER_ERROR
      )
    );
  }
});

// Complete video upload and save to database
export const completeVideoUpload = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { guid, title, duration, order, isFree, mimeType  } = req.body;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true,
        },
      },
    },
  });

  if (!lesson) {
    return next(new ErrorResponse("الدرس غير موجود", STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === "CENTER_ADMIN" && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      },
    });

    if (!userCenter) {
      return next(
        new ErrorResponse(
          "ليس لديك إذن لإضافة محتوى لهذا الدرس",
          STATUS_CODE.FORBIDDEN
        )
      );
    }
  }


  await prisma.file.create({
      data: {
        category: 'DOCUMENT',
        type: 'VIDEO',
        originalName: title,
        storedName: title,
        path: 'private-video',
        mimeType,
        size: 0
      }
    });

  try {
    const content = await prisma.content.create({
      data: {
        title,
        type: "VIDEO",
        bunnyVideoGuid: guid,
        duration: parseInt(duration),
        order: parseInt(order),
        isFree: isFree == "true",
        lesson: { connect: { id } },
                contentUrl: `${guid}`,
      },
    });

    return res.status(STATUS_CODE.CREATED).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: { content },
      message: "تم إكمال رفع الفيديو وتخزينه بنجاح",
    });
  } catch (err) {
    console.error("completeVideoUpload error:", err.message);
    return next(
      new ErrorResponse(
        `فشل إكمال الرفع: ${err.message}`,
        STATUS_CODE.INTERNAL_SERVER_ERROR
      )
    );
  }
});




// POST /uploads/refresh  (body: { guid })
export const refreshUploadHeaders = catchAsync(async (req, res, next) => {
  const { guid } = req.body || req.params;
  if (!guid) return res.status(400).json({ error: "guid required" });

  // Generate headers with maximum expiry (7 days) or customize based on request
  const { LibraryId, AuthorizationSignature, AuthorizationExpire, VideoId, tusUrl } =
    generateBunnyAuthHeadersForGuid(guid);

  return res.json({
    status: "success",
    data: {
      guid: VideoId,
      tusUrl,
      headers: { LibraryId, AuthorizationSignature, AuthorizationExpire, VideoId },
    },
  });
});

// POST /uploads/save  (body: { guid, uploadUrl, lessonId })
export const saveUploadUrl = catchAsync(async (req, res, next) => {
  const { guid, uploadUrl, lessonId, fileName, fileSize } = req.body;
  const userId = req.user?.userId || null;

  if (!guid || !uploadUrl) return res.status(400).json({ error: "guid & uploadUrl required" });

  const up = await prisma.upload.upsert({
    where: { guid },
    update: { uploadUrl, lessonId: lessonId || null, fileName: fileName || null, fileSize: fileSize ? Number(fileSize) : null, updatedAt: new Date() },
    create: { guid, uploadUrl, lessonId: lessonId || null, userId, fileName: fileName || null, fileSize: fileSize ? Number(fileSize) : null },
  });

  return res.json({ status: "success", data: up });
});

// GET /uploads/:guid
export const getUploadByGuid = catchAsync(async (req, res, next) => {
  const { guid } = req.params;
  const up = await prisma.upload.findUnique({ where: { guid } });
  if (!up) return res.status(404).json({ error: "not found" });
  res.json({ status: "success", data: up });
});

// GET /uploads/lesson/:lessonId
export const getUploadByLesson = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  if (!lessonId) return res.status(400).json({ error: "lessonId required" });

  const upload = await prisma.upload.findFirst({ where: { lessonId } });
  if (!upload) return res.status(404).json({ status: "not_found" });
  return res.json({ status: "success", data: upload });
});





// Get signed playback URL
export const getSignedUrl = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const userId = req.user.userId;

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { lesson: { include: { course: true } } },
  });

  if (!content || content.type !== "VIDEO") {
    return next(
      new ErrorResponse(
        "المحتوى غير موجود أو ليس فيديو",
        STATUS_CODE.NOT_FOUND
      )
    );
  }

  const userExists = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!userExists) {
    return next(
      new ErrorResponse("المستخدم غير موجود", STATUS_CODE.UNAUTHORIZED)
    );
  }

  // Check if content is paid and user doesn't have access
  if (!content.isFree) {
    const hasAccess = await hasAccessToPaidContent(userId, content.lesson.courseId, content.lessonId);
    
    if (!hasAccess) {
      return next(
        new ErrorResponse("المحتوى الحصري والمميز ل       المشتركين لدينا فقط", STATUS_CODE.FORBIDDEN)
      );
    }
  }

  try {
    const signedUrl = generateBunnySignedUrl(content?.contentUrl);
    return res.status(STATUS_CODE.OK).json({
      status: STATUS_MESSAGE.SUCCESS,
      data: { signedUrl, content },
      message: "تم إنشاء رابط تشغيل موقّع بنجاح",
    });
  } catch (err) {
    console.error("getSignedUrl error:", err.message);
    return next(
      new ErrorResponse(
        `فشل إنشاء الرابط الموقّع: ${err.message}`,
        STATUS_CODE.INTERNAL_SERVER_ERROR
      )
    );
  }
});











export const updateContent = catchAsync(async (req, res, next) => {
  const { id, contentId } = req.params;
  const { title, type, duration, order, isFree } = req.body;
  let contentUrl = null;

  // Check if lesson and content exist
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      lesson: {
        include: {
          course: true
        }
      }
    }
  });

  if (!content) {
    return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to update this content', STATUS_CODE.FORBIDDEN));
    }
  }

  // Handle file upload if provided
  if (req.file) {
    // Delete old file if exists
    if (content.contentUrl) {
      const oldFilename = path.basename(content.contentUrl);
      const oldPath = path.join(process.cwd(), 'uploads', 'contents', oldFilename);
      await unlink(oldPath).catch(err => logger.error(`Failed to delete old file: ${err.message}`));

      // Delete old File entry
      await prisma.file.deleteMany({
        where: {
          path: content.contentUrl
        }
      });
    }

    const newFilename = req.file.filename;
    contentUrl = `/uploads/contents/${newFilename}`;

    // Create new File entry
    await prisma.file.create({
      data: {
        category: 'DOCUMENT',
        type: type === 'PDF' ? 'PDF' : type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        originalName: req.file.originalname,
        storedName: newFilename,
        path: contentUrl,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  }


  console.log("is free => ", isFree)


  const updateData = {
    title,
    type,
    duration: duration ? parseInt(duration) : null,
    order: parseInt(order),
    isFree: isFree,
    ...(contentUrl && { contentUrl })
  };

  const updatedContent = await prisma.content.update({
    where: { id: contentId },
    data: updateData
  });

  logger.info(`Content updated: ${contentId} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { content: updatedContent },
    message: 'Content updated successfully'
  });
});

export const deleteContent = catchAsync(async (req, res, next) => {
  const { id, contentId } = req.params;

  // Check if lesson and content exist
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId }
  });

  if (!content) {
    return next(new ErrorResponse('Content not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to delete this content', STATUS_CODE.FORBIDDEN));
    }
  }

  // Delete file if exists
  if (content.contentUrl) {
    const filename = path.basename(content.contentUrl);
    const filePath = path.join(process.cwd(), 'uploads', 'contents', filename);
    await unlink(filePath).catch(err => logger.error(`Failed to delete file: ${err.message}`));

    // Delete File entry
    await prisma.file.deleteMany({
      where: {
        path: content.contentUrl
      }
    });
  }

  await prisma.content.delete({
    where: { id: contentId }
  });

  // Reorder remaining contents in the lesson
  const remainingContents = await prisma.content.findMany({
    where: { lessonId: id },
    orderBy: { order: 'asc' }
  });

  for (let i = 0; i < remainingContents.length; i++) {
    await prisma.content.update({
      where: { id: remainingContents[i].id },
      data: { order: i }
    });
  }

  logger.info(`Content deleted: ${contentId} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Content deleted successfully'
  });
});

export const getLessonStats = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          center: true
        }
      }
    }
  });

  if (!lesson) {
    return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN' && lesson.course.centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: lesson.course.centerId,
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to view stats for this lesson', STATUS_CODE.FORBIDDEN));
    }
  }

  const [
    totalEnrollments,
    completedEnrollments,
    averageProgress,
    contentStats,
    quizStats
  ] = await Promise.all([
    prisma.enrollment.count({
      where: { 
        courseId: lesson.courseId,
        status: 'ACTIVE'
      }
    }),
    prisma.lessonProgress.count({
      where: { 
        lessonId: id,
        completed: true
      }
    }),
    prisma.lessonProgress.aggregate({
      where: { lessonId: id },
      _avg: { progress: true }
    }),
    prisma.content.groupBy({
      by: ['type'],
      where: { lessonId: id },
      _count: { id: true }
    }),
    prisma.quiz.aggregate({
      where: { lessonId: id },
      _count: { id: true },
      _avg: { 
        timeLimit: true,
        maxAttempts: true 
      }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalEnrollments,
      completedEnrollments,
      completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
      averageProgress: averageProgress._avg.progress || 0,
      contentStats: contentStats.map(item => ({
        type: item.type,
        count: item._count.id
      })),
      quizCount: quizStats._count.id,
      averageTimeLimit: quizStats._avg.timeLimit || 0,
      averageMaxAttempts: quizStats._avg.maxAttempts || 0
    }
  });
});

export const reorderLessons = catchAsync(async (req, res, next) => {
  const { lessons } = req.body;

  // Validate all lessons belong to the same course
  const lessonIds = lessons.map(l => l.id);
  const dbLessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    select: { id: true, courseId: true }
  });

  if (dbLessons.length !== lessons.length) {
    return next(new ErrorResponse('Some lessons not found', STATUS_CODE.NOT_FOUND));
  }

  const courseIds = [...new Set(dbLessons.map(l => l.courseId))];
  if (courseIds.length > 1) {
    return next(new ErrorResponse('Lessons must belong to the same course', STATUS_CODE.BAD_REQUEST));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    const course = await prisma.course.findUnique({
      where: { id: courseIds[0] },
      include: { center: true }
    });

    if (course.centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: course.centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to reorder lessons in this course', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Update lesson orders in transaction
  await prisma.$transaction(
    lessons.map(lesson => 
      prisma.lesson.update({
        where: { id: lesson.id },
        data: { order: lesson.order }
      })
    )
  );

  logger.info(`Lessons reordered for course ${courseIds[0]} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Lessons reordered successfully'
  });
});