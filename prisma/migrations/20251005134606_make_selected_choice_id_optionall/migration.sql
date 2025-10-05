/*
  Warnings:

  - You are about to drop the column `QuizzPassed` on the `lessons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."lessons" DROP COLUMN "QuizzPassed";

-- AlterTable
ALTER TABLE "public"."quiz_submissions" ADD COLUMN     "passed" BOOLEAN;
