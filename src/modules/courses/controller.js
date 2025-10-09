import { randomUUID } from 'crypto';
import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';
import { validateCouponForCourse } from '../../utils/couponUtils.js';


// Optional: if you want to also delete from local filesystem
import fs from 'fs';
import path from 'path';
import { unlink } from 'fs/promises';


export const getAllCourses = catchAsync(async (req, res, next) => {
  // Ensure page/limit are numbers with defaults
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const { search, academicYear, isPublished, centerId, minPrice, maxPrice } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(academicYear && { academicYear }),
    ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
    ...(centerId && { centerId }),
    ...((minPrice || maxPrice) && {
      price: {
        ...(minPrice && { gte: parseFloat(minPrice) }),
        ...(maxPrice && { lte: parseFloat(maxPrice) }),
      },
    }),
  };

  const [courses, totalCount] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit, // limit is now a valid integer
      include: {
        center: {
          select: { id: true, name: true, city: true }
        },
        lessons: { select: { _count: true } },
        enrollments: { select: { _count: true } },
        _count: { select: { lessons: true, enrollments: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.course.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      courses,
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

export const getCourseById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  console.log("get course hitted")

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: {
        select: {
          id: true,
          name: true,
          city: true,
        }
      },
      lessons: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          contents: {
              orderBy: { order: 'asc' }, // ✅ uses the `order Int` field in your Content model
            select: {
              id: true,
              title: true,
              duration: true,
              type: true,
              isFree: true,
              passingScore: true,
              timeLimit: true,
              questions: true,

            }
          },
          // UPDATED: Quizzes are now contents with type 'QUIZ'
          // : {
          //   where: { type: 'QUIZ', isPublished: true },
          //   orderBy: { order: 'asc' },
          //   select: {
          //     id: true,
          //     title: true,
          //     description: true,
          //     timeLimit: true,
          //     maxAttempts: true,
          //     passingScore: true,
          //     passThreshold: true,
          //     _count: {
          //       select: {
          //         questions: true,
          //       }
          //     }
          //   }
          // },
          _count: {
            select: {
              contents: true,
              // quizContents: true,
              homeworks: true,
            }
          }
        }
      },
      coupons: {
        where: {
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        },
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
          maxUses: true,
          usedCount: true,
          minPurchase: true,
          endDate: true,
        }
      },
      _count: {
        select: {
          lessons: true,
          enrollments: true,
        }
      }
    }
  });

  console.log("course => ", course)

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  console.log("course after validation => ", course)

  console.log("get course hitted")
  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { course }
  });
});


