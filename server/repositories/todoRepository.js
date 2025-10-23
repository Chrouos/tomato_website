// server/repositories/todoRepository.js
import { prisma } from '../db.js'

// （可選）一鍵補欄位：若你尚未用 migration 加上 due_at，可暫時使用；完成後建議刪除。
export const ensureTodoSchema = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS todos
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
  `)
}

// ---- DB → API 映射（snake_case → camelCase） ----
const mapTodo = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: row.category_id,
    completed: row.completed,
    completedAt: row.completed_at,
    dueAt: row.due_at ?? null,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const selectFields = {
  id: true,
  user_id: true,
  title: true,
  category_id: true,
  completed: true,
  completed_at: true,
  due_at: true,
  archived: true,
  created_at: true,
  updated_at: true,
}

const toDateOrNull = (v) => (v == null ? null : (v instanceof Date ? v : new Date(v)))

// ---- 列表：未封存 + 排序 completed ASC, due_at NULLS LAST + ASC, updated_at DESC ----
export const listTodos = async ({ userId }) => {
  const rows = await prisma.todos.findMany({
    where: { user_id: userId, archived: false },
    select: selectFields,
    orderBy: [
      { completed: 'asc' },
      // 等價 `due_at IS NULL, due_at ASC` → 以 nulls: 'last' + sort: 'asc'
      { due_at: { sort: 'asc', nulls: 'last' } },
      { updated_at: 'desc' },
    ],
  })
  return rows.map(mapTodo)
}

// ---- 建立 ----
export const createTodo = async ({ userId, title, categoryId, dueAt }) => {
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('title 是必填欄位')
  }
  const row = await prisma.todos.create({
    data: {
      user_id: userId,
      title: title.trim(),
      category_id: categoryId ?? null,
      due_at: toDateOrNull(dueAt),
      // created_at/updated_at 交給 DB default(now())
    },
    select: selectFields,
  })
  return mapTodo(row)
}

// ---- 更新（僅更新 title/categoryId/dueAt；需本人且未封存）----
export const updateTodo = async ({ userId, todoId, title, categoryId, dueAt }) => {
  const current = await prisma.todos.findFirst({
    where: { id: todoId, user_id: userId, archived: false },
    select: selectFields,
  })
  if (!current) return null

  const data = {}
  if (typeof title === 'string') data.title = title.trim()
  if (categoryId !== undefined) data.category_id = categoryId ?? null
  if (dueAt !== undefined) data.due_at = toDateOrNull(dueAt)

  if (Object.keys(data).length === 0) return mapTodo(current)

  // 你的 schema 沒 @updatedAt，手動更新
  data.updated_at = new Date()

  const row = await prisma.todos.update({
    where: { id: todoId },
    data,
    select: selectFields,
  })
  return mapTodo(row)
}

// ---- 勾/取消完成（需本人且未封存）----
export const setTodoCompletion = async ({ userId, todoId, completed }) => {
  const current = await prisma.todos.findFirst({
    where: { id: todoId, user_id: userId, archived: false },
    select: { id: true },
  })
  if (!current) return null

  const row = await prisma.todos.update({
    where: { id: todoId },
    data: {
      completed: !!completed,
      completed_at: completed ? new Date() : null,
      updated_at: new Date(),
    },
    select: selectFields,
  })
  return mapTodo(row)
}

// ---- 封存（需本人且未封存）----
export const archiveTodo = async ({ userId, todoId }) => {
  const current = await prisma.todos.findFirst({
    where: { id: todoId, user_id: userId, archived: false },
    select: selectFields,
  })
  if (!current) return null

  const row = await prisma.todos.update({
    where: { id: todoId },
    data: { archived: true, updated_at: new Date() },
    select: selectFields,
  })
  return mapTodo(row)
}

export default {
  ensureTodoSchema,
  listTodos,
  createTodo,
  updateTodo,
  setTodoCompletion,
  archiveTodo,
}
