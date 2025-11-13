import crypto from 'crypto'

const clients = new Map() // userId -> Set(res)
const HEARTBEAT_INTERVAL_MS = 30_000

const writeEvent = (res, { event, data, id }) => {
  if (res.writableEnded) return false
  if (id) {
    res.write(`id: ${id}\n`)
  }
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data ?? null)}\n\n`)
  return true
}

export const addClient = ({ userId, res }) => {
  const existing = clients.get(userId)
  if (existing) {
    existing.add(res)
  } else {
    clients.set(userId, new Set([res]))
  }
}

export const removeClient = ({ userId, res }) => {
  const set = clients.get(userId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) {
    clients.delete(userId)
  }
}

export const publishToUsers = (userIds, event, data) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return
  const payload = { event, data }
  const id = crypto.randomUUID()
  userIds.forEach((userId) => {
    const targets = clients.get(userId)
    if (!targets) return
    targets.forEach((res) => {
      const delivered = writeEvent(res, { event, data: payload, id })
      if (!delivered) {
        removeClient({ userId, res })
      }
    })
  })
}

export const publishToUser = (userId, event, data) => {
  publishToUsers([userId], event, data)
}

const sendHeartbeat = () => {
  const now = Date.now()
  clients.forEach((set) => {
    set.forEach((res) => {
      if (res.writableEnded) {
        set.delete(res)
        return
      }
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: now })}\n\n`)
    })
  })
}

setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS).unref()

export default {
  addClient,
  removeClient,
  publishToUser,
  publishToUsers,
}