export const createCourse = catchAsync(async (req, res, next) => {
  const { centerId, ...courseData } = req.body || {};
  let thumbnailUrl = null;

  if (!req.file) {
  return res.status(400).json({ message: "Thumbnail image is required" });
}



  // Check if user has permission to create course for this center
  if (centerId) {
    const userCenter = await prisma.userCenter.findFirst({
      where: {
        userId: req.user.userId,
        centerId: centerId,
      },
      include: {
        center: true
      }
    });

    if (!userCenter) {
      return next(new ErrorResponse('You do not have permission to create courses for this center', STATUS_CODE.FORBIDDEN));
    }
  }

let course = await prisma.course.create({
    data: {
      ...courseData,
      ...(centerId && { center: { connect: { id: centerId } } }),
    },
    include: {
      center: {
        select: {
          id: true,
          name: true,
          city: true,
        }
      }
    }
  });


  // Handle thumbnail upload
  if (req.file) {
    const newFilename = req.file.filename;
    thumbnailUrl = `/uploads/courses/${newFilename}`;

    // Create File entry
    await prisma.file.create({
      data: {
        category: 'COURSE',
        type: 'IMAGE',
        courseId: course.id,
        originalName: req.file.originalname,
        storedName: newFilename,
        path: thumbnailUrl,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });

    // Update course with thumbnail
    course = await prisma.course.update({
      where: { id: course.id },
      data: { thumbnail: thumbnailUrl },
      include: {
        center: {
          select: {
            id: true,
            name: true,
            city: true,
          }
        }
      }
    });
  }

  logger.info(`Course created: ${course.id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { course },
    message: 'Course created successfully'
  });
});


export const updateCourse = catchAsync(async (req, res, next) => {
  console.log("update course hitted")
  const { id } = req.params;
  const {isPublished, price, discountPrice, centerId, ...updateData } = req.body || {};
  let thumbnailUrl = null;

  console.log("update course hitted")

  // Check if course exists and user has permission to update it
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Handle thumbnail upload if provided
  if (req.file) {
    if (course.thumbnail) {
      const oldFilename = path.basename(course.thumbnail);
      const oldPath = path.join(process.cwd(), 'uploads', 'courses', oldFilename);
      await unlink(oldPath).catch(err => logger.error(`Failed to delete old thumbnail: ${err.message}`));

      // Delete old File entry
      await prisma.file.deleteMany({
        where: {
          path: course.thumbnail,
          courseId: id
        }
      });
    }

    const newFilename = req.file.filename;
    thumbnailUrl = `/uploads/courses/${newFilename}`;

    // Create new File entry
    await prisma.file.create({
      data: {
        category: 'COURSE',
        type: 'IMAGE',
        courseId: id,
        originalName: req.file.originalname,
        storedName: newFilename,
        path: thumbnailUrl,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });

    updateData.thumbnail = thumbnailUrl;
  
  }

  // Update course
  const updatedCourse = await prisma.course.update({
    where: { id },
    data: {
      ...updateData,
      price: parseFloat(price),
      discountPrice: parseFloat(discountPrice),
      isPublished: isPublished == "true" || isPublished == true,
      ...(centerId && { center: { connect: { id: centerId } } }),
    },
    include: {
      center: {
        select: {
          id: true,
          name: true,
          city: true,
        }
      }
    }
  });

  logger.info(`Course updated: ${id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { course: updatedCourse },
    message: 'Course updated successfully'
  });
});


export const deleteCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if course exists and user has permission to delete it
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true,
      _count: {
        select: {
          enrollments: true,
          lessons: true,
        }
      }
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }


  console.log("course enrollment => ", course._count.enrollments)

  // Check if course has enrollments
  await prisma.$transaction(async (tx) => {
  // Delete lesson progress and wallet transactions for all enrollments of this course
  await tx.lessonProgress.deleteMany({
    where: { enrollment: { courseId: id } }
  });

  await tx.walletTransaction.deleteMany({
    where: { enrollment: { courseId: id } }
  });

  // Delete enrollments themselves
  await tx.enrollment.deleteMany({
    where: { courseId: id }
  });

  const files = await tx.file.findMany({ where: { courseId: id } });
    for (const file of files) {
      const filePath = path.join(process.cwd(), file.path.slice(1)); // assuming path starts with '/'
      await fs.promises.unlink(filePath).catch((err) =>
        logger.error(`Failed to delete file ${file.id}: ${err.message}`)
      );
    }

  // Finally delete the course
  await tx.course.delete({ where: { id } });
});


  logger.info(`Course deleted: ${id} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Course deleted successfully'
  });
});

export const getCourseUsers = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search, status } = req.query;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  const skip = (pageNumber - 1) * limitNumber;

  // Check if course exists and user has permission to view enrollments
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }



  const where = {
    courseId: id,
    status: { not: 'REFUNDED' },   
    ...(status && { status }),
    ...(search && {
      user: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      },
    }),
  };

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take: limitNumber,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.enrollment.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      enrollments,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    }
  });
});

export const enrollUserInCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { userId, couponCode, centerCode } = req.body;

  // Check if course exists and user has permission to enroll users
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission (admin or center admin of the course's center)


  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Check if user is already enrolled
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId: id,
      status: { not: 'REFUNDED' }
    }
  });

  if (existingEnrollment) {
    return next(new ErrorResponse('User is already enrolled in this course', STATUS_CODE.CONFLICT));
  }

  // Calculate final price
  let finalPrice = course.discountPrice || course.price;
  let coupon = null;

  // Apply coupon if provided
  if (couponCode) {
  const validationResult = await validateCouponForCourse(couponCode, userId, id);
  
  if (!validationResult.valid) {
    return next(new ErrorResponse(validationResult.error, STATUS_CODE.BAD_REQUEST));
  }

  finalPrice = validationResult.coupon.finalAmount;
  coupon = await prisma.coupon.findUnique({
    where: { id: validationResult.coupon.id }
  });
}


  // Validate center code if provided
  let centerCodeRecord = null;
  if (centerCode) {
    centerCodeRecord = await prisma.centerCode.findFirst({
      where: {
        code: centerCode,
        active: true,
        centerId: course.centerId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      }
    });

    if (!centerCodeRecord) {
      return next(new ErrorResponse('Invalid or expired center code', STATUS_CODE.BAD_REQUEST));
    }
  }

  // Create enrollment
  const enrollment = await prisma.$transaction(async (tx) => {
    // Create enrollment
    const enrollment = await tx.enrollment.create({
      data: {
        userId,
        courseId: id,
        status: 'ACTIVE',
        amountPaid: finalPrice,
        ...(coupon && { coupon: { connect: { id: coupon.id } } }),
        ...(centerCodeRecord && { centerCode: { connect: { id: centerCodeRecord.id } } }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        course: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    // Update coupon usage if applicable
    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } }
      });
    }

    return enrollment;
  });

  logger.info(`User ${userId} enrolled in course ${id} by admin ${req.user.userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { enrollment },
    message: 'User enrolled successfully'
  });
});

