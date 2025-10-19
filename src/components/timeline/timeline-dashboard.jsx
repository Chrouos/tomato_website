import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useAuth } from '../../lib/auth-context.jsx'
import { fetchEvents, fetchSessions } from '../../lib/api.js'
import { toaster } from '../ui/toaster.jsx'
import { Tooltip } from '../ui/tooltip.jsx'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const DEFAULT_RANGE_DAYS = 7
const ONE_HOUR = 60 * 60

const locales = {
  'zh-TW': zhTW,
  zh: zhTW,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
})

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

  const handleFilterChange = (field) => (event) => {
    const value = event?.target?.value ?? ''
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

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

  const calendarEvents = useMemo(() => {
    const items = []

    sessions.forEach((session) => {
      let end = session.completedAt
        ? new Date(session.completedAt)
        : session.startedAt
          ? new Date(session.startedAt)
          : null
      const durationSeconds = session.durationSeconds ?? 0
      let start = session.startedAt ? new Date(session.startedAt) : null

      if (!start && end && durationSeconds > 0) {
        start = new Date(end.getTime() - durationSeconds * 1000)
      }

      if (start && !end) {
        end = new Date(start.getTime() + (durationSeconds > 0 ? durationSeconds * 1000 : 25 * 60 * 1000))
      }

      if (!start) {
        const fallback = new Date()
        start = fallback
      }

      if (!end) {
        end = new Date(start.getTime() + 25 * 60 * 1000)
      }

      items.push({
        id: `session-${session.id}`,
        title: `${session.categoryLabel ?? '番茄鐘'}`,
        start,
        end,
        type: 'session',
        raw: session,
      })
    })

    events.forEach((event) => {
      if (!event.occurredAt) return
      const start = new Date(event.occurredAt)
      const end = addMinutes(start, 5)
      items.push({
        id: `event-${event.id}`,
        title: `${event.eventType}`,
        start,
        end,
        type: 'event',
        raw: event,
      })
    })

    return items
  }, [sessions, events])

  const eventPropGetter = useCallback((event) => {
    if (event.type === 'session') {
      return {
        className: 'timeline-event timeline-event-session',
        style: {
          backgroundColor: '#805AD5',
          border: 'none',
          color: 'white',
        },
      }
    }
    return {
      className: 'timeline-event timeline-event-action',
      style: {
        backgroundColor: '#3182CE',
        border: 'none',
        color: 'white',
        opacity: 0.9,
      },
    }
  }, [])

  const EventComponent = useCallback((eventWrapperProps) => {
    const { event, style, className } = eventWrapperProps
    const label = (() => {
      if (event.type === 'session') {
        const { raw } = event
        const durationHours = Math.round(((raw.durationSeconds ?? 0) / ONE_HOUR) * 10) / 10
        const startedAt = raw.startedAt ? new Date(raw.startedAt) : null
        const completedAt = raw.completedAt ? new Date(raw.completedAt) : null
        const startedLabel = startedAt ? `${format(startedAt, 'yyyy/MM/dd HH:mm')}` : '未知'
        const completedLabel = completedAt ? `${format(completedAt, 'yyyy/MM/dd HH:mm')}` : '未完成'
        return `${raw.categoryLabel ?? '番茄鐘'}\n開始：${startedLabel}\n結束：${completedLabel}\n時長：約 ${durationHours} 小時`
      }

      const { raw } = event
      const occurredAt = raw.occurredAt ? new Date(raw.occurredAt) : null
      const startLabel = occurredAt ? format(occurredAt, 'yyyy/MM/dd HH:mm') : '未知'
      const endLabel = occurredAt ? format(addMinutes(occurredAt, 5), 'yyyy/MM/dd HH:mm') : '未知'
      const payload = raw.payload && Object.keys(raw.payload).length > 0 ? `\n內容：${JSON.stringify(raw.payload)}` : ''
      return `${raw.eventType}${raw.sessionKey ? ` (Session: ${raw.sessionKey})` : ''}\n開始：${startLabel}\n結束：${endLabel}${payload}`
    })()

    return (
      <Tooltip
        showArrow
        openDelay={150}
        closeDelay={100}
        placement='top'
        content={label}
        contentProps={{ whiteSpace: 'pre-line' }}
      >
        <Box
          className={className}
          style={{
            ...style,
            borderRadius: '6px',
            padding: '4px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontWeight: 600,
          }}
        >
          <Text fontSize='xs' lineHeight='1'>
            {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
          </Text>
          <Text fontSize='sm' lineHeight='1.2'>
            {event.title}
          </Text>
        </Box>
      </Tooltip>
    )
  }, [])

  const defaultDate = useMemo(() => {
    if (filters.to) {
      const endDate = endOfDay(filters.to)
      if (endDate) return endDate
    }
    return new Date()
  }, [filters.to])

  return (
    <Stack gap='6' height='100%' overflow='hidden'>
      <Stack gap='1'>
        <Heading size='lg'>番茄鐘時間軸</Heading>
        <Text color='fg.muted'>
          檢視特定期間的操作與完成紀錄，了解自己在什麼時間完成了哪些任務。
        </Text>
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing='4'>
        <Stack gap='2'>
          <Text fontSize='sm' fontWeight='semibold'>
            開始日期
          </Text>
          <Input
            type='date'
            value={filters.from}
            max={filters.to || undefined}
            onChange={handleFilterChange('from')}
          />
        </Stack>
        <Stack gap='2'>
          <Text fontSize='sm' fontWeight='semibold'>
            結束日期
          </Text>
          <Input
            type='date'
            value={filters.to}
            min={filters.from || undefined}
            onChange={handleFilterChange('to')}
          />
        </Stack>
        <Stack gap='2'>
          <Text fontSize='sm' fontWeight='semibold'>
            最短時長 (小時)
          </Text>
          <Input
            type='number'
            min='0'
            value={filters.minHours}
            onChange={handleFilterChange('minHours')}
          />
        </Stack>
        <Stack gap='2' justify='flex-end'>
          <Button
            w='full'
            variant='outline'
            isLoading={isLoading}
            onClick={() => setFilters((prev) => ({ ...prev }))}
          >
            重新整理
          </Button>
        </Stack>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing='4'>
        <Box borderWidth='1px' borderRadius='md' p='4'>
          <Text fontSize='sm' color='fg.muted'>
            完成番茄鐘
          </Text>
          <Heading size='lg'>{completedCount}</Heading>
        </Box>
        <Box borderWidth='1px' borderRadius='md' p='4'>
          <Text fontSize='sm' color='fg.muted'>
            累積專注時間
          </Text>
          <Heading size='lg'>{totalHours} 小時</Heading>
        </Box>
        <Box borderWidth='1px' borderRadius='md' p='4'>
          <Text fontSize='sm' color='fg.muted'>
            總事件筆數
          </Text>
          <Heading size='lg'>{events.length}</Heading>
        </Box>
      </SimpleGrid>

      <Box borderWidth='1px' borderRadius='lg' flex='1' minH='0' overflow='hidden'>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor='start'
          endAccessor='end'
          style={{ height: '100%', minHeight: '500px' }}
          defaultView={Views.WEEK}
          views={['day', 'week', 'month']}
          step={30}
          defaultDate={defaultDate}
          eventPropGetter={eventPropGetter}
          dayLayoutAlgorithm='no-overlap'
          components={{
            event: EventComponent,
          }}
          messages={{
            today: '今天',
            previous: '上一頁',
            next: '下一頁',
            month: '月',
            week: '週',
            day: '日',
            agenda: '清單',
            showMore: (total) => `+${total} 更多`,
          }}
          tooltipAccessor={(event) => {
            if (event.type === 'session') {
              return `${event.raw.categoryLabel ?? '番茄鐘'}\n時長：${Math.round(((event.raw.durationSeconds ?? 0) / ONE_HOUR) * 10) / 10} 小時`
            }
            return `${event.title}\n${event.raw.sessionKey ?? ''}`
          }}
        />
      </Box>
    </Stack>
  )
}
