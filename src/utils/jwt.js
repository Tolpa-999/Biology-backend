import jwt from 'jsonwebtoken';
import env from '../config/index.js';

const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET; // Add to .env
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET; // Add to .env, different from ACCESS

export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '60d' });
}

export function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '60d' });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}