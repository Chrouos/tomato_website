// server/repositories/emailVerificationRepository.js
import { prisma } from '../db.js'

const selectFields = {
  email: true,
  code_hash: true,
  expires_at: true,
  created_at: true,
  updated_at: true,
}

const mapVerification = (row) => {
  if (!row) return null
  return {
    email: row.email,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const upsertVerificationCode = async ({ email, codeHash, expiresAt }) => {
  const row = await prisma.email_verification_codes.upsert({
    where: { email }, // email 是 @id
    create: { email, code_hash: codeHash, expires_at: expiresAt },
    // 你的 schema 沒有 @updatedAt，所以更新時手動寫 updated_at
    update: { code_hash: codeHash, expires_at: expiresAt, updated_at: new Date() },
    select: selectFields,
  })
  return mapVerification(row)
}

export const findVerificationByEmail = async (email) => {
  const row = await prisma.email_verification_codes.findUnique({
    where: { email },
    select: selectFields,
  })
  return mapVerification(row)
}

export const deleteVerificationByEmail = async (email) => {
  // 用 deleteMany 以保持「刪不存在也不丟錯」的語意
  await prisma.email_verification_codes.deleteMany({
    where: { email },
  })
}

export default {
  upsertVerificationCode,
  findVerificationByEmail,
  deleteVerificationByEmail,
}
