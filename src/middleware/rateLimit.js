import rateLimit from "express-rate-limit";

const rateLimitMiddleware = rateLimit({
  windowMs: 30 * 1000, // 30s window
  max: 10,             // 10 requests per IP
  message: { message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export default rateLimitMiddleware;
