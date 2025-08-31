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

// Configure trust proxy for production (adjust based on your reverse proxy setup)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust the first proxy (e.g., Nginx, Cloudflare)
} else {
//   app.set('trust proxy', false); // Disable in development to avoid rate limit bypass
}

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

// CORS configuration

//  app.use(cors({ origin: 'https://hazem-hamdy.com', credentials: true,}));

app.use(compression());
app.use(helmet()); // Add security headers
app.use(securityMiddleware);

// Routes
app.use('/auth', authRoutes);

// 404 Handler
app.all(/.*/, (req, res) => {
  res.status(404).json({ status: 'error', message: 'resource not available' });
});

// Error Handler
app.use(errorMiddleware);

export default app;