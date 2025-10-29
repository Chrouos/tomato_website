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
  } catch (error) {
    res.status(400).json({ error: error.message ?? '回覆鼓勵信失敗' })
  }
})

router.post('/letters/:id/read', async (req, res) => {
  await markLetterRead({ userId: req.user.id, letterId: req.params.id })
  res.json({ ok: true })
})

router.post('/letters/:id/read-reply', async (req, res) => {
  await markReplyRead({ userId: req.user.id, letterId: req.params.id })
  res.json({ ok: true })
})

export default router
