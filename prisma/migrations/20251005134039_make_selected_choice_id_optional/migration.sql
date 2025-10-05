/*
  Warnings:

  - You are about to drop the column `passThreshold` on the `lessons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."lessons" DROP COLUMN "passThreshold",
ADD COLUMN     "passed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."quizzes" ALTER COLUMN "passingScore" SET DEFAULT 50,
ALTER COLUMN "passThreshold" SET DEFAULT 40.0;
