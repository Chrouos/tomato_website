import crypto from 'crypto'
import { prisma } from '../db.js'

export const MAX_MEMBERS_PER_GROUP = 20
export const ONLINE_THRESHOLD_MS = 10 * 60 * 1000

const mapGroup = (row) => {
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const mapMembership = (row) => {
  if (!row) return null
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    displayName: row.display_name,
    userName: row.user?.name ?? null,
  }
}

const randomInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const index = bytes[i] % alphabet.length
    code += alphabet[index]
  }
  return code
}

const generateUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomInviteCode()
    const existing = await prisma.study_groups.findUnique({
      where: { invite_code: code },
      select: { id: true },
    })
    if (!existing) {
      return code
    }
  }
  throw new Error('無法產生唯一定邀請連結，請稍後再試')
}

export const createStudyGroup = async ({ ownerId, name }) => {
  const existingMembership = await prisma.study_group_members.findFirst({
    where: { user_id: ownerId },
  })

  if (existingMembership) {
    throw new Error('你已經加入共讀群組，請先退出後再建立新的群組')
  }

  const groupName = typeof name === 'string' ? name.trim() : ''
  if (!groupName) {
    throw new Error('名稱為必填欄位')
  }

  const inviteCode = await generateUniqueInviteCode()

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.study_groups.create({
      data: {
        owner_id: ownerId,
        name: groupName,
        invite_code: inviteCode,
      },
    })

    const membership = await tx.study_group_members.create({
      data: {
        group_id: group.id,
        user_id: ownerId,
        role: 'owner',
        last_seen_at: new Date(),
      },
      include: { user: { select: { id: true, name: true } } },
    })

    return {
      group,
      membership,
    }
  })

  return {
    group: mapGroup(result.group),
    membership: mapMembership(result.membership),
  }
}

export const listStudyGroups = async ({ userId }) => {
  const memberships = await prisma.study_group_members.findMany({
    where: { user_id: userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      group: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joined_at: 'asc' },
  })

  return memberships.map((membership) => ({
    ...mapMembership(membership),
    group: mapGroup(membership.group),
    memberCount: membership.group?._count?.members ?? 0,
  }))
}

