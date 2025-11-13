import { prisma } from '../db.js'

const mapMessage = (row) => {
  if (!row) return null
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    senderName: row.sender?.name ?? null,
  }
}

export const listGroupMessages = async ({ userId, groupId, limit = 100 }) => {
  const membership = await prisma.study_group_members.findFirst({
    where: { group_id: groupId, user_id: userId },
    select: { id: true },
  })
  if (!membership) {
    return []
  }

  const rows = await prisma.study_group_messages.findMany({
    where: { group_id: groupId },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
    take: limit,
  })

  return rows.reverse().map(mapMessage)
}

export const createGroupMessage = async ({ userId, groupId, content }) => {
  const membership = await prisma.study_group_members.findFirst({
    where: { group_id: groupId, user_id: userId },
    select: { id: true },
  })
  if (!membership) {
    throw new Error('你不在此共讀群組中')
  }

  const trimmed = typeof content === 'string' ? content.trim() : ''
  if (!trimmed) {
    throw new Error('訊息不可為空白')
  }
  if (trimmed.length > 1000) {
    throw new Error('訊息長度不可超過 1000 字')
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.study_group_members.updateMany({
      where: { group_id: groupId, user_id: userId },
      data: { last_seen_at: new Date() },
    })

    return tx.study_group_messages.create({
      data: {
        group_id: groupId,
        sender_id: userId,
        content: trimmed,
      },
      include: { sender: { select: { id: true, name: true } } },
    })
  })

  return mapMessage(row)
}

export default {
  listGroupMessages,
  createGroupMessage,
}
