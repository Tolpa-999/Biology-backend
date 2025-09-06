/*
  Warnings:

  - A unique constraint covering the columns `[enrollmentId,lessonId,lessonEnrollmentId]` on the table `lesson_progress` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."lesson_progress_enrollmentId_lessonId_key";

-- AlterTable
ALTER TABLE "public"."contents" ADD COLUMN     "bunnyVideoGuid" TEXT;

-- AlterTable
ALTER TABLE "public"."coupons" ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "public"."homeworks" ADD COLUMN     "courseId" TEXT,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."lesson_progress" ADD COLUMN     "lessonEnrollmentId" TEXT,
ALTER COLUMN "enrollmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."lessons" ADD COLUMN     "centerId" TEXT,
ADD COLUMN     "discountPrice" DOUBLE PRECISION,
ADD COLUMN     "price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."quizzes" ADD COLUMN     "courseId" TEXT,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."lesson_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentId" TEXT,

    CONSTRAINT "lesson_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_enrollments_userId_lessonId_key" ON "public"."lesson_enrollments"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollmentId_lessonId_lessonEnrollmentId_key" ON "public"."lesson_progress"("enrollmentId", "lessonId", "lessonEnrollmentId");

-- AddForeignKey
ALTER TABLE "public"."lessons" ADD CONSTRAINT "lessons_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "public"."centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_enrollments" ADD CONSTRAINT "lesson_enrollments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "public"."enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_progress" ADD CONSTRAINT "lesson_progress_lessonEnrollmentId_fkey" FOREIGN KEY ("lessonEnrollmentId") REFERENCES "public"."lesson_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quizzes" ADD CONSTRAINT "quizzes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."homeworks" ADD CONSTRAINT "homeworks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupons" ADD CONSTRAINT "coupons_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
