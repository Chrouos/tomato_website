import { Router } from 'express'
import { verifyAuthToken } from '../middleware/authMiddleware.js'
import { findById } from '../repositories/userRepository.js'
import { addClient, removeClient } from '../lib/sseHub.js'

const router = Router()

router.get('/', async (req, res) => {
  const tokenParam = req.query.token
  let authUser = null
  try {
    authUser = verifyAuthToken(typeof tokenParam === 'string' ? tokenParam : null)
  } catch (error) {
    return res
      .status(error.status ?? 401)
      .json({ error: error.message ?? '授權失敗' })
  }

  const user = await findById(authUser.id)
  if (!user) {
    return res.status(401).json({ error: '找不到使用者帳號' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write(':ok\n\n')

  addClient({ userId: user.id, res })

  req.on('close', () => {
    removeClient({ userId: user.id, res })
  })
})

export default router
