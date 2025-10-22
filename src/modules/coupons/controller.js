import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

/**
 * Create a new coupon
 */
export const createCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    name,
    description,
    discountType,
    discountValue,
    maxUses,
    maxUsesPerUser,
    minPurchase,
    startDate,
    endDate,
    scope,
    courseId,
    lessonId,
    validUserIds,
    excludedUserIds,
  } = req.body;

  const userId = req.user.userId;

  // Validate discount values
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    return next(new ErrorResponse('Percentage discount cannot exceed 100%', STATUS_CODE.BAD_REQUEST));
  }

  // Check if code already exists
  const existingCoupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() }
  });

  if (existingCoupon) {
    return next(new ErrorResponse('Coupon code already exists', STATUS_CODE.CONFLICT));
  }

  // Validate course/lesson scope
  if (scope === 'COURSE' && !courseId) {
    return next(new ErrorResponse('Course ID is required for course-scoped coupons', STATUS_CODE.BAD_REQUEST));
  }

  if (scope === 'LESSON' && !lessonId) {
    return next(new ErrorResponse('Lesson ID is required for lesson-scoped coupons', STATUS_CODE.BAD_REQUEST));
  }

  // Check if course/lesson exists and user has permission
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { center: true }
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
        return next(new ErrorResponse('You do not have permission to create coupons for this course', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  if (lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          include: { center: true }
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
        return next(new ErrorResponse('You do not have permission to create coupons for this lesson', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Validate users exist
  if (validUserIds && validUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: validUserIds } },
      select: { id: true }
    });

    if (validUsers.length !== validUserIds.length) {
      return next(new ErrorResponse('Some valid users not found', STATUS_CODE.NOT_FOUND));
    }
  }

  if (excludedUserIds && excludedUserIds.length > 0) {
    const excludedUsers = await prisma.user.findMany({
      where: { id: { in: excludedUserIds } },
      select: { id: true }
    });

    if (excludedUsers.length !== excludedUserIds.length) {
      return next(new ErrorResponse('Some excluded users not found', STATUS_CODE.NOT_FOUND));
    }
  }

  // Create coupon with transaction
  const coupon = await prisma.$transaction(async (tx) => {
    const couponData = {
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      scope,
      courseId: scope === 'COURSE' ? courseId : null,
      lessonId: scope === 'LESSON' ? lessonId : null,
      createdById: userId,
      isActive: true,
      status: 'ACTIVE',
    };

    const newCoupon = await tx.coupon.create({
      data: couponData,
      include: {
        course: {
          select: { id: true, title: true, academicYear: true }
        },
        lesson: {
          select: { id: true, title: true, course: { select: { title: true } } }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        validForUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        excludedUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Connect valid users if provided
    if (validUserIds && validUserIds.length > 0) {
      await tx.coupon.update({
        where: { id: newCoupon.id },
        data: {
          validForUsers: {
            connect: validUserIds.map(id => ({ id }))
          }
        }
      });
    }

    // Connect excluded users if provided
    if (excludedUserIds && excludedUserIds.length > 0) {
      await tx.coupon.update({
        where: { id: newCoupon.id },
        data: {
          excludedUsers: {
            connect: excludedUserIds.map(id => ({ id }))
          }
        }
      });
    }

    return await tx.coupon.findUnique({
      where: { id: newCoupon.id },
      include: {
        course: {
          select: { id: true, title: true, academicYear: true }
        },
        lesson: {
          select: { id: true, title: true, course: { select: { title: true } } }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        validForUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        excludedUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  });

  logger.info(`Coupon created: ${coupon.code} by user: ${userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon },
    message: 'Coupon created successfully'
  });
});

/**
 * Bulk create coupons
 */
export const bulkCreateCoupons = catchAsync(async (req, res, next) => {
  const { coupons } = req.body; // Array of coupon objects
  const userId = req.user.userId;

  if (!Array.isArray(coupons) || coupons.length === 0) {
    return next(new ErrorResponse('Coupons array is required', STATUS_CODE.BAD_REQUEST));
  }

  if (coupons.length > 100) {
    return next(new ErrorResponse('Cannot create more than 100 coupons at once', STATUS_CODE.BAD_REQUEST));
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const couponData of coupons) {
    try {
      // Validate required fields
      if (!couponData.code || !couponData.name || !couponData.discountType || !couponData.discountValue) {
        results.failed.push({
          code: couponData.code,
          error: 'Missing required fields'
        });
        continue;
      }

      // Check if code already exists
      const existingCoupon = await prisma.coupon.findUnique({
        where: { code: couponData.code.toUpperCase() }
      });

      if (existingCoupon) {
        results.failed.push({
          code: couponData.code,
          error: 'Code already exists'
        });
        continue;
      }

      const coupon = await prisma.coupon.create({
        data: {
          code: couponData.code.toUpperCase(),
          name: couponData.name,
          description: couponData.description,
          discountType: couponData.discountType,
          discountValue: couponData.discountValue,
          startDate: couponData.startDate ? new Date(couponData.startDate) : null,
          endDate: couponData.endDate ? new Date(couponData.endDate) : null,
          scope: couponData.scope || 'GLOBAL',
          courseId: couponData.courseId,
          lessonId: couponData.lessonId,
          createdById: userId,
          isActive: true,
          status: 'ACTIVE',
        }
      });

      results.successful.push(coupon);
    } catch (error) {
      results.failed.push({
        code: couponData.code,
        error: error.message
      });
    }
  }

  logger.info(`Bulk coupons created: ${results.successful.length} successful, ${results.failed.length} failed by user: ${userId}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: results,
    message: `Bulk coupon creation completed: ${results.successful.length} successful, ${results.failed.length} failed`
  });
});

/**
 * Get all coupons with filtering and pagination
 */
export const getAllCoupons = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { search, status, scope, discountType, isActive } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(status && { status }),
    ...(scope && { scope }),
    ...(discountType && { discountType }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
  };

  const [coupons, totalCount] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      include: {
        course: {
          select: { id: true, title: true, academicYear: true }
        },
        lesson: {
          select: { id: true, title: true, course: { select: { title: true } } }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        validForUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        excludedUsers: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        _count: {
          select: {
            enrollments: true,
            usages: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.coupon.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      coupons,
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

/**
 * Get coupon by ID
 */
export const getCouponById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: {
        select: { id: true, title: true, academicYear: true, price: true }
      },
      lesson: {
        select: { id: true, title: true, price: true, course: { select: { title: true } } }
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      validForUsers: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true }
      },
      excludedUsers: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true }
      },
      enrollments: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true }
          },
          course: {
            select: { id: true, title: true, academicYear: true }
          }
        },
        orderBy: { startedAt: 'desc' }
      },
      usages: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      },
      _count: {
        select: {
          enrollments: true,
          usages: true,
          validForUsers: true,
          excludedUsers: true,
        }
      }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon }
  });
});

