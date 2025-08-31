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
