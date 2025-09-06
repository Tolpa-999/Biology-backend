

import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

import { initiatePaymobPayment, verifyPaymobWebhook } from '../../utils/paymob.js';



export const createManualPayment = catchAsync(async (req, res, next) => {
  const { userEmail, courseId, lessonId, amount, description, paymentDate } = req.body;
  
  // Validate that either courseId or lessonId is provided
  if (!courseId && !lessonId) {
    return next(new ErrorResponse('Either courseId or lessonId is required', STATUS_CODE.BAD_REQUEST));
  }
  
  if (courseId && lessonId) {
    return next(new ErrorResponse('Provide either courseId or lessonId, not both', STATUS_CODE.BAD_REQUEST));
  }
  
  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  });
  
  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }
  
  let course = null;
  let lesson = null;
  let finalAmount = amount;
  
  // If course payment
  if (courseId) {
    course = await prisma.course.findUnique({
      where: { id: courseId }
    });
    
    if (!course) {
      return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
    }
    
    // Use provided amount or course price
    if (!finalAmount) {
      finalAmount = course.discountPrice || course.price;
    }
  }
  
  // If lesson payment
  if (lessonId) {
    lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true }
    });
    
    if (!lesson) {
      return next(new ErrorResponse('Lesson not found', STATUS_CODE.NOT_FOUND));
    }
    
    // Check if lesson is purchasable individually
    if (!lesson.price && lesson.price !== 0) {
      return next(new ErrorResponse('This lesson cannot be purchased individually', STATUS_CODE.BAD_REQUEST));
    }
    
    // Use provided amount or lesson price
    if (!finalAmount) {
      finalAmount = lesson.discountPrice || lesson.price;
    }
  }
  
  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: finalAmount,
      provider: 'MANUAL',
      status: 'PAID',
      description: description || `Manual payment for ${course ? course.title : lesson.title}`,
      metadata: {
        processedBy: req.user.userId,
        processedAt: new Date().toISOString(),
        paymentDate: paymentDate || new Date().toISOString(),
        itemType: course ? 'COURSE' : 'LESSON',
        itemId: course ? courseId : lessonId
      }
    }
  });
  
  // Create enrollment based on payment type
  if (courseId) {
    // Check if user already has an enrollment for this course
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: courseId,
        status: { not: 'REFUNDED' }
      }
    });
    
    if (existingEnrollment) {
      // Update existing enrollment
      await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: 'ACTIVE',
          amountPaid: finalAmount,
          paymentId: payment.id,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
    } else {
      // Create new enrollment
      await prisma.enrollment.create({
        data: {
          userId: user.id,
          courseId: courseId,
          status: 'ACTIVE',
          amountPaid: finalAmount,
          paymentId: payment.id,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
    }
  }
  
  if (lessonId) {
    // Check if user already has a lesson enrollment
    const existingLessonEnrollment = await prisma.lessonEnrollment.findFirst({
      where: {
        userId: user.id,
        lessonId: lessonId
      }
    });
    
    if (existingLessonEnrollment) {
      // Update existing lesson enrollment
      await prisma.lessonEnrollment.update({
        where: { id: existingLessonEnrollment.id },
        data: {
          status: 'ACTIVE',
          amountPaid: finalAmount,
          paymentId: payment.id,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
    } else {
      // Create new lesson enrollment
      await prisma.lessonEnrollment.create({
        data: {
          userId: user.id,
          lessonId: lessonId,
          status: 'ACTIVE',
          amountPaid: finalAmount,
          paymentId: payment.id,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
    }
  }
  
  logger.info(`Manual payment created by admin ${req.user.userId} for user ${user.id} for ${course ? 'course' : 'lesson'} ${course ? courseId : lessonId}`);
  
  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { payment },
    message: 'Manual payment processed successfully'
  });
});

export const getManualPayments = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const where = {
    provider: 'MANUAL',
    ...(req.query.userId && { userId: req.query.userId }),
    ...(req.query.status && { status: req.query.status })
  };
  
  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payment.count({ where })
  ]);
  
  const totalPages = Math.ceil(totalCount / limit);
  
  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      payments,
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




export const initiatePayment = catchAsync(async (req, res, next) => {
  const { type, id } = req.body; // type: 'course' | 'lesson', id: courseId or lessonId
  const userId = req.user.userId;

  let item, price, orderId;
  if (type === 'course') {
    item = await prisma.course.findUnique({ where: { id } });
    price = item.discountPrice || item.price;
    orderId = `course_${id}`;
    if (await prisma.enrollment.findFirst({ where: { userId, courseId: id, status: 'ACTIVE' } })) return next(new ErrorResponse('Already enrolled', STATUS_CODE.CONFLICT));
  } else if (type === 'lesson') {
    item = await prisma.lesson.findUnique({ where: { id } });
    price = item.discountPrice || item.price;
    orderId = `lesson_${id}`;
    if (await prisma.lessonEnrollment.findFirst({ where: { userId, lessonId: id, status: 'ACTIVE' } })) return next(new ErrorResponse('Already purchased', STATUS_CODE.CONFLICT));
  } else return next(new ErrorResponse('Invalid type', STATUS_CODE.BAD_REQUEST));

  if (!price) return next(new ErrorResponse('No price set', STATUS_CODE.BAD_REQUEST));

  // Create payment
  const payment = await prisma.payment.create({
    data: { userId, amount: price, provider: 'WALLET', status: 'INITIATED', description: `${type} ${id}` }
  });

  const payUrl = await initiatePaymobPayment(price, orderId, type, id);
  return res.status(STATUS_CODE.OK).json({ status: STATUS_MESSAGE.SUCCESS, data: { payUrl, paymentId: payment.id } });
});

export const paymobWebhook = catchAsync(async (req, res, next) => {
  if (!verifyPaymobWebhook(req)) return next(new ErrorResponse('Invalid webhook', STATUS_CODE.UNAUTHORIZED));

  const { obj } = req.body; // Paymob payload
  const payment = await prisma.payment.findUnique({ where: { providerRef: obj.order.id.toString() } }); // Map to your payment

  if (!payment) return res.status(404).send();

  const newStatus = obj.success ? 'PAID' : 'FAILED';
  await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus, providerRef: obj.id.toString() } });

  if (newStatus === 'PAID') {
    const [type, itemId] = payment.description.split(' ');
    if (type === 'course') {
      await prisma.enrollment.create({ data: { userId: payment.userId, courseId: itemId, status: 'ACTIVE', amountPaid: payment.amount, paymentId: payment.id } });
    } else {
      await prisma.lessonEnrollment.create({ data: { userId: payment.userId, lessonId: itemId, status: 'ACTIVE', amountPaid: payment.amount, paymentId: payment.id } });
    }
  }

  res.status(200).send();
});