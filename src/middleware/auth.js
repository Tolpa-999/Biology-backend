import { verifyAccessToken } from '../utils/jwt.js';

export default function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    console.log("req.user => ", req?.user)
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}