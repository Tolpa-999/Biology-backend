// src/middleware/security.js
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

const securityMiddleware = [
  helmet(),
  cors(),
  compression(),
];

export default securityMiddleware;
