import { Router } from 'express'
import authenticate from '../middleware/authMiddleware.js'
import ensureUserExists from '../middleware/ensureUserExists.js'
import {
  createStudyGroup,
  listStudyGroups,
  getStudyGroupDetail,
  joinStudyGroupByInviteCode,
  updateStudyGroupPresence,
  leaveStudyGroup,
} from '../repositories/studyGroupRepository.js'
import { prisma } from '../db.js'
import { broadcastStudyGroupPresence } from '../services/studyGroupPresence.js'
import {
  listGroupMessages,
  createGroupMessage,
} from '../repositories/studyGroupMessageRepository.js'
import { publishToUsers } from '../lib/sseHub.js'

const router = Router()

router.use(authenticate, ensureUserExists)

router.post('/presence/ping', async (req, res) => {
  await prisma.study_group_members.updateMany({
    where: { user_id: req.user.id },
    data: { last_seen_at: new Date() },
  })

  res.json({ ok: true })

  broadcastStudyGroupPresence({ userId: req.user.id }).catch((error) => {
    console.error('Failed to broadcast study group presence', error)
  })
})

router.get('/', async (req, res) => {
  const items = await listStudyGroups({ userId: req.user.id })
  res.json({ items })
})

router.post('/', async (req, res) => {
  const { name } = req.body ?? {}

  try {
    const result = await createStudyGroup({
      ownerId: req.user.id,
      name,
    })
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/join', async (req, res) => {
  const { inviteCode } = req.body ?? {}
  if (typeof inviteCode !== 'string' || inviteCode.trim() === '') {
    return res.status(400).json({ error: 'inviteCode 為必填欄位' })
  }

  try {
    const result = await joinStudyGroupByInviteCode({
      userId: req.user.id,
      inviteCode: inviteCode.trim(),
    })
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:groupId', async (req, res) => {
  const group = await getStudyGroupDetail({
    userId: req.user.id,
    groupId: req.params.groupId,
  })

  if (!group) {
    return res.status(404).json({ error: '找不到學習群組或你沒有權限' })
  }

  res.json(group)
})

router.post('/:groupId/ping', async (req, res) => {
  const updated = await updateStudyGroupPresence({
    userId: req.user.id,
    groupId: req.params.groupId,
  })

  if (!updated) {
    return res.status(404).json({ error: '找不到學習群組或你沒有權限' })
  }

  res.json({ ok: true })
})

router.get('/:groupId/messages', async (req, res) => {
  try {
    const messages = await listGroupMessages({
      userId: req.user.id,
      groupId: req.params.groupId,
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200),
    })
    res.json({ items: messages })
  } catch (error) {
    res.status(400).json({ error: error.message ?? '載入群組訊息失敗' })
  }
})

router.post('/:groupId/messages', async (req, res) => {
  try {
    const message = await createGroupMessage({
      userId: req.user.id,
      groupId: req.params.groupId,
      content: req.body?.content,
    })

    res.status(201).json({ message })

    const recipients = await prisma.study_group_members.findMany({
      where: { group_id: req.params.groupId },
      select: { user_id: true },
    })

    publishToUsers(
      recipients.map((item) => item.user_id),
      'study-group:message',
      {
        groupId: req.params.groupId,
        message,
      },
    )

    broadcastStudyGroupPresence({ userId: req.user.id }).catch((error) => {
      console.error('Failed to broadcast study group presence', error)
    })
  } catch (error) {
    res.status(400).json({ error: error.message ?? '送出訊息失敗' })
  }
})

router.delete('/:groupId', async (req, res) => {
  const result = await leaveStudyGroup({
    userId: req.user.id,
    groupId: req.params.groupId,
  })

  if (!result.left) {
    return res.status(404).json({ error: result.reason ?? '找不到學習群組或你沒有權限' })
  }

  if (result.disbanded) {
    return res.json({ ok: true, disbanded: true })
  }
  return res.json({ ok: true })
})

export default router
