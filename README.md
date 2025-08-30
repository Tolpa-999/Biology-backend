# Biology Platform Backend

A scalable, secure, and high-performance Express.js backend for an educational platform.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup PostgreSQL**:
   - Install PostgreSQL 16 locally.
   - Create database: `psql -U postgres -c "CREATE DATABASE biologydb;"`.
   - Update `.env` with `DATABASE_URL`.

3. **Setup Redis**:
   - Install Redis locally and ensure it runs on `localhost:6379`.
   - Update `.env` with `REDIS_URL`.

4. **Initialize Prisma**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. **Run**:
   - Development: `npm run dev`
   - Production: `npm start`
   - Clustering: `pm2 start src/server.js -i max`

6. **Test**:
   ```bash
   npm test
   ```

7. **API Docs**:
   - Access at `http://localhost:5000/api-docs`.

## Structure
- **src/app.js**: Express app setup.
- **src/server.js**: Server entry point.
- **src/config/**: Environment configuration.
- **src/loaders/**: Initializes Prisma, Redis, BullMQ.
- **src/middleware/**: Security, auth, RBAC, rate limiting, validation, error handling.
- **src/utils/**: Logging, JWT, password hashing, encryption, caching.
- **src/modules/**: Feature modules (health, auth, users, courses, webhooks).
- **src/workers/**: Background job processing with BullMQ.

## Features
- **Scalability**: Redis caching, BullMQ queues, pm2 clustering.
- **Security**: JWT, RBAC, helmet, rate limiting, input validation.
- **Reliability**: Centralized error handling, Pino logging.
- **Performance**: Compression, caching, optimized queries.# Biology-backend
