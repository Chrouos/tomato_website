import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Divider, Input, Select, Space, Spin, Tag, Typography, Card } from 'antd'
import { LuCopy } from 'react-icons/lu'
import {
  createStudyGroup,
  fetchStudyGroupDetail,
  fetchStudyGroups,
  joinStudyGroup,
  leaveStudyGroup,
  pingStudyGroup,
  fetchStudyGroupMessages,
  createStudyGroupMessage,
} from '../lib/api.js'
import { useColorModeValue } from './ui/color-mode.jsx'
import { toaster } from './ui/toaster.jsx'

export const formatStudyDuration = (seconds) => {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatMessageTime = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function StudyGroupPanel({ token }) {
  const { Title, Text } = Typography
  const { TextArea } = Input

  const [groups, setGroups] = useState([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [groupDetail, setGroupDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [messages, setMessages] = useState([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesEndRef = useRef(null)

  const titleColor = useColorModeValue('#1f1f1f', '#f1f5f9')
  const secondaryColor = useColorModeValue('#595959', '#cbd5f5')
  const inviteFieldBackground = useColorModeValue('rgba(248,250,252,0.9)', 'rgba(30,41,59,0.7)')
  const memberCardBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.7)')
  const memberCardBackground = useColorModeValue('rgba(248,250,252,0.55)', 'rgba(15,23,42,0.35)')
  const ONLINE_THRESHOLD_MS = 10 * 60 * 1000
  const chatBackground = useColorModeValue('rgba(248,250,252,0.6)', 'rgba(15,23,42,0.5)')
  const chatBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.7)')

  const scrollMessagesToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [])

  const normalizeMember = useCallback((member) => {
    if (!member) return member
    const lastSeenAt = member.lastSeenAt ? new Date(member.lastSeenAt) : null
    return {
      ...member,
      lastSeenAt,
      online: Boolean(member.online),
    }
  }, [])

  const normalizeGroupDetail = useCallback(
    (detail) => {
      if (!detail) return detail
      return {
        ...detail,
        members: Array.isArray(detail.members) ? detail.members.map(normalizeMember) : detail.members,
      }
    },
    [normalizeMember],
  )

  const refreshGroups = useCallback(async () => {
    if (!token) {
      setGroups([])
      return []
    }
    setIsLoadingGroups(true)
    try {
      const response = await fetchStudyGroups({ token })
      const items = response?.items ?? []
      setGroups(items)
      return items
    } catch (error) {
      toaster.create({ type: 'error', title: '載入共讀群組失敗', description: error.message })
      setGroups([])
      return []
    } finally {
      setIsLoadingGroups(false)
    }
  }, [token])

  const refreshGroupDetail = useCallback(
    async (groupId, { silent = false } = {}) => {
      if (!token || !groupId) {
        setGroupDetail(null)
        setMessages([])
        return null
      }
      if (!silent) {
        setIsLoadingDetail(true)
        setIsLoadingMessages(true)
        setMessages([])
      }
      try {
        const data = await fetchStudyGroupDetail({ token, groupId })
        const normalized = normalizeGroupDetail(data)
        setGroupDetail(normalized)
        if (!silent) {
          const messagesResponse = await fetchStudyGroupMessages({ token, groupId, limit: 200 })
          const items = Array.isArray(messagesResponse?.items) ? messagesResponse.items : []
          setMessages(items)
          setTimeout(scrollMessagesToBottom, 100)
        }
        return normalized
      } catch (error) {
        toaster.create({ type: 'error', title: '載入群組摘要失敗', description: error.message })
        setGroupDetail(null)
        setMessages([])
        return null
      } finally {
        if (!silent) {
          setIsLoadingDetail(false)
        }
        setIsLoadingMessages(false)
      }
    },
    [token, normalizeGroupDetail, scrollMessagesToBottom],
  )

  useEffect(() => {
    if (!token) {
      setGroups([])
      setSelectedGroupId(null)
      setGroupDetail(null)
      return
    }
    refreshGroups()
  }, [token, refreshGroups])

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupDetail(null)
      return
    }
    refreshGroupDetail(selectedGroupId)
  }, [refreshGroupDetail, selectedGroupId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleSessionEvent = () => {
      if (!token || !selectedGroupId) return
      refreshGroupDetail(selectedGroupId, { silent: true })
    }
    window.addEventListener('tomato:session-event-recorded', handleSessionEvent)
    return () => {
      window.removeEventListener('tomato:session-event-recorded', handleSessionEvent)
    }
  }, [token, selectedGroupId, refreshGroupDetail])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handlePresence = (event) => {
      const detail = event?.detail
      if (!detail || detail.groupId !== selectedGroupId) {
        return
      }
      setGroupDetail((previous) => {
        if (!previous || previous.group?.id !== detail.groupId) {
          return previous
        }
        const members = Array.isArray(previous.members)
          ? previous.members.map((member) => {
              if (member.userId !== detail.member?.userId) {
                return member
              }
              const lastSeen = detail.member?.lastSeenAt
                ? new Date(detail.member.lastSeenAt)
                : member.lastSeenAt
              return {
                ...member,
                lastSeenAt: lastSeen,
                online: Boolean(detail.member?.online ?? true),
              }
            })
          : previous.members
        return {
          ...previous,
          members,
        }
      })
      if (detail?.groupId) {
        refreshGroupDetail(detail.groupId, { silent: true })
      }
    }
    window.addEventListener('tomato:study-group-presence', handlePresence)
    return () => {
      window.removeEventListener('tomato:study-group-presence', handlePresence)
    }
  }, [selectedGroupId, refreshGroupDetail])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleMessage = (event) => {
      const detail = event?.detail
      if (!detail || detail.groupId !== selectedGroupId || !detail.message) {
        return
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === detail.message.id)) {
          return prev
        }
        const next = [...prev, detail.message]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
      if (detail.message.senderId !== undefined) {
        setTimeout(scrollMessagesToBottom, 100)
      }
    }
    window.addEventListener('tomato:study-group-message', handleMessage)
    return () => {
      window.removeEventListener('tomato:study-group-message', handleMessage)
    }
  }, [selectedGroupId, scrollMessagesToBottom])

  useEffect(() => {
    const interval = setInterval(() => {
      setGroupDetail((previous) => {
        if (!previous || !Array.isArray(previous.members) || previous.members.length === 0) {
          return previous
        }
        const onlineAfter = Date.now() - ONLINE_THRESHOLD_MS
        let changed = false
        const members = previous.members.map((member) => {
          if (!member.lastSeenAt) {
            return member.online ? { ...member, online: false } : member
          }
          const lastSeenMs = member.lastSeenAt instanceof Date
            ? member.lastSeenAt.getTime()
            : new Date(member.lastSeenAt).getTime()
          const shouldBeOnline = lastSeenMs >= onlineAfter
          if (shouldBeOnline === Boolean(member.online)) {
            return member
          }
          changed = true
          return {
            ...member,
            online: shouldBeOnline,
          }
        })
        if (!changed) {
          return previous
        }
        return {
          ...previous,
          members,
        }
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [ONLINE_THRESHOLD_MS])

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId(null)
      return
    }
    const exists = groups.some((item) => item?.group?.id === selectedGroupId)
    if (!exists) {
      setSelectedGroupId(groups[0].group.id)
    }
  }, [groups, selectedGroupId])

  useEffect(() => {
    if (!token || !selectedGroupId) {
      return
    }
    const sendPing = () => {
      pingStudyGroup({ token, groupId: selectedGroupId }).catch(() => {})
    }
    sendPing()
    const interval = setInterval(sendPing, 60_000)
    return () => {
      clearInterval(interval)
    }
  }, [token, selectedGroupId])

  const handleCreateGroup = async () => {
    if (!token || !createName.trim()) return
    setIsCreating(true)
    try {
      const result = await createStudyGroup({ token, name: createName.trim() })
      setCreateName('')
      toaster.create({ type: 'success', title: '共讀群組已建立' })
      await refreshGroups()
      setSelectedGroupId(result?.group?.id ?? null)
    } catch (error) {
      toaster.create({ type: 'error', title: '建立群組失敗', description: error.message })
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!token || !joinCode.trim()) return
    setIsJoining(true)
    try {
      const code = joinCode.trim().toUpperCase()
      const result = await joinStudyGroup({ token, inviteCode: code })
      toaster.create({ type: 'success', title: '已加入共讀群組' })
      setJoinCode('')
      await refreshGroups()
      setSelectedGroupId(result?.group?.id ?? null)
    } catch (error) {
      toaster.create({ type: 'error', title: '加入群組失敗', description: error.message })
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!token || !selectedGroupId) return
    setIsLeaving(true)
    try {
      const result = await leaveStudyGroup({ token, groupId: selectedGroupId })
      if (result?.disbanded) {
        toaster.create({ type: 'success', title: '你已解散共讀群組' })
      } else {
        toaster.create({ type: 'success', title: '已退出共讀群組' })
      }
      setSelectedGroupId(null)
      setGroupDetail(null)
      setMessages([])
      await refreshGroups()
    } catch (error) {
      toaster.create({ type: 'error', title: '退出失敗', description: error.message })
    } finally {
      setIsLeaving(false)
    }
  }

  const handleSendMessage = async () => {
    if (!token || !selectedGroupId) return
    const trimmed = messageInput.trim()
    if (!trimmed) return
    setIsSendingMessage(true)
    try {
      const response = await createStudyGroupMessage({
        token,
        groupId: selectedGroupId,
        content: trimmed,
      })
      const message = response?.message ?? null
      if (message) {
        setMessages((prev) => {
          const next = [...prev, message]
          return next.length > 200 ? next.slice(next.length - 200) : next
        })
        setTimeout(scrollMessagesToBottom, 100)
      }
      setMessageInput('')
    } catch (error) {
      toaster.create({ type: 'error', title: '訊息送出失敗', description: error.message })
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleMessageInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const selectedGroup = useMemo(() => {
    return groups.find((item) => item?.group?.id === selectedGroupId) ?? null
  }, [groups, selectedGroupId])

  const memberLimit = 20
  const memberCount = selectedGroup?.memberCount ?? groupDetail?.members?.length ?? 0

  const renderMembersSection = useMemo(() => {
    if (isLoadingDetail) {
      return (
        <Space align='center' style={{ width: '100%', justifyContent: 'center', padding: '32px 0' }}>
          <Spin />
        </Space>
      )
    }
    if (!groupDetail || !Array.isArray(groupDetail.members) || groupDetail.members.length === 0) {
      return (
        <Text type='secondary' style={{ color: secondaryColor }}>
          目前沒有其他成員，邀請好友加入一起讀書吧！
        </Text>
      )
    }
    return (
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Text strong style={{ color: titleColor }}>
          成員狀態（{memberCount}/{memberLimit}）
        </Text>
        <Space direction='vertical' size={10} style={{ width: '100%' }}>
          {groupDetail.members.map((member) => {
            const displayName = member.displayName || member.userName || '未命名'
            const roleLabel = member.role === 'owner' ? '群組建立者' : '成員'
            return (
              <div
                key={member.id}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `1px solid ${memberCardBorder}`,
                  background: memberCardBackground,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <Space align='center' size={8} style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space align='center' size={8}>
                    <Tag color={member.online ? 'green' : 'default'}>{member.online ? '在線' : '離線'}</Tag>
                    <Text strong style={{ color: titleColor }}>{displayName}</Text>
                  </Space>
                  <Text type='secondary' style={{ color: secondaryColor }}>{roleLabel}</Text>
                </Space>
                <Space direction='vertical' size={2}>
                  <Text style={{ color: secondaryColor }}>
                    今日專注時間：{formatStudyDuration(member.studySecondsToday)}
                  </Text>
                  <Text style={{ color: secondaryColor }}>
                    每日任務：剩餘 {member.remainingDailyTasks ?? Math.max((member.totalDailyTasks ?? 0) - (member.completedDailyTasksToday ?? 0), 0)} / {member.totalDailyTasks ?? 0}（今日完成 {member.completedDailyTasksToday ?? 0}）
                  </Text>
                  <Text style={{ color: secondaryColor }}>
                    待辦事項：剩餘 {member.remainingTodos ?? 0}，今日完成 {member.completedTodosToday ?? 0}
                  </Text>
                </Space>
              </div>
            )
          })}
        </Space>
      </Space>
    )
  }, [groupDetail, isLoadingDetail, memberCardBackground, memberCardBorder, memberCount, memberLimit, secondaryColor, titleColor])

  const renderChatSection = useMemo(() => {
    if (!selectedGroupId) {
      return null
    }
    return (
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Text strong style={{ color: titleColor }}>群組對話</Text>
        <Card
          bodyStyle={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: 360,
          }}
          style={{ borderRadius: 16, border: `1px solid ${chatBorder}`, background: chatBackground }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
            }}
          >
            {isLoadingMessages ? (
              <Space align='center' style={{ justifyContent: 'center', width: '100%', paddingTop: 48 }}>
                <Spin />
              </Space>
            ) : messages.length === 0 ? (
              <Text type='secondary' style={{ color: secondaryColor }}>
                目前尚無訊息，發一則問候開啟對話吧！
              </Text>
            ) : (
              messages.map((message) => {
                const isSelf = message.senderId === groupDetail?.membership?.userId
                const bubbleColor = isSelf ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.18)'
                return (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: isSelf ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: bubbleColor,
                      borderRadius: 12,
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <Text strong style={{ color: titleColor, fontSize: 12 }}>
                      {message.senderName ?? '匿名夥伴'}
                    </Text>
                    <Text style={{ whiteSpace: 'pre-wrap', color: titleColor }}>{message.content}</Text>
                    <Text type='secondary' style={{ color: secondaryColor, fontSize: 11 }}>
                      {formatMessageTime(message.createdAt)}
                    </Text>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <Space direction='vertical' size={8} style={{ width: '100%' }}>
            <TextArea
              placeholder='輸入訊息，按 Enter 送出，Shift + Enter 換行'
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              onKeyDown={handleMessageInputKeyDown}
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={1000}
            />
            <Button
              type='primary'
              onClick={handleSendMessage}
              loading={isSendingMessage}
              disabled={!messageInput.trim() || isSendingMessage}
            >
              送出訊息
            </Button>
          </Space>
        </Card>
      </Space>
    )
  }, [chatBackground, chatBorder, groupDetail, handleMessageInputKeyDown, handleSendMessage, isLoadingMessages, isSendingMessage, messageInput, messages, secondaryColor, selectedGroupId, titleColor])

  const shareCode = selectedGroup?.group?.inviteCode ?? ''


  const handleCopyInviteCode = async () => {
    if (!shareCode) return
    try {
      await navigator.clipboard.writeText(shareCode)
      toaster.create({ type: 'success', title: '邀請代碼已複製' })
    } catch (error) {
      toaster.create({ type: 'warning', title: '無法複製代碼', description: error.message })
    }
  }

  if (!token) {
    return (
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0, color: titleColor }}>
          共讀群組
        </Title>
        <Text type='secondary' style={{ color: secondaryColor }}>
          登入後即可建立或加入共讀群組，一起追蹤讀書進度。
        </Text>
      </Space>
    )
  }

  return (
    <Space direction='vertical' size={24} style={{ width: '100%' }}>
      <Space direction='vertical' size={8} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0, color: titleColor }}>
          共讀群組
        </Title>
        <Text type='secondary' style={{ color: secondaryColor }}>
          建立分享連結或輸入代碼，邀請好友一起讀書、同步查看完成進度。每次僅能加入一個群組，退出後才能加入其他群組。
        </Text>
      </Space>

      {groups.length === 0 ? (
        <>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Text strong style={{ color: titleColor }}>建立新群組</Text>
            <Input
              placeholder='輸入群組名稱'
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              maxLength={80}
            />
            <Button
              type='primary'
              block
              onClick={handleCreateGroup}
              loading={isCreating}
              disabled={!createName.trim()}
            >
              建立群組
            </Button>
          </Space>

          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Text strong style={{ color: titleColor }}>加入群組</Text>
            <Input
              placeholder='輸入好友提供的邀請代碼'
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              maxLength={16}
              style={{ textTransform: 'uppercase' }}
            />
            <Button
              block
              onClick={handleJoinGroup}
              loading={isJoining}
              disabled={!joinCode.trim()}
            >
              加入群組
            </Button>
          </Space>

          <Divider style={{ margin: '8px 0' }} />
        </>
      ) : null}

      {isLoadingGroups ? (
        <Space align='center' style={{ width: '100%', justifyContent: 'center' }}>
          <Spin />
        </Space>
      ) : groups.length === 0 ? (
        <Text type='secondary' style={{ color: secondaryColor }}>
          目前還沒有共讀群組，建立一個或向好友索取邀請代碼吧！
        </Text>
      ) : (
        <Space direction='vertical' size={16} style={{ width: '100%' }}>
          {groups.length > 1 ? (
            <Space direction='vertical' size={8} style={{ width: '100%' }}>
              <Text strong style={{ color: titleColor }}>選擇群組</Text>
              <Select
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                options={groups.map((item) => ({
                  label: `${item.group.name} (${item.memberCount}/${memberLimit})`,
                  value: item.group.id,
                }))}
                style={{ width: '100%' }}
              />
            </Space>
          ) : (
            <Space direction='vertical' size={4} style={{ width: '100%' }}>
              <Text strong style={{ color: titleColor }}>當前群組</Text>
              <Text style={{ color: titleColor }}>
                {groups[0]?.group?.name ?? '未命名群組'} ({memberCount}/{memberLimit})
              </Text>
            </Space>
          )}

          {shareCode ? (
            <Space direction='vertical' size={6} style={{ width: '100%' }}>
              <Text strong style={{ color: titleColor }}>邀請代碼</Text>
              <Input
                readOnly
                value={shareCode}
                style={{ background: inviteFieldBackground, fontWeight: 600, letterSpacing: 2 }}
                suffix={
                  <Button type='text' size='small' icon={<LuCopy />} onClick={handleCopyInviteCode}>
                    複製
                  </Button>
                }
              />
              <Text type='secondary' style={{ color: secondaryColor }}>
                將代碼分享給好友，他們即可加入該群組（最多 20 位成員）。
              </Text>
            </Space>
          ) : null}

          {selectedGroupId ? (
            <Button danger block onClick={handleLeaveGroup} loading={isLeaving}>
              {groupDetail?.membership?.role === 'owner' ? '解散群組' : '退出群組'}
            </Button>
          ) : null}

          <Divider style={{ margin: '0' }} />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>{renderMembersSection}</div>
            <div style={{ flex: '1 1 360px', minWidth: 280 }}>{renderChatSection}</div>
          </div>
        </Space>
      )}
    </Space>
  )
}
