import crypto from "crypto";

export function encrypt(text) {
  const cipher = crypto.createCipher("aes-256-cbc", process.env.JWT_SECRET);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decrypt(encrypted) {
  const decipher = crypto.createDecipher("aes-256-cbc", process.env.JWT_SECRET);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
