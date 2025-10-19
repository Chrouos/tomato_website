import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

const JWT_SECRET = getEnv('JWT_SECRET');

if (!JWT_SECRET) {
  console.warn('JWT_SECRET 未設定，部分授權功能將無法運作。');
}

export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
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

export default optionalAuthenticate;
