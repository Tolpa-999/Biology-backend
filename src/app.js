// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import compression from "compression";

// import errorMiddleware from "./middleware/errors.js";
// import securityMiddleware from "./middleware/security.js";

// // Routes
// // import healthRoutes from "./modules/health/routes.js";
// import authRoutes from "./modules/auth/routes.js";
// import cookieParser from "cookie-parser";

// const app = express();


// ////////   conmmented in dev but important in vps ////////////////////
// // app.set("trust proxy", true);


// app.use(express.json());
// app.use(morgan("dev"));

// app.use(cookieParser());

// // custom security middleware
// app.use(securityMiddleware);



// // Routes
// // app.use("/health", healthRoutes);
// app.use("/auth", authRoutes);



// app.all(/.*/, (req, res) => {
//   res.status(404).json({ status: "error", message: "resource not available" });
// });


// // Error handler
// app.use(errorMiddleware);

// export default app





import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import errorMiddleware from './middleware/errors.js';
import securityMiddleware from './middleware/security.js';
import authRoutes from './modules/auth/routes.js';
import cookieParser from 'cookie-parser';

const app = express();

app.set('trust proxy', true); // Uncommented for VPS

app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(securityMiddleware);
app.use(cors({ origin: 'https://hazem-hamdi.com', credentials: true })); // Adjust CORS for frontend
app.use(compression());

app.use('/auth', authRoutes);

app.all(/.*/, (req, res) => {
  res.status(404).json({ status: "error", message: "resource not available" });
});


app.use(errorMiddleware);

export default app;
