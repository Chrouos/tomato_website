import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Calendar as AntdCalendar,
  Card,
  Col,
  Empty,
  InputNumber,
  List,
  Row,
  Segmented,
  Space,
  Spin,
  Timeline,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useAuth } from '../../lib/auth-context.jsx'
import { fetchEvents, fetchSessions } from '../../lib/api.js'
import { toaster } from '../ui/toaster.jsx'
import {
  endOfDay,
  formatDurationLabel,
  getEventColor,
  getEventLabel,
  getEventTags,
  startOfDay,
} from './utils.js'
import { useTimelineFilters } from './use-timeline-filters.js'

const ONE_HOUR = 60 * 60

export function TimelineDashboard() {
  const { token, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [events, setEvents] = useState([])
  const {
    filters,
    activeRangeKey,
    calendarValue,
    selectedDate,
    applyQuickRange,
    selectDate,
    handleMinHoursChange,
    setCalendarValue,
    setSelectedDate,
  } = useTimelineFilters()

  const { Title, Paragraph, Text } = Typography
  const quickRangeOptions = useMemo(
    () => [
      { label: '今日', value: 'today' },
      { label: '最近 7 天', value: '7d' },
      { label: '最近 14 天', value: '14d' },
      { label: '本月', value: 'month' },
      { label: '自訂', value: 'custom', disabled: true },
    ],
    [],
  )
  const isCustomRange = !['today', '7d', '14d', 'month'].includes(activeRangeKey)
  const segmentedValue = isCustomRange ? 'custom' : activeRangeKey

  useEffect(() => {
    const rangeStart = filters.from ? dayjs(filters.from) : null
    const rangeEnd = filters.to ? dayjs(filters.to) : null
    if (rangeStart && selectedDate && selectedDate.isBefore(rangeStart, 'day')) {
      setSelectedDate(rangeStart)
      setCalendarValue(rangeStart)
      return
    }
    if (rangeEnd && selectedDate && selectedDate.isAfter(rangeEnd, 'day')) {
      setSelectedDate(rangeEnd)
      setCalendarValue(rangeEnd)
    }
  }, [filters.from, filters.to, selectedDate, setCalendarValue, setSelectedDate])

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSessions([])
      setEvents([])
      return
    }

    const load = async () => {
      setIsLoading(true)
      try {
        const fromDate = filters.from ? startOfDay(filters.from) : null
        const toDate = filters.to ? endOfDay(filters.to) : null
        const minDurationSeconds =
          Number(filters.minHours) > 0 ? Number(filters.minHours) * ONE_HOUR : undefined

        const [sessionsResp, eventsResp] = await Promise.all([
          fetchSessions({
            token,
            limit: 500,
            offset: 0,
            from: fromDate?.toISOString(),
            to: toDate?.toISOString(),
            minDuration: minDurationSeconds,
          }),
          fetchEvents({
            token,
            limit: 1000,
            offset: 0,
            from: fromDate?.toISOString(),
            to: toDate?.toISOString(),
          }),
        ])

        setSessions(sessionsResp.items ?? [])
        setEvents(eventsResp.items ?? [])
      } catch (error) {
        toaster.create({
          title: '統計資料載入失敗',
          description: error.message,
          type: 'error',
        })
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [filters, isAuthenticated, token])

  const totalHours = useMemo(() => {
    if (!sessions.length) return 0
    const seconds = sessions.reduce((acc, session) => acc + (session.durationSeconds ?? 0), 0)
    return Math.round((seconds / ONE_HOUR) * 10) / 10
  }, [sessions])

  const completedCount = useMemo(
    () => sessions.filter((session) => Boolean(session.completedAt)).length,
    [sessions],
  )

  const normalizedSessions = useMemo(() => {
    return sessions.map((session) => {
      let start = session.startedAt ? dayjs(session.startedAt) : null
      let end = session.completedAt ? dayjs(session.completedAt) : null
      const durationSeconds = session.durationSeconds ?? 0

      if (!start && end && durationSeconds > 0) {
        start = end.subtract(durationSeconds, 'second')
      }
      if (start && !end) {
        end = start.add(durationSeconds > 0 ? durationSeconds : 25 * 60, 'second')
      }
      if (!start) {
        start = session.createdAt ? dayjs(session.createdAt) : dayjs()
      }
      if (!end) {
        end = start.add(25, 'minute')
      }

      const derivedDurationSeconds =
        durationSeconds > 0 ? durationSeconds : Math.max(end.diff(start, 'second'), 0)

      return {
        ...session,
        start,
        end,
        durationSeconds: derivedDurationSeconds,
        durationLabel: formatDurationLabel(derivedDurationSeconds),
        title: session.categoryLabel ?? '番茄鐘',
      }
    })
  }, [sessions])

  const normalizedEvents = useMemo(() => {
    return events
      .map((event) => {
        if (!event.occurredAt) return null
        const start = dayjs(event.occurredAt)
        if (!start.isValid()) return null
        const end = start.add(5, 'minute')
        const eventLabel = getEventLabel(event.eventType)
        return {
          ...event,
          start,
          end,
          title: eventLabel,
          tags: getEventTags(event),
        }
      })
      .filter(Boolean)
  }, [events])

  const recordsByDate = useMemo(() => {
    const map = new Map()
    const ensure = (key) => {
      if (!map.has(key)) {
        map.set(key, { sessions: [], events: [] })
      }
      return map.get(key)
    }

    normalizedSessions.forEach((session) => {
      const key = session.start.format('YYYY-MM-DD')
      ensure(key).sessions.push(session)
    })

    normalizedEvents.forEach((event) => {
      const key = event.start.format('YYYY-MM-DD')
      ensure(key).events.push(event)
    })

    map.forEach((bucket) => {
      bucket.sessions.sort((a, b) => a.start.valueOf() - b.start.valueOf())
      bucket.events.sort((a, b) => a.start.valueOf() - b.start.valueOf())
    })

    return map
  }, [normalizedSessions, normalizedEvents])

  const selectedKey = selectedDate ? selectedDate.format('YYYY-MM-DD') : null
  const selectedRecords = selectedKey ? recordsByDate.get(selectedKey) : null
  const dailySessions = selectedRecords?.sessions ?? []
  const dailyEvents = useMemo(() => {
    const eventsList = selectedRecords?.events ?? []
    return [...eventsList].sort((a, b) => b.start.valueOf() - a.start.valueOf())
  }, [selectedRecords])

  const todayKey = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const renderDateCell = useCallback(
    (value) => {
      const key = value.format('YYYY-MM-DD')
      const summary = recordsByDate.get(key)
      const sessionCount = summary?.sessions.length ?? 0
      const eventCount = summary?.events.length ?? 0
      const isSelected = selectedDate ? value.isSame(selectedDate, 'day') : false
      const isToday = key === todayKey
      const isCurrentMonth = calendarValue ? value.isSame(calendarValue, 'month') : true

      return (
        <div
          style={{
            borderRadius: 8,
            padding: 8,
            minHeight: 78,
            background: isSelected ? '#e6f4ff' : undefined,
            border: isSelected ? '1px solid #1677ff' : '1px solid transparent',
            opacity: isCurrentMonth ? 1 : 0.45,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{value.date()}</span>
            {isToday ? <Tag color='blue'>今天</Tag> : null}
          </div>
          <Space direction='vertical' size={4} style={{ marginTop: 8 }}>
            {sessionCount > 0 ? <Tag color='geekblue'>番茄 {sessionCount}</Tag> : null}
            {eventCount > 0 ? <Tag color='purple'>事件 {eventCount}</Tag> : null}
            {sessionCount === 0 && eventCount === 0 ? (
              <Text type='secondary' style={{ fontSize: 12 }}>
                —
              </Text>
            ) : null}
          </Space>
        </div>
      )
    },
    [recordsByDate, selectedDate, todayKey, calendarValue],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <Space direction='vertical' size={4}>
        <Title level={3} style={{ margin: 0 }}>
          番茄鐘時間軸
        </Title>
        <Paragraph type='secondary' style={{ margin: 0 }}>
          檢視特定期間的操作與完成紀錄，了解自己在什麼時間完成了哪些任務。
        </Paragraph>
      </Space>

      <Card styles={{ body: { padding: 16 } }}>
        <Row gutter={[16, 16]} align='bottom'>
          <Col xs={24} md={16} lg={12}>
            <Space direction='vertical' size={8} style={{ width: '100%' }}>
              <Text type='secondary' style={{ fontSize: 12 }}>
                快速範圍
              </Text>
              <Segmented
                block
                value={segmentedValue}
                options={quickRangeOptions}
                onChange={(value) => {
                  applyQuickRange(value)
                }}
              />
              <Text type='secondary' style={{ fontSize: 12 }}>
                也可以直接在右側行事曆點選日期檢視當日詳情。
              </Text>
            </Space>
          </Col>
          <Col xs={24} md={8} lg={6}>
            <Space direction='vertical' size={8} style={{ width: '100%' }}>
              <Text type='secondary' style={{ fontSize: 12 }}>
                最短時長 (小時)
              </Text>
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                value={filters.minHours !== '' ? Number(filters.minHours) : null}
                onChange={handleMinHoursChange}
              />
              <Button
                onClick={() => applyQuickRange(activeRangeKey)}
                loading={isLoading}
                disabled={isCustomRange}
              >
                重新整理
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Text type='secondary'>完成番茄鐘</Text>
            <Title level={3} style={{ margin: 0 }}>
              {completedCount}
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Text type='secondary'>累積專注時間</Text>
            <Title level={3} style={{ margin: 0 }}>
              {totalHours} 小時
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Text type='secondary'>總事件筆數</Text>
            <Title level={3} style={{ margin: 0 }}>
              {events.length}
            </Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ flex: 1, minHeight: 0 }}>
        <Col xs={24} xl={12} style={{ display: 'flex', minHeight: 0 }}>
          <Card
            styles={{
              body: { padding: 16, height: '100%', display: 'flex', flexDirection: 'column' },
            }}
            style={{ width: '100%' }}
          >
            <Spin spinning={isLoading}>
              <AntdCalendar
                fullscreen={false}
                value={calendarValue}
                onSelect={(value) => {
                  selectDate(value)
                }}
                onPanelChange={(value) => setCalendarValue(value)}
                fullCellRender={renderDateCell}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} xl={12} style={{ display: 'flex', minHeight: 0 }}>
          <Card
            styles={{
              body: {
                padding: 16,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                overflow: 'hidden',
              },
            }}
            style={{ width: '100%' }}
          >
            <div style={{ flex: '0 0 auto' }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                當日番茄鐘
              </Title>
              {dailySessions.length ? (
                <List
                  dataSource={dailySessions}
                  rowKey={(item) => `session-${item.id}-${item.start.valueOf()}`}
                  style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 8 }}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction='vertical' size={4} style={{ width: '100%' }}>
                        <Space align='baseline' size={8}>
                          <Text strong>{item.title}</Text>
                          <Tag color='blue'>{item.durationLabel}</Tag>
                        </Space>
                        <Text type='secondary'>
                          {item.start.format('HH:mm:ss')} - {item.end.format('HH:mm:ss')}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description='當日無番茄鐘紀錄'
                />
              )}
            </div>

            <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                當日事件
              </Title>
              {dailyEvents.length ? (
                <Timeline
                  mode='left'
                  style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 10, margin: 0 }}
                  items={dailyEvents.map((item) => {
                    const hasPayload = item.payload && Object.keys(item.payload).length > 0
                    const color = getEventColor(item.eventType)
                    return {
                      dot: (
                        <Tooltip title={item.title}>
                          <span
                            style={{
                              display: 'inline-flex',
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: color,
                            }}
                          />
                        </Tooltip>
                      ),
                      key: `event-${item.id}-${item.start.valueOf()}`,
                      color,
                      label: null,
                      children: (
                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                          <Space align='baseline' size={8}>
                            <Text
                              strong
                              style={{
                                fontFamily: 'Menlo, Consolas, monospace',
                                minWidth: 80,
                              }}
                            >
                              {item.start.format('HH:mm:ss')}
                            </Text>
                            <Text strong>{item.title}</Text>
                            {item.tags?.map((tag) => (
                              <Tag key={tag.key} color={tag.color}>
                                {tag.label}
                              </Tag>
                            ))}
                          </Space>
                          <Text type='secondary'>
                            {item.start.format('HH:mm:ss')} - {item.end.format('HH:mm:ss')}
                          </Text>
                          {hasPayload ? (
                            <Tooltip
                              title={
                                <pre style={{ margin: 0 }}>
                                  {JSON.stringify(item.payload, null, 2)}
                                </pre>
                              }
                              placement='topLeft'
                            >
                              <Text type='secondary' style={{ fontSize: 12 }}>
                                查看事件內容
                              </Text>
                            </Tooltip>
                          ) : null}
                        </Space>
                      ),
                    }
                  })}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description='當日無事件紀錄'
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
