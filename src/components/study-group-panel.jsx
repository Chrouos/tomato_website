import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Divider, Input, Select, Space, Spin, Tag, Typography } from 'antd'
import { LuCopy } from 'react-icons/lu'
import {
  createStudyGroup,
  fetchStudyGroupDetail,
  fetchStudyGroups,
  joinStudyGroup,
  leaveStudyGroup,
  pingStudyGroup,
} from '../lib/api.js'
import { useColorModeValue } from './ui/color-mode.jsx'
import { toaster } from './ui/toaster.jsx'

const formatDuration = (seconds) => {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function StudyGroupPanel({ token }) {
  const { Title, Text } = Typography

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

  const titleColor = useColorModeValue('#1f1f1f', '#f1f5f9')
  const secondaryColor = useColorModeValue('#595959', '#cbd5f5')
  const inviteFieldBackground = useColorModeValue('rgba(248,250,252,0.9)', 'rgba(30,41,59,0.7)')
  const memberCardBorder = useColorModeValue('rgba(148,163,184,0.35)', 'rgba(71,85,105,0.7)')
  const memberCardBackground = useColorModeValue('rgba(248,250,252,0.55)', 'rgba(15,23,42,0.35)')

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
    async (groupId) => {
      if (!token || !groupId) {
        setGroupDetail(null)
        return null
      }
      setIsLoadingDetail(true)
      try {
        const data = await fetchStudyGroupDetail({ token, groupId })
        setGroupDetail(data)
        return data
      } catch (error) {
        toaster.create({ type: 'error', title: '載入群組摘要失敗', description: error.message })
        setGroupDetail(null)
        return null
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [token],
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
      await refreshGroups()
    } catch (error) {
      toaster.create({ type: 'error', title: '退出失敗', description: error.message })
    } finally {
      setIsLeaving(false)
    }
  }

  const selectedGroup = useMemo(() => {
    return groups.find((item) => item?.group?.id === selectedGroupId) ?? null
  }, [groups, selectedGroupId])

  const shareCode = selectedGroup?.group?.inviteCode ?? ''
  const memberLimit = 20
  const memberCount = selectedGroup?.memberCount ?? groupDetail?.members?.length ?? 0

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

          {isLoadingDetail ? (
            <Space align='center' style={{ width: '100%', justifyContent: 'center' }}>
              <Spin />
            </Space>
          ) : groupDetail && groupDetail.members?.length > 0 ? (
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
                          今日專注時間：{formatDuration(member.studySecondsToday)}
                        </Text>
                        <Text style={{ color: secondaryColor }}>
                          今日完成待辦：{member.completedTodosToday}
                        </Text>
                      </Space>
                    </div>
                  )
                })}
              </Space>
            </Space>
          ) : (
            <Text type='secondary' style={{ color: secondaryColor }}>
              目前沒有其他成員，邀請好友加入一起讀書吧！
            </Text>
          )}
        </Space>
      )}
    </Space>
  )
}
