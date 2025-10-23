// server/repositories/categoryRepository.js
import { randomUUID } from 'crypto'
import { prisma } from '../db.js'

export const DEFAULT_CATEGORY_SEEDS = [
  // { id: 'deep-work', label: '深度工作' },
  // { id: 'learning',  label: '學習' },
  // { id: 'meeting',   label: '會議/討論' },
  // { id: 'break',     label: '安排休息' },
]

// 內部欄位 → 對外 camelCase
const mapCategory = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id ?? null,
    label: row.label,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const categorySelect = {
  id: true,
  user_id: true,
  label: true,
  is_default: true,
  created_at: true,
  updated_at: true,
}

// 1) 補種預設類別（只新增缺的；不覆寫 label）
export const ensureDefaultCategories = async () => {
  if (!DEFAULT_CATEGORY_SEEDS.length) return

  const seedIds = DEFAULT_CATEGORY_SEEDS.map(s => s.id)
  const existing = await prisma.categories.findMany({
    where: { id: { in: seedIds } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map(r => r.id))
  const missing = DEFAULT_CATEGORY_SEEDS.filter(s => !existingIds.has(s.id))
  if (!missing.length) return

  await prisma.categories.createMany({
    data: missing.map(s => ({ id: s.id, label: s.label, is_default: true })),
    skipDuplicates: true,
  })
}

// 2) 列表（userId 存在：預設 + 該用戶自訂；否則：只有預設）
export const listCategories = async ({ userId } = {}) => {
  const where = userId
    ? { OR: [{ is_default: true }, { user_id: userId }] }
    : { is_default: true }

  const rows = await prisma.categories.findMany({
    where,
    select: categorySelect,
    orderBy: [
      { is_default: 'desc' },    // 預設在前（true 排前）
      { created_at: 'asc' },
      { label: 'asc' },
    ],
  })
  return rows.map(mapCategory)
}

// 3) 建立（避免與預設或該用戶已有的 label 重複，大小寫不敏感）
export const createCategory = async ({ userId, label }) => {
  if (!userId) throw new Error('缺少 userId')
  const trimmed = (label ?? '').trim()
  if (!trimmed) throw new Error('label 是必填欄位')

  const dup = await prisma.categories.findFirst({
    where: {
      label: { equals: trimmed, mode: 'insensitive' },
      OR: [{ is_default: true }, { user_id: userId }],
    },
    select: { id: true },
  })
  if (dup) throw new Error('類別名稱已存在')

  const row = await prisma.categories.create({
    data: {
      id: randomUUID(),
      user_id: userId,
      label: trimmed,
      is_default: false,
    },
    select: categorySelect,
  })
  return mapCategory(row)
}

// 4) 刪除（僅限本人且非預設）
export const deleteCategory = async ({ userId, categoryId }) => {
  if (!userId) throw new Error('缺少 userId')

  // 先查到要刪的（帶條件），再刪；用交易確保一致性
  const [found] = await prisma.$transaction([
    prisma.categories.findFirst({
      where: { id: categoryId, user_id: userId, is_default: false },
      select: categorySelect,
    }),
  ])
  if (!found) return null

  await prisma.categories.delete({
    where: { id: categoryId }, // id 是主鍵；條件已在上一步過濾
  })
  return mapCategory(found)
}

export default {
  ensureDefaultCategories,
  listCategories,
  createCategory,
  deleteCategory,
}
