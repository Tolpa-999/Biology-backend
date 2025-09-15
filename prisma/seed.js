// prisma/seed.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ensure default roles exist
  const roles = [
    'ADMIN',
    'TEACHER',
    'STUDENT',
    'CENTER_ADMIN',
    'PARENT',
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  console.log('✅ Roles seeded successfully');

    // ✅ Backfill sessionVersion
  await prisma.user.updateMany({
    where: { sessionVersion: null },
    data: { sessionVersion: 0 },
  });
  console.log("✅ Backfilled sessionVersion for users");


   const users = await prisma.user.findMany();
  for (const user of users) {
    await prisma.file.create({
      data: {
        originalName: "default-profile.png",
        path: "/uploads/users/thumbnails/default-profile.png",
        size: 1024, // fake size
        mimeType: "image/png",
        type: "IMAGE",
        userId: user.id,
        category: "USER"
      },
    });
  }

  // ✅ Backfill courses with default thumbnail
  const courses = await prisma.course.findMany();
  for (const course of courses) {
    await prisma.file.create({
      data: {
        originalName: "default-thumbnail.png",
        path: "/uploads/courses/thumbnails/default-thumbnail.png",
        size: 1024,
        mimeType: "image/png",
        type: "IMAGE",
        courseId: course.id,
        category: "COURSE"
      },
    });
  }




}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Prisma seeds successfully");
  })
  .catch(async (e) => {
    console.error("error in seed.js => ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
