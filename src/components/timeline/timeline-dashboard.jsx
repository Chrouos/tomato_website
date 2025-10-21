import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Calendar as AntdCalendar,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  InputNumber,
  List,
  Row,
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

const DEFAULT_RANGE_DAYS = 7
const ONE_HOUR = 60 * 60

function formatDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date
}

function formatDurationLabel(durationSeconds) {
  if (!durationSeconds || Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    return '約 25 分'
  }
  const minutes = Math.round(durationSeconds / 60)
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10
    return `約 ${hours} 小時`
  }
  return `約 ${minutes} 分`
}

function getEventColor(eventType) {
  if (!eventType) return 'gray'
  if (eventType.includes('complete')) return 'green'
  if (eventType.includes('reset') || eventType.includes('reopen')) return 'orange'
  if (eventType.includes('delete')) return 'red'
  if (eventType.includes('add')) return 'blue'
  return 'purple'
}

function getEventLabel(eventType) {
  if (!eventType) return '事件'
  const map = {
    'todo-add': '新增待辦',
    'todo-complete': '完成待辦',
    'todo-reopen': '還原待辦',
    'daily-todo-add': '新增每日任務',
    'daily-todo-complete': '完成每日任務',
    'daily-todo-reset': '重新開始每日任務',
    'daily-todo-delete': '刪除每日任務',
    start: '開始番茄鐘',
    resume: '繼續番茄鐘',
    pause: '暫停番茄鐘',
    reset: '重置番茄鐘',
    complete: '番茄鐘完成',
  }
  if (map[eventType]) return map[eventType]
  const normalized = eventType.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  return normalized
}

function getEventTags(event) {
  const tags = []
  const payload = event?.payload ?? {}
  const eventType = event?.eventType ?? ''
  const categoryLabel = payload.categoryLabel ?? event?.categoryLabel ?? null
  const todoTitle =
    payload.todoTitle ??
    payload.title ??
    payload.todo?.title ??
    (typeof event?.title === 'string' && eventType.includes('todo') ? event.title : null)
  const isTodoEvent = /todo/i.test(eventType)
  const isPomodoroEvent = ['start', 'resume', 'pause', 'reset', 'complete'].includes(eventType)

  if (todoTitle) {
    tags.push({
      key: `todo-${todoTitle}`,
      label: todoTitle,
      color: 'blue',
    })
  }

  if (categoryLabel && (isPomodoroEvent || !isTodoEvent)) {
    tags.push({
      key: `category-${categoryLabel}`,
      label: categoryLabel,
      color: 'geekblue',
    })
  } else if (categoryLabel && isTodoEvent) {
    tags.push({
      key: `category-${categoryLabel}`,
      label: categoryLabel,
      color: 'purple',
    })
  }

  if (event?.sessionKey) {
    tags.push({
      key: `session-${event.sessionKey}`,
      label: `Session ${event.sessionKey.slice(-6)}`,
      color: 'default',
    })
  }

  return tags
}

export function TimelineDashboard() {
  const { token, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [events, setEvents] = useState([])
  const [filters, setFilters] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (DEFAULT_RANGE_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return {
      from: formatDateInput(start),
      to: formatDateInput(end),
      minHours: '0',
    }
  })

  const { Title, Paragraph, Text } = Typography
  const { RangePicker } = DatePicker

  const [calendarValue, setCalendarValue] = useState(() =>
    dayjs(filters.to || formatDateInput(new Date())),
  )
  const [selectedDate, setSelectedDate] = useState(() =>
    dayjs(filters.to || formatDateInput(new Date())),
  )

  const handleDateRangeChange = (dates) => {
    setFilters((prev) => ({
      ...prev,
      from: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : '',
      to: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : '',
    }))
  }

  const handleMinHoursChange = (value) => {
    setFilters((prev) => ({
      ...prev,
      minHours: value != null && !Number.isNaN(value) ? String(value) : '',
    }))
  }

  const dateRangeValue = useMemo(() => {
    const start = filters.from ? dayjs(filters.from) : null
    const end = filters.to ? dayjs(filters.to) : null
    if (!start && !end) return null
    return [start, end]
  }, [filters.from, filters.to])

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
  }, [filters.from, filters.to, selectedDate])

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

      <Card bodyStyle={{ padding: 16 }}>
        <Row gutter={[16, 16]} align='bottom'>
          <Col xs={24} md={12} lg={10}>
            <Space direction='vertical' size={8} style={{ width: '100%' }}>
              <Text type='secondary' style={{ fontSize: 12 }}>
                日期範圍
              </Text>
              <RangePicker
                value={dateRangeValue}
                allowClear
                style={{ width: '100%' }}
                onChange={handleDateRangeChange}
              />
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
            </Space>
          </Col>
          <Col
            xs={24}
            md={4}
            lg={4}
            style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}
          >
            <Button onClick={() => setFilters((prev) => ({ ...prev }))} loading={isLoading}>
              重新整理
            </Button>
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
            bodyStyle={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}
            style={{ width: '100%' }}
          >
            <Spin spinning={isLoading}>
              <AntdCalendar
                fullscreen={false}
                value={calendarValue}
                onSelect={(value) => {
                  setSelectedDate(value)
                  setCalendarValue(value)
                }}
                onPanelChange={(value) => setCalendarValue(value)}
                dateFullCellRender={renderDateCell}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} xl={12} style={{ display: 'flex', minHeight: 0 }}>
          <Card
            bodyStyle={{
              padding: 16,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              overflow: 'hidden',
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
