import prisma from '../../loaders/prisma.js';
import { hashPassword } from '../../utils/password.js';
import catchAsync from '../../utils/cathAsync.js';
import ErrorResponse from '../../utils/errorResponse.js';
import { STATUS_CODE, STATUS_MESSAGE } from '../../utils/httpStatusCode.js';
import logger from '../../utils/logger.js';

export const getAllUsers = catchAsync(async (req, res, next) => {
  const { page, limit, search, role, isActive, academicStage } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(role && {
      userRoles: {
        some: {
          role: {
            name: role
          }
        }
      }
    }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(academicStage && { academicStage }),
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        email: true,
        gender: true,
        location: true,
        academicStage: true,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        lastLogin: true,
        createdAt: true,
        userRoles: {
          include: {
            role: true
          }
        },
        _count: {
          select: {
            enrollments: true,
            payments: true,
          }
        }
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
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    }
  });
});

export const getUserById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      email: true,
      gender: true,
      location: true,
      academicStage: true,
      parentPhone: true,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      avatar: true,
      lastLogin: true,
      themePreference: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        include: {
          role: true
        }
      },
      enrollments: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              academicYear: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      _count: {
        select: {
          enrollments: true,
          payments: true,
          quizSubmissions: true,
          homeworkSubmissions: true,
        }
      }
    }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user }
  });
});

export const createUser = catchAsync(async (req, res, next) => {
  const { phone, email, password, roles, ...userData } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { 
      OR: [
        { phone }, 
        ...(email ? [{ email }] : [])
      ] 
    },
  });

  if (existingUser) {
    return next(new ErrorResponse('User already exists', STATUS_CODE.CONFLICT));
  }

  // Validate roles exist
  const existingRoles = await prisma.role.findMany({
    where: {
      name: { in: roles }
    }
  });

  if (existingRoles.length !== roles.length) {
    const invalidRoles = roles.filter(role => 
      !existingRoles.some(r => r.name === role)
    );
    return next(new ErrorResponse(`Invalid roles: ${invalidRoles.join(', ')}`, STATUS_CODE.BAD_REQUEST));
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with transaction
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { 
        ...userData,
        phone, 
        email: email || null,
        passwordHash,
      },
    });

    // Assign roles
    await Promise.all(
      roles.map(roleName =>
        tx.userRole.create({
          data: {
            user: { connect: { id: user.id } },
            role: { connect: { name: roleName } }
          }
        })
      )
    );

    return user;
  });

  // Fetch created user with roles
  const createdUser = await prisma.user.findUnique({
    where: { id: newUser.id },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      email: true,
      gender: true,
      location: true,
      academicStage: true,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      lastLogin: true,
      createdAt: true,
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  logger.info(`Admin created user: ${newUser.phone} with roles: ${roles.join(', ')}`);

  return res.status(STATUS_CODE.CREATED).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user: createdUser },
    message: 'User created successfully'
  });
});

export const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { roles, ...updateData } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: true }
  });

  if (!existingUser) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Validate roles if provided
  if (roles) {
    const existingRoles = await prisma.role.findMany({
      where: {
        name: { in: roles }
      }
    });

    if (existingRoles.length !== roles.length) {
      const invalidRoles = roles.filter(role => 
        !existingRoles.some(r => r.name === role)
      );
      return next(new ErrorResponse(`Invalid roles: ${invalidRoles.join(', ')}`, STATUS_CODE.BAD_REQUEST));
    }
  }

  // Update user with transaction
  const updatedUser = await prisma.$transaction(async (tx) => {
    // Update user data
    const user = await tx.user.update({
      where: { id },
      data: updateData,
    });

    // Update roles if provided
    if (roles) {
      // Remove existing roles
      await tx.userRole.deleteMany({
        where: { userId: id }
      });

      // Add new roles
      await Promise.all(
        roles.map(roleName =>
          tx.userRole.create({
            data: {
              user: { connect: { id } },
              role: { connect: { name: roleName } }
            }
          })
        )
      );
    }

    return user;
  });

  // Fetch updated user with roles
  const userWithRoles = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      email: true,
      gender: true,
      location: true,
      academicStage: true,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      lastLogin: true,
      createdAt: true,
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  logger.info(`Admin updated user: ${id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user: userWithRoles },
    message: 'User updated successfully'
  });
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Prevent deletion of own account
  // if (id === req.user.userId) {
  //   return next(new ErrorResponse('Cannot delete your own account', STATUS_CODE.FORBIDDEN));
  // }

  // Delete user (cascade will handle related records)
  await prisma.user.delete({
    where: { id }
  });

  logger.info(`Admin deleted user: ${id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message: 'User deleted successfully'
  });
});

export const toggleUserStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    return next(new ErrorResponse('User not found', STATUS_CODE.NOT_FOUND));
  }

  // Prevent deactivating own account
  if (id === req.user.userId && !user.isActive) {
    return next(new ErrorResponse('Cannot deactivate your own account', STATUS_CODE.FORBIDDEN));
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true
    }
  });

  const action = updatedUser.isActive ? 'activated' : 'deactivated';
  logger.info(`Admin ${action} user: ${id}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: { user: updatedUser },
    message: `User ${action} successfully`
  });
});

export const bulkUserAction = catchAsync(async (req, res, next) => {
  const { userIds, action } = req.body;

  // Prevent acting on own account for deactivate/delete
  if (userIds.includes(req.user.userId) && (action === 'deactivate' || action === 'delete')) {
    return next(new ErrorResponse('Cannot perform this action on your own account', STATUS_CODE.FORBIDDEN));
  }

  let updateData;
  let message;

  switch (action) {
    case 'activate':
      updateData = { isActive: true };
      message = 'Users activated successfully';
      break;
    case 'deactivate':
      updateData = { isActive: false };
      message = 'Users deactivated successfully';
      break;
    case 'delete':
      // For delete, we'll actually delete the users
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
          NOT: { id: req.user.userId } // Prevent deleting self
        }
      });
      message = 'Users deleted successfully';
      break;
    default:
      return next(new ErrorResponse('Invalid action', STATUS_CODE.BAD_REQUEST));
  }

  if (action !== 'delete') {
    await prisma.user.updateMany({
      where: {
        id: { in: userIds },
        NOT: action === 'deactivate' ? { id: req.user.userId } : undefined
      },
      data: updateData
    });
  }

  logger.info(`Admin performed bulk action '${action}' on users: ${userIds.join(', ')}`);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    message
  });
});

export const getUserStats = catchAsync(async (req, res, next) => {
  const [
    totalUsers,
    activeUsers,
    usersByRole,
    usersByAcademicStage,
    recentRegistrations
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.role.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      }
    }),
    prisma.user.groupBy({
      by: ['academicStage'],
      _count: { id: true },
      where: { academicStage: { not: null } }
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })
  ]);

  return res.status(STATUS_CODE.OK).json({
    status: STATUS_MESSAGE.SUCCESS,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.map(role => ({
        role: role.name,
        count: role._count.users
      })),
      usersByAcademicStage: usersByAcademicStage.map(stage => ({
        stage: stage.academicStage,
        count: stage._count.id
      })),
      recentRegistrations
    }
  });
});