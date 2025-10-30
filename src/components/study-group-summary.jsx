import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Space, Spin, Tag, Typography, Input } from 'antd'
import { useColorModeValue } from './ui/color-mode.jsx'
import { toaster } from './ui/toaster.jsx'
import {
  fetchStudyGroups,
  fetchStudyGroupDetail,
  fetchStudyGroupMessages,
  createStudyGroupMessage,
} from '../lib/api.js'
import { formatStudyDuration } from './study-group-panel.jsx'

const formatMessageTime = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const { Text } = Typography

export function StudyGroupSummary({ token, onOpenDetail }) {
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupDetail, setGroupDetail] = useState(null)
  const ONLINE_THRESHOLD_MS = 10 * 60 * 1000
  const [messages, setMessages] = useState([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesEndRef = useRef(null)
  const { TextArea } = Input
  const titleColor = useColorModeValue('#1f1f1f', '#f1f5f9')
  const secondaryColor = useColorModeValue('#595959', '#cbd5f5')
  const cardBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.6)')
  const cardBackground = useColorModeValue('rgba(255,255,255,0.92)', 'rgba(15,23,42,0.45)')
  const memberItemBackground = useColorModeValue('rgba(248,250,252,0.9)', 'rgba(30,41,59,0.6)')
  const chatBackground = useColorModeValue('rgba(248,250,252,0.6)', 'rgba(15,23,42,0.5)')
  const chatBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.7)')

  const normalizeMembers = useCallback((detail) => {
    if (!detail || !Array.isArray(detail.members)) {
      return detail
    }
    return {
      ...detail,
      members: detail.members.map((member) => ({
        ...member,
        lastSeenAt: member.lastSeenAt ? new Date(member.lastSeenAt) : null,
        online: Boolean(member.online),
      })),
    }
  }, [])

  const loadSummary = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) {
        setGroups([])
        setGroupDetail(null)
        setMessages([])
        setIsLoading(false)
        return
      }
      if (!silent) {
        setIsLoading(true)
        setIsLoadingMessages(true)
      }
      try {
        const response = await fetchStudyGroups({ token })
        const items = response?.items ?? []
        setGroups(items)
        const primaryGroup = items[0]?.group?.id
        if (primaryGroup) {
          const detail = await fetchStudyGroupDetail({ token, groupId: primaryGroup })
          setGroupDetail(normalizeMembers(detail))
          if (!silent) {
            const resMessages = await fetchStudyGroupMessages({ token, groupId: primaryGroup, limit: 200 })
            const itemsMessages = Array.isArray(resMessages?.items) ? resMessages.items : []
            setMessages(itemsMessages)
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
              }
            }, 100)
          }
        } else {
          setGroupDetail(null)
          setMessages([])
        }
      } catch (error) {
        toaster.create({ type: 'error', title: '共讀群組載入失敗', description: error.message })
        setGroupDetail(null)
        setMessages([])
      } finally {
        if (!silent) {
          setIsLoading(false)
          setIsLoadingMessages(false)
        }
        setIsLoadingMessages(false)
      }
    },
    [token, normalizeMembers],
  )

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleSessionEvent = () => {
      loadSummary({ silent: true })
    }
    window.addEventListener('tomato:session-event-recorded', handleSessionEvent)
    return () => {
      window.removeEventListener('tomato:session-event-recorded', handleSessionEvent)
    }
  }, [loadSummary])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handlePresence = () => {
      loadSummary({ silent: true })
    }
    window.addEventListener('tomato:study-group-presence', handlePresence)
    return () => {
      window.removeEventListener('tomato:study-group-presence', handlePresence)
    }
  }, [loadSummary])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleMessage = (event) => {
      const detail = event?.detail
      if (!detail || detail.groupId !== groupDetail?.group?.id || !detail.message) {
        return
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === detail.message.id)) {
          return prev
        }
        const next = [...prev, detail.message]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    }
    window.addEventListener('tomato:study-group-message', handleMessage)
    return () => {
      window.removeEventListener('tomato:study-group-message', handleMessage)
    }
  }, [groupDetail?.group?.id])

  const handleSendMessage = useCallback(async () => {
    if (!token || !groupDetail?.group?.id) return
    const trimmed = messageInput.trim()
    if (!trimmed) return
    setIsSendingMessage(true)
    try {
      const response = await createStudyGroupMessage({
        token,
        groupId: groupDetail.group.id,
        content: trimmed,
      })
      const message = response?.message ?? null
      if (message) {
        setMessages((prev) => {
          const next = [...prev, message]
          return next.length > 200 ? next.slice(next.length - 200) : next
        })
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
          }
        }, 100)
      }
      setMessageInput('')
    } catch (error) {
      toaster.create({ type: 'error', title: '訊息送出失敗', description: error.message })
    } finally {
      setIsSendingMessage(false)
    }
  }, [groupDetail?.group?.id, messageInput, token])

  const handleMessageInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setGroupDetail((previous) => {
        if (!previous || !Array.isArray(previous.members)) {
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
          if (Boolean(member.online) === shouldBeOnline) {
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

  if (!token) {
    return (
      <div
        style={{
          width: '100%',
          borderRadius: 18,
          border: `1px dashed ${cardBorder}`,
          background: cardBackground,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type='secondary' style={{ color: secondaryColor }}>
          登入後即可建立共讀群組，找伙伴一起專注！
        </Text>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        style={{
          width: '100%',
          borderRadius: 18,
          border: `1px solid ${cardBorder}`,
          background: cardBackground,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Spin />
      </div>
    )
  }

  if (!groupDetail) {
    return (
      <div
        style={{
          width: '100%',
          borderRadius: 18,
          border: `1px dashed ${cardBorder}`,
          background: cardBackground,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type='secondary' style={{ color: secondaryColor }}>
          目前尚未加入共讀群組，建立或輸入邀請碼開始吧！
        </Text>
        <Button type='primary' onClick={onOpenDetail} size='small'>管理共讀</Button>
      </div>
    )
  }

  const members = groupDetail.members ?? []
  const memberLimit = 20
  const memberCount = members.length
  const onlineCount = members.filter((member) => member.online).length
  const highlightMembers = members.slice(0, 4)

  const memberPanelContent =
    highlightMembers.length === 0 ? (
      <Text type='secondary' style={{ color: secondaryColor }}>
        尚未有夥伴加入，分享邀請代碼來組成讀書夥伴吧！
      </Text>
    ) : (
      <Space direction='vertical' size={8} style={{ width: '100%' }}>
        {highlightMembers.map((member) => {
          const displayName = member.displayName || member.userName || '未命名'
          const roleLabel = member.role === 'owner' ? '群組建立者' : '成員'
          return (
            <div
              key={member.id}
              style={{
                borderRadius: 12,
                border: `1px solid rgba(148,163,184,0.35)`,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                background: memberItemBackground,
              }}
            >
              <Space align='center' size={10} style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space align='center' size={8}>
                  <Tag color={member.online ? 'green' : 'default'} style={{ marginInline: 0 }}>
                    {member.online ? '在線' : '離線'}
                  </Tag>
                  <Text strong style={{ color: titleColor }}>{displayName}</Text>
                </Space>
                <Text type='secondary' style={{ color: secondaryColor }}>{roleLabel}</Text>
              </Space>
              <Text type='secondary' style={{ color: secondaryColor }}>
                今日專注時間：{formatStudyDuration(member.studySecondsToday)}
              </Text>
              <Text type='secondary' style={{ color: secondaryColor }}>
                每日任務：剩餘 {member.remainingDailyTasks ?? Math.max((member.totalDailyTasks ?? 0) - (member.completedDailyTasksToday ?? 0), 0)} / {member.totalDailyTasks ?? 0}（今日完成 {member.completedDailyTasksToday ?? 0}）
              </Text>
              <Text type='secondary' style={{ color: secondaryColor }}>
                待辦事項：剩餘 {member.remainingTodos ?? 0}，今日完成 {member.completedTodosToday ?? 0}
              </Text>
            </div>
          )
        })}
        {memberCount > highlightMembers.length ? (
          <Text type='secondary' style={{ color: secondaryColor }}>
            另外還有 {memberCount - highlightMembers.length} 位夥伴，一起加油！
          </Text>
        ) : null}
      </Space>
    )

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 18,
        border: `1px solid ${cardBorder}`,
        background: cardBackground,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            flex: '1 1 320px',
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Space align='center' size={10} wrap style={{ width: '100%' }}>
            <Text strong style={{ color: titleColor }}>
              {groupDetail.group?.name ?? '未命名共讀'}
            </Text>
            <Tag color='blue' style={{ marginInline: 0 }}>
              成員 {memberCount}/{memberLimit}
            </Tag>
            <Tag color={onlineCount > 0 ? 'green' : 'default'} style={{ marginInline: 0 }}>
              在線 {onlineCount}
            </Tag>
          </Space>
          {memberPanelContent}
        </div>
        <div
          style={{
            flex: '1 1 360px',
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Text strong style={{ color: titleColor }}>群組對話</Text>
            <Button type='primary' size='small' onClick={onOpenDetail}>
              管理共讀
            </Button>
          </div>
          <Card
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                height: 320,
                background: chatBackground,
                borderRadius: 16,
              },
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
                  const isSelf = groupDetail?.membership?.userId === message.senderId
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
            <div
              style={{
                display: 'flex',
                gap: 8,
                width: '100%',
              }}
            >
              <TextArea
                placeholder='輸入訊息，按 Enter 送出，Shift + Enter 換行'
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={handleMessageInputKeyDown}
                autoSize={{ minRows: 2, maxRows: 4 }}
                maxLength={1000}
                style={{ flex: 1 }}
              />
              <Button
                type='primary'
                onClick={handleSendMessage}
                loading={isSendingMessage}
                disabled={!messageInput.trim() || isSendingMessage}
                style={{ flexShrink: 0 }}
              >
                送出訊息
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
