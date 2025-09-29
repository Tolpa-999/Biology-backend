// src/utils/couponUtils.js
import prisma from '../loaders/prisma.js';

// Helper function to update coupon status
export const updateCouponStatus = async (coupon) => {
  const now = new Date();
  let status = coupon.status; // default keep current

  if (!coupon.isActive) {
    status = 'INACTIVE';
  } else if (coupon.startDate && new Date(coupon.startDate) > now) {
    status = 'INACTIVE'; // not started yet
  } else if (coupon.endDate && new Date(coupon.endDate) < now) {
    status = 'EXPIRED';
  } else if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    status = 'USED_UP';
  } else {
    status = 'ACTIVE';
  }

  if (coupon.status !== status) {
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { status }
    });
    return status;
  }

  return coupon.status;
};


export const validateCouponForCourse = async (couponCode, userId, courseId) => {
  // Get the coupon with all necessary relations
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase() },
    include: {
      validForUsers: { select: { id: true } },
      excludedUsers: { select: { id: true } },
      course: { select: { id: true, price: true, discountPrice: true } }
    }
  });

  if (!coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }

  // Update status first
  const status = await updateCouponStatus(coupon);

if (status !== 'ACTIVE') {
  return { valid: false, error: `Coupon is ${status.toLowerCase()}` };
}


  // Check scope - coupon must be either GLOBAL or for this specific course
  if (coupon.scope === 'COURSE' && coupon.courseId !== courseId) {
    return { valid: false, error: 'Coupon is not valid for this course' };
  }

  if (coupon.scope === 'LESSON') {
    return { valid: false, error: 'This coupon is only valid for lessons, not courses' };
  }

  // Get course price from database (don't trust user input)
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { price: true, discountPrice: true }
  });

  if (!course) {
    return { valid: false, error: 'Course not found' };
  }

  const currentPrice = course.discountPrice || course.price;

  // Check minimum purchase
  if (coupon.minPurchase && currentPrice < coupon.minPurchase) {
    return { 
      valid: false, 
      error: `Minimum purchase of ${coupon.minPurchase} required. Current price: ${currentPrice}` 
    };
  }

  // Check user restrictions
  if (coupon.validForUsers.length > 0) {
    const isValidUser = coupon.validForUsers.some(user => user.id === userId);
    if (!isValidUser) {
      return { valid: false, error: 'Coupon is not valid for this user' };
    }
  }

  if (coupon.excludedUsers.length > 0) {
    const isExcluded = coupon.excludedUsers.some(user => user.id === userId);
    if (isExcluded) {
      return { valid: false, error: 'Coupon is not valid for this user' };
    }
  }

  // Check max uses per user
  if (coupon.maxUsesPerUser) {
    const userUsageCount = await prisma.enrollment.count({
      where: {
        userId,
        couponId: coupon.id
      }
    });

    console.log("userUsageCount => ", userUsageCount, " and coupon.maxUsesPerUser => ", coupon.maxUsesPerUser)

    if (userUsageCount >= coupon.maxUsesPerUser) {
      return { valid: false, error: 'Coupon usage limit reached for this user' };
    }
  }

  // Calculate discount based on actual course price
  let discountAmount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = (currentPrice * coupon.discountValue) / 100;
  } else {
    discountAmount = Math.min(coupon.discountValue, currentPrice);
  }

  const finalAmount = currentPrice - discountAmount;

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount,
      originalPrice: currentPrice
    }
  };
};

export const calculateDiscount = (coupon, amount) => {
  let discountAmount = 0;
  
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = (amount * coupon.discountValue) / 100;
  } else {
    discountAmount = Math.min(coupon.discountValue, amount);
  }

  return {
    discountAmount,
    finalAmount: amount - discountAmount
  };
};