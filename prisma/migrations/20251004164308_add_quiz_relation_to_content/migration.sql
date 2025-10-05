/*
  Warnings:

  - A unique constraint covering the columns `[quizId]` on the table `contents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."contents" ADD COLUMN     "quizId" TEXT;

-- AlterTable
ALTER TABLE "public"."quizzes" ADD COLUMN     "order" INTEGER DEFAULT 999;

-- CreateIndex
CREATE UNIQUE INDEX "contents_quizId_key" ON "public"."contents"("quizId");

-- AddForeignKey
ALTER TABLE "public"."contents" ADD CONSTRAINT "contents_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