/**
 * Get coupon by code
 */
export const getCouponByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      course: {
        select: { id: true, title: true, academicYear: true, price: true }
      },
      lesson: {
        select: { id: true, title: true, price: true, course: { select: { title: true } } }
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      validForUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      excludedUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      _count: {
        select: {
          enrollments: true,
          usages: true,
        }
      }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon }
  });
});

/**
 * Update coupon
 */
export const updateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if coupon exists
  const existingCoupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: { include: { center: true } },
      lesson: { include: { course: { include: { center: true } } } }
    }
  });

  if (!existingCoupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    let centerId = null;
    
    if (existingCoupon.course) {
      centerId = existingCoupon.course.centerId;
    } else if (existingCoupon.lesson) {
      centerId = existingCoupon.lesson.course.centerId;
    }

    if (centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to update this coupon', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Validate discount values
  if (updateData.discountType === 'PERCENTAGE' && updateData.discountValue > 100) {
    return next(new ErrorResponse('Percentage discount cannot exceed 100%', STATUS_CODE.BAD_REQUEST));
  }

  // Validate users exist if provided
  if (updateData.validUserIds && updateData.validUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: updateData.validUserIds } },
      select: { id: true }
    });

    if (validUsers.length !== updateData.validUserIds.length) {
      return next(new ErrorResponse('Some valid users not found', STATUS_CODE.NOT_FOUND));
    }
  }

  if (updateData.excludedUserIds && updateData.excludedUserIds.length > 0) {
    const excludedUsers = await prisma.user.findMany({
      where: { id: { in: updateData.excludedUserIds } },
      select: { id: true }
    });

    if (excludedUsers.length !== updateData.excludedUserIds.length) {
      return next(new ErrorResponse('Some excluded users not found', STATUS_CODE.NOT_FOUND));
    }
  }

  const updatedCoupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...updateData,
      ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
      ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
      // Remove user relation fields from direct update
      validUserIds: undefined,
      excludedUserIds: undefined,
    },
    include: {
      course: {
        select: { id: true, title: true, academicYear: true }
      },
      lesson: {
        select: { id: true, title: true, course: { select: { title: true } } }
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      validForUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      excludedUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    }
  });

  logger.info(`Coupon updated: ${updatedCoupon.code} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon: updatedCoupon },
    message: 'Coupon updated successfully'
  });
});

/**
 * Delete coupon
 */
export const deleteCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if coupon exists
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: { include: { center: true } },
      lesson: { include: { course: { include: { center: true } } } },
      _count: {
        select: {
          enrollments: true,
          usages: true,
        }
      }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    let centerId = null;
    
    if (coupon.course) {
      centerId = coupon.course.centerId;
    } else if (coupon.lesson) {
      centerId = coupon.lesson.course.centerId;
    }

    if (centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to delete this coupon', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Check if coupon has enrollments
  if (coupon._count.enrollments > 0) {
    return next(new ErrorResponse('Cannot delete coupon with associated enrollments', STATUS_CODE.CONFLICT));
  }

  await prisma.coupon.delete({
    where: { id }
  });

  logger.info(`Coupon deleted: ${coupon.code} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'Coupon deleted successfully'
  });
});

