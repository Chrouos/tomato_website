import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

const JWT_SECRET = getEnv('JWT_SECRET');

if (!JWT_SECRET) {
  console.warn('JWT_SECRET 未設定，JWT 驗證將無法正常運作。');
}

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '缺少授權資訊' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: '無效或過期的 token' });
  }
};

export default authenticate;
