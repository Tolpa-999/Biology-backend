-- AlterTable
ALTER TABLE "public"."quiz_answers" ADD COLUMN     "awardedPoints" INTEGER,
ADD COLUMN     "textAnswer" TEXT,
ALTER COLUMN "isCorrect" DROP NOT NULL;