/**
 * Deactivate coupon
 */
export const deactivateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: { include: { center: true } },
      lesson: { include: { course: { include: { center: true } } } }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    let centerId = null;
    
    if (coupon.course) {
      centerId = coupon.course.centerId;
    } else if (coupon.lesson) {
      centerId = coupon.lesson.course.centerId;
    }

    if (centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to deactivate this coupon', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  const updatedCoupon = await prisma.coupon.update({
    where: { id },
    data: {
      isActive: false,
      status: 'INACTIVE'
    }
  });

  logger.info(`Coupon deactivated: ${coupon.code} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon: updatedCoupon },
    message: 'Coupon deactivated successfully'
  });
});

/**
 * Activate coupon
 */
export const activateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: { include: { center: true } },
      lesson: { include: { course: { include: { center: true } } } }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    let centerId = null;
    
    if (coupon.course) {
      centerId = coupon.course.centerId;
    } else if (coupon.lesson) {
      centerId = coupon.lesson.course.centerId;
    }

    if (centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to activate this coupon', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Check if coupon is expired
  if (coupon.endDate && new Date() > coupon.endDate) {
    return next(new ErrorResponse('Cannot activate expired coupon', STATUS_CODE.BAD_REQUEST));
  }

  // Check if coupon is used up
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return next(new ErrorResponse('Cannot activate fully used coupon', STATUS_CODE.BAD_REQUEST));
  }

  const updatedCoupon = await prisma.coupon.update({
    where: { id },
    data: {
      isActive: true,
      status: 'ACTIVE'
    }
  });

  logger.info(`Coupon activated: ${coupon.code} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon: updatedCoupon },
    message: 'Coupon activated successfully'
  });
});

/**
 * Validate coupon for application
 */
export const validateCoupon = catchAsync(async (req, res, next) => {
  const { code, courseId, lessonId, purchaseAmount } = req.body;
  const userId = req.user.userId;

  const validationResult = await validateCouponForUser(code, userId, courseId, lessonId, purchaseAmount);

  if (!validationResult.valid) {
    return next(new ErrorResponse(validationResult.message, STATUS_CODE.BAD_REQUEST));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      valid: true,
      coupon: validationResult.coupon,
      discountAmount: validationResult.discountAmount,
      finalAmount: validationResult.finalAmount,
      message: validationResult.message
    }
  });
});

/**
 * Apply coupon to purchase
 */
