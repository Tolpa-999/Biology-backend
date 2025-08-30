import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";

import errorMiddleware from "./middleware/errors.js";
import securityMiddleware from "./middleware/security.js";

// Routes
// import healthRoutes from "./modules/health/routes.js";
import authRoutes from "./modules/auth/routes.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.json());
app.use(morgan("dev"));

app.use(cookieParser());

// custom security middleware
app.use(securityMiddleware);



// Routes
// app.use("/health", healthRoutes);
app.use("/auth", authRoutes);


// Error handler
app.use(errorMiddleware);

export default app;
