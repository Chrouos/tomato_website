// server/services/authService.js
import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { getEnv, getEnvNumber, isEnvTrue } from '../config/env.js'
import { findByEmail, createUser, updateUserProvider } from '../repositories/userRepository.js'
import {
  upsertVerificationCode,
  findVerificationByEmail,
  deleteVerificationByEmail,
} from '../repositories/emailVerificationRepository.js'

// ===== Env =====
const JWT_SECRET = getEnv('JWT_SECRET')
if (!JWT_SECRET) {
  console.warn('JWT_SECRET 未設定，請在 .env.local 中加入後再啟動伺服器。')
}
const JWT_EXPIRES_IN = getEnv('JWT_EXPIRES_IN', '7d')

const GOOGLE_CLIENT_ID = getEnv('GOOGLE_CLIENT_ID')
const VERIFICATION_CODE_EXP_MINUTES = getEnvNumber('EMAIL_VERIFICATION_CODE_EXP_MIN', 60)
const EXPOSE_VERIFICATION_CODE = isEnvTrue('EXPOSE_VERIFICATION_CODE', false)
const REQUIRE_GOOGLE_VERIFIED_EMAIL = isEnvTrue('REQUIRE_GOOGLE_VERIFIED_EMAIL', true)

// ===== Helpers =====
let googleClient
const getGoogleClient = () => {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID 未設定，無法進行 Google 登入。')
  if (!googleClient) googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)
  return googleClient
}

const sanitizeUser = (user) => {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}

const signToken = (user) => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET 未設定，無法產生 token。')
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// ===== Email 驗證碼：送碼 =====
export const requestEmailVerification = async ({ email }) => {
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error('缺少必要欄位 (email)')

  const existingUser = await findByEmail(normalized)
  if (existingUser) throw new Error('Email 已註冊，請改用登入或更換 Email')

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXP_MINUTES * 60 * 1000)

  const record = await upsertVerificationCode({ email: normalized, codeHash, expiresAt })

  if (EXPOSE_VERIFICATION_CODE) console.log(`[DEV] 驗證碼 (${normalized}): ${code}`)

  return {
    message: '驗證碼已寄送，請在 1 小時內完成註冊。',
    expiresAt: record.expiresAt,
    ...(EXPOSE_VERIFICATION_CODE ? { verificationCode: code } : {}),
  }
}

// ===== Email 註冊 =====
export const register = async ({ email, password, name, verificationCode }) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password || !name || verificationCode === undefined) {
    throw new Error('缺少必要欄位 (email, password, name, verificationCode)')
  }

  const existingUser = await findByEmail(normalizedEmail)
  if (existingUser) throw new Error('Email 已被使用，請改用登入或更換 Email')

  const verificationRecord = await findVerificationByEmail(normalizedEmail)
  if (!verificationRecord) throw new Error('請先索取 email 驗證碼')

  const expiresAt = new Date(verificationRecord.expiresAt).getTime()
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    await deleteVerificationByEmail(normalizedEmail)
    throw new Error('驗證碼已過期，請重新索取')
  }

  const normalizedCode = String(verificationCode).trim()
  if (normalizedCode.length === 0) throw new Error('請輸入驗證碼')
  if (!/^[0-9]{6}$/.test(normalizedCode)) throw new Error('驗證碼格式不正確')

  const isCodeMatch = await bcrypt.compare(normalizedCode, verificationRecord.codeHash)
  if (!isCodeMatch) throw new Error('驗證碼錯誤')

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await createUser({
    email: normalizedEmail,
    name,
    passwordHash,
    provider: 'local',
  })

  await deleteVerificationByEmail(normalizedEmail)

  const token = signToken(user)
  return { user: sanitizeUser(user), token }
}

// ===== Email 登入 =====
export const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password) throw new Error('缺少必要欄位 (email, password)')

  const user = await findByEmail(normalizedEmail)
  if (!user) throw new Error('帳號或密碼錯誤')

  if (!user.passwordHash) throw new Error('此帳號使用社群登入，請改用 Google 登入')

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) throw new Error('帳號或密碼錯誤')

  const token = signToken(user)
  return { user: sanitizeUser(user), token }
}

// ===== Google 登入（無則自動註冊） =====
export const loginWithGoogle = async ({ idToken }) => {
  if (!idToken) throw new Error('缺少 Google 驗證 token')

  let payload
  try {
    const client = getGoogleClient()
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch (e) {
    throw new Error('Google token 驗證失敗')
  }

  if (!payload) throw new Error('Google token 驗證失敗')

  const {
    email: rawEmail,
    name,
    sub: googleId,
    email_verified: emailVerified,
  } = payload

  const email = normalizeEmail(rawEmail)
  if (!email) throw new Error('Google 回傳資料中缺少 email，無法登入')
  if (REQUIRE_GOOGLE_VERIFIED_EMAIL && !emailVerified) throw new Error('Google 帳號尚未驗證 email')

  // 1) 找既有使用者（以 email 為準）
  let user = await findByEmail(email)

  // 2) 沒有就自動註冊（provider=google, 無本地密碼）
  if (!user) {
    user = await createUser({
      email,
      name: name ?? email.split('@')[0],
      provider: 'google',
      providerId: googleId, // 你的 users 表需有 providerId 欄位；若沒有可移除
    })
  } else if (user.provider !== 'google' || user.providerId !== googleId) {
    // 3) 已存在但不是 google，或 providerId 不一致 → 補上綁定
    user = await updateUserProvider({
      userId: user.id,
      provider: 'google',
      providerId: googleId,
    })
  }

  const token = signToken(user)
  return { user: sanitizeUser(user), token }
}

export default {
  requestEmailVerification,
  register,
  login,
  loginWithGoogle,
}