export const applyCoupon = catchAsync(async (req, res, next) => {
  const { code, courseId, lessonId, purchaseAmount } = req.body;
  const userId = req.user.userId;

  const validationResult = await validateCouponForUser(code, userId, courseId, lessonId, purchaseAmount);

  if (!validationResult.valid) {
    return next(new ErrorResponse(validationResult.message, STATUS_CODE.BAD_REQUEST));
  }

  const { coupon, discountAmount, finalAmount } = validationResult;

  // Record coupon usage
  await prisma.couponUsage.upsert({
    where: {
      couponId_userId: {
        couponId: coupon.id,
        userId: userId
      }
    },
    update: {
      count: { increment: 1 },
      updatedAt: new Date()
    },
    create: {
      couponId: coupon.id,
      userId: userId,
      count: 1
    }
  });

  // Update coupon usage count
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: {
      usedCount: { increment: 1 },
      ...(coupon.maxUses && coupon.usedCount + 1 >= coupon.maxUses && {
        status: 'USED_UP',
        isActive: false
      })
    }
  });

  // Log coupon application
  await prisma.activityEvent.create({
    data: {
      userId,
      type: 'COUPON_APPLIED',
      metadata: {
        couponId: coupon.id,
        couponCode: coupon.code,
        courseId,
        lessonId,
        purchaseAmount,
        discountAmount,
        finalAmount,
        appliedAt: new Date()
      }
    }
  });

  logger.info(`Coupon applied: ${coupon.code} by user: ${userId} for amount: ${purchaseAmount}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      coupon,
      discountAmount,
      finalAmount,
      applied: true
    },
    message: 'Coupon applied successfully'
  });
});

/**
 * Assign users to coupon (valid or excluded)
 */
export const assignUsersToCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { userIds, action } = req.body;

  // Check if coupon exists
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      course: { include: { center: true } },
      lesson: { include: { course: { include: { center: true } } } }
    }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  // Check permission for center admins
  if (req.user.role === 'CENTER_ADMIN') {
    let centerId = null;
    
    if (coupon.course) {
      centerId = coupon.course.centerId;
    } else if (coupon.lesson) {
      centerId = coupon.lesson.course.centerId;
    }

    if (centerId) {
      const userCenter = await prisma.userCenter.findFirst({
        where: {
          userId: req.user.userId,
          centerId: centerId,
        }
      });

      if (!userCenter) {
        return next(new ErrorResponse('You do not have permission to modify this coupon', STATUS_CODE.FORBIDDEN));
      }
    }
  }

  // Validate users exist
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true }
  });

  if (users.length !== userIds.length) {
    return next(new ErrorResponse('Some users not found', STATUS_CODE.NOT_FOUND));
  }

  let updateData = {};

  switch (action) {
    case 'ADD_VALID':
      updateData = {
        validForUsers: {
          connect: userIds.map(id => ({ id }))
        }
      };
      break;
    case 'ADD_EXCLUDED':
      updateData = {
        excludedUsers: {
          connect: userIds.map(id => ({ id }))
        }
      };
      break;
    case 'REMOVE_VALID':
      updateData = {
        validForUsers: {
          disconnect: userIds.map(id => ({ id }))
        }
      };
      break;
    case 'REMOVE_EXCLUDED':
      updateData = {
        excludedUsers: {
          disconnect: userIds.map(id => ({ id }))
        }
      };
      break;
    default:
      return next(new ErrorResponse('Invalid action', STATUS_CODE.BAD_REQUEST));
  }

  const updatedCoupon = await prisma.coupon.update({
    where: { id },
    data: updateData,
    include: {
      validForUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      excludedUsers: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    }
  });

  logger.info(`Users assigned to coupon: ${coupon.code}, action: ${action}, users: ${userIds.length} by user: ${req.user.userId}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { coupon: updatedCoupon },
    message: `Users ${action.replace('_', ' ').toLowerCase()} successfully`
  });
});

/**
 * Get coupon usage statistics
 */
export const getCouponUsageStats = catchAsync(async (req, res, next) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalCoupons,
    activeCoupons,
    totalUsage,
    recentUsage,
    usageByScope,
    topCoupons
  ] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.count({ where: { isActive: true, status: 'ACTIVE' } }),
    prisma.coupon.aggregate({
      _sum: { usedCount: true }
    }),
    prisma.enrollment.count({
      where: {
        couponId: { not: null },
        startedAt: { gte: thirtyDaysAgo }
      }
    }),
    prisma.coupon.groupBy({
      by: ['scope'],
      _sum: { usedCount: true },
      _count: { id: true }
    }),
    prisma.coupon.findMany({
      where: { usedCount: { gt: 0 } },
      orderBy: { usedCount: 'desc' },
      take: 10,
      select: {
        id: true,
        code: true,
        name: true,
        usedCount: true,
        discountType: true,
        discountValue: true,
        scope: true
      }
    })
  ]);

  const stats = {
    totalCoupons,
    activeCoupons,
    inactiveCoupons: totalCoupons - activeCoupons,
    totalUsage: totalUsage._sum.usedCount || 0,
    recentUsage,
    usageByScope: usageByScope.map(item => ({
      scope: item.scope,
      totalUsage: item._sum.usedCount || 0,
      couponCount: item._count.id
    })),
    topCoupons
  };

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { stats }
  });
});

/**
 * Get coupon usage details
 */
