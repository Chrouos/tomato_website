// server/repositories/dailyTaskRepository.js
import { prisma } from '../db.js'

// ── 共用：DB→API 映射 ─────────────────────────────────────────
const mapDailyTask = (row, completion = null) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: row.category_id,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedToday: !!completion,
    completionId: completion?.id ?? null,
    completedOn: completion?.completed_on ?? null,
    completedAt: completion?.created_at ?? null,
  }
}

const dailyTaskSelect = {
  id: true,
  user_id: true,
  title: true,
  category_id: true,
  archived: true,
  created_at: true,
  updated_at: true,
}

const completionSelect = {
  id: true,
  daily_task_id: true,
  completed_on: true,
  created_at: true,
  updated_at: true,
}

// 小工具：把 'YYYY-MM-DD' 轉成 Date（UTC 00:00）
const toDate = (d) => (d instanceof Date ? d : new Date(`${d}T00:00:00.000Z`))

// ── 1) 列表（含當天是否完成） ─────────────────────────────────
export const listDailyTasks = async ({ userId, date }) => {
  const completedOn = toDate(date)

  const rows = await prisma.daily_tasks.findMany({
    where: { user_id: userId, archived: false },
    select: {
      ...dailyTaskSelect,
      daily_task_completions: {
        where: { completed_on: completedOn },
        select: completionSelect,
        take: 1, // 每天最多一筆
      },
    },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  })

  return rows.map((r) => mapDailyTask(r, r.daily_task_completions[0]))
}

// ── 2) 建立 ───────────────────────────────────────────────────
export const createDailyTask = async ({ userId, title, categoryId }) => {
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('title 是必填欄位')
  }
  const row = await prisma.daily_tasks.create({
    data: {
      user_id: userId,
      title: title.trim(),
      category_id: categoryId ?? null,
      // created_at/updated_at 由 DB default(now()) 填
    },
    select: dailyTaskSelect,
  })
  return mapDailyTask(row)
}

// ── 3) 更新（僅允許 title / categoryId；需本人且未封存） ────────
export const updateDailyTask = async ({ userId, taskId, title, categoryId }) => {
  const existing = await prisma.daily_tasks.findFirst({
    where: { id: taskId, user_id: userId, archived: false },
    select: dailyTaskSelect,
  })
  if (!existing) return null

  const data = {}
  if (typeof title === 'string') data.title = title.trim()
  if (categoryId !== undefined) data.category_id = categoryId ?? null

  if (Object.keys(data).length === 0) {
    return mapDailyTask(existing)
  }

  // Prisma 不會自動改 updated_at（你的 schema 沒 @updatedAt），手動設
  data.updated_at = new Date()

  const row = await prisma.daily_tasks.update({
    where: { id: taskId },
    data,
    select: dailyTaskSelect,
  })
  return mapDailyTask(row)
}

// ── 4) 封存（需本人且未封存） ─────────────────────────────────
export const archiveDailyTask = async ({ userId, taskId }) => {
  const existing = await prisma.daily_tasks.findFirst({
    where: { id: taskId, user_id: userId, archived: false },
    select: dailyTaskSelect,
  })
  if (!existing) return null

  const row = await prisma.daily_tasks.update({
    where: { id: taskId },
    data: { archived: true, updated_at: new Date() },
    select: dailyTaskSelect,
  })
  return mapDailyTask(row)
}

// ── 5) 標記完成（upsert by 唯一鍵 (daily_task_id, completed_on)） ──
export const markDailyTaskCompleted = async ({ userId, taskId, date }) => {
  const completedOn = toDate(date)

  return await prisma.$transaction(async (tx) => {
    // 驗證任務歸屬且未封存
    const ok = await tx.daily_tasks.findFirst({
      where: { id: taskId, user_id: userId, archived: false },
      select: { id: true },
    })
    if (!ok) return null

    const row = await tx.daily_task_completions.upsert({
      where: {
        daily_task_id_completed_on: {
          daily_task_id: taskId,
          completed_on: completedOn,
        },
      },
      create: { daily_task_id: taskId, completed_on: completedOn },
      update: { updated_at: new Date() },
      select: completionSelect,
    })
    return row
  })
}

// ── 6) 取消當天完成（刪除該日完成紀錄；需本人且未封存） ────────
export const resetDailyTaskCompletion = async ({ userId, taskId, date }) => {
  const completedOn = toDate(date)

  return await prisma.$transaction(async (tx) => {
    const task = await tx.daily_tasks.findFirst({
      where: { id: taskId, user_id: userId, archived: false },
      select: { id: true },
    })
    if (!task) return null

    const found = await tx.daily_task_completions.findUnique({
      where: {
        daily_task_id_completed_on: {
          daily_task_id: taskId,
          completed_on: completedOn,
        },
      },
      select: completionSelect,
    })
    if (!found) return null

    await tx.daily_task_completions.delete({
      where: {
        daily_task_id_completed_on: {
          daily_task_id: taskId,
          completed_on: completedOn,
        },
      },
    })
    return found
  })
}

export default {
  listDailyTasks,
  createDailyTask,
  updateDailyTask,
  archiveDailyTask,
  markDailyTaskCompleted,
  resetDailyTaskCompletion,
}
