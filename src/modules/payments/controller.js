

import axios from 'axios';
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

    const enrolled = await prisma.enrollment.findFirst({ where: { userId, courseId: id, status: 'ACTIVE' } })

    if (enrolled) 
    {
      return next(new ErrorResponse('Already enrolled', STATUS_CODE.CONFLICT));
    }
  } else if (type === 'lesson') {
    item = await prisma.lesson.findUnique({ where: { id } });

    console.log("item => ", item)

    price = item.discountPrice || item.price;


    orderId = `lesson_${id}`;

    const purchased = await prisma.lessonEnrollment.findFirst({ where: { userId, lessonId: id, status: 'ACTIVE' } })

    if (purchased) 
    {
      return next(new ErrorResponse('Already purchased', STATUS_CODE.CONFLICT));
    }
  } else return next(new ErrorResponse('Invalid type', STATUS_CODE.BAD_REQUEST));

  console.log("item => ", item)

  if (price == 0 || !price) {
    return next(new ErrorResponse('Course is free', STATUS_CODE.BAD_REQUEST));
  }

  // Create payment
  const payment = await prisma.payment.create({
    data: { 
      userId, 
      amount: price, 
      provider: 'CARD', 
      status: 'INITIATED', 
      description: `${type} ${id}` }
  });

  const payUrl = await initiatePaymobPayment(price, orderId, type, id, userId);

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

  console.log("newStatus => ", newStatus)

  res.status(200).send();
});



/**
 * Admin endpoint to remove an enrollment or lessonEnrollment.
 *
 * Behavior:
 * - Identify enrollment via enrollmentId OR userId+type+(courseId|lessonId).
 * - Optional refund:
 *   - If payment exists and provider is WALLET or MANUAL -> create WalletTransaction credit and mark Payment as REFUNDED.
 *   - If provider is an external gateway -> mark Payment as REFUNDED and create PaymentLog requesting external refund.
 * - Mark enrollment/lessonEnrollment status = REFUNDED (soft) and clear/adjust progress.
 * - Optionally cascade/remove lesson enrollments/progress.
 */
