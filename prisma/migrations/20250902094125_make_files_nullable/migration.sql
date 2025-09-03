/*
  Warnings:

  - The values [PROFILE] on the enum `FileCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FileCategory_new" AS ENUM ('USER', 'COURSE', 'DOCUMENT');
ALTER TABLE "public"."File" ALTER COLUMN "category" TYPE "public"."FileCategory_new" USING ("category"::text::"public"."FileCategory_new");
ALTER TYPE "public"."FileCategory" RENAME TO "FileCategory_old";
ALTER TYPE "public"."FileCategory_new" RENAME TO "FileCategory";
DROP TYPE "public"."FileCategory_old";
COMMIT;
