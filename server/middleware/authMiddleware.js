import jwt from 'jsonwebtoken'
import { getEnv } from '../config/env.js'

const JWT_SECRET = getEnv('JWT_SECRET')

if (!JWT_SECRET) {
  console.warn('JWT_SECRET 未設定，JWT 驗證將無法正常運作。')
}

export const verifyAuthToken = (token) => {
  if (!token) {
    const error = new Error('缺少授權資訊')
    error.status = 401
    throw error
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return {
      id: payload.sub,
      email: payload.email,
    }
  } catch (error) {
    const authError = new Error('無效或過期的 token')
    authError.status = 401
    throw authError
  }
}

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  try {
    const user = verifyAuthToken(token)
    req.user = user
    return next()
  } catch (error) {
    return res.status(error.status ?? 401).json({ error: error.message })
  }
}

export default authenticate
