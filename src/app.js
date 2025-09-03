import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import errorMiddleware from './middleware/errors.js';
import securityMiddleware from './middleware/security.js';

// routes
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import courseRoutes from './modules/courses/routes.js';
import lessonsRoutes from './modules/lessons/routes.js';

import cookieParser from 'cookie-parser';


import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// Configure trust proxy for production (adjust based on your reverse proxy setup)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust the first proxy (e.g., Nginx, Cloudflare)
} else {
//   app.set('trust proxy', false); // Disable in development to avoid rate limit bypass
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(cookieParser());

// CORS configuration
// app.use(cors({ origin: 'https://hazem-hamdy.com', credentials: true,}));


// Allow multiple origins
const allowedOrigins = ['http://localhost:3000', 'https://hazem-hamdy.com'];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(compression());
app.use(helmet());
app.use(securityMiddleware);

// Serve uploads statically with proper cross-origin header
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));




// routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonsRoutes);

// 404 Handler
app.all(/.*/, (req, res) => {
  res.status(404).json({ status: 'error', message: 'resource not available' });
});

// Error Handler
app.use(errorMiddleware);

export default app;