-- AlterTable
ALTER TABLE "public"."contents" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "contentUrl" DROP NOT NULL;
