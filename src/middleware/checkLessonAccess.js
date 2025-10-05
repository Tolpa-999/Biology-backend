// middlewares/checkLessonAccess.js
import prisma from "../loaders/prisma.js";
import ErrorResponse from "../utils/errorResponse.js";
import { STATUS_CODE } from "../utils/httpStatusCode.js";
import catchAsync from "../utils/cathAsync.js";

export const checkLessonAccess = catchAsync(async (req, res, next) => {


  if (!userId) {
    return next(new ErrorResponse("User not authenticated", STATUS_CODE.UNAUTHORIZED));
  }


    if (lesson.requiresQuizPass) {


    const { lessonId } = req.params;
  const userId = req.user?.userId;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      quizzes: {
        include: {
          submissions: {
            where: { userId },
            select: { id: true, passed: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    return next(new ErrorResponse("Lesson not found", STATUS_CODE.NOT_FOUND));
  }




  // If lesson doesn't require quiz pass -> allow access


  // Check if user has passed any quiz of this lesson
  const hasPassedQuiz = lesson.quizzes.some((quiz) =>
    quiz.submissions.some((submission) => submission.passed === true)
  );

  if (!hasPassedQuiz) {
    return next(
      new ErrorResponse("بجب اجتياز الكويز على هذا الدرس ل الوصول الى المحتوى الخاص به", STATUS_CODE.FORBIDDEN)
    );
  }

    }






  // ✅ Access granted
  return next();
});
