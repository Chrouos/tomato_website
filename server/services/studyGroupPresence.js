import { prisma } from '../db.js'
import { publishToUsers } from '../lib/sseHub.js'
import { ONLINE_THRESHOLD_MS } from '../repositories/studyGroupRepository.js'

export const broadcastStudyGroupPresence = async ({ userId }) => {
  const memberships = await prisma.study_group_members.findMany({
    where: { user_id: userId },
    select: { group_id: true, last_seen_at: true },
  })
  if (memberships.length === 0) return

  const groupIds = [...new Set(memberships.map((item) => item.group_id))]
  const groupMembers = await prisma.study_group_members.findMany({
    where: { group_id: { in: groupIds } },
    select: { group_id: true, user_id: true },
  })

  const recipientsByGroup = new Map()
  groupMembers.forEach((item) => {
    if (!recipientsByGroup.has(item.group_id)) {
      recipientsByGroup.set(item.group_id, new Set())
    }
    recipientsByGroup.get(item.group_id).add(item.user_id)
  })

  const now = Date.now()

  memberships.forEach((membership) => {
    const recipients = recipientsByGroup.get(membership.group_id)
    if (!recipients || recipients.size === 0) {
      return
    }
    const lastSeenAt = membership.last_seen_at ?? new Date()
    publishToUsers(Array.from(recipients), 'study-group:presence', {
      groupId: membership.group_id,
      member: {
        userId,
        lastSeenAt,
        online: true,
        expiresAt: new Date(now + ONLINE_THRESHOLD_MS),
      },
    })
  })
}

export default {
  broadcastStudyGroupPresence,
}
