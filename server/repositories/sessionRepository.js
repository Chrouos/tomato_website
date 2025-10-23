// server/repositories/sessionRepository.js
import { prisma } from '../db.js'

const selectFields = {
  id: true,
  user_id: true,
  duration_seconds: true,
  category_id: true,
  category_label: true,
  started_at: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
}

const mapSession = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    durationSeconds: row.duration_seconds,
    categoryId: row.category_id,
    categoryLabel: row.category_label,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toDate = (v) => (v ? (v instanceof Date ? v : new Date(v)) : null)

// 建立 Session
export const createSession = async ({
  userId,
  durationSeconds,
  categoryId,
  categoryLabel,
  startedAt,
  completedAt,
}) => {
  const row = await prisma.sessions.create({
    data: {
      user_id: userId,
      duration_seconds: durationSeconds,
      category_id: categoryId ?? null,
      category_label: categoryLabel ?? null,
      started_at: toDate(startedAt),
      completed_at: toDate(completedAt),
      // created_at/updated_at 由 DB default(now()) 填
    },
    select: selectFields,
  })
  return mapSession(row)
}

// 依使用者列出 Sessions（completed_at DESC NULLS LAST, created_at DESC）
export const listSessionsByUser = async ({ userId, limit = 50, offset = 0 }) => {
  const rows = await prisma.sessions.findMany({
    where: { user_id: userId },
    select: selectFields,
    orderBy: [
      // Prisma 6 寫法：指定 nulls 排序
      { completed_at: { sort: 'desc', nulls: 'last' } },
      { created_at: 'desc' },
    ],
    take: limit,
    skip: offset,
  })
  return rows.map(mapSession)
}

export default {
  createSession,
  listSessionsByUser,
}
