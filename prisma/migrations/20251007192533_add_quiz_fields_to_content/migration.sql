-- AlterTable
ALTER TABLE "File" ADD COLUMN     "isFree" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false;
