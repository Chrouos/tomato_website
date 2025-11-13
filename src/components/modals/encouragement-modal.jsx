import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Divider, Empty, Input, Modal, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { LuFeather, LuInbox, LuMail, LuMessageCircle, LuSend } from 'react-icons/lu'
import {
  fetchEncouragementSummary,
  fetchEncouragementInbox,
  fetchEncouragementSent,
  sendEncouragementLetter,
  replyEncouragementLetter,
  markEncouragementLetterRead,
  markEncouragementReplyRead,
} from '../../lib/api.js'
import { toaster } from '../ui/toaster.jsx'
import { useColorModeValue } from '../ui/color-mode.jsx'

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

const SUMMARY_FALLBACK = {
  credits: 0,
  unreadLetters: 0,
  awaitingReply: 0,
  unreadReplies: 0,
}

const formatDateTime = (value) => {
  if (!value) return '—'
  return dayjs(value).format('YYYY/MM/DD HH:mm')
}

const createLetterCardStyle = ({ border, background }) => ({
  width: '100%',
  padding: '14px 16px',
  borderRadius: 18,
  border: `1px solid ${border}`,
  background,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
})

export function EncouragementModal({ token, open, onClose }) {
  const [summary, setSummary] = useState({ ...SUMMARY_FALLBACK })
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [replyDrafts, setReplyDrafts] = useState({})
  const [sendMessage, setSendMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState('inbox')

  const sectionTitleColor = useColorModeValue('#0f172a', '#f1f5f9')
  const secondaryColor = useColorModeValue('#6b7280', '#cbd5f5')
  const cardBorder = useColorModeValue('rgba(148,163,184,0.25)', 'rgba(71,85,105,0.5)')
  const cardBackground = useColorModeValue('rgba(255,255,255,0.92)', 'rgba(15,23,42,0.5)')
  const replyBackground = useColorModeValue('rgba(248,250,252,0.85)', 'rgba(30,41,59,0.55)')
  const mailboxBackground = useColorModeValue('#e0f2fd', '#1e293b')
  const mailboxColor = useColorModeValue('#2563eb', '#60a5fa')
  const modalBackground = useColorModeValue('#f8fbff', '#0f172a')

  const canSend = summary.credits > 0

  const resetState = useCallback(() => {
    setSummary({ ...SUMMARY_FALLBACK })
    setInbox([])
    setSent([])
    setReplyDrafts({})
    setSendMessage('')
    setActiveTab('inbox')
  }, [])

  const loadData = useCallback(async () => {
    if (!token || !open) {
      resetState()
      return
    }
    setIsLoading(true)
    try {
      const [summaryData, inboxData, sentData] = await Promise.all([
        fetchEncouragementSummary({ token }),
        fetchEncouragementInbox({ token }),
        fetchEncouragementSent({ token }),
      ])

      const normalizedSummary =
        summaryData && typeof summaryData === 'object'
          ? { ...SUMMARY_FALLBACK, ...summaryData }
          : { ...SUMMARY_FALLBACK }

      const inboxItems = Array.isArray(inboxData?.items) ? inboxData.items : []
      const sentItems = Array.isArray(sentData?.items) ? sentData.items : []

      setSummary(normalizedSummary)
      setInbox(inboxItems)
      setSent(sentItems)
      setReplyDrafts({})
    } catch (error) {
      toaster.create({ type: 'error', title: '匿名信箱同步失敗', description: error.message })
      resetState()
    } finally {
      setIsLoading(false)
    }
  }, [token, open, resetState])

  useEffect(() => {
    if (!open) return
    loadData()
  }, [loadData, open])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleRealtime = () => {
      if (!open) return
      loadData()
    }
    window.addEventListener('tomato:encouragement-updated', handleRealtime)
    return () => {
      window.removeEventListener('tomato:encouragement-updated', handleRealtime)
    }
  }, [open, loadData])

  useEffect(() => {
    if (!token || !open || activeTab !== 'inbox') return
    const unreadIds = inbox.filter((item) => !item.readAt).map((item) => item.id)
    if (unreadIds.length === 0) return

    ;(async () => {
      await Promise.allSettled(
        unreadIds.map((letterId) => markEncouragementLetterRead({ token, letterId })),
      )
      const nowIso = new Date().toISOString()
      setInbox((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt: nowIso })))
      setSummary((prev) => ({
        ...prev,
        unreadLetters: Math.max(0, (prev.unreadLetters ?? 0) - unreadIds.length),
      }))
    })()
  }, [activeTab, inbox, token, open])

  useEffect(() => {
    if (!token || !open || activeTab !== 'sent') return
    const unreadReplyIds = sent
      .filter((item) => item.reply && item.reply.isRead === false)
      .map((item) => item.id)
    if (unreadReplyIds.length === 0) return

    ;(async () => {
      await Promise.allSettled(
        unreadReplyIds.map((letterId) => markEncouragementReplyRead({ token, letterId })),
      )
      setSent((prev) =>
        prev.map((item) =>
          item.reply && item.reply.isRead === false
            ? { ...item, reply: { ...item.reply, isRead: true } }
            : item,
        ),
      )
      setSummary((prev) => ({
        ...prev,
        unreadReplies: Math.max(0, (prev.unreadReplies ?? 0) - unreadReplyIds.length),
      }))
    })()
  }, [activeTab, sent, token, open])

  const handleSend = async () => {
    const trimmed = sendMessage.trim()
    if (!token || !trimmed) return
    setIsSending(true)
    try {
      await sendEncouragementLetter({ token, message: trimmed })
      toaster.create({ type: 'success', title: '已匿名送出一份鼓勵！' })
      setSendMessage('')
      setActiveTab('sent')
      await loadData()
    } catch (error) {
      toaster.create({ type: 'error', title: '送信失敗', description: error.message })
    } finally {
      setIsSending(false)
    }
  }

  const handleReplyChange = (letterId, value) => {
    setReplyDrafts((prev) => ({ ...prev, [letterId]: value }))
  }

  const handleReply = async (letterId) => {
    const trimmed = replyDrafts[letterId]?.trim()
    if (!token || !trimmed) return
    try {
      await replyEncouragementLetter({ token, letterId, message: trimmed })
      toaster.create({ type: 'success', title: '已送出回覆，謝謝你的真誠！' })
      setReplyDrafts((prev) => ({ ...prev, [letterId]: '' }))
      await loadData()
      setActiveTab('sent')
    } catch (error) {
      toaster.create({ type: 'error', title: '回覆失敗', description: error.message })
    }
  }

  const renderInbox = useMemo(() => {
    if (inbox.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description='信箱暫時靜悄悄，寄出一封暖暖的小卡吧！'
        />
      )
    }

    return (
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {inbox.map((letter) => {
          const draft = replyDrafts[letter.id] ?? ''
          const replied = Boolean(letter.reply)
          return (
            <div key={letter.id} style={createLetterCardStyle({ border: cardBorder, background: cardBackground })}>
              <Space align='center' size={8}>
                <LuMail size={18} color={letter.readAt ? '#94a3b8' : '#22c55e'} />
                <Text strong style={{ color: sectionTitleColor }}>{formatDateTime(letter.sentAt)}</Text>
              </Space>

              <Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{letter.message}</Paragraph>
              
              <Divider />

              {replied ? (
                <div
                  style={{
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: replyBackground,
                  }}
                >
                  <Text strong style={{ color: sectionTitleColor }}>你已回覆這封信</Text>
                  <Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                    {letter.reply?.message}
                  </Paragraph>
                  <Text type='secondary' style={{ color: secondaryColor }}>{formatDateTime(letter.reply?.sentAt)}</Text>
                </div>
              ) : (
                <Space direction='vertical' size={8} style={{ width: '100%' }}>
                  <Text type='secondary' style={{ color: secondaryColor }}>
                    你可以回覆任何話
                  </Text>
                  <TextArea
                    value={draft}
                    rows={3}
                    maxLength={2000}
                    showCount
                    onChange={(event) => handleReplyChange(letter.id, event.target.value)}
                    placeholder='寫下你的回覆...'
                  />
                  <Button type='primary' disabled={!draft.trim()} onClick={() => handleReply(letter.id)}>
                    匿名回覆
                  </Button>
                </Space>
              )}
            </div>
          )
        })}
      </Space>
    )
  }, [inbox, replyDrafts, handleReply, cardBorder, cardBackground, replyBackground, sectionTitleColor, secondaryColor])

  const renderSent = useMemo(() => {
    if (sent.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description='還沒有寄出信件，完成 25 分鐘專注後就能獲得額度！'
        />
      )
    }

    return (
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {sent.map((letter) => (
          <div key={letter.id} style={createLetterCardStyle({ border: cardBorder, background: cardBackground })}>
            <Space align='center' size={8}>
              <LuSend size={18} color='#2563eb' />
              <Text strong style={{ color: sectionTitleColor }}>{formatDateTime(letter.sentAt)}</Text>
            </Space>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{letter.yourMessage}</Paragraph>

            {letter.reply ? (
              <div
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: replyBackground,
                }}
              >
                <Space align='center' size={8}>
                  <LuInbox size={18} color='#f59e0b' />
                  <Text strong style={{ color: sectionTitleColor }}>這封信有回覆了</Text>
                </Space>
                <Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  {letter.reply.message}
                </Paragraph>
                <Text type='secondary' style={{ color: secondaryColor }}>{formatDateTime(letter.reply.sentAt)}</Text>
              </div>
            ) : (
              <Text type='secondary' style={{ color: secondaryColor }}>
                尚未收到回覆，耐心等候或再寄一封新信。
              </Text>
            )}
          </div>
        ))}
      </Space>
    )
  }, [sent, cardBorder, cardBackground, replyBackground, sectionTitleColor, secondaryColor])

  const renderCompose = useMemo(() => {
    return (
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Text strong style={{ color: sectionTitleColor }}>寫一封小信件</Text>
        <Text type='secondary' style={{ color: secondaryColor }}>
          用一兩句話分享專注後的心情，對方不會知道是你。
        </Text>
        <TextArea
          value={sendMessage}
          onChange={(event) => setSendMessage(event.target.value)}
          rows={5}
          maxLength={2000}
          showCount
          disabled={!canSend || isSending}
          placeholder={
            canSend
              ? '想送出什麼話？簡單一句就能讓人會心一笑。'
              : '完成 25 分鐘番茄鐘即可獲得額度，先專注於手邊的任務吧！'
          }
        />
        <Space size={8}>
          <Button type='primary' onClick={handleSend} disabled={!canSend || !sendMessage.trim()} loading={isSending}>
            匿名寄出
          </Button>
          <Button onClick={() => setSendMessage('')} disabled={sendMessage.length === 0}>
            清空內容
          </Button>
        </Space>
      </Space>
    )
  }, [sendMessage, canSend, isSending, sectionTitleColor, secondaryColor])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={720}
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      <div
        style={{
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: modalBackground,
          borderRadius: 16,
        }}
      >
        <Space direction='vertical' size={12} style={{ width: '100%' }}>
          <Space align='center' size={14} style={{ justifyContent: 'space-between' }}>
            <Space align='center' size={10}>
              <Badge count={summary.unreadLetters} size='small' offset={[-4, 4]}>
                <span
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: mailboxBackground,
                    color: mailboxColor,
                    boxShadow: '0 12px 30px rgba(37, 99, 235, 0.18)',
                  }}
                >
                  <LuMail size={32} />
                </span>
              </Badge>
              <Space direction='vertical' size={4}>
                <Space align='center' size={8}>
                  <Title level={4} style={{ margin: 0, color: sectionTitleColor }}>
                    暖心信箱
                  </Title>
                  <Tooltip title='完成 25 分鐘番茄鐘會得到 1 個額度'>
                    <Tag color='blue' style={{ borderRadius: 999, marginInline: 0 }}>
                      額度 {summary.credits}
                    </Tag>
                  </Tooltip>
                </Space>
                <Text type='secondary' style={{ color: secondaryColor }}>
                  收信、回信、再送出一封小小的鼓勵。
                </Text>
              </Space>
            </Space>
            <Button size='small' onClick={loadData} icon={<LuInbox size={14} />}>刷新</Button>
          </Space>

          <Space size={8}>
            <Button
              type={activeTab === 'inbox' ? 'primary' : 'default'}
              icon={<LuInbox size={14} />}
              onClick={() => setActiveTab('inbox')}
            >
              收信
            </Button>
            <Button
              type={activeTab === 'compose' ? 'primary' : 'default'}
              icon={<LuFeather size={14} />}
              onClick={() => setActiveTab('compose')}
              disabled={!canSend}
            >
              寫信
            </Button>
            <Button
              type={activeTab === 'sent' ? 'primary' : 'default'}
              icon={<LuMessageCircle size={14} />}
              onClick={() => setActiveTab('sent')}
            >
              寄件
            </Button>
          </Space>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {isLoading ? (
          <Space align='center' style={{ width: '100%', justifyContent: 'center', padding: '32px 0' }}>
            <Spin />
          </Space>
        ) : (
          <div style={{ width: '100%' }}>
            {activeTab === 'inbox' && renderInbox}
            {activeTab === 'compose' && renderCompose}
            {activeTab === 'sent' && renderSent}
          </div>
        )}
      </div>
    </Modal>
  )
}
