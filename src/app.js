import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import errorMiddleware from "./middleware/errors.js";
import securityMiddleware from "./middleware/security.js";
import authRoutes from "./modules/auth/routes.js";
import userRoutes from "./modules/users/routes.js";
import courseRoutes from "./modules/courses/routes.js";
import lessonsRoutes from "./modules/lessons/routes.js";
import videoRoutes from "./modules/videos/routes.js";
import paymentRoutes from "./modules/payments/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import quizzesRoutes from "./modules/quizzes/routes.js";
import progressRoutes from "./modules/progress/routes.js";
import duplicationRoutes from "./modules/duplication/routes.js";


import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server as SocketServer } from "socket.io";
import { getRedisClient } from "./loaders/redis.js";
import { verifyAccessToken } from "./utils/jwt.js";
import logger from "./utils/logger.js";
import http from "http";
import prisma from "./loaders/prisma.js";


  


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");   // <--- put it here
const server = http.createServer(app);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:3000",
  "https://hazem-hamdy.com",
  "https://www.hazem-hamdy.com"
  ]; 

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);


app.use(securityMiddleware);

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("X-Content-Type-Options", "nosniff");

    },
  })
);


// Initialize Socket.IO immediately
const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  // Don't use Redis adapter initially until Redis is ready
});

// Socket.IO middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('WebSocket auth attempt:', {
    token: token ? token.substring(0, 10) + '...' : 'missing',
    timestamp: new Date().toISOString(),
  });
  
  if (!token) {
    console.log('WebSocket auth error: No token provided');
    return next(new Error("Authentication error"));
  }
  
  try {
    const decoded = verifyAccessToken(token);
    console.log('Token decoded:', {
      userId: decoded.userId,
      sessionVersion: decoded.sessionVersion,
      timestamp: new Date().toISOString(),
    });
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { sessionVersion: true, isActive: true },
    });
    
    console.log('User lookup:', {
      userId: decoded.userId,
      found: !!user,
      isActive: user?.isActive,
      sessionVersion: user?.sessionVersion,
      timestamp: new Date().toISOString(),
    });
    
    if (!user || !user.isActive || user.sessionVersion !== decoded.sessionVersion) {
      console.log('WebSocket auth error:', {
        userFound: !!user,
        isActive: user?.isActive,
        sessionVersionMatch: user?.sessionVersion === decoded.sessionVersion,
        timestamp: new Date().toISOString(),
      });
      return next(new Error("Invalid or expired session"));
    }
    
    socket.user = decoded;
    next();
  } catch (err) {
    console.error('WebSocket auth error:', {
      message: err.message,
      token: token ? token.substring(0, 10) + '...' : 'missing',
      timestamp: new Date().toISOString(),
    });
    next(new Error("Invalid token"));
  }
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  logger.info(`WS connected: ${socket.id}`, {
    userId: socket.user.userId,
    timestamp: new Date().toISOString(),
  });
  
  const userId = socket.user.userId;

  socket.on("subscribe", () => {
    socket.join(`user:${userId}`);
    logger.info(`User subscribed to room: user:${userId}`, {
      timestamp: new Date().toISOString(),
    });
    
    // Log clients in room
    io.in(`user:${userId}`).allSockets().then((clients) => {
      logger.info(`Clients in room user:${userId}`, {
        clientCount: clients.size,
        clientIds: Array.from(clients),
        timestamp: new Date().toISOString(),
      });
    });
  });

  socket.on("disconnect", () => {
    logger.info(`WS disconnected: ${socket.id}`, {
      userId,
      timestamp: new Date().toISOString(),
    });
  });
});

// Initialize Redis and setup pub/sub in background
(async () => {
  try {
    const redis = await getRedisClient();
    await redis.ping();
    logger.info('Redis connection successful');

    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    // Handle pub/sub client errors
    pubClient.on('error', (err) => {
      logger.error('Redis pub client error:', err);
    });

    subClient.on('error', (err) => {
      logger.error('Redis sub client error:', err);
    });

    // Update Socket.IO to use Redis adapter
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter enabled');

    // Subscribe to force_logout channel
    await subClient.subscribe('user:force_logout');
    logger.info('Subscribed to user:force_logout channel');

    // Message handler for force_logout
    subClient.on('message', async (channel, message) => {
      try {
        if (channel === 'user:force_logout') {
          const parsed = JSON.parse(message);
          if (parsed.event === 'force_logout' && parsed.userId) {
            const userId = parsed.userId;
            
            const clients = await io.in(`user:${userId}`).allSockets();
            
            logger.info(`Emitting force_logout to room: user:${userId}`, {
              clientCount: clients.size,
              clientIds: Array.from(clients),
              timestamp: new Date().toISOString(),
            });
            
            io.to(`user:${userId}`).emit('force_logout', {
              reason: 'Session invalidated by new login',
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        logger.error('Error handling Redis message:', {
          error: err.message,
          channel,
          message,
          timestamp: new Date().toISOString(),
        });
      }
    });

  } catch (err) {
    logger.error('Failed to initialize Redis for Socket.IO:', err);
    // Socket.IO will continue working without Redis, just without clustering
  }
})();


app.use("/api/videos", videoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/quiz", quizzesRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/duplication", duplicationRoutes);

app.all(/.*/, (req, res) => {
  res.status(404).json({ status: "error", message: "resource not available" });
});

app.use(errorMiddleware);


const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  try {
    // 1. Close Socket.IO
    io.sockets.sockets.forEach((socket) => socket.disconnect(true));
    logger.info('Socket.IO connections closed.');

    // 2. Close HTTP server
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info('HTTP server closed.');

    // 3. Close Prisma
    await prisma.$disconnect();
    logger.info('Prisma disconnected.');

    // 4. Quit Redis (use your getRedisClient logic safely)
    try {
      const redis = await getRedisClient();
      if (redis && redis.status === 'ready') await redis.quit();
      logger.info('Redis disconnected.');
    } catch (err) {
      logger.warn('Redis disconnection failed:', err.message);
    }

    logger.info('✅ Graceful shutdown complete.');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

// Register signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));



export default server;