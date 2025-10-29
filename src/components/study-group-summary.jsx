import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Space, Spin, Tag, Typography } from 'antd'
import { useColorModeValue } from './ui/color-mode.jsx'
import { toaster } from './ui/toaster.jsx'
import {
  fetchStudyGroups,
  fetchStudyGroupDetail,
} from '../lib/api.js'
import { formatStudyDuration } from './study-group-panel.jsx'

const { Text } = Typography

export function StudyGroupSummary({ token, onOpenDetail }) {
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupDetail, setGroupDetail] = useState(null)
  const titleColor = useColorModeValue('#1f1f1f', '#f1f5f9')
  const secondaryColor = useColorModeValue('#595959', '#cbd5f5')
  const cardBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.6)')
  const cardBackground = useColorModeValue('rgba(255,255,255,0.92)', 'rgba(15,23,42,0.45)')
  const memberItemBackground = useColorModeValue('rgba(248,250,252,0.9)', 'rgba(30,41,59,0.6)')

  const loadSummary = useCallback(async () => {
    if (!token) {
      setGroups([])
      setGroupDetail(null)
      return
    }
    setIsLoading(true)
    try {
      const response = await fetchStudyGroups({ token })
      const items = response?.items ?? []
      setGroups(items)
      const primaryGroup = items[0]?.group?.id
      if (primaryGroup) {
        const detail = await fetchStudyGroupDetail({ token, groupId: primaryGroup })
        setGroupDetail(detail)
      } else {
        setGroupDetail(null)
      }
    } catch (error) {
      toaster.create({ type: 'error', title: '共讀群組載入失敗', description: error.message })
      setGroupDetail(null)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleSessionEvent = () => {
      loadSummary()
    }
    window.addEventListener('tomato:session-event-recorded', handleSessionEvent)
    return () => {
      window.removeEventListener('tomato:session-event-recorded', handleSessionEvent)
    }
  }, [loadSummary])

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
        gap: 12,
      }}
    >
      <Space align='center' size={10} style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space align='baseline' size={10} wrap>
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
        <Button type='primary' size='small' onClick={onOpenDetail}>
          管理共讀
        </Button>
      </Space>

      {highlightMembers.length === 0 ? (
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
                  今日完成待辦：{member.completedTodosToday}
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
      )}
    </div>
  )
}
