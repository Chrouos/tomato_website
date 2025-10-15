import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getEnv, getEnvNumber, isEnvTrue } from '../config/env.js';
import { findByEmail, createUser, updateUserProvider } from '../repositories/userRepository.js';
import {
  upsertVerificationCode,
  findVerificationByEmail,
  deleteVerificationByEmail,
} from '../repositories/emailVerificationRepository.js';

const JWT_SECRET = getEnv('JWT_SECRET');

if (!JWT_SECRET) {
  console.warn('JWT_SECRET 未設定，請在 .env.local 中加入後再啟動伺服器。');
}

const JWT_EXPIRES_IN = getEnv('JWT_EXPIRES_IN', '7d');

const GOOGLE_CLIENT_ID = getEnv('GOOGLE_CLIENT_ID');
const VERIFICATION_CODE_EXP_MINUTES = getEnvNumber('EMAIL_VERIFICATION_CODE_EXP_MIN', 60);
const EXPOSE_VERIFICATION_CODE = isEnvTrue('EXPOSE_VERIFICATION_CODE', false);

let googleClient;

const getGoogleClient = () => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID 未設定，無法進行 Google 登入。');
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }

  return googleClient;
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

const signToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 未設定，無法產生 token。');
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
};

export const requestEmailVerification = async ({ email }) => {
  if (!email) {
    throw new Error('缺少必要欄位 (email)');
  }

  const existingUser = await findByEmail(email);

  if (existingUser) {
    throw new Error('Email 已註冊，請改用登入或更換 Email');
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXP_MINUTES * 60 * 1000);

  const record = await upsertVerificationCode({
    email,
    codeHash,
    expiresAt,
  });

  if (EXPOSE_VERIFICATION_CODE) {
    console.log(`[DEV] 驗證碼 (${email}): ${code}`);
  }

  return {
    message: '驗證碼已寄送，請在 1 小時內完成註冊。',
    expiresAt: record.expiresAt,
    ...(EXPOSE_VERIFICATION_CODE ? { verificationCode: code } : {}),
  };
};

export const register = async ({ email, password, name, verificationCode }) => {
  if (!email || !password || !name || verificationCode === undefined) {
    throw new Error('缺少必要欄位 (email, password, name, verificationCode)');
  }

  const existingUser = await findByEmail(email);

  if (existingUser) {
    throw new Error('Email 已被使用，請改用登入或更換 Email');
  }

  const verificationRecord = await findVerificationByEmail(email);

  if (!verificationRecord) {
    throw new Error('請先索取 email 驗證碼');
  }

  const expiresAt = new Date(verificationRecord.expiresAt).getTime();
  const now = Date.now();

  if (Number.isNaN(expiresAt) || expiresAt < now) {
    await deleteVerificationByEmail(email);
    throw new Error('驗證碼已過期，請重新索取');
  }

  const normalizedCode = String(verificationCode).trim();

  if (normalizedCode.length === 0) {
    throw new Error('請輸入驗證碼');
  }

  if (!/^[0-9]{6}$/.test(normalizedCode)) {
    throw new Error('驗證碼格式不正確');
  }

  const isCodeMatch = await bcrypt.compare(normalizedCode, verificationRecord.codeHash);

  if (!isCodeMatch) {
    throw new Error('驗證碼錯誤');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await createUser({
    email,
    name,
    passwordHash,
    provider: 'local',
  });

  await deleteVerificationByEmail(email);

  const token = signToken(user);

  return { user: sanitizeUser(user), token };
};

export const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error('缺少必要欄位 (email, password)');
  }

  const user = await findByEmail(email);

  if (!user) {
    throw new Error('帳號或密碼錯誤');
  }

  if (!user.passwordHash) {
    throw new Error('此帳號使用社群登入，請改用 Google 登入');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new Error('帳號或密碼錯誤');
  }

  const token = signToken(user);

  return { user: sanitizeUser(user), token };
};

export const loginWithGoogle = async ({ idToken }) => {
  if (!idToken) {
    throw new Error('缺少 Google 驗證 token');
  }

  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error('Google token 驗證失敗');
  }

  const { email, name, sub: googleId, email_verified: emailVerified } = payload;

  if (!emailVerified && isEnvTrue('REQUIRE_GOOGLE_VERIFIED_EMAIL', true)) {
    throw new Error('Google 帳號尚未驗證 email');
  }

  if (!email) {
    throw new Error('Google 回傳資料中缺少 email，無法登入');
  }

  let user = await findByEmail(email);

  if (!user) {
    user = await createUser({
      email,
      name: name ?? email.split('@')[0],
      provider: 'google',
      providerId: googleId,
    });
  } else if (user.provider !== 'google' || user.providerId !== googleId) {
    user = await updateUserProvider({
      userId: user.id,
      provider: 'google',
      providerId: googleId,
    });
  }

  const token = signToken(user);

  return { user: sanitizeUser(user), token };
};

export default {
  requestEmailVerification,
  register,
  login,
  loginWithGoogle,
};
