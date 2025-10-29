// server/repositories/sessionEventRepository.js
import { prisma } from '../db.js'

const selectFields = {
  id: true,
  user_id: true,
  session_key: true,
  event_type: true,
  payload: true,
  occurred_at: true,
  created_at: true,
}

const mapEvent = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    sessionKey: row.session_key,
    eventType: row.event_type,
    payload: row.payload,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

const toDate = (v) => (v ? (v instanceof Date ? v : new Date(v)) : undefined)

/** 建立事件 */
export const createEvent = async ({ userId, sessionKey, eventType, payload, occurredAt }) => {
  const occurredAtDate = occurredAt ? toDate(occurredAt) : new Date()
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.session_events.create({
      data: {
        user_id: userId,
        session_key: sessionKey ?? null,
        event_type: eventType,
        payload: payload ?? null,
        occurred_at: occurredAtDate, // 與原本 NOW() 一致
      },
      select: selectFields,
    })

    await tx.study_group_members.updateMany({
      where: { user_id: userId },
      data: { last_seen_at: new Date() },
    })

    return created
  })
  return mapEvent(row)
}

/** 依使用者查事件（可選 sessionKey、from/to 區間；含分頁） */
export const listEventsByUser = async ({
  userId,
  from,
  to,
  sessionKey,
  limit = 200,
  offset = 0,
}) => {
  const where = {
    user_id: userId,
    ...(sessionKey ? { session_key: sessionKey } : {}),
    ...(from || to
      ? { occurred_at: { ...(from ? { gte: toDate(from) } : {}), ...(to ? { lte: toDate(to) } : {}) } }
      : {}),
  }

  const rows = await prisma.session_events.findMany({
    where,
    select: selectFields,
    orderBy: [{ occurred_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
    skip: offset,
  })

  return rows.map(mapEvent)
}

export default {
  createEvent,
  listEventsByUser,
}
