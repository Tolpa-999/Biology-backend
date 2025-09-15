// src/modules/dashboard/controller.js
import prisma from '../../loaders/prisma.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

export const getPlatformStats = catchAsync(async (req, res, next) => {
  const { fromDate, toDate } = req.query;

  const where = {
    ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
    ...(toDate && { createdAt: { lte: new Date(toDate) } }),
  };

  const [
    totalUsers,
    activeUsers,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalRevenue,
    recentSignups,
    recentEnrollments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.course.count(),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.enrollment.count(),
    prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true }
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, middleName: true, lastName: true, email: true, createdAt: true }
    }),
    prisma.enrollment.findMany({
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true } }
      }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentSignups,
      recentEnrollments
    }
  });
});

export const getUserStats = catchAsync(async (req, res) => {
  const { fromDate, toDate, role } = req.query 
  // build createdAt range ONCE
  const createdAtRange = {};
  if (fromDate) createdAtRange.gte = new Date(fromDate);
  if (toDate) createdAtRange.lte = new Date(toDate);

  const userWhere = {
    ...(Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {}),
    ...(role ? { userRoles: { some: { role: { name: role } } } } : {}),
  };

  // For usersByRole we filter on the user relation (date range) and role relation (if provided)
  const userRoleWhere = {
    ...(Object.keys(createdAtRange).length ? { user: { createdAt: createdAtRange } } : {}),
    ...(role ? { role: { name: role } } : {}),
  };

  const [
    totalUsers,
    activeUsers,
    groupedByRole,
    growthTrend,
    recentLogins,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.user.count({ where: { ...userWhere, isActive: true } }),
    prisma.userRole.groupBy({
      by: ['roleId'],
      where: userRoleWhere,
      _count: { _all: true }, // or { userId: true } if you prefer
    }),
    prisma.user.groupBy({
      by: ['createdAt'],
      where: userWhere,
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.loginEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  // fetch role names and map
  const roleIds = groupedByRole.map(g => g.roleId);
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true },
  });
  const roleNameById = Object.fromEntries(roles.map(r => [r.id, r.name]));

  const usersByRole = groupedByRole.map(g => ({
    role: roleNameById[g.roleId] ?? String(g.roleId),
    count: g._count._all, // or g._count.userId if you used that shape
  }));

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalUsers,
      activeUsers,
      usersByRole,
      growthTrend,
      recentLogins,
    },
  });
});

export const getAllUsers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { search, role, fromDate, toDate } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ]
    }),
    ...(role && { userRoles: { some: { role: { name: role } } } }),
    ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
    ...(toDate && { createdAt: { lte: new Date(toDate) } }),
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
        _count: { select: { enrollments: true, payments: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
});

export const getUserDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: { include: { role: true } },
      userCenters: { include: { center: true } },
      enrollments: {
        include: {
          course: { select: { title: true } },
          payment: { select: { amount: true, status: true } }
        }
      },
      payments: {
        select: { amount: true, status: true, createdAt: true }
      },
      loginEvents: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      },
      activityEvents: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      },
      wallet: true
    }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Remove sensitive data
  delete user.passwordHash;

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user }
  });
});


// src/modules/dashboard/controller.js

export const toggleUserRole = catchAsync(async (req, res, next) => {
  const { id } = req.params; // user ID
  const targetRole = req.body?.targetRole; // optional (force specific role)

  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // current role(s)
  const currentRole = user.userRoles[0]?.role.name; // assuming 1 main role

  // toggle or force role
  let newRoleName = targetRole 
    ? targetRole 
    : currentRole?.toUpperCase() === 'ADMIN' 
      ? 'STUDENT' 
      : 'ADMIN';

  // find role ID
  const role = await prisma.role.findUnique({
    where: { name: newRoleName },
  });

  if (!role) {
    return next(new ErrorResponse('Target role not found', STATUS_CODE.NOT_FOUND));
  }

  // remove old roles & assign new one
  await prisma.userRole.deleteMany({
    where: { userId: id },
  });

  await prisma.userRole.create({
    data: {
      userId: id,
      roleId: role.id,
    },
  });

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: `Role updated successfully to ${newRoleName}`,
    data: { userId: id, newRole: newRoleName },
  });
});




