import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

const CREDIT_REASON_SESSION = 'session_complete'
const CREDIT_REASON_SEND = 'send_letter'

const LETTER_STATUS_DELIVERED = 'delivered'
const LETTER_STATUS_REPLIED = 'replied'

const mapLetter = (row) => {
  if (!row) return null
  return {
    id: row.id,
    senderMessage: row.sender_message,
    replyMessage: row.reply_message,
    senderSentAt: row.sender_sent_at,
    recipientRepliedAt: row.recipient_replied_at,
    recipientReadAt: row.recipient_read_at,
    senderReplyReadAt: row.sender_reply_read_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const sanitizeLetterForRecipient = (row) => {
  if (!row) return null
  return {
    id: row.id,
    message: row.sender_message,
    sentAt: row.sender_sent_at,
    reply: row.reply_message
      ? {
          message: row.reply_message,
          sentAt: row.recipient_replied_at,
          readBySender: Boolean(row.sender_reply_read_at),
        }
      : null,
    readAt: row.recipient_read_at,
    canReply: row.reply_message == null,
    status: row.status,
  }
}

const sanitizeLetterForSender = (row) => {
  if (!row) return null
  return {
    id: row.id,
    yourMessage: row.sender_message,
    sentAt: row.sender_sent_at,
    reply: row.reply_message
      ? {
          message: row.reply_message,
          sentAt: row.recipient_replied_at,
          isRead: Boolean(row.sender_reply_read_at),
        }
      : null,
    status: row.status,
  }
}

const adjustCreditsTx = async (tx, { userId, amount, reason, referenceId = null }) => {
  if (!amount) return { credits: null, event: null }

  const rows = await tx.$queryRaw`
    SELECT credits
    FROM encouragement_balances
    WHERE user_id = CAST(${userId} AS uuid)
    FOR UPDATE
  `

  let nextCredits = amount

  if (rows.length === 0) {
    if (amount < 0) {
      throw new Error('剩餘額度不足')
    }
    await tx.encouragement_balances.create({
      data: {
        user_id: userId,
        credits: nextCredits,
      },
    })
  } else {
    const current = Number(rows[0].credits)
    nextCredits = current + amount
    if (nextCredits < 0) {
      throw new Error('剩餘額度不足')
    }
    await tx.encouragement_balances.update({
      where: { user_id: userId },
      data: { credits: nextCredits },
    })
  }

  const event = await tx.encouragement_credit_events.create({
    data: {
      user_id: userId,
      change: amount,
      reason,
      reference_id: referenceId,
    },
  })

  return { credits: nextCredits, event }
}

export const grantCreditForSession = async ({ userId, sessionId, amount = 1 }) => {
  if (amount <= 0) return
  try {
    await prisma.$transaction(async (tx) => {
      await adjustCreditsTx(tx, {
        userId,
        amount,
        reason: CREDIT_REASON_SESSION,
        referenceId: sessionId,
      })
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // already granted for this session
      return
    }
    throw error
  }
}

const pickRandomRecipientTx = async (tx, { excludeUserId }) => {
  const rows = await tx.$queryRaw`
    SELECT id
    FROM users
    WHERE id <> CAST(${excludeUserId} AS uuid)
    ORDER BY random()
    LIMIT 1
  `
  if (rows.length === 0) {
    const fallback = await tx.$queryRaw`
      SELECT id
      FROM users
      WHERE id = CAST(${excludeUserId} AS uuid)
      LIMIT 1
    `
    return fallback[0]?.id ?? null
  }
  return rows[0].id
}

export const createEncouragementLetter = async ({ senderId, message }) => {
  const content = typeof message === 'string' ? message.trim() : ''
  if (!content) {
    throw new Error('訊息內容不可為空白')
  }
  if (content.length > 2000) {
    throw new Error('訊息長度不可超過 2000 字')
  }

  return prisma.$transaction(async (tx) => {
    const recipientId = await pickRandomRecipientTx(tx, { excludeUserId: senderId })
    if (!recipientId) {
      throw new Error('目前沒有其他使用者可以配對，稍後再試一次')
    }

    const { event } = await adjustCreditsTx(tx, {
      userId: senderId,
      amount: -1,
      reason: CREDIT_REASON_SEND,
      referenceId: null,
    })

    const letter = await tx.encouragement_letters.create({
      data: {
        sender_id: senderId,
        recipient_id: recipientId,
        sender_message: content,
        status: LETTER_STATUS_DELIVERED,
      },
    })

    if (event) {
      await tx.encouragement_credit_events.update({
        where: { id: event.id },
        data: { reference_id: letter.id },
      })
    }

    return {
      letter: mapLetter(letter),
      recipientId,
    }
  })
}

export const listInboxLetters = async ({ userId }) => {
  const rows = await prisma.encouragement_letters.findMany({
    where: { recipient_id: userId },
    orderBy: [{ sender_sent_at: 'desc' }],
  })
  return rows.map(sanitizeLetterForRecipient)
}

export const listSentLetters = async ({ userId }) => {
  const rows = await prisma.encouragement_letters.findMany({
    where: { sender_id: userId },
    orderBy: [{ sender_sent_at: 'desc' }],
  })
  return rows.map(sanitizeLetterForSender)
}

export const getEncouragementSummary = async ({ userId }) => {
  const balance = await prisma.encouragement_balances.findUnique({
    where: { user_id: userId },
  })

  const [unreadCount, awaitingReplyCount, pendingRepliesForSender] = await Promise.all([
    prisma.encouragement_letters.count({
      where: {
        recipient_id: userId,
        recipient_read_at: null,
      },
    }),
    prisma.encouragement_letters.count({
      where: {
        recipient_id: userId,
        reply_message: null,
      },
    }),
    prisma.encouragement_letters.count({
      where: {
        sender_id: userId,
        reply_message: { not: null },
        sender_reply_read_at: null,
      },
    }),
  ])

  return {
    credits: balance?.credits ?? 0,
    unreadLetters: unreadCount,
    awaitingReply: awaitingReplyCount,
    unreadReplies: pendingRepliesForSender,
  }
}

export const markLetterRead = async ({ userId, letterId }) => {
  return prisma.encouragement_letters.updateMany({
    where: {
      id: letterId,
      recipient_id: userId,
      recipient_read_at: null,
    },
    data: {
      recipient_read_at: new Date(),
    },
  })
}

export const markReplyRead = async ({ userId, letterId }) => {
  return prisma.encouragement_letters.updateMany({
    where: {
      id: letterId,
      sender_id: userId,
      reply_message: { not: null },
      sender_reply_read_at: null,
    },
    data: {
      sender_reply_read_at: new Date(),
    },
  })
}

export const replyToEncouragementLetter = async ({ userId, letterId, message }) => {
  const content = typeof message === 'string' ? message.trim() : ''
  if (!content) {
    throw new Error('回覆內容不可為空白')
  }
  if (content.length > 2000) {
    throw new Error('回覆內容不可超過 2000 字')
  }

  const letter = await prisma.encouragement_letters.findUnique({
    where: { id: letterId },
    select: {
      id: true,
      recipient_id: true,
      reply_message: true,
    },
  })

  if (!letter || letter.recipient_id !== userId) {
    throw new Error('無法回覆這封信件')
  }
  if (letter.reply_message) {
    throw new Error('這封信已經回覆過了')
  }

  const updated = await prisma.encouragement_letters.update({
    where: { id: letterId },
    data: {
      reply_message: content,
      recipient_replied_at: new Date(),
      status: LETTER_STATUS_REPLIED,
    },
  })

  return mapLetter(updated)
}

export default {
  grantCreditForSession,
  createEncouragementLetter,
  listInboxLetters,
  listSentLetters,
  getEncouragementSummary,
  markLetterRead,
  markReplyRead,
  replyToEncouragementLetter,
}
