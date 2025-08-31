/*
  Warnings:

  - Added the required column `parentPhone` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "parentPhone" TEXT NOT NULL;