export const removeUserFromCourse = catchAsync(async (req, res, next) => {
  const { id, userId } = req.params;

  // Check if course exists and user has permission to remove users
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission (admin or center admin of the course's center)


  // Check if enrollment exists
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId: id,
      status: { not: 'REFUNDED' }
    },
    include: {
      payment: true
    }
  });

  if (!enrollment) {
    return next(new ErrorResponse('User is not enrolled in this course', STATUS_CODE.NOT_FOUND));
  }

  // Update enrollment status to REFUNDED
  await prisma.$transaction(async (tx) => {
  await tx.lessonProgress.deleteMany({ where: { enrollmentId: enrollment.id } });
  await tx.walletTransaction.deleteMany({ where: { enrollmentId: enrollment.id } });
  
  await tx.enrollment.delete({ where: { id: enrollment.id } });
});

  logger.info(`User ${userId} removed from course ${id} by admin ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'User removed from course successfully'
  });
});

export const getCourseStats = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if course exists and user has permission to view stats
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission (admin or center admin of the course's center)


  const [
    totalEnrollments,
    activeEnrollments,
    revenue,
    enrollmentsByStatus,
    recentEnrollments
  ] = await Promise.all([
    prisma.enrollment.count({
      where: { courseId: id }
    }),
    prisma.enrollment.count({
      where: { 
        courseId: id,
        status: 'ACTIVE'
      }
    }),
    prisma.enrollment.aggregate({
      where: { 
        courseId: id,
        status: 'ACTIVE'
      },
      _sum: { amountPaid: true }
    }),
    prisma.enrollment.groupBy({
      by: ['status'],
      where: { courseId: id },
      _count: { id: true }
    }),
    prisma.enrollment.findMany({
      where: { courseId: id },
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalEnrollments,
      activeEnrollments,
      revenue: revenue._sum.amountPaid || 0,
      enrollmentsByStatus: enrollmentsByStatus.map(item => ({
        status: item.status,
        count: item._count.id
      })),
      recentEnrollments
    }
  });
});


export const getCourseLessons = catchAsync(async (req, res, next) => {
  const { id } = req.params; // courseId

  // Verify course exists
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!course) {
    return res.status(STATUS_CODE.NOT_FOUND).json({
      status: STATUS_MESSAGE.ERROR,
      message: "Course not found",
    });
  }

  // 2️⃣ Fetch lessons with all contents and homeworks
  const lessons = await prisma.lesson.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" },
    include: {
      contents: {
        select: {
          id: true,
          type: true, // important — so we can detect QUIZ type
        },
      },
      homeworks: true,
    },
  });

  // 3️⃣ Compute statistics per lesson
  const data = lessons.map((lesson) => {
    const totalContents = lesson.contents.length;

    // Filter quiz-type contents
    const quizCount = lesson.contents.filter(
      (content) => content.type === "QUIZ"
    ).length;

    const homeworkCount = lesson.homeworks.length;

    // Return clean structure
    return {
      ...lesson,
      _count: {
        contents: totalContents,
        quizzes: quizCount,
        homeworks: homeworkCount,
      },
    };
  });

  // 4️⃣ Return result
  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data,
  });
});




export const validateCourseCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  const { id: courseId } = req.params; // Course ID from URL params
  const userId = req.user.userId;

  if (!code) {
    return next(new ErrorResponse('Coupon code is required', STATUS_CODE.BAD_REQUEST));
  }

  // Validate coupon against the specific course
  const validationResult = await validateCouponForCourse(code, userId, courseId);

  if (!validationResult.valid) {
    return next(new ErrorResponse(validationResult.error, STATUS_CODE.BAD_REQUEST));
  }

  await prisma.coupon.update({
  where: { id: validationResult.coupon?.id },
  data: { usedCount: { increment: 1 } }
});


  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      valid: true,
      coupon: validationResult.coupon
    }
  });
});



