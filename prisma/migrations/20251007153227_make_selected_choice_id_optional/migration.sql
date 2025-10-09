-- AlterTable
ALTER TABLE "public"."contents" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."courses" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."lessons" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;
