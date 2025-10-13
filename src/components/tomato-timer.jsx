import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  Badge,
  Box,
  Button,
  ButtonGroup,
  HStack,
  Heading,
  Icon,
  Input,
  NumberInput,
  Stack,
  Tag,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import {
  LuCalendar,
  LuClipboardList,
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
const DEFAULT_CATEGORIES = [
  { id: 'deep-work', label: '深度工作' },
  { id: 'learning', label: '學習' },
  { id: 'meeting', label: '會議/討論' },
  { id: 'break', label: '安排休息' },
]

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
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    DEFAULT_CATEGORIES[0]?.id ?? null,
  )
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const eventId = useRef(0)
  const [eventLog, setEventLog] = useState([])

  const getCategorySnapshot = useCallback(
    (categoryId) => {
      if (!categoryId) {
        return {
          categoryId: null,
          categoryLabel: '未指定',
        }
      }
      const category = categories.find((item) => item.id === categoryId)
      return {
        categoryId,
        categoryLabel: category?.label ?? '未指定',
      }
    },
    [categories],
  )

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
    if (categories.length === 0) {
      setSelectedCategoryId(null)
      return
    }
    if (!selectedCategoryId || !categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories, selectedCategoryId])

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) {
      return
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          setSessionEnd(new Date())
          const categorySnapshot = getCategorySnapshot(activeCategoryId)
          logEvent('complete', {
            totalSeconds: initialSeconds,
            ...categorySnapshot,
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [
    isRunning,
    secondsLeft,
    initialSeconds,
    activeCategoryId,
    getCategorySnapshot,
    logEvent,
  ])

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
      setActiveCategoryId(null)
      return next
    })
  }

  const handleReset = () => {
    setSecondsLeft(initialSeconds)
    setIsRunning(false)
    setSessionStart(null)
    setSessionEnd(null)
    const categorySnapshot = getCategorySnapshot(
      selectedCategoryId ?? activeCategoryId,
    )
    setActiveCategoryId(null)
    logEvent('reset', {
      totalSeconds: initialSeconds,
      ...categorySnapshot,
    })
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
    setActiveCategoryId(null)
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
      const categorySnapshot = getCategorySnapshot(activeCategoryId)
      logEvent('pause', {
        remainingSeconds: secondsLeft,
        ...categorySnapshot,
      })
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

    const baseCategoryId = hasStartedBefore
      ? activeCategoryId ?? selectedCategoryId
      : selectedCategoryId

    if (!baseCategoryId) {
      return
    }

    if (!hasStartedBefore || !activeCategoryId) {
      setActiveCategoryId(baseCategoryId)
    }

    setSessionEnd(new Date(now.getTime() + secondsLeft * 1000))

    const eventType =
      hasStartedBefore && secondsLeft !== initialSeconds ? 'resume' : 'start'
    const categorySnapshot = getCategorySnapshot(baseCategoryId)
    logEvent(eventType, {
      remainingSeconds: secondsLeft,
      ...categorySnapshot,
    })
    setIsRunning(true)
  }

  const handleAddCategory = () => {
    const trimmed = newCategoryLabel.trim()
    if (!trimmed) return

    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/gi, '')
      .replace(/\s+/g, '-')
    const id = `${slug || 'category'}-${Date.now()}`
    const nextCategory = { id, label: trimmed }
    setCategories((prev) => [...prev, nextCategory])
    setSelectedCategoryId(id)
    setNewCategoryLabel('')
  }

  const handleRemoveCategory = (id) => {
    if (isRunning) return
    setCategories((prev) => prev.filter((category) => category.id !== id))
    setSelectedCategoryId((current) => (current === id ? null : current))
    setActiveCategoryId((current) => (current === id ? null : current))
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
  const activeCategoryLabel = getCategorySnapshot(
    activeCategoryId ?? selectedCategoryId,
  ).categoryLabel
  const startButtonLabel = isRunning ? '暫停' : sessionStart ? '繼續' : '開始'
  const isStartDisabled =
    (!isRunning && (!selectedCategoryId || secondsLeft <= 0)) || false

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

          <Stack gap='6' align='center'>
            <Stack align='center' gap='2'>
              <Text fontSize='7xl' fontWeight='semibold'>
                {timeLabel}
              </Text>
              <Stack align='center' gap='1'>
                <Text fontSize='xs' color='fg.muted'>
                  目前類別
                </Text>
                <Badge colorPalette={
                  activeCategoryId ?? selectedCategoryId ? 'teal' : 'gray'
                }>
                  {activeCategoryLabel}
                </Badge>
              </Stack>
            </Stack>
            <ButtonGroup spacing='3'>
              <Button
                onClick={handleToggle}
                colorScheme={isRunning ? 'orange' : 'green'}
                minW='32'
                isDisabled={isStartDisabled}
              >
                {startButtonLabel}
              </Button>
              <Button variant='outline' onClick={handleReset}>
                重置
              </Button>
            </ButtonGroup>
            <Accordion.Root width='full' maxW='64' collapsible>
              <Accordion.Item value='time'>
                <Box borderWidth='1px' borderRadius='lg' overflow='hidden'>
                  <Accordion.ItemTrigger px='4' py='3'>
                    <HStack justify='space-between' flex='1'>
                      <Text fontSize='sm' fontWeight='medium'>
                        手動設定時間
                      </Text>
                      <Accordion.ItemIndicator />
                    </HStack>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent px='4' pb='4'>
                    <Stack gap='4'>
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
                      <HStack gap='2' justify='center'>
                        <Button
                          leftIcon={<LuMinus />}
                          onClick={() => handleAdjust(-1)}
                          isDisabled={isRunning || secondsLeft <= 0}
                          variant='outline'
                          size='sm'
                          _disabled={{
                            opacity: 1,
                            bg: 'gray.200',
                            color: 'fg.muted',
                            borderColor: 'gray.300',
                          }}
                        >
                          -1 分鐘
                        </Button>
                        <Button
                          rightIcon={<LuPlus />}
                          onClick={() => handleAdjust(1)}
                          variant='outline'
                          size='sm'
                          isDisabled={isRunning}
                          _disabled={{
                            opacity: 1,
                            bg: 'gray.200',
                            color: 'fg.muted',
                            borderColor: 'gray.300',
                          }}
                        >
                          +1 分鐘
                        </Button>
                      </HStack>
                    </Stack>
                  </Accordion.ItemContent>
                </Box>
              </Accordion.Item>
              <Accordion.Item value='category'>
                <Box borderWidth='1px' borderRadius='lg' overflow='hidden'>
                  <Accordion.ItemTrigger px='4' py='3'>
                    <HStack justify='space-between' flex='1'>
                      <Text fontSize='sm' fontWeight='medium'>
                        管理工作類別
                      </Text>
                      <Accordion.ItemIndicator />
                    </HStack>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent px='4' pb='4'>
                    <Stack gap='3'>
                      {categories.length > 0 ? (
                        <Wrap justify='center' spacing='2'>
                          {categories.map((category) => (
                            <WrapItem key={category.id}>
                              <Tag.Root
                                variant={
                                  category.id === selectedCategoryId
                                    ? 'solid'
                                    : 'subtle'
                                }
                                colorPalette='teal'
                                cursor={isRunning ? 'not-allowed' : 'pointer'}
                                opacity={isRunning ? 0.7 : 1}
                                onClick={() => {
                                  if (!isRunning) {
                                    setSelectedCategoryId(category.id)
                                  }
                                }}
                              >
                                <Tag.Label>{category.label}</Tag.Label>
                                <Tag.EndElement>
                                  <Tag.CloseTrigger
                                    disabled={isRunning}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleRemoveCategory(category.id)
                                    }}
                                  />
                                </Tag.EndElement>
                              </Tag.Root>
                            </WrapItem>
                          ))}
                        </Wrap>
                      ) : (
                        <Text fontSize='sm' color='fg.muted' textAlign='center'>
                          請先新增一個工作類別。
                        </Text>
                      )}
                      <HStack>
                        <Input
                          size='sm'
                          placeholder='新增類別'
                          value={newCategoryLabel}
                          onChange={(event) => setNewCategoryLabel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              handleAddCategory()
                            }
                          }}
                          isDisabled={isRunning}
                        />
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={handleAddCategory}
                          isDisabled={
                            isRunning || newCategoryLabel.trim() === ''
                          }
                        >
                          新增
                        </Button>
                      </HStack>
                    </Stack>
                  </Accordion.ItemContent>
                </Box>
              </Accordion.Item>
            </Accordion.Root>
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
            <HStack gap='3' align='center'>
              <Icon as={LuClipboardList} boxSize='6' color='fg.muted' />
              <Stack gap='0'>
                <Text fontSize='sm' color='fg.muted'>
                  工作類別
                </Text>
                <Text fontWeight='medium'>{activeCategoryLabel}</Text>
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
                        {event.categoryLabel && (
                          <Text fontSize='xs' color='fg.muted'>
                            類別：{event.categoryLabel}
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
