/*
  Warnings:

  - You are about to drop the column `quizId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `quizId` on the `contents` table. All the data in the column will be lost.
  - You are about to drop the column `quizId` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `quizId` on the `quiz_submissions` table. All the data in the column will be lost.
  - You are about to drop the `quizzes` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `contentId` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentId` to the `quiz_submissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_quizId_fkey";

-- DropForeignKey
ALTER TABLE "contents" DROP CONSTRAINT "contents_quizId_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_quizId_fkey";

-- DropForeignKey
ALTER TABLE "quiz_submissions" DROP CONSTRAINT "quiz_submissions_quizId_fkey";

-- DropForeignKey
ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_courseId_fkey";

-- DropForeignKey
ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_lessonId_fkey";

-- DropIndex
DROP INDEX "contents_quizId_key";

-- DropIndex
DROP INDEX "questions_quizId_order_idx";

-- DropIndex
DROP INDEX "quiz_submissions_quizId_userId_idx";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "quizId",
ADD COLUMN     "contentId" TEXT;

-- AlterTable
ALTER TABLE "contents" DROP COLUMN "quizId",
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "passThreshold" DOUBLE PRECISION DEFAULT 40.0,
ADD COLUMN     "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "timeLimit" INTEGER,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "quizId",
ADD COLUMN     "contentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quiz_submissions" DROP COLUMN "quizId",
ADD COLUMN     "contentId" TEXT NOT NULL;

-- DropTable
DROP TABLE "quizzes";

-- CreateIndex
CREATE INDEX "questions_contentId_order_idx" ON "questions"("contentId", "order");

-- CreateIndex
CREATE INDEX "quiz_submissions_contentId_userId_idx" ON "quiz_submissions"("contentId", "userId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
