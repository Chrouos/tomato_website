import { Router } from 'express'
import authenticate from '../middleware/authMiddleware.js'
import ensureUserExists from '../middleware/ensureUserExists.js'
import {
  createEncouragementLetter,
  getEncouragementSummary,
  listInboxLetters,
  listSentLetters,
  markLetterRead,
  markReplyRead,
  replyToEncouragementLetter,
} from '../repositories/encouragementRepository.js'
import { publishToUser } from '../lib/sseHub.js'
import { prisma } from '../db.js'

const router = Router()

router.use(authenticate, ensureUserExists)

router.get('/summary', async (req, res) => {
  const summary = await getEncouragementSummary({ userId: req.user.id })
  res.json(summary)
})

router.get('/inbox', async (req, res) => {
  const items = await listInboxLetters({ userId: req.user.id })
  res.json({ items })
})

router.get('/sent', async (req, res) => {
  const items = await listSentLetters({ userId: req.user.id })
  res.json({ items })
})

router.post('/send', async (req, res) => {
  const { message } = req.body ?? {}
  try {
    const result = await createEncouragementLetter({ senderId: req.user.id, message })
    res.status(201).json({ letter: result.letter })
    publishToUser(req.user.id, 'encouragement:updated', {
      action: 'sent',
      letterId: result.letter.id,
    })
    if (result.recipientId) {
      publishToUser(result.recipientId, 'encouragement:updated', {
        action: 'received',
        letterId: result.letter.id,
      })
    }
  } catch (error) {
    res.status(400).json({ error: error.message ?? '送出鼓勵信失敗' })
  }
})

router.post('/letters/:id/reply', async (req, res) => {
  const { message } = req.body ?? {}
  try {
    const letter = await replyToEncouragementLetter({
      userId: req.user.id,
      letterId: req.params.id,
      message,
    })
    res.json({ letter })
    publishToUser(req.user.id, 'encouragement:updated', {
      action: 'replied',
      letterId: letter.id,
    })
    const original = await prisma.encouragement_letters.findUnique({
      where: { id: letter.id },
      select: { sender_id: true },
    })
    if (original?.sender_id) {
      publishToUser(original.sender_id, 'encouragement:updated', {
        action: 'reply-received',
        letterId: letter.id,
      })
    }
  } catch (error) {
    res.status(400).json({ error: error.message ?? '回覆鼓勵信失敗' })
  }
})

router.post('/letters/:id/read', async (req, res) => {
  await markLetterRead({ userId: req.user.id, letterId: req.params.id })
  res.json({ ok: true })
  publishToUser(req.user.id, 'encouragement:updated', {
    action: 'read',
    letterId: req.params.id,
  })
  const letter = await prisma.encouragement_letters.findUnique({
    where: { id: req.params.id },
    select: { sender_id: true },
  })
  if (letter?.sender_id) {
    publishToUser(letter.sender_id, 'encouragement:updated', {
      action: 'letter-read',
      letterId: req.params.id,
    })
  }
})

router.post('/letters/:id/read-reply', async (req, res) => {
  await markReplyRead({ userId: req.user.id, letterId: req.params.id })
  res.json({ ok: true })
  publishToUser(req.user.id, 'encouragement:updated', {
    action: 'read-reply',
    letterId: req.params.id,
  })
  const letter = await prisma.encouragement_letters.findUnique({
    where: { id: req.params.id },
    select: { recipient_id: true },
  })
  if (letter?.recipient_id) {
    publishToUser(letter.recipient_id, 'encouragement:updated', {
      action: 'reply-read',
      letterId: req.params.id,
    })
  }
})

export default router
