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

const router = Router()

router.use(authenticate, ensureUserExists)

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
