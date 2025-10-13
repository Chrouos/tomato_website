import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  NumberInput,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  LuCalendar,
  LuClock,
  LuCheck,
  LuMinus,
  LuPause,
  LuPlay,
  LuPlus,
  LuRotateCcw,
} from 'react-icons/lu'

const ONE_MINUTE = 60
const INITIAL_MINUTES = 25

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`
}

function formatTimeOfDay(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function TomatoTimer() {
  const [initialSeconds, setInitialSeconds] = useState(
    INITIAL_MINUTES * ONE_MINUTE,
  )
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [inputMinutes, setInputMinutes] = useState(() =>
    Math.floor(initialSeconds / ONE_MINUTE),
  )
  const [inputSeconds, setInputSeconds] = useState(
    initialSeconds % ONE_MINUTE,
  )
  const [sessionStart, setSessionStart] = useState(null)
  const [sessionEnd, setSessionEnd] = useState(null)
  const eventId = useRef(0)
  const [eventLog, setEventLog] = useState([])

  const logEvent = useCallback((type, detail = {}) => {
    eventId.current += 1
    setEventLog((prev) => [
      {
        id: eventId.current,
        type,
        timestamp: new Date(),
        ...detail,
      },
      ...prev,
    ])
  }, [])

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) {
      return
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          setSessionEnd(new Date())
          logEvent('complete', { totalSeconds: initialSeconds })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, secondsLeft, initialSeconds, logEvent])

  const timeLabel = useMemo(() => formatTime(secondsLeft), [secondsLeft])

  useEffect(() => {
    if (!isRunning) {
      setInputMinutes(Math.floor(secondsLeft / ONE_MINUTE))
      setInputSeconds(secondsLeft % ONE_MINUTE)
    }
  }, [secondsLeft, isRunning])

  const handleAdjust = (deltaMinutes) => {
    if (isRunning) {
      return
    }
    setSecondsLeft((prev) => {
      const deltaSeconds = deltaMinutes * ONE_MINUTE
      const next = Math.max(prev + deltaSeconds, 0)
      setInitialSeconds(next)
      setSessionStart(null)
      setSessionEnd(null)
      return next
    })
  }

  const handleReset = () => {
    setSecondsLeft(initialSeconds)
    setIsRunning(false)
    setSessionStart(null)
    setSessionEnd(null)
    logEvent('reset', { totalSeconds: initialSeconds })
  }

  const commitInputValues = (minutes, seconds) => {
    const safeMinutes = Math.max(Math.floor(Number(minutes) || 0), 0)
    const safeSeconds = Math.min(
      Math.max(Math.floor(Number(seconds) || 0), 0),
      ONE_MINUTE - 1,
    )
    setInputMinutes(safeMinutes)
    setInputSeconds(safeSeconds)
    const totalSeconds = safeMinutes * ONE_MINUTE + safeSeconds
    setInitialSeconds(totalSeconds)
    setSecondsLeft(totalSeconds)
    setSessionStart(null)
    setSessionEnd(null)
  }

  const handleMinutesChange = ({ valueAsNumber }) => {
    const next = Number.isNaN(valueAsNumber) ? 0 : Math.max(valueAsNumber, 0)
    setInputMinutes(Math.floor(next))
  }

  const handleSecondsChange = ({ valueAsNumber }) => {
    const raw = Number.isNaN(valueAsNumber) ? 0 : valueAsNumber
    const clamped = Math.min(Math.max(raw, 0), ONE_MINUTE - 1)
    setInputSeconds(Math.floor(clamped))
  }

  const handleInputsCommit = () => {
    if (isRunning) return
    commitInputValues(inputMinutes, inputSeconds)
  }

  const handleToggle = () => {
    if (isRunning) {
      setIsRunning(false)
      setSessionEnd(null)
      logEvent('pause', { remainingSeconds: secondsLeft })
      return
    }

    if (secondsLeft <= 0) {
      return
    }

    const now = new Date()
    const hasStartedBefore = sessionStart !== null
    if (!hasStartedBefore) {
      setSessionStart(now)
    }
    setSessionEnd(new Date(now.getTime() + secondsLeft * 1000))

    const eventType =
      hasStartedBefore && secondsLeft !== initialSeconds ? 'resume' : 'start'
    logEvent(eventType, { remainingSeconds: secondsLeft })
    setIsRunning(true)
  }

  const sessionStatus = (() => {
    if (isRunning) return '進行中'
    if (secondsLeft === 0 && (sessionStart || sessionEnd)) return '已完成'
    return '待機'
  })()

  const sessionStatusColor = isRunning
    ? 'green'
    : secondsLeft === 0 && (sessionStart || sessionEnd)
      ? 'purple'
      : 'gray'

  const sessionStartLabel = sessionStart
    ? formatTimeOfDay(sessionStart)
    : '--:--'
  const sessionEndLabel = sessionEnd ? formatTimeOfDay(sessionEnd) : '--:--'

  return (
    <Stack
      direction={{ base: 'column', lg: 'row' }}
      gap='6'
      width='full'
      align='stretch'
      justify='center'
    >
      <Box
        borderWidth='1px'
        borderRadius='xl'
        padding={{ base: '6', md: '8' }}
        width='full'
        background='bg.surface'
        boxShadow='sm'
      >
        <Stack gap='6'>
          <Stack gap='2' align='center'>
            <Heading size='lg'>番茄鐘</Heading>
            <Text color='fg.muted'>保持專注，善用番茄鐘節奏。</Text>
          </Stack>

          <Stack gap='4' align='center'>
            <Stack align='center' gap='3'>
              <Text fontSize='7xl' fontWeight='semibold'>
                {timeLabel}
              </Text>
              <Stack width='full' maxW='64' gap='3'>
                <Text fontSize='sm' textAlign='center' color='fg.muted'>
                  手動設定時間
                </Text>
                <HStack gap='3' justify='center'>
                  <Stack align='center' gap='1'>
                    <Text fontSize='xs' color='fg.muted'>
                      分鐘
                    </Text>
                    <NumberInput.Root
                      width='24'
                      value={String(inputMinutes)}
                      onValueChange={handleMinutesChange}
                      min={0}
                      max={999}
                      keepWithinRange={false}
                      clampValueOnBlur={false}
                      disabled={isRunning}
                    >
                      <NumberInput.Control />
                      <NumberInput.Input
                        textAlign='center'
                        onBlur={handleInputsCommit}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                        inputMode='numeric'
                        pattern='[0-9]*'
                      />
                    </NumberInput.Root>
                  </Stack>
                  <Text fontSize='lg' fontWeight='medium' color='fg.muted'>
                    :
                  </Text>
                  <Stack align='center' gap='1'>
                    <Text fontSize='xs' color='fg.muted'>
                      秒
                    </Text>
                    <NumberInput.Root
                      width='24'
                      value={String(inputSeconds)}
                      onValueChange={handleSecondsChange}
                      min={0}
                      max={59}
                      keepWithinRange
                      clampValueOnBlur={false}
                      disabled={isRunning}
                    >
                      <NumberInput.Control />
                      <NumberInput.Input
                        textAlign='center'
                        onBlur={handleInputsCommit}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                        inputMode='numeric'
                        pattern='[0-9]*'
                      />
                    </NumberInput.Root>
                  </Stack>
                </HStack>
              </Stack>
            </Stack>
            <HStack gap='2'>
              <Button
                leftIcon={<LuMinus />}
                onClick={() => handleAdjust(-1)}
                disabled={isRunning || secondsLeft <= 0}
                variant='outline'
                size='sm'
              >
                -1 分鐘
              </Button>
              <Button
                rightIcon={<LuPlus />}
                onClick={() => handleAdjust(1)}
                variant='outline'
                size='sm'
                disabled={isRunning}
              >
                +1 分鐘
              </Button>
            </HStack>
            <HStack gap='3'>
              <Button
                onClick={handleToggle}
                colorScheme={isRunning ? 'orange' : 'green'}
                width='32'
              >
                {isRunning ? '暫停' : '開始'}
              </Button>
              <Button variant='outline' onClick={handleReset}>
                重置
              </Button>
            </HStack>
          </Stack>

          <Text fontSize='sm' color='fg.muted' textAlign='center'>
            小技巧：一次專注 25 分鐘，接著短暫休息 5 分鐘。
          </Text>
        </Stack>
      </Box>

      <Box
        borderWidth='1px'
        borderRadius='xl'
        padding={{ base: '6', md: '8' }}
        width='full'
        maxW={{ base: 'full', lg: 'sm' }}
        background='bg.subtle'
        boxShadow='sm'
      >
        <Stack gap='6'>
          <Stack align='center' gap='3'>
            <Heading size='md'>番茄時間軸</Heading>
            <Badge colorPalette={sessionStatusColor}>{sessionStatus}</Badge>
          </Stack>
          <Stack gap='4'>
            <HStack gap='3' align='center'>
              <Icon as={LuCalendar} boxSize='6' color='fg.muted' />
              <Stack gap='0'>
                <Text fontSize='sm' color='fg.muted'>
                  日期
                </Text>
                <Text fontWeight='medium'>
                  {sessionStart
                    ? new Intl.DateTimeFormat('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                      }).format(sessionStart)
                    : new Intl.DateTimeFormat('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                      }).format(new Date())}
                </Text>
              </Stack>
            </HStack>
            <HStack gap='3' align='center'>
              <Icon as={LuClock} boxSize='6' color='fg.muted' />
              <Stack gap='0'>
                <Text fontSize='sm' color='fg.muted'>
                  番茄鐘時段
                </Text>
                <Text fontWeight='medium'>
                  {sessionStartLabel} → {sessionEndLabel}
                </Text>
              </Stack>
            </HStack>
          </Stack>
          <Stack gap='3'>
            <Text fontSize='sm' color='fg.muted'>
              操作紀錄
            </Text>
            <Stack gap='3' maxHeight='56' overflowY='auto' paddingEnd='1'>
              {eventLog.length === 0 ? (
                <Text fontSize='sm' color='fg.muted'>
                  目前尚未有番茄鐘操作。
                </Text>
              ) : (
                eventLog.map((event) => {
                  const descriptors = {
                    start: { label: '開始', icon: LuPlay, color: 'green' },
                    resume: { label: '繼續', icon: LuPlay, color: 'green' },
                    pause: { label: '暫停', icon: LuPause, color: 'orange' },
                    reset: { label: '重置', icon: LuRotateCcw, color: 'gray' },
                    complete: {
                      label: '結束',
                      icon: LuCheck,
                      color: 'purple',
                    },
                  }
                  const meta =
                    descriptors[event.type] ?? {
                      label: '未知事件',
                      icon: LuClock,
                      color: 'gray',
                    }

                  let detail = null
                  if (event.type === 'start') {
                    if (typeof event.remainingSeconds === 'number') {
                      detail = `倒數 ${formatTime(event.remainingSeconds)}`
                    }
                  } else if (
                    event.type === 'resume' ||
                    event.type === 'pause'
                  ) {
                    if (typeof event.remainingSeconds === 'number') {
                      detail = `剩餘 ${formatTime(event.remainingSeconds)}`
                    }
                  } else if (event.type === 'reset') {
                    if (typeof event.totalSeconds === 'number') {
                      detail = `重設為 ${formatTime(event.totalSeconds)}`
                    }
                  } else if (event.type === 'complete') {
                    detail = '番茄鐘完成'
                  }

                  return (
                    <HStack key={event.id} align='flex-start' gap='3'>
                      <Icon
                        as={meta.icon}
                        boxSize='5'
                        color={`${meta.color}.500`}
                        marginTop='1'
                      />
                      <Stack gap='0' flex='1'>
                        <HStack justify='space-between'>
                          <Text fontWeight='medium'>{meta.label}</Text>
                          <Text fontSize='xs' color='fg.muted'>
                            {formatTimeOfDay(event.timestamp)}
                          </Text>
                        </HStack>
                        {detail && (
                          <Text fontSize='xs' color='fg.muted'>
                            {detail}
                          </Text>
                        )}
                      </Stack>
                    </HStack>
                  )
                })
              )}
            </Stack>
          </Stack>
          <Text fontSize='sm' color='fg.muted'>
            點擊開始後會自動記錄預計完成時間；完成後可參考這裡做工作紀錄。
          </Text>
        </Stack>
      </Box>
    </Stack>
  )
}