export const getStudyGroupDetail = async ({ userId, groupId }) => {
  const membership = await prisma.study_group_members.findFirst({
    where: { group_id: groupId, user_id: userId },
    include: { group: true },
  })

  if (!membership) {
    return null
  }

  const members = await prisma.study_group_members.findMany({
    where: { group_id: groupId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { joined_at: 'asc' },
  })

  const memberIds = members.map((item) => item.user_id)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const localDateString = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`

  const [sessionStats, todoStats, dailyTaskCompletions, dailyTaskTotals, todoOutstanding] = memberIds.length
    ? await Promise.all([
        prisma.sessions.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: memberIds },
            completed_at: { gte: startOfDay },
          },
          _sum: { duration_seconds: true },
        }),
        prisma.todos.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: memberIds },
            completed: true,
            completed_at: { gte: startOfDay },
          },
          _count: { _all: true },
        }),
        prisma.daily_task_completions.findMany({
          where: {
            completed_on: new Date(localDateString),
            daily_tasks: {
              user_id: { in: memberIds },
            },
          },
          include: {
            daily_tasks: { select: { user_id: true } },
          },
        }),
        prisma.daily_tasks.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: memberIds },
            archived: false,
          },
          _count: { _all: true },
        }),
        prisma.todos.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: memberIds },
            completed: false,
            archived: false,
          },
          _count: { _all: true },
        }),
      ])
    : [[], [], [], [], []]

  const sessionMap = new Map(
    sessionStats.map((item) => [item.user_id, item._sum?.duration_seconds ?? 0]),
  )
  const todoMap = new Map(
    todoStats.map((item) => [item.user_id, item._count?._all ?? 0]),
  )
  const dailyTaskCompletionMap = new Map()
  dailyTaskCompletions.forEach((item) => {
    const userId = item.daily_tasks?.user_id
    if (!userId) return
    dailyTaskCompletionMap.set(userId, (dailyTaskCompletionMap.get(userId) ?? 0) + 1)
  })
  const dailyTaskTotalsMap = new Map(
    dailyTaskTotals.map((item) => [item.user_id, item._count?._all ?? 0]),
  )
  const todoOutstandingMap = new Map(
    todoOutstanding.map((item) => [item.user_id, item._count?._all ?? 0]),
  )

  const now = Date.now()
  const onlineAfter = now - ONLINE_THRESHOLD_MS

  const memberDetails = members.map((item) => {
    const lastSeen = item.last_seen_at ? item.last_seen_at.getTime() : null
    const online = lastSeen ? lastSeen >= onlineAfter : false
    return {
      ...mapMembership(item),
      studySecondsToday: sessionMap.get(item.user_id) ?? 0,
      completedTodosToday: todoMap.get(item.user_id) ?? 0,
      remainingTodos: todoOutstandingMap.get(item.user_id) ?? 0,
      completedDailyTasksToday: dailyTaskCompletionMap.get(item.user_id) ?? 0,
      totalDailyTasks: dailyTaskTotalsMap.get(item.user_id) ?? 0,
      remainingDailyTasks: Math.max(
        (dailyTaskTotalsMap.get(item.user_id) ?? 0) - (dailyTaskCompletionMap.get(item.user_id) ?? 0),
        0,
      ),
      online,
    }
  })

  return {
    group: mapGroup(membership.group),
    members: memberDetails,
    membership: mapMembership(membership),
  }
}

export const joinStudyGroupByInviteCode = async ({ userId, inviteCode }) => {
  const currentMembership = await prisma.study_group_members.findFirst({
    where: { user_id: userId },
  })
  if (currentMembership) {
    throw new Error('你已經在共讀群組中，請先退出後再加入其他群組')
  }

  const group = await prisma.study_groups.findUnique({
    where: { invite_code: inviteCode },
  })
  if (!group) {
    throw new Error('邀請連結無效或已過期')
  }

  const existingMembership = await prisma.study_group_members.findFirst({
    where: { group_id: group.id, user_id: userId },
    include: { user: { select: { id: true, name: true } } },
  })

  if (existingMembership) {
    return {
      group: mapGroup(group),
      membership: mapMembership(existingMembership),
    }
  }

  const memberCount = await prisma.study_group_members.count({
    where: { group_id: group.id },
  })
  if (memberCount >= MAX_MEMBERS_PER_GROUP) {
    throw new Error('此群組已達成員上限')
  }

  const membership = await prisma.study_group_members.create({
    data: {
      group_id: group.id,
      user_id: userId,
      role: 'member',
      last_seen_at: new Date(),
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return {
    group: mapGroup(group),
    membership: mapMembership(membership),
  }
}

export const updateStudyGroupPresence = async ({ userId, groupId }) => {
  const membership = await prisma.study_group_members.updateMany({
    where: { group_id: groupId, user_id: userId },
    data: { last_seen_at: new Date() },
  })
  return membership.count > 0
}

export const leaveStudyGroup = async ({ userId, groupId }) => {
  const membership = await prisma.study_group_members.findFirst({
    where: { group_id: groupId, user_id: userId },
  })

  if (!membership) {
    return { left: false, reason: '找不到你的群組成員資料' }
  }

  if (membership.role === 'owner') {
    await prisma.study_groups.delete({
      where: { id: groupId },
    })
    return { left: true, disbanded: true }
  }

  await prisma.study_group_members.delete({
    where: { id: membership.id },
  })
  return { left: true, disbanded: false }
}

export default {
  createStudyGroup,
  listStudyGroups,
  getStudyGroupDetail,
  joinStudyGroupByInviteCode,
  updateStudyGroupPresence,
  leaveStudyGroup,
}
