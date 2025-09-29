// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import compression from "compression";
// import errorMiddleware from "./middleware/errors.js";
// import securityMiddleware from "./middleware/security.js";
// import authRoutes from "./modules/auth/routes.js";
// import userRoutes from "./modules/users/routes.js";
// import courseRoutes from "./modules/courses/routes.js";
// import lessonsRoutes from "./modules/lessons/routes.js";
// import videoRoutes from "./modules/videos/routes.js";
// import paymentRoutes from "./modules/payments/routes.js";
// import dashboardRoutes from "./modules/dashboard/routes.js";
// import cookieParser from "cookie-parser";
// import path from "path";
// import { fileURLToPath } from "url";
// import { createAdapter } from "@socket.io/redis-adapter";
// import { Server as SocketServer } from "socket.io";
// import { getRedisClient } from "./loaders/redis.js";
// import { verifyAccessToken } from "./utils/jwt.js";
// import logger from "./utils/logger.js";
// import http from "http";
// import prisma from "./loaders/prisma.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// const server = http.createServer(app);

// if (process.env.NODE_ENV === "production") {
//   app.set("trust proxy", 1);
// }

// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// app.use(morgan("dev"));
// app.use(cookieParser());

// const allowedOrigins = ["http://localhost:3000", "https://hazem-hamdy.com"];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.indexOf(origin) === -1) {
//         const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
//         return callback(new Error(msg), false);
//       }
//       return callback(null, true);
//     },
//     credentials: true,
//   })
// );

// app.use(compression());
// app.use(helmet());
// app.use(securityMiddleware);

// app.use(
//   "/uploads",
//   express.static(path.join(process.cwd(), "Uploads"), {
//     setHeaders: (res) => {
//       res.set("Cross-Origin-Resource-Policy", "cross-origin");
//     },
//   })
// );

// (async () => {
//   const redis = await getRedisClient();
//   const pubClient = redis.duplicate();
//   const subClient = redis.duplicate();

//   const io = new SocketServer(server, {
//     cors: { origin: allowedOrigins, credentials: true },
//     adapter: createAdapter(pubClient, subClient),
//   });

//   io.use(async (socket, next) => {
//     const token = socket.handshake.auth.token;
//     console.log('WebSocket auth attempt:', {
//       token: token ? token.substring(0, 10) + '...' : 'missing',
//       timestamp: new Date().toISOString(),
//     });
//     if (!token) return next(new Error("Authentication error"));
//     try {
//       const decoded = verifyAccessToken(token);
//       console.log('Token decoded:', {
//         userId: decoded.userId,
//         sessionVersion: decoded.sessionVersion,
//       });
//       const user = await prisma.user.findUnique({
//         where: { id: decoded.userId },
//         select: { sessionVersion: true, isActive: true },
//       });
//       console.log('User lookup:', {
//         userId: decoded.userId,
//         found: !!user,
//         isActive: user?.isActive,
//         sessionVersion: user?.sessionVersion,
//       });
//       if (
//         !user ||
//         !user.isActive ||
//         user.sessionVersion !== decoded.sessionVersion
//       ) {
//         return next(new Error("Invalid or expired session"));
//       }
//       socket.user = decoded;
//       next();
//     } catch (err) {
//       console.error('WebSocket auth error:', {
//         message: err.message,
//         token: token ? token.substring(0, 10) + '...' : 'missing',
//         timestamp: new Date().toISOString(),
//       });
//       next(new Error("Invalid token"));
//     }
//   });

//   io.on("connection", (socket) => {
//     logger.info(`WS connected: ${socket.id}`, {
//       userId: socket.user.userId,
//     });
//     const userId = socket.user.userId;

//     socket.on("subscribe", () => {
//       socket.join(`user:${userId}`);
//       logger.info(`User subscribed to room: user:${userId}`);
//     });

//     socket.on("disconnect", () => {
//       logger.info(`WS disconnected: ${socket.id}`);
//     });
//   });
// })();

// app.use("/api/videos", videoRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/courses", courseRoutes);
// app.use("/api/lessons", lessonsRoutes);
// app.use("/api/admin/dashboard", dashboardRoutes);
// app.use("/api/payment", paymentRoutes);

// app.all(/.*/, (req, res) => {
//   res.status(404).json({ status: "error", message: "resource not available" });
// });

// app.use(errorMiddleware);

// export default server;

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

const allowedOrigins = ["http://localhost:3000", "https://hazem-hamdy.com", "https://www.hazem-hamdy.com"];

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


(async () => {
  const redis = await getRedisClient();
  
  // Test Redis connection
  try {
    await redis.ping();
    logger.info('Redis connection successful');
  } catch (err) {
    logger.error('Redis connection failed:', err);
    return;
  }

  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  // Test pub/sub functionality
  subClient.on('subscribe', (channel, count) => {
    logger.info(`Subscribed to channel: ${channel}, total subscriptions: ${count}`);
  });

  subClient.on('message', (channel, message) => {
    logger.info(`Raw Redis message received on ${channel}:`, message);
  });

  const io = new SocketServer(server, {
    cors: { origin: allowedOrigins, credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

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
      if (
        !user ||
        !user.isActive ||
        user.sessionVersion !== decoded.sessionVersion
      ) {
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
      // NEW: Log clients in room
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

  // First, subscribe to the channel
subClient.subscribe('user:force_logout', (err, count) => {
  if (err) {
    logger.error('Failed to subscribe to user:force_logout:', err);
  } else {
    logger.info(`Subscribed to user:force_logout, total subscriptions: ${count}`);
  }
});

// Then, handle messages using the 'message' event
subClient.on('message', async (channel, message) => {
  try {
    logger.info(`Received Redis message on channel: ${channel}`, {
      message,
      timestamp: new Date().toISOString(),
    });
    
    if (channel === 'user:force_logout') {
      const parsed = JSON.parse(message);
      if (parsed.event === 'force_logout' && parsed.userId) {
        const userId = parsed.userId;
        
        const clients = await io.in(`user:${userId}`).allSockets();
        
        logger.info(`Emittingggg force_logout ----------- to room: user:${userId}`, {
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






  
})();

app.use("/api/videos", videoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/quiz", quizzesRoutes);

app.all(/.*/, (req, res) => {
  res.status(404).json({ status: "error", message: "resource not available" });
});

app.use(errorMiddleware);

export default server;