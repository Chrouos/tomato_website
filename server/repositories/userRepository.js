// server/repositories/userRepository.js
import { prisma } from '../db.js'

const selectFields = {
  id: true,
  email: true,
  name: true,
  password_hash: true,
  provider: true,
  provider_id: true,
  created_at: true,
  updated_at: true,
}

const mapUser = (row) => {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    provider: row.provider,
    providerId: row.provider_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const findByEmail = async (email) => {
  const row = await prisma.users.findUnique({
    where: { email },
    select: selectFields,
  })
  return mapUser(row)
}

export const findById = async (id) => {
  const row = await prisma.users.findUnique({
    where: { id },
    select: selectFields,
  })
  return mapUser(row)
}

export const createUser = async ({ email, name, passwordHash, provider, providerId }) => {
  const row = await prisma.users.create({
    data: {
      email,
      name,
      password_hash: passwordHash ?? null,
      provider: provider ?? 'local',     // 與原行為一致；也可改成省略以吃 DB default
      provider_id: providerId ?? null,
      // created_at / updated_at 交由 DB default(now())
    },
    select: selectFields,
  })
  return mapUser(row)
}

export const updateUserProvider = async ({ userId, provider, providerId }) => {
  const row = await prisma.users.update({
    where: { id: userId },
    data: {
      provider,
      provider_id: providerId ?? null,
      updated_at: new Date(), // schema 未使用 @updatedAt，手動更新
    },
    select: selectFields,
  })
  return mapUser(row)
}

export const updatePassword = async ({ userId, passwordHash }) => {
  const row = await prisma.users.update({
    where: { id: userId },
    data: {
      password_hash: passwordHash,
      updated_at: new Date(), // 手動更新
    },
    select: selectFields,
  })
  return mapUser(row)
}

export default {
  findByEmail,
  findById,
  createUser,
  updateUserProvider,
  updatePassword,
}
