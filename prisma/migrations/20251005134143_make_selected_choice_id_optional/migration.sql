/*
  Warnings:

  - You are about to drop the column `passed` on the `lessons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."lessons" DROP COLUMN "passed",
ADD COLUMN     "QuizzPassed" BOOLEAN NOT NULL DEFAULT false;