export const getCourseStats = catchAsync(async (req, res, next) => {
  const { fromDate, toDate, academicYear, centerId } = req.query;

  const where = {
    ...(academicYear && { academicYear }),
    ...(centerId && { centerId }),
    ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
    ...(toDate && { createdAt: { lte: new Date(toDate) } }),
  };

  const [
    totalCourses,
    publishedCourses,
    coursesByYear,
    totalEnrollments,
    totalRevenue,
    topCourses
  ] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.count({ where: { ...where, isPublished: true } }),
    prisma.course.groupBy({
      by: ['academicYear'],
      _count: { id: true }
    }),
    prisma.enrollment.count({ where: { course: where } }),
    prisma.enrollment.aggregate({
      where: { course: where, status: 'ACTIVE' },
      _sum: { amountPaid: true }
    }),
    prisma.course.findMany({
      take: 5,
      orderBy: { enrollments: { _count: 'desc' } },
      include: { _count: { select: { enrollments: true } } }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalCourses,
      publishedCourses,
      coursesByYear: coursesByYear.map(item => ({ year: item.academicYear, count: item._count.id })),
      totalEnrollments,
      totalRevenue: totalRevenue._sum.amountPaid || 0,
      topCourses
    }
  });
});

export const getAllCourses = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { search, academicYear, centerId, isPublished } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(academicYear && { academicYear }),
    ...(centerId && { centerId }),
    ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
  };

  const [courses, totalCount] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      include: {
        center: { select: { name: true } },
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
        hasPrev: page > 1
      }
    }
  });
});

export const getCourseDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      center: true,
      lessons: {
        include: {
          _count: { select: { contents: true, quizzes: true, homeworks: true } }
        }
      },
      enrollments: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          payment: { select: { amount: true, status: true } }
        }
      },
      coupons: true
    }
  });

  if (!course) {
    return next(new ErrorResponse('Course not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { course }
  });
});

export const getEnrollmentStats = catchAsync(async (req, res, next) => {
  const { fromDate, toDate, status, centerId } = req.query;

  const where = {
    ...(status && { status }),
    ...(centerId && { course: { centerId } }),
    ...(fromDate && { startedAt: { gte: new Date(fromDate) } }),
    ...(toDate && { startedAt: { lte: new Date(toDate) } }),
  };

  const [
    totalEnrollments,
    enrollmentsByStatus,
    enrollmentTrend,
    topCoursesByEnrollments
  ] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.groupBy({
      by: ['status'],
      where,
      _count: { id: true }
    }),
    prisma.enrollment.groupBy({
      by: ['startedAt'],
      where,
      _count: { id: true },
      orderBy: { startedAt: 'asc' }
    }),
    prisma.course.findMany({
      take: 5,
      orderBy: { enrollments: { _count: 'desc' } },
      include: { _count: { select: { enrollments: true } } }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalEnrollments,
      enrollmentsByStatus: enrollmentsByStatus.map(item => ({ status: item.status, count: item._count.id })),
      enrollmentTrend,
      topCoursesByEnrollments
    }
  });
});

export const getPaymentStats = catchAsync(async (req, res, next) => {
  const { fromDate, toDate, provider } = req.query;

  const createdAtRange= {};
  if (fromDate) createdAtRange.gte = new Date(fromDate);
  if (toDate) createdAtRange.lte = new Date(toDate);

  const where = {
    ...(provider ? { provider } : {}),
    ...(Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {}),
  };

  const [
    totalPayments,
    totalRevenue,
    paymentsByStatus,
    paymentTrend,
    topPayersGrouped
  ] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ...where, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.payment.groupBy({
      by: ['createdAt'],
      where,
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.groupBy({
      by: ['userId'],
      where: { ...where, status: 'PAID' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
  ]);

  // Fetch user info for top payers
  const userIds = topPayersGrouped.map(p => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const usersById = Object.fromEntries(users.map(u => [u.id, u]));

  const topPayers = topPayersGrouped.map(p => ({
    user: usersById[p.userId],
    totalPaid: p._sum.amount || 0,
  }));

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      paymentsByStatus: paymentsByStatus.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
      paymentTrend,
      topPayers,
    },
  });
});


export const getActivityLogs = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { search, type, fromDate, toDate } = req.query;

  const skip = (page - 1) * limit;

  const where = {
    ...(type && { type }),
    ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
    ...(toDate && { createdAt: { lte: new Date(toDate) } }),
    ...(search && {
      user: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }
    }),
  };

  const [logs, totalCount] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      skip,
      take: limit,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.activityEvent.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      logs,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
});