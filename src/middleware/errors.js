// middlewares/errorHandler.js
export default function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Prisma validation / DB errors (optional)
  if (err.code && err.code.startsWith("P")) {
    statusCode = 400;
    message = "Database error";
  }

  res.status(statusCode).json({
    status: "error",
    message,
  });
}