export const getCouponUsage = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { userId, courseId, lessonId, startDate, endDate } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(userId && { userId }),
    ...(courseId && { course: { id: courseId } }),
    ...(lessonId && { lesson: { id: lessonId } }),
    ...((startDate || endDate) && {
      startedAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) })
      }
    })
  };

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        ...where,
        couponId: { not: null }
      },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        course: {
          select: { id: true, title: true, academicYear: true, price: true }
        },
        coupon: {
          select: { id: true, code: true, name: true, discountType: true, discountValue: true }
        },
        payment: {
          select: { id: true, amount: true, status: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.enrollment.count({
      where: {
        ...where,
        couponId: { not: null }
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      enrollments,
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

/**
 * Get user's coupon usage
 */
export const getUserCouponUsage = catchAsync(async (req, res, next) => {
  const userId = req.user.userId;

  const [couponUsages, enrollments] = await Promise.all([
    prisma.couponUsage.findMany({
      where: { userId },
      include: {
        coupon: {
          select: {
            id: true,
            code: true,
            name: true,
            discountType: true,
            discountValue: true,
            scope: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.enrollment.findMany({
      where: {
        userId,
        couponId: { not: null }
      },
      include: {
        course: {
          select: { id: true, title: true, academicYear: true }
        },
        coupon: {
          select: { id: true, code: true, name: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      couponUsages,
      enrollmentsWithCoupons: enrollments
    }
  });
});

/**
 * Get enrollments for a specific coupon
 */
export const getCouponEnrollments = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  // Check if coupon exists
  const coupon = await prisma.coupon.findUnique({
    where: { id }
  });

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', STATUS_CODE.NOT_FOUND));
  }

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where: { couponId: id },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        course: {
          select: { id: true, title: true, academicYear: true, price: true }
        },
        payment: {
          select: { id: true, amount: true, status: true, createdAt: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.enrollment.count({
      where: { couponId: id }
    })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name
      },
      enrollments,
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate coupon for user application
 */
async function validateCouponForUser(code, userId, courseId, lessonId, purchaseAmount) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      course: true,
      lesson: true,
      validForUsers: { select: { id: true } },
      excludedUsers: { select: { id: true } },
      usages: {
        where: { userId },
        select: { count: true }
      }
    }
  });

  if (!coupon) {
    return { valid: false, message: 'Coupon not found' };
  }

  if (!coupon.isActive || coupon.status !== 'ACTIVE') {
    return { valid: false, message: 'Coupon is not active' };
  }

  // Check date validity
  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    return { valid: false, message: 'Coupon is not yet valid' };
  }

  if (coupon.endDate && now > coupon.endDate) {
    return { valid: false, message: 'Coupon has expired' };
  }

  // Check usage limits
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: 'Coupon has reached maximum usage limit' };
  }

  // Check per-user usage limits
  if (coupon.maxUsesPerUser) {
    const userUsage = coupon.usages[0]?.count || 0;
    if (userUsage >= coupon.maxUsesPerUser) {
      return { valid: false, message: 'You have reached the maximum usage limit for this coupon' };
    }
  }

  // Check minimum purchase amount
  if (coupon.minPurchase && purchaseAmount < coupon.minPurchase) {
    return { 
      valid: false, 
      message: `Minimum purchase amount of ${coupon.minPurchase} EGP required` 
    };
  }

  // Check user restrictions
  if (coupon.validForUsers.length > 0) {
    const isValidUser = coupon.validForUsers.some(user => user.id === userId);
    if (!isValidUser) {
      return { valid: false, message: 'Coupon is not valid for your account' };
    }
  }

  if (coupon.excludedUsers.length > 0) {
    const isExcluded = coupon.excludedUsers.some(user => user.id === userId);
    if (isExcluded) {
      return { valid: false, message: 'Coupon is not valid for your account' };
    }
  }

  // Check scope validity
  if (coupon.scope === 'COURSE' && (!courseId || coupon.courseId !== courseId)) {
    return { valid: false, message: 'Coupon is not valid for this course' };
  }

  if (coupon.scope === 'LESSON' && (!lessonId || coupon.lessonId !== lessonId)) {
    return { valid: false, message: 'Coupon is not valid for this lesson' };
  }

  // Calculate discount
  let discountAmount = 0;
  let finalAmount = purchaseAmount;

  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = (purchaseAmount * coupon.discountValue) / 100;
    // Ensure discount doesn't exceed purchase amount
    discountAmount = Math.min(discountAmount, purchaseAmount);
  } else {
    discountAmount = Math.min(coupon.discountValue, purchaseAmount);
  }

  finalAmount = purchaseAmount - discountAmount;

  // Ensure final amount is not negative
  if (finalAmount < 0) {
    finalAmount = 0;
    discountAmount = purchaseAmount;
  }

  return {
    valid: true,
    coupon,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat(finalAmount.toFixed(2)),
    message: 'Coupon is valid'
  };
}