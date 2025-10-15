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
  Tooltip,
} from '@chakra-ui/react'
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useAuth } from '../../lib/auth-context.jsx'
import { fetchEvents, fetchSessions } from '../../lib/api.js'
import { toaster } from '../ui/toaster.jsx'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const DEFAULT_RANGE_DAYS = 7

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
      minMinutes: '0',
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
          Number(filters.minMinutes) > 0 ? Number(filters.minMinutes) * 60 : undefined

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

  const totalMinutes = useMemo(() => {
    if (!sessions.length) return 0
    const seconds = sessions.reduce((acc, session) => acc + (session.durationSeconds ?? 0), 0)
    return Math.round((seconds / 60) * 10) / 10
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
        title: `${session.categoryLabel ?? '番茄鐘'} · ${Math.round((session.durationSeconds ?? 0) / 60)} 分鐘`,
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
        title: `${event.eventType}${event.sessionKey ? ` · ${event.sessionKey.slice(0, 6)}` : ''}`,
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
        style: {
          backgroundColor: '#805AD5',
          borderRadius: '6px',
          border: 'none',
          color: 'white',
        },
      }
    }
    return {
      style: {
        backgroundColor: '#3182CE',
        borderRadius: '6px',
        border: 'none',
        color: 'white',
        opacity: 0.85,
      },
    }
  }, [])

  const EventComponent = useCallback((eventWrapperProps) => {
    const { event } = eventWrapperProps
    const label = (() => {
      if (event.type === 'session') {
        const { raw } = event
        const duration = Math.round((raw.durationSeconds ?? 0) / 60)
        const started = raw.startedAt ? new Date(raw.startedAt).toLocaleString() : '未知'
        const ended = raw.completedAt ? new Date(raw.completedAt).toLocaleString() : '未完成'
        return `${raw.categoryLabel ?? '番茄鐘'}\n開始：${started}\n結束：${ended}\n時長：約 ${duration} 分鐘`
      }

      const { raw } = event
      const occurred = raw.occurredAt ? new Date(raw.occurredAt).toLocaleString() : '未知'
      const payload = raw.payload && Object.keys(raw.payload).length > 0 ? `\n內容：${JSON.stringify(raw.payload)}` : ''
      return `${raw.eventType}${raw.sessionKey ? ` (Session: ${raw.sessionKey})` : ''}\n時間：${occurred}${payload}`
    })()

    return (
      <Tooltip.Root openDelay={150} closeDelay={100} gutter={8} placement='top'>
        <Tooltip.Trigger asChild>
          <Box as='span'>{event.title}</Box>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content whiteSpace='pre-line'>{label}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
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
            最短時長 (分鐘)
          </Text>
          <Input
            type='number'
            min='0'
            value={filters.minMinutes}
            onChange={handleFilterChange('minMinutes')}
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
          <Heading size='lg'>{totalMinutes} 分鐘</Heading>
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
              return `${event.raw.categoryLabel ?? '番茄鐘'}\n時長：${Math.round((event.raw.durationSeconds ?? 0) / 60)} 分鐘`
            }
            return `${event.title}\n${event.raw.sessionKey ?? ''}`
          }}
        />
      </Box>
    </Stack>
  )
}
