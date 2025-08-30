import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_RETRY_MAX: z.coerce.number().default(5),
  REDIS_RETRY_BACKOFF_MS: z.coerce.number().default(1000),

  // JWT & Auth
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  JWT_ACCESS_EXPIRY: z.string().default("30m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),


  // Telegram
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_DOMAIN: z.string(),
});

const env = envSchema.parse(process.env);

export default env;