export const removeEnrollment = catchAsync(async (req, res, next) => {
  const adminId = req.user.userId;
  const {
    enrollmentId,
    userId,
    type,
    courseId,
    lessonId,
    refund,
    refundAmount,
    refundReason,
    cascadeLessonEnrollments,
    removeProgress
  } = req.body;

  // Resolve the target enrollment(s)
  let targetEnrollment = null;
  let targetLessonEnrollment = null;

  if (enrollmentId) {
    // try course enrollment first
    targetEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { payment: true, lessonEnrollments: true, user: true }
    });
    if (!targetEnrollment) {
      targetLessonEnrollment = await prisma.lessonEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { payment: true, lesson: true, user: true }
      });
      if (!targetLessonEnrollment) {
        return next(new ErrorResponse('Enrollment not found', STATUS_CODE.NOT_FOUND));
      }
    }
  } else {
    // Find by user + type + courseId/lessonId
    if (!userId) return next(new ErrorResponse('userId is required when enrollmentId is not provided', STATUS_CODE.BAD_REQUEST));

    if (type === 'course') {
      if (!courseId) return next(new ErrorResponse('courseId required for course type', STATUS_CODE.BAD_REQUEST));
      targetEnrollment = await prisma.enrollment.findFirst({
        where: { userId, courseId, status: { not: 'REFUNDED' } },
        include: { payment: true, lessonEnrollments: true, user: true }
      });
      if (!targetEnrollment) return next(new ErrorResponse('Course enrollment not found', STATUS_CODE.NOT_FOUND));
    } else if (type === 'lesson') {
      if (!lessonId) return next(new ErrorResponse('lessonId required for lesson type', STATUS_CODE.BAD_REQUEST));
      targetLessonEnrollment = await prisma.lessonEnrollment.findFirst({
        where: { userId, lessonId, status: { not: 'REFUNDED' } },
        include: { payment: true, lesson: true, user: true }
      });
      if (!targetLessonEnrollment) return next(new ErrorResponse('Lesson enrollment not found', STATUS_CODE.NOT_FOUND));
    } else {
      return next(new ErrorResponse('Invalid type', STATUS_CODE.BAD_REQUEST));
    }
  }

  // Use a transaction for safety
  const result = await prisma.$transaction(async (tx) => {
    // Common helpers for refund handling
    async function handleRefund(payment, calcRefundAmount) {
      // If no payment record, create a wallet credit if refundAmount provided
      if (!payment) {
        if (!calcRefundAmount || calcRefundAmount <= 0) {
          return { refunded: false, note: 'No payment to refund' };
        }
        // create wallet and transaction (credit)
        const wallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
        if (!wallet) {
          // create wallet
          await tx.wallet.create({ data: { userId: targetUserId, balance: calcRefundAmount } });
        } else {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: calcRefundAmount } }
          });
        }
        await tx.walletTransaction.create({
          data: {
            walletId: wallet ? wallet.id : (await tx.wallet.findUnique({ where: { userId: targetUserId } })).id,
            amount: calcRefundAmount,
            type: 'REFUND',
            description: refundReason || 'Admin refund - no payment record',
          }
        });
        return { refunded: true, note: 'Credited wallet (no payment present)' };
      }

      // If payment exists, branch by provider
      const provider = payment.provider; // FAWRY | WALLET | CASH | MANUAL
      const paymentId = payment.id;
      const existingAmount = payment.amount || 0;

      // Determine refund amount
      const toRefund = (typeof refundAmount === 'number') ? refundAmount : (calcRefundAmount ?? existingAmount);

      // For WALLET or MANUAL -> credit wallet directly
      if (provider === 'WALLET' || provider === 'MANUAL') {
        let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({ data: { userId: payment.userId, balance: toRefund } });
        } else {
          await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: toRefund } } });
        }
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: toRefund,
            type: 'REFUND',
            paymentId: paymentId,
            description: refundReason || `Admin refund for payment ${paymentId}`
          }
        });
        // mark payment refunded
        await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED', updatedAt: new Date() } });
        await tx.paymentLog.create({
          data: {
            paymentId,
            event: 'ADMIN_REFUND',
            payload: { adminId, toRefund, reason: refundReason || null },
            signature: null
          }
        });
        return { refunded: true, note: 'Refunded to wallet/manual' };
      }

      // For external providers (FAWRY, CASH, etc) -> mark as REFUNDED and log a refund request
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED', updatedAt: new Date() } });
      await tx.paymentLog.create({
        data: {
          paymentId,
          event: 'REFUND_REQUESTED_EXTERNAL',
          payload: { adminId, provider, toRefund, reason: refundReason || null },
          signature: null
        }
      });
      return { refunded: true, note: 'Marked payment REFUNDED and logged external refund request' };
    } // end handleRefund

    // We'll need to know the target user id for wallet ops
    let targetUserId = null;

    // Removing a course enrollment
    if (targetEnrollment) {
      targetUserId = targetEnrollment.userId;

      // Compute default refund amount (simple example: full amountPaid)
      const calcRefundAmount = targetEnrollment.amountPaid || 0;

      // perform refund if requested
      let refundResult = { refunded: false, note: 'no refund requested' };
      if (refund) {
        refundResult = await handleRefund(targetEnrollment.payment || null, calcRefundAmount);
      }

      // Update enrollment status to REFUNDED (soft remove)
      await tx.enrollment.update({
        where: { id: targetEnrollment.id },
        data: {
          status: 'REFUNDED',
          expiresAt: new Date(),
          progress: 0,
          updatedAt: new Date()
        }
      });

      // Optionally remove lesson enrollments and progress associated with this course for this user
      if (cascadeLessonEnrollments) {
        const lessonEnrollments = await tx.lessonEnrollment.findMany({
          where: { userId: targetUserId, lessonId: { in: targetEnrollment.course.lessons ? targetEnrollment.course.lessons.map(l => l.id) : [] } }
        });

        // Mark each lessonEnrollment as REFUNDED and optionally remove progress
        for (const le of lessonEnrollments) {
          await tx.lessonEnrollment.update({
            where: { id: le.id },
            data: { status: 'REFUNDED', expiresAt: new Date(), amountPaid: 0, paymentId: null }
          });
        }
      }

      // Remove or reset lesson progress rows tied to this enrollment (optional)
      if (removeProgress) {
        await tx.lessonProgress.deleteMany({
          where: { enrollmentId: targetEnrollment.id }
        });
      }

      // Log admin action
      await tx.activityEvent.create({
        data: {
          userId: targetUserId,
          type: 'ADMIN_REMOVE_ENROLLMENT',
          contentId: targetEnrollment.courseId,
          contentUrl: null,
          metadata: { adminId, enrollmentId: targetEnrollment.id, refundRequested: refund, refundResult },
        }
      });

      return {
        success: true,
        type: 'course',
        enrollmentId: targetEnrollment.id,
        refundResult
      };
    }

    // Removing a lesson enrollment
    if (targetLessonEnrollment) {
      targetUserId = targetLessonEnrollment.userId;

      const calcRefundAmount = targetLessonEnrollment.amountPaid || 0;
      let refundResult = { refunded: false, note: 'no refund requested' };
      if (refund) {
        refundResult = await handleRefund(targetLessonEnrollment.payment || null, calcRefundAmount);
      }

      // Update lessonEnrollment status
      await tx.lessonEnrollment.update({
        where: { id: targetLessonEnrollment.id },
        data: { status: 'REFUNDED', expiresAt: new Date(), amountPaid: 0, paymentId: null }
      });

      // Remove progress associated with this lessonEnrollment
      if (removeProgress) {
        await tx.lessonProgress.deleteMany({
          where: { lessonEnrollmentId: targetLessonEnrollment.id }
        });
      }

      // Log admin action
      await tx.activityEvent.create({
        data: {
          userId: targetUserId,
          type: 'ADMIN_REMOVE_LESSON_ENROLLMENT',
          contentId: targetLessonEnrollment.lessonId,
          metadata: { adminId, lessonEnrollmentId: targetLessonEnrollment.id, refundRequested: refund, refundResult }
        }
      });

      return {
        success: true,
        type: 'lesson',
        lessonEnrollmentId: targetLessonEnrollment.id,
        refundResult
      };
    }

    throw new Error('Unexpected logic path in removeEnrollment transaction');
  }); // end transaction

  logger.info(`Admin ${adminId} removed enrollment result: ${JSON.stringify(result)}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: result,
    message: 'Enrollment removed successfully'
  });
});



const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY; // from your Paymob dashboard
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_CARD_INTEGRATION_ID; // wallet integration id
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID; // optional if you use iframe
const PAYMOB_AUTH_URL = "https://accept.paymobsolutions.com/api/auth/tokens";
const PAYMOB_ORDER_URL = "https://accept.paymobsolutions.com/api/ecommerce/orders";
const PAYMOB_PAYMENT_KEY_URL = "https://accept.paymobsolutions.com/api/acceptance/payment_keys";
const PAYMOB_PAY_URL = "https://accept.paymobsolutions.com/api/acceptance/payments/pay";


export const mobileWallet = async (req, res, next) => {
  try {
    const { amount_cents, phone_number } = req.body;

    // 1️⃣ Get Auth Token
    const authRes = await axios.post(PAYMOB_AUTH_URL, {
      api_key: PAYMOB_API_KEY,
    });
    const authToken = authRes.data.token;

    // 2️⃣ Create Order
    const orderRes = await axios.post(
      PAYMOB_ORDER_URL,
      {
        auth_token: authToken,
        delivery_needed: "false",
        amount_cents: amount_cents, // e.g. "1000" = 10 EGP
        currency: "EGP",
        items: [],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    const orderId = orderRes.data.id;

    // 3️⃣ Get Payment Key
    const paymentKeyRes = await axios.post(PAYMOB_PAYMENT_KEY_URL, {
      auth_token: authToken,
      amount_cents: amount_cents,
      expiration: 3600,
      order_id: orderId,
      billing_data: {
        apartment: "NA",
        email: "customer@test.com",
        floor: "NA",
        first_name: "Test",
        street: "NA",
        building: "NA",
        phone_number: phone_number,
        shipping_method: "NA",
        postal_code: "NA",
        city: "Cairo",
        country: "EG",
        last_name: "Customer",
        state: "Cairo",
      },
      currency: "EGP",
      integration_id: PAYMOB_INTEGRATION_ID,
    });
    const paymentKey = paymentKeyRes.data.token;

    // 4️⃣ Pay with Wallet
    const walletRes = await axios.post(PAYMOB_PAY_URL, {
      source: {
        identifier: phone_number, // e.g. "01010101010"
        subtype: "WALLET",
      },
      payment_token: paymentKey,
    });

    // 5️⃣ Decode Base64 token (if Paymob returns encoded token)
    let finalToken = null;
    if (walletRes.data?.token) {
      finalToken = Buffer.from(walletRes.data.token, "base64").toString("utf8");
    }

    return res.json({
      step1_auth: authRes.data,
      step2_order: orderRes.data,
      step3_paymentKey: paymentKeyRes.data,
      step4_wallet: walletRes.data,
      decoded_wallet_token: finalToken,
    });
  } catch (err) {
    console.error("Paymob Wallet Error:", err.response?.data || err.message || err);
    return res.status(500).json(err.response?.data || { error: err.message });
  }
}
