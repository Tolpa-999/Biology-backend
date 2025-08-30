import crypto from "crypto";
import config from "../config/index.js";

export function verifyTelegramAuth(data) {
  const { hash, ...userData } = data;
  const secret = crypto.createHash("sha256").update(config.telegramBotToken).digest();
  const checkString = Object.keys(userData)
    .sort()
    .map((k) => `${k}=${userData[k]}`)
    .join("\n");

  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  return hmac === hash && Date.now() / 1000 - userData.auth_date < 86400; // Valid < 24h
}
