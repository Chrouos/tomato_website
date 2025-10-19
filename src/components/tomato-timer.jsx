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
import { useAuth } from '../lib/auth-context.jsx'
import {
  createEvent,
  createSession,
  fetchCategories,
  createCategory as createCategoryApi,
  deleteCategory as deleteCategoryApi,
} from '../lib/api.js'
import { toaster } from './ui/toaster.jsx'

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
    second: '2-digit',
  }).format(date)
}

export function TomatoTimer() {
  const { token, isAuthenticated } = useAuth()
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
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [todos, setTodos] = useState([])
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoCategoryId, setNewTodoCategoryId] = useState(null)
  const eventId = useRef(0)
  const [eventLog, setEventLog] = useState([])
  const [, setIsSyncingSession] = useState(false)
  const lastSyncedKeyRef = useRef(null)
  const sessionKeyRef = useRef(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState(null)

  const generateSessionKey = useCallback(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }, [])

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

  const logEvent = useCallback(
    (type, detail = {}, options = {}) => {
      const occurredAt = options.occurredAt instanceof Date ? options.occurredAt : new Date()
      const timestamp = occurredAt
      eventId.current += 1
      setEventLog((prev) => {
        const entry = {
          id: eventId.current,
          type,
          timestamp,
          ...detail,
        }
        const next = [entry, ...prev]
        next.sort((a, b) => {
          const timeDiff = b.timestamp.getTime() - a.timestamp.getTime()
          if (timeDiff !== 0) return timeDiff
          return b.id - a.id
        })
        return next
      })
      const resolvedSessionKey = (() => {
        if (options.sessionKey) {
          sessionKeyRef.current = options.sessionKey
          return options.sessionKey
        }
        if (sessionKeyRef.current) {
          return sessionKeyRef.current
        }
        const generated = generateSessionKey()
        sessionKeyRef.current = generated
        return generated
      })()

      if (isAuthenticated && token) {
        createEvent({
          token,
          event: {
            sessionKey: resolvedSessionKey,
            eventType: type,
            payload: detail,
            occurredAt: occurredAt.toISOString(),
          },
        }).catch((error) => {
          console.warn('Failed to record event', error)
        })
      }

      if (options.clearSessionKey) {
        sessionKeyRef.current = null
      }
    },
    [generateSessionKey, isAuthenticated, token],
  )

  const syncSession = useCallback(
    async ({ totalSeconds, categorySnapshot, finishedAt }) => {
      if (!isAuthenticated || !token) {
        return
      }

      const startedAtDate =
        sessionStart instanceof Date
          ? sessionStart
          : finishedAt instanceof Date
            ? new Date(finishedAt.getTime() - totalSeconds * 1000)
            : null

      const startedAtIso = startedAtDate ? startedAtDate.toISOString() : null
      const finishedAtIso = finishedAt instanceof Date ? finishedAt.toISOString() : null
      const dedupeKey = `${startedAtIso ?? 'unknown'}-${finishedAtIso ?? Date.now()}-${totalSeconds}-${categorySnapshot.categoryId ?? 'none'}`

      if (lastSyncedKeyRef.current === dedupeKey) {
        return
      }

      lastSyncedKeyRef.current = dedupeKey
      setIsSyncingSession(true)

      try {
        await createSession({
          token,
          session: {
            durationSeconds: totalSeconds,
            categoryId: categorySnapshot.categoryId,
            categoryLabel: categorySnapshot.categoryLabel,
            startedAt: startedAtIso,
            completedAt: finishedAtIso,
          },
        })
        toaster.create({
          title: '已同步番茄鐘紀錄',
          type: 'success',
        })
      } catch (error) {
        lastSyncedKeyRef.current = null
        toaster.create({
          title: '同步番茄鐘紀錄失敗',
          description: error.message,
          type: 'error',
        })
      } finally {
        setIsSyncingSession(false)
      }
    },
    [isAuthenticated, token, sessionStart],
  )

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      setIsLoadingCategories(true)
      try {
        const response = await fetchCategories({
          token: isAuthenticated && token ? token : undefined,
        })
        if (cancelled) return

        const items = Array.isArray(response?.items) ? response.items : []
        setCategories(items)
      } catch (error) {
        if (!cancelled) {
          setCategories([])
          toaster.create({
            title: '載入分類失敗',
            description: error.message,
            type: 'error',
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCategories(false)
        }
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryId(null)
      return
    }
    if (
      !selectedCategoryId ||
      !categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories, selectedCategoryId])

  useEffect(() => {
    if (
      categories.length === 0 ||
      (newTodoCategoryId &&
        categories.some((category) => category.id === newTodoCategoryId))
    ) {
      return
    }
    setNewTodoCategoryId(selectedCategoryId ?? categories[0]?.id ?? null)
  }, [categories, newTodoCategoryId, selectedCategoryId])

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) {
      return
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          const finishedAt = new Date()
          setSessionEnd(finishedAt)
          const categorySnapshot = getCategorySnapshot(activeCategoryId)
          logEvent(
            'complete',
            {
              totalSeconds: initialSeconds,
              ...categorySnapshot,
            },
            {
              occurredAt: finishedAt,
              clearSessionKey: true,
            },
          )
          syncSession({
            totalSeconds: initialSeconds,
            categorySnapshot,
            finishedAt,
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
    sessionStart,
    syncSession,
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
    logEvent(
      'reset',
      {
        totalSeconds: initialSeconds,
        ...categorySnapshot,
      },
      { clearSessionKey: true },
    )
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
      const now = new Date()
      logEvent(
        'pause',
        {
          remainingSeconds: secondsLeft,
          ...categorySnapshot,
        },
        { sessionKey: sessionKeyRef.current ?? undefined, occurredAt: now },
      )
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
    const sessionKey =
      eventType === 'start' || !sessionKeyRef.current
        ? generateSessionKey()
        : sessionKeyRef.current

    logEvent(
      eventType,
      {
        remainingSeconds: secondsLeft,
        ...categorySnapshot,
      },
      {
        sessionKey,
        occurredAt: now,
      },
    )
    setIsRunning(true)
  }

  const handleAddCategory = async () => {
    const trimmed = newCategoryLabel.trim()
    if (!trimmed) return
    if (!isAuthenticated || !token) {
      toaster.create({
        title: '請先登入後再新增分類',
        type: 'info',
      })
      return
    }

    setIsSavingCategory(true)
    try {
      const category = await createCategoryApi({
        token,
        label: trimmed,
      })
      setCategories((prev) => [...prev, category])
      setSelectedCategoryId(category.id)
      setNewCategoryLabel('')
      setNewTodoCategoryId((current) => current ?? category.id)
    } catch (error) {
      toaster.create({
        title: '新增分類失敗',
        description: error.message,
        type: 'error',
      })
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleRemoveCategory = async (id) => {
    if (isRunning) return
    const target = categories.find((category) => category.id === id)
    if (!target) return

    if (target.isDefault) {
      toaster.create({
        title: '預設分類不可刪除',
        type: 'info',
      })
      return
    }

    if (!isAuthenticated || !token) {
      toaster.create({
        title: '請先登入後再刪除分類',
        type: 'info',
      })
      return
    }

    setDeletingCategoryId(id)
    try {
      const deleted = await deleteCategoryApi({
        token,
        categoryId: id,
      })

      if (!deleted) {
        toaster.create({
          title: '找不到分類',
          type: 'error',
        })
        return
      }

      setCategories((prev) => prev.filter((category) => category.id !== id))
      setSelectedCategoryId((current) => (current === id ? null : current))
      setActiveCategoryId((current) => (current === id ? null : current))
    } catch (error) {
      toaster.create({
        title: '刪除分類失敗',
        description: error.message,
        type: 'error',
      })
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const handleAddTodo = () => {
    const trimmed = newTodoTitle.trim()
    if (!trimmed || !newTodoCategoryId) return

    const categorySnapshot = getCategorySnapshot(newTodoCategoryId)
    const todo = {
      id: `todo-${Date.now()}`,
      title: trimmed,
      categoryId: newTodoCategoryId,
      completed: false,
      createdAt: new Date(),
      completedAt: null,
    }
    setTodos((prev) => [todo, ...prev])
    setNewTodoTitle('')
    logEvent(
      'todo-add',
      {
        todoTitle: trimmed,
        ...categorySnapshot,
      },
      { sessionKey: sessionKeyRef.current ?? undefined },
    )
  }

  const handleToggleTodo = (id) => {
    const target = todos.find((todo) => todo.id === id)
    if (!target) return

    const nextCompleted = !target.completed
    const categorySnapshot = getCategorySnapshot(target.categoryId)

    logEvent(
      nextCompleted ? 'todo-complete' : 'todo-reopen',
      {
        todoTitle: target.title,
        ...categorySnapshot,
      },
      { sessionKey: sessionKeyRef.current ?? undefined },
    )

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date() : null,
            }
          : todo,
      ),
    )
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
    (!isRunning &&
      (!selectedCategoryId || secondsLeft <= 0 || isLoadingCategories)) ||
    false
  const pendingTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos
    .filter((todo) => todo.completed)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))

  return (
    <Stack
      direction={{ base: 'column', lg: 'row' }}
      gap='6'
      width='full'
      height='100%'
      maxH='100%'
      align='stretch'
      justify='center'
      minH='0'
    >
      <Box
        borderWidth='1px'
        borderRadius='xl'
        padding={{ base: '6', md: '8' }}
        width='full'
        background='bg.surface'
        boxShadow='sm'
        flex='1'
        maxH='100%'
        minH='0'
        overflowY='auto'
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
                      {isLoadingCategories ? (
                        <Text fontSize='sm' color='fg.muted' textAlign='center'>
                          載入分類中...
                        </Text>
                      ) : categories.length > 0 ? (
                        <Box maxHeight='32' overflowY='auto' pr='1'>
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
                                      disabled={
                                        isRunning ||
                                        category.isDefault ||
                                        deletingCategoryId === category.id ||
                                        !isAuthenticated
                                      }
                                      onClick={async (event) => {
                                        event.stopPropagation()
                                        await handleRemoveCategory(category.id)
                                      }}
                                    />
                                  </Tag.EndElement>
                                </Tag.Root>
                              </WrapItem>
                            ))}
                          </Wrap>
                        </Box>
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
                              if (!isSavingCategory) {
                                handleAddCategory()
                              }
                            }
                          }}
                          isDisabled={isRunning}
                        />
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={handleAddCategory}
                          isDisabled={
                            isRunning ||
                            newCategoryLabel.trim() === '' ||
                            isSavingCategory
                          }
                          isLoading={isSavingCategory}
                        >
                          新增
                        </Button>
                      </HStack>
                    </Stack>
                  </Accordion.ItemContent>
                </Box>
              </Accordion.Item>
              <Accordion.Item value='todo'>
                <Box borderWidth='1px' borderRadius='lg' overflow='hidden'>
                  <Accordion.ItemTrigger px='4' py='3'>
                    <HStack justify='space-between' flex='1'>
                      <Text fontSize='sm' fontWeight='medium'>
                        TODO 清單
                      </Text>
                      <Accordion.ItemIndicator />
                    </HStack>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent px='4' pb='4'>
                    <Stack gap='3'>
                      <Stack gap='2'>
                        <Input
                          size='sm'
                          placeholder='新增待辦事項'
                          value={newTodoTitle}
                          onChange={(event) => setNewTodoTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              handleAddTodo()
                            }
                          }}
                        />
                        {categories.length > 0 ? (
                          <Box maxHeight='32' overflowY='auto' pr='1'>
                            <Wrap justify='center' spacing='2'>
                              {categories.map((category) => (
                                <WrapItem key={category.id}>
                                  <Tag.Root
                                    variant={
                                      category.id === newTodoCategoryId
                                        ? 'solid'
                                        : 'subtle'
                                    }
                                    colorPalette='purple'
                                    cursor='pointer'
                                    onClick={() => setNewTodoCategoryId(category.id)}
                                  >
                                    <Tag.Label>{category.label}</Tag.Label>
                                  </Tag.Root>
                                </WrapItem>
                              ))}
                            </Wrap>
                          </Box>
                        ) : (
                          <Text fontSize='sm' color='fg.muted' textAlign='center'>
                            請先建立工作類別以指派待辦。
                          </Text>
                        )}
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={handleAddTodo}
                          isDisabled={!newTodoTitle.trim() || !newTodoCategoryId}
                        >
                          新增待辦
                        </Button>
                      </Stack>
                      <Stack gap='2'>
                        {pendingTodos.length === 0 ? (
                          <Text fontSize='sm' color='fg.muted' textAlign='center'>
                            尚未新增待辦事項。
                          </Text>
                        ) : (
                          pendingTodos.map((todo) => {
                            const category = getCategorySnapshot(todo.categoryId)
                            return (
                              <HStack
                                key={todo.id}
                                justify='space-between'
                                borderWidth='1px'
                                borderRadius='md'
                                px='3'
                                py='2'
                              >
                                <Stack gap='0'>
                                  <Text
                                    fontSize='sm'
                                    textDecoration='none'
                                    color='fg'
                                  >
                                    {todo.title}
                                  </Text>
                                  <Text fontSize='xs' color='fg.muted'>
                                    類別：{category.categoryLabel}
                                  </Text>
                                </Stack>
                                <Button
                                  size='xs'
                                  variant='solid'
                                  colorScheme='teal'
                                  onClick={() => handleToggleTodo(todo.id)}
                                >
                                  完成
                                </Button>
                              </HStack>
                            )
                          })
                        )}
                      </Stack>
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
        flex={{ base: 'none', lg: '1' }}
        maxH='100%'
        minH='0'
        overflowY='auto'
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
              待辦清單
            </Text>
            {pendingTodos.length === 0 ? (
              <Text fontSize='sm' color='fg.muted'>
                目前沒有待辦事項。
              </Text>
            ) : (
              <Stack gap='2' maxHeight='40' overflowY='auto' pr='1'>
                {pendingTodos.map((todo) => {
                  const category = getCategorySnapshot(todo.categoryId)
                  return (
                    <HStack
                      key={todo.id}
                      justify='space-between'
                      borderWidth='1px'
                      borderRadius='md'
                      px='3'
                      py='2'
                    >
                      <Stack gap='0'>
                        <Text fontSize='sm'>{todo.title}</Text>
                        <Text fontSize='xs' color='fg.muted'>
                          類別：{category.categoryLabel}
                        </Text>
                      </Stack>
                      <Button
                        size='xs'
                        variant='solid'
                        colorScheme='teal'
                        onClick={() => handleToggleTodo(todo.id)}
                      >
                        完成
                      </Button>
                    </HStack>
                  )
                })}
              </Stack>
            )}
          </Stack>
          <Stack gap='3'>
            <Text fontSize='sm' color='fg.muted'>
              待辦完成紀錄
            </Text>
            {completedTodos.length === 0 ? (
              <Text fontSize='sm' color='fg.muted'>
                還沒有完成的待辦。
              </Text>
            ) : (
              <Stack gap='2' maxHeight='40' overflowY='auto' pr='1'>
                {completedTodos.map((todo) => {
                  const category = getCategorySnapshot(todo.categoryId)
                  return (
                    <HStack
                      key={todo.id}
                      justify='space-between'
                      borderWidth='1px'
                      borderRadius='md'
                      px='3'
                      py='2'
                      bg='bg.subtle'
                    >
                      <Stack gap='0'>
                        <Text fontSize='sm' color='fg'>
                          {todo.title}
                        </Text>
                        <Text fontSize='xs' color='fg.muted'>
                          類別：{category.categoryLabel}
                        </Text>
                        <Text fontSize='xs' color='fg.muted'>
                          完成於：
                          {todo.completedAt
                            ? formatTimeOfDay(todo.completedAt)
                            : '—'}
                        </Text>
                      </Stack>
                      <Button
                        size='xs'
                        variant='outline'
                        colorScheme='gray'
                        onClick={() => handleToggleTodo(todo.id)}
                      >
                        還原
                      </Button>
                    </HStack>
                  )
                })}
              </Stack>
            )}
          </Stack>
          <Text fontSize='sm' color='fg.muted'>
            點擊開始後會自動記錄預計完成時間；完成後可參考這裡做工作紀錄。
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
        flex={{ base: 'none', lg: '1' }}
        maxH='100%'
        minH='0'
        overflowY='auto'
      >
        <Stack gap='6'>
          <Stack align='center' gap='3'>
            <Heading size='md'>操作紀錄</Heading>
          </Stack>
          <Stack gap='3'>
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
                    'todo-add': {
                      label: '新增待辦',
                      icon: LuClipboardList,
                      color: 'blue',
                    },
                    'todo-complete': {
                      label: '完成待辦',
                      icon: LuCheck,
                      color: 'purple',
                    },
                    'todo-reopen': {
                      label: '還原待辦',
                      icon: LuRotateCcw,
                      color: 'gray',
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
                  } else if (event.type === 'todo-add') {
                    detail = `新增 ${event.todoTitle}`
                  } else if (event.type === 'todo-complete') {
                    detail = `完成 ${event.todoTitle}`
                  } else if (event.type === 'todo-reopen') {
                    detail = `重新開啟 ${event.todoTitle}`
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
          
      
        </Stack>
      </Box>
    </Stack>
  )
}
