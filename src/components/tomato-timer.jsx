import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Collapse, Col, Input, InputNumber, Modal, Row, Space, Spin, Tag, Typography, Divider } from 'antd'
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
  LuTrash2,
  LuX,
} from 'react-icons/lu'
import { useAuth } from '../lib/auth-context.jsx'
import {
  createEvent,
  createSession,
  fetchCategories,
  createCategory as createCategoryApi,
  deleteCategory as deleteCategoryApi,
  fetchDailyTasks,
  createDailyTask as createDailyTaskApi,
  archiveDailyTask as archiveDailyTaskApi,
  completeDailyTask as completeDailyTaskApi,
  resetDailyTask as resetDailyTaskApi,
  fetchTodos,
  createTodo as createTodoApi,
  completeTodo as completeTodoApi,
  reopenTodo as reopenTodoApi,
  archiveTodo as archiveTodoApi,
} from '../lib/api.js'
import { toaster } from './ui/toaster.jsx'

const ONE_MINUTE = 60
const ONE_HOUR = ONE_MINUTE * 60
const INITIAL_MINUTES = 25
const MAX_TOTAL_HOURS = 24
const MAX_TOTAL_SECONDS = MAX_TOTAL_HOURS * ONE_HOUR
const DAILY_TODOS_STORAGE_KEY = 'tomato_daily_todos_v1'
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

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function TomatoTimer() {
  const { token, isAuthenticated } = useAuth()
  const [initialSeconds, setInitialSeconds] = useState(
    INITIAL_MINUTES * ONE_MINUTE,
  )
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [inputHours, setInputHours] = useState(() =>
    Math.floor(initialSeconds / ONE_HOUR),
  )
  const [inputMinutes, setInputMinutes] = useState(() =>
    Math.floor((initialSeconds % ONE_HOUR) / ONE_MINUTE),
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
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [todos, setTodos] = useState([])
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoCategoryId, setNewTodoCategoryId] = useState(null)
  const [dailyTodos, setDailyTodos] = useState([])
  const [newDailyTodoTitle, setNewDailyTodoTitle] = useState('')
  const [newDailyTodoCategoryId, setNewDailyTodoCategoryId] = useState(null)
  const [todayKey, setTodayKey] = useState(() => getTodayKey())
  const [isLoadingDailyTasks, setIsLoadingDailyTasks] = useState(false)
  const [togglingDailyTodoId, setTogglingDailyTodoId] = useState(null)
  const [deletingDailyTodoId, setDeletingDailyTodoId] = useState(null)
  const [dailyTodoToDelete, setDailyTodoToDelete] = useState(null)
  const [isDeleteDailyTodoModalVisible, setIsDeleteDailyTodoModalVisible] =
    useState(false)
  const [isLoadingTodosRemote, setIsLoadingTodosRemote] = useState(false)
  const [deletingTodoId, setDeletingTodoId] = useState(null)
  const [todoToDelete, setTodoToDelete] = useState(null)
  const [isDeleteTodoModalVisible, setIsDeleteTodoModalVisible] =
    useState(false)
  const eventId = useRef(0)
  const [eventLog, setEventLog] = useState([])
  const [, setIsSyncingSession] = useState(false)
  const lastSyncedKeyRef = useRef(null)
  const sessionKeyRef = useRef(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState(null)

  const mapDailyTaskFromApi = useCallback(
    (item) => ({
      id: item.id,
      title: item.title,
      categoryId: item.categoryId ?? null,
      archived: Boolean(item.archived),
      createdAt: item.createdAt ? new Date(item.createdAt) : null,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      completedOn:
        item.completedToday || item.completedOn === todayKey ? todayKey : null,
    }),
    [todayKey],
  )

  const mapTodoFromApi = useCallback((item) => ({
    id: item.id,
    title: item.title,
    categoryId: item.categoryId ?? null,
    completed: Boolean(item.completed),
    completedAt: item.completedAt ? new Date(item.completedAt) : null,
    archived: Boolean(item.archived),
    createdAt: item.createdAt ? new Date(item.createdAt) : null,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
  }), [])

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

  const refreshDailyTasks = useCallback(async () => {
    if (!isAuthenticated || !token) {
      return
    }
    setIsLoadingDailyTasks(true)
    try {
      const response = await fetchDailyTasks({
        token,
        date: todayKey,
      })
      const items = Array.isArray(response?.items)
        ? response.items.map(mapDailyTaskFromApi)
        : []
      setDailyTodos(items)
    } catch (error) {
      toaster.create({
        title: '每日任務載入失敗',
        description: error.message,
        type: 'error',
      })
    } finally {
      setIsLoadingDailyTasks(false)
    }
  }, [isAuthenticated, token, todayKey, mapDailyTaskFromApi])

  const refreshTodos = useCallback(async () => {
    if (!isAuthenticated || !token) {
      return
    }
    setIsLoadingTodosRemote(true)
    try {
      const response = await fetchTodos({ token })
      const items = Array.isArray(response?.items)
        ? response.items.map(mapTodoFromApi)
        : []
      setTodos(items)
    } catch (error) {
      toaster.create({
        title: '待辦事項載入失敗',
        description: error.message,
        type: 'error',
      })
    } finally {
      setIsLoadingTodosRemote(false)
    }
  }, [isAuthenticated, token, mapTodoFromApi])

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
    if (categories.length === 0) {
      setNewDailyTodoCategoryId(null)
      return
    }
    if (
      !newDailyTodoCategoryId ||
      !categories.some((category) => category.id === newDailyTodoCategoryId)
    ) {
      setNewDailyTodoCategoryId(categories[0].id)
    }
  }, [categories, newDailyTodoCategoryId])

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
    if (isAuthenticated || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(DAILY_TODOS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const id =
            typeof item.id === 'string'
              ? item.id
              : `daily-${Date.now()}-${Math.random().toString(16).slice(2)}`
          const title = typeof item.title === 'string' ? item.title : ''
          if (!title.trim()) return null
          return {
            id,
            title,
            categoryId: item.categoryId ?? null,
            createdAt: item.createdAt ?? new Date().toISOString(),
            updatedAt: item.updatedAt ?? null,
            completedOn: item.completedOn === todayKey ? todayKey : null,
          }
        })
        .filter(Boolean)
      setDailyTodos(normalized)
    } catch (error) {
      console.warn('Failed to load daily todos', error)
    }
  }, [todayKey, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated || typeof window === 'undefined') return
    try {
      const payload = dailyTodos.map((todo) => ({
        ...todo,
        completedOn: todo.completedOn === todayKey ? todayKey : null,
      }))
      window.localStorage.setItem(
        DAILY_TODOS_STORAGE_KEY,
        JSON.stringify(payload),
      )
    } catch (error) {
      console.warn('Failed to persist daily todos', error)
    }
  }, [dailyTodos, todayKey, isAuthenticated])

  useEffect(() => {
    const interval = setInterval(() => {
      const nextKey = getTodayKey()
      if (nextKey !== todayKey) {
        setTodayKey(nextKey)
        if (isAuthenticated && token) {
          refreshDailyTasks()
        } else {
          setDailyTodos((prev) =>
            prev.map((todo) => ({
              ...todo,
              completedOn: null,
            })),
          )
        }
      }
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [todayKey, isAuthenticated, token, refreshDailyTasks])

  useEffect(() => {
    if (!isAuthenticated || !token) return
    refreshDailyTasks()
  }, [isAuthenticated, token, todayKey, refreshDailyTasks])

  useEffect(() => {
    if (!isAuthenticated || !token) return
    refreshTodos()
  }, [isAuthenticated, token, refreshTodos])

  useEffect(() => {
    if (!isAuthenticated) {
      setTodos([])
      setDailyTodos([])
    }
  }, [isAuthenticated])

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
      const totalHours = Math.floor(secondsLeft / ONE_HOUR)
      const remainder = secondsLeft % ONE_HOUR
      setInputHours(totalHours)
      setInputMinutes(Math.floor(remainder / ONE_MINUTE))
      setInputSeconds(remainder % ONE_MINUTE)
    }
  }, [secondsLeft, isRunning])

  const handleAdjust = (deltaHours) => {
    if (isRunning) {
      return
    }
    setSecondsLeft((prev) => {
      const deltaSeconds = deltaHours * ONE_HOUR
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

  const applyInputValues = useCallback(
    (hours, minutes, seconds, { updateInputs = true } = {}) => {
      const safeHours = Math.max(Math.floor(Number(hours) || 0), 0)
      const safeMinutes = Math.max(Math.floor(Number(minutes) || 0), 0)
      const safeSeconds = Math.min(
        Math.max(Math.floor(Number(seconds) || 0), 0),
        ONE_MINUTE - 1,
      )
      const clampedMinutes = Math.min(safeMinutes, ONE_MINUTE - 1)

      let totalSeconds =
        safeHours * ONE_HOUR + clampedMinutes * ONE_MINUTE + safeSeconds

      if (totalSeconds > MAX_TOTAL_SECONDS) {
        totalSeconds = MAX_TOTAL_SECONDS
      }

      if (updateInputs) {
        const nextHours = Math.floor(totalSeconds / ONE_HOUR)
        const remainder = totalSeconds % ONE_HOUR
        const nextMinutes = Math.floor(remainder / ONE_MINUTE)
        const nextSeconds = remainder % ONE_MINUTE
        setInputHours(nextHours)
        setInputMinutes(nextMinutes)
        setInputSeconds(nextSeconds)
      }

      setInitialSeconds(totalSeconds)
      setSecondsLeft(totalSeconds)
      setSessionStart(null)
      setSessionEnd(null)
      setActiveCategoryId(null)
    },
    [],
  )

  const handleHoursChange = (value) => {
    if (isRunning) return
    const parsed = Number(value ?? 0)
    const next = Number.isFinite(parsed) ? parsed : 0
    const capped = Math.min(Math.max(next, 0), MAX_TOTAL_HOURS)
    applyInputValues(capped, inputMinutes, inputSeconds)
  }

  const handleMinutesChange = (value) => {
    if (isRunning) return
    const parsed = Number(value ?? 0)
    const next = Number.isFinite(parsed) ? parsed : 0
    applyInputValues(inputHours, Math.min(Math.max(next, 0), ONE_MINUTE - 1), inputSeconds)
  }

  const handleSecondsChange = (value) => {
    if (isRunning) return
    const parsed = Number(value ?? 0)
    const next = Number.isFinite(parsed) ? parsed : 0
    const clamped = Math.min(Math.max(next, 0), ONE_MINUTE - 1)
    applyInputValues(inputHours, inputMinutes, clamped)
  }

  const handleInputsCommit = () => {
    if (isRunning) return
    applyInputValues(inputHours, inputMinutes, inputSeconds)
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
      ? activeCategoryId ?? selectedCategoryId ?? null
      : selectedCategoryId ?? null

    if (!hasStartedBefore || !activeCategoryId) {
      if (baseCategoryId) {
        setActiveCategoryId(baseCategoryId)
      }
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
      setNewDailyTodoCategoryId((current) => current ?? category.id)
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

      const nextCategories = categories.filter((category) => category.id !== id)
      const fallbackCategoryId = nextCategories[0]?.id ?? null
      setCategories(nextCategories)
      setSelectedCategoryId((current) =>
        current === id ? fallbackCategoryId : current,
      )
      setActiveCategoryId((current) => (current === id ? null : current))
      setNewTodoCategoryId((current) =>
        current === id ? fallbackCategoryId : current,
      )
      setNewDailyTodoCategoryId((current) =>
        current === id ? fallbackCategoryId : current,
      )
      setTodos((prev) =>
        prev.map((todo) =>
          todo.categoryId === id ? { ...todo, categoryId: null } : todo,
        ),
      )
      setDailyTodos((prev) =>
        prev.map((todo) =>
          todo.categoryId === id ? { ...todo, categoryId: null } : todo,
        ),
      )
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

  const requestCategoryDeletion = (category) => {
    setCategoryToDelete(category)
    setIsDeleteModalVisible(true)
  }

  const cancelCategoryDeletion = () => {
    setIsDeleteModalVisible(false)
    setCategoryToDelete(null)
  }

  const confirmCategoryDeletion = async () => {
    if (!categoryToDelete) return
    await handleRemoveCategory(categoryToDelete.id)
    setIsDeleteModalVisible(false)
    setCategoryToDelete(null)
  }

  const handleAddDailyTodo = async () => {
    const trimmed = newDailyTodoTitle.trim()
    if (!trimmed || !newDailyTodoCategoryId) return

    const categorySnapshot = getCategorySnapshot(newDailyTodoCategoryId)

    if (isAuthenticated && token) {
      try {
        const created = await createDailyTaskApi({
          token,
          title: trimmed,
          categoryId: newDailyTodoCategoryId,
        })
        const mapped = mapDailyTaskFromApi({
          ...created,
          completedToday: false,
        })
        setDailyTodos((prev) => [...prev, mapped])
        setNewDailyTodoTitle('')
        logEvent(
          'daily-todo-add',
          {
            todoTitle: trimmed,
            ...categorySnapshot,
          },
          { sessionKey: sessionKeyRef.current ?? undefined },
        )
      } catch (error) {
        toaster.create({
          title: '新增每日任務失敗',
          description: error.message,
          type: 'error',
        })
      }
      return
    }

    const now = new Date()
    const todo = {
      id: `daily-${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      title: trimmed,
      categoryId: newDailyTodoCategoryId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      completedOn: null,
    }

    setDailyTodos((prev) => [todo, ...prev])
    setNewDailyTodoTitle('')

    logEvent(
      'daily-todo-add',
      {
        todoTitle: trimmed,
        ...categorySnapshot,
      },
      { sessionKey: sessionKeyRef.current ?? undefined },
    )
  }

  const handleToggleDailyTodo = async (id) => {
    const target = dailyTodos.find((todo) => todo.id === id)
    if (!target) return

    const hasCompletedToday = target.completedOn === todayKey
    const categorySnapshot = getCategorySnapshot(target.categoryId)
    const eventType = hasCompletedToday ? 'daily-todo-reset' : 'daily-todo-complete'
    setTogglingDailyTodoId(id)

    if (isAuthenticated && token) {
      try {
        if (hasCompletedToday) {
          await resetDailyTaskApi({
            token,
            taskId: id,
            date: todayKey,
          })
        } else {
          await completeDailyTaskApi({
            token,
            taskId: id,
            date: todayKey,
          })
        }
        const updatedAt = new Date().toISOString()
        setDailyTodos((prev) =>
          prev.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  completedOn: hasCompletedToday ? null : todayKey,
                  updatedAt,
                }
              : todo,
          ),
        )
        logEvent(
          eventType,
          {
            todoTitle: target.title,
            ...categorySnapshot,
          },
          { sessionKey: sessionKeyRef.current ?? undefined },
        )
      } catch (error) {
        toaster.create({
          title: hasCompletedToday ? '重置每日任務失敗' : '完成每日任務失敗',
          description: error.message,
          type: 'error',
        })
      } finally {
        setTogglingDailyTodoId(null)
      }
      return
    }

    try {
      const updatedAt = new Date().toISOString()
      setDailyTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                completedOn: hasCompletedToday ? null : todayKey,
                updatedAt,
              }
            : todo,
        ),
      )
      logEvent(
        eventType,
        {
          todoTitle: target.title,
          ...categorySnapshot,
        },
        { sessionKey: sessionKeyRef.current ?? undefined },
      )
    } finally {
      setTogglingDailyTodoId(null)
    }
  }

  const handleDeleteDailyTodo = async (id) => {
    const target = dailyTodos.find((todo) => todo.id === id)
    if (!target) return false

    const categorySnapshot = getCategorySnapshot(target.categoryId)
    setDeletingDailyTodoId(id)

    try {
      if (isAuthenticated && token) {
        await archiveDailyTaskApi({
          token,
          taskId: id,
        })
      }

      setDailyTodos((prev) => prev.filter((todo) => todo.id !== id))
      logEvent(
        'daily-todo-delete',
        {
          todoTitle: target.title,
          ...categorySnapshot,
        },
        { sessionKey: sessionKeyRef.current ?? undefined },
      )
      return true
    } catch (error) {
      if (isAuthenticated && token) {
        toaster.create({
          title: '刪除每日任務失敗',
          description: error.message,
          type: 'error',
        })
      }
      return false
    } finally {
      setDeletingDailyTodoId(null)
    }
  }

  const requestDailyTodoDeletion = (todo) => {
    setDailyTodoToDelete(todo)
    setIsDeleteDailyTodoModalVisible(true)
  }

  const cancelDailyTodoDeletion = () => {
    setIsDeleteDailyTodoModalVisible(false)
    setDailyTodoToDelete(null)
  }

  const confirmDailyTodoDeletion = async () => {
    if (!dailyTodoToDelete) return
    const success = await handleDeleteDailyTodo(dailyTodoToDelete.id)
    if (success) {
      setIsDeleteDailyTodoModalVisible(false)
      setDailyTodoToDelete(null)
    }
  }

  const handleDeleteTodo = async (id) => {
    const target = todos.find((todo) => todo.id === id)
    if (!target) return false

    const categorySnapshot = getCategorySnapshot(target.categoryId)
    setDeletingTodoId(id)

    try {
      if (isAuthenticated && token) {
        await archiveTodoApi({
          token,
          todoId: id,
        })
      }

      setTodos((prev) => prev.filter((todo) => todo.id !== id))
      logEvent(
        'todo-delete',
        {
          todoTitle: target.title,
          ...categorySnapshot,
        },
        { sessionKey: sessionKeyRef.current ?? undefined },
      )
      return true
    } catch (error) {
      if (isAuthenticated && token) {
        toaster.create({
          title: '刪除待辦失敗',
          description: error.message,
          type: 'error',
        })
      }
      return false
    } finally {
      setDeletingTodoId(null)
    }
  }

  const requestTodoDeletion = (todo) => {
    setTodoToDelete(todo)
    setIsDeleteTodoModalVisible(true)
  }

  const cancelTodoDeletion = () => {
    setIsDeleteTodoModalVisible(false)
    setTodoToDelete(null)
  }

  const confirmTodoDeletion = async () => {
    if (!todoToDelete) return
    const success = await handleDeleteTodo(todoToDelete.id)
    if (success) {
      setIsDeleteTodoModalVisible(false)
      setTodoToDelete(null)
    }
  }

  const handleAddTodo = async () => {
    const trimmed = newTodoTitle.trim()
    if (!trimmed || !newTodoCategoryId) return

    const categorySnapshot = getCategorySnapshot(newTodoCategoryId)

    if (isAuthenticated && token) {
      try {
        const created = await createTodoApi({
          token,
          title: trimmed,
          categoryId: newTodoCategoryId,
        })
        const mapped = mapTodoFromApi(created)
        setTodos((prev) => [mapped, ...prev])
        setNewTodoTitle('')
        logEvent(
          'todo-add',
          {
            todoTitle: trimmed,
            ...categorySnapshot,
          },
          { sessionKey: sessionKeyRef.current ?? undefined },
        )
      } catch (error) {
        toaster.create({
          title: '新增待辦失敗',
          description: error.message,
          type: 'error',
        })
      }
      return
    }

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

  const handleToggleTodo = async (id) => {
    const target = todos.find((todo) => todo.id === id)
    if (!target) return

    const nextCompleted = !target.completed
    const categorySnapshot = getCategorySnapshot(target.categoryId)

    if (isAuthenticated && token) {
      try {
        const updated = nextCompleted
          ? await completeTodoApi({ token, todoId: id })
          : await reopenTodoApi({ token, todoId: id })
        const mapped = mapTodoFromApi(updated)
        setTodos((prev) => prev.map((todo) => (todo.id === id ? mapped : todo)))
        logEvent(
          nextCompleted ? 'todo-complete' : 'todo-reopen',
          {
            todoTitle: target.title,
            ...categorySnapshot,
          },
          { sessionKey: sessionKeyRef.current ?? undefined },
        )
      } catch (error) {
        toaster.create({
          title: nextCompleted ? '完成待辦失敗' : '重新開啟待辦失敗',
          description: error.message,
          type: 'error',
        })
      }
      return
    }

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
    (!isRunning && (secondsLeft <= 0 || isLoadingCategories)) || false
  const pendingDailyTodos = useMemo(
    () => dailyTodos.filter((todo) => todo.completedOn !== todayKey),
    [dailyTodos, todayKey],
  )
  const completedDailyTodos = useMemo(
    () => dailyTodos.filter((todo) => todo.completedOn === todayKey),
    [dailyTodos, todayKey],
  )
  const pendingTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos
    .filter((todo) => todo.completed)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))

  const { Title, Text: AntText } = Typography
  const sessionStatusTagColor =
    sessionStatusColor === 'green'
      ? 'green'
      : sessionStatusColor === 'purple'
        ? 'purple'
        : 'default'
  const iconColorMap = {
    green: '#52c41a',
    orange: '#fa8c16',
    gray: '#8c8c8c',
    purple: '#722ed1',
    blue: '#1677ff',
    pink: '#eb2f96',
    red: '#f5222d',
  }
  const cardMaxHeight = 'calc(100vh - 220px)'
  const timerCardStyle = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    maxHeight: cardMaxHeight,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
  const sideCardStyle = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    maxHeight: cardMaxHeight,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
  const cardBodyStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    minHeight: 0,
    overflowY: 'auto',
    height: '100%',
  }
  const taskColumnsLayoutStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    width: '100%',
    alignItems: 'start',
  }
  const taskColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 0,
  }
  const taskColumnTitleStyle = {
    fontSize: 13,
    fontWeight: 600,
    paddingTop: 10,
    color: '#1f1f1f',
    letterSpacing: 0.4,
  }
  const taskListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }
  const taskCardBaseStyle = {
    width: '100%',
    minWidth: 0,
    border: '1px solid #d9d9d9',
    borderRadius: 12,
    padding: '12px 14px',
    background: '#f5fffe',
    boxShadow: '0 4px 12px rgba(15, 39, 102, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }
  
  const taskCardCompletedStyle = {
    ...taskCardBaseStyle,
    border: '1px solid #b7eb8f',
    background: '#f6ffed',
  }
  const renderCategorySelection = ({ selectedId, onSelect, emptyText }) => {
    if (categories.length === 0) {
      return (
        <AntText type='secondary' style={{ display: 'block', textAlign: 'center' }}>
          {emptyText}
        </AntText>
      )
    }

    return (
      <div style={{ maxHeight: 128, overflowY: 'auto', paddingRight: 4 }}>
        <Space wrap size={[8, 8]}>
          {categories.map((category) => (
            <Tag.CheckableTag
              key={category.id}
              checked={category.id === selectedId}
              onChange={(checked) => {
                if (checked) {
                  onSelect(category.id)
                }
              }}
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                border: category.id === selectedId ? '1px solid #1677ff' : '1px solid #d9d9d9',
                backgroundColor: category.id === selectedId ? '#f0f5ff' : '#fff',
                lineHeight: '20px',
                color: category.id === selectedId ? '#0958d9' : '#434343',
                fontWeight: category.id === selectedId ? 600 : 400,
              }}
            >
              {category.label}
            </Tag.CheckableTag>
          ))}
        </Space>
      </div>
    )
  }
  const manualTimeSection = (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Space
        align='center'
        size={16}
        style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Space direction='vertical' size={8} align='center'>
          <AntText type='secondary' style={{ fontSize: 12 }}>
            小時
          </AntText>
          <InputNumber
            min={0}
            max={MAX_TOTAL_HOURS}
            value={inputHours}
            disabled={isRunning}
            onChange={handleHoursChange}
            onBlur={handleInputsCommit}
            onPressEnter={handleInputsCommit}
            style={{ width: 80 }}
          />
        </Space>
        <div style={{ fontSize: 24, fontWeight: 600 }}>:</div>
        <Space direction='vertical' size={8} align='center'>
          <AntText type='secondary' style={{ fontSize: 12 }}>
            分鐘
          </AntText>
          <InputNumber
            min={0}
            max={59}
            value={inputMinutes}
            disabled={isRunning}
            onChange={handleMinutesChange}
            onBlur={handleInputsCommit}
            onPressEnter={handleInputsCommit}
            style={{ width: 80 }}
          />
        </Space>
        <div style={{ fontSize: 24, fontWeight: 600 }}>:</div>
        <Space direction='vertical' size={8} align='center'>
          <AntText type='secondary' style={{ fontSize: 12 }}>
            秒
          </AntText>
          <InputNumber
            min={0}
            max={59}
            value={inputSeconds}
            disabled={isRunning}
            onChange={handleSecondsChange}
            onBlur={handleInputsCommit}
            onPressEnter={handleInputsCommit}
            style={{ width: 80 }}
          />
        </Space>
      </Space>
      <Space align='center' size={12} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          size='small'
          icon={<LuMinus />}
          onClick={() => handleAdjust(-1)}
          disabled={isRunning || secondsLeft < ONE_HOUR}
        >
          1 小時
        </Button>
        <Button
          size='small'
          icon={<LuPlus />}
          onClick={() => handleAdjust(1)}
          disabled={isRunning}
        >
          1 小時
        </Button>
      </Space>
    </Space>
  )
  const manageCategoriesSection = (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      {isLoadingCategories ? (
        <div style={{ textAlign: 'center' }}>
          <Spin size='small' />
          <AntText type='secondary' style={{ marginLeft: 8 }}>
            載入分類中...
          </AntText>
        </div>
      ) : categories.length > 0 ? (
        <div style={{ maxHeight: 128, overflowY: 'auto', paddingRight: 4 }}>
          <Space wrap size={[8, 8]}>
            {categories.map((category) => {
              const isSelected = category.id === selectedCategoryId
              const canRemove =
                !isRunning && !category.isDefault && isAuthenticated
              const isDeleting = deletingCategoryId === category.id
              return (
                <Tag
                  key={category.id}
                  color={isSelected ? 'cyan' : undefined}
                  closable={canRemove && !isDeleting}
                  closeIcon={<LuX size={12} />}
                  icon={isDeleting ? <Spin size='small' /> : undefined}
                  onClose={(event) => {
                    event.preventDefault()
                    requestCategoryDeletion(category)
                  }}
                  style={{
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    opacity: isRunning ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    paddingRight: 10,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => {
                    if (!isRunning) {
                      setSelectedCategoryId(category.id)
                    }
                  }}
                >
                  {category.label}
                </Tag>
              )
            })}
          </Space>
        </div>
      ) : (
        <AntText type='secondary' style={{ display: 'block', textAlign: 'center' }}>
          請先新增一個工作類別。
        </AntText>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          size='small'
          placeholder='新增類別'
          value={newCategoryLabel}
          disabled={isRunning}
          onChange={(event) => setNewCategoryLabel(event.target.value)}
          onPressEnter={(event) => {
            event.preventDefault()
            if (!isSavingCategory && !isRunning) {
              handleAddCategory()
            }
          }}
        />
        <Button
          size='small'
          onClick={handleAddCategory}
          disabled={
            isRunning || newCategoryLabel.trim() === '' || isSavingCategory
          }
          loading={isSavingCategory}
        >
          新增
        </Button>
      </div>
    </Space>
  )
  const createDailyTaskSection = (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Input
        size='small'
        placeholder='輸入每日任務內容'
        value={newDailyTodoTitle}
        onChange={(event) => setNewDailyTodoTitle(event.target.value)}
        onPressEnter={(event) => {
          event.preventDefault()
          handleAddDailyTodo()
        }}
      />
      {renderCategorySelection({
        selectedId: newDailyTodoCategoryId,
        onSelect: setNewDailyTodoCategoryId,
        emptyText: '請先建立工作類別再新增每日任務。',
      })}
      <Button
        size='small'
        onClick={handleAddDailyTodo}
        disabled={!newDailyTodoTitle.trim() || !newDailyTodoCategoryId}
      >
        建立即日任務
      </Button>
    </Space>
  )
  const createTodoSection = (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Input
        size='small'
        placeholder='輸入待辦事項'
        value={newTodoTitle}
        onChange={(event) => setNewTodoTitle(event.target.value)}
        onPressEnter={(event) => {
          event.preventDefault()
          handleAddTodo()
        }}
      />
      {renderCategorySelection({
        selectedId: newTodoCategoryId,
        onSelect: setNewTodoCategoryId,
        emptyText: '請先建立工作類別再新增待辦事項。',
      })}
      <Button
        size='small'
        onClick={handleAddTodo}
        disabled={!newTodoTitle.trim() || !newTodoCategoryId}
      >
        建立待辦事項
      </Button>
    </Space>
  )
  const collapseItems = [
    { key: 'time', label: '手動設定時間', children: manualTimeSection },
    { key: 'category', label: '管理工作類別', children: manageCategoriesSection },
    { key: 'daily-create', label: '新增每日任務', children: createDailyTaskSection },
    { key: 'todo-create', label: '新增待辦事項', children: createTodoSection },
  ]

  return (
    <Space
      direction='vertical'
      size={24}
      style={{
        width: '100%',
        paddingBottom: 24,
        paddingRight: 8,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12} xl={8} xxl={8} style={{ minWidth: 0 }}>
          <Card style={timerCardStyle} styles={{ body: cardBodyStyle }}>
            <Space direction='vertical' size={24} style={{ width: '100%' }}>
              <Space direction='vertical' size={8} align='center'>
                <Title level={3} style={{ margin: 0 }}>
                  番茄鐘
                </Title>
              </Space>

              <Space
                direction='vertical'
                size={24}
                align='center'
                style={{ width: '100%' }}
              >
                <div style={{ fontSize: '4rem', fontWeight: 600 }}>{timeLabel}</div>
                <Space direction='vertical' size={4} align='center'>
                  <AntText type='secondary' style={{ fontSize: 12 }}>
                    目前類別
                  </AntText>
                  <Tag color={activeCategoryId ?? selectedCategoryId ? 'processing' : undefined}>
                    {activeCategoryLabel}
                  </Tag>
                </Space>
              </Space>

              <Space size={12} wrap style={{ justifyContent: 'center' }}>
                <Button
                  type='primary'
                  size='large'
                  icon={isRunning ? <LuPause /> : <LuPlay />}
                  onClick={handleToggle}
                  disabled={isStartDisabled}
                  style={{ minWidth: 128 }}
                >
                  {startButtonLabel}
                </Button>
                <Button size='large' icon={<LuRotateCcw />} onClick={handleReset}>
                  重置
                </Button>
              </Space>

              <Collapse items={collapseItems} bordered={false} />

              <AntText type='secondary' style={{ textAlign: 'center' }}>
                小技巧：一次專注 25 分鐘，接著短暫休息 5 分鐘。
              </AntText>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12} xl={8} xxl={8} style={{ minWidth: 0 }}>
          <Card style={sideCardStyle} styles={{ body: cardBodyStyle }}>
            <Space direction='vertical' size={24} style={{ width: '100%' }}>
              <Space direction='vertical' size={12} align='center'>
                <Title level={4} style={{ margin: 0 }}>
                  番茄時間軸
                </Title>
                <Tag color={sessionStatusTagColor}>{sessionStatus}</Tag>
              </Space>

              <Space direction='vertical' size={16}>
                <Space align='center' size={12}>
                  <LuCalendar size={24} color={iconColorMap.gray} />
                  <Space direction='vertical' size={0}>
                    <AntText type='secondary' style={{ fontSize: 12 }}>
                      日期
                    </AntText>
                    <AntText strong>
                      {sessionStart
                        ? new Intl.DateTimeFormat('zh-TW', {
                            month: '2-digit',
                            day: '2-digit',
                          }).format(sessionStart)
                        : new Intl.DateTimeFormat('zh-TW', {
                            month: '2-digit',
                            day: '2-digit',
                          }).format(new Date())}
                    </AntText>
                  </Space>
                </Space>
                <Space align='center' size={12}>
                  <LuClock size={24} color={iconColorMap.gray} />
                  <Space direction='vertical' size={0}>
                    <AntText type='secondary' style={{ fontSize: 12 }}>
                      番茄鐘時段
                    </AntText>
                    <AntText strong>
                      {sessionStartLabel} → {sessionEndLabel}
                    </AntText>
                  </Space>
                </Space>
                <Space align='center' size={12}>
                  <LuClipboardList size={24} color={iconColorMap.gray} />
                  <Space direction='vertical' size={0}>
                    <AntText type='secondary' style={{ fontSize: 12 }}>
                      工作類別
                    </AntText>
                    <AntText strong>{activeCategoryLabel}</AntText>
                  </Space>
                </Space>
              </Space>

              <Space direction='vertical' size={12} style={{ width: '100%' }}>
                <Title level={5} style={{ margin: 0 }}>
                  操作紀錄
                </Title>
                <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 8 }}>
                  {eventLog.length === 0 ? (
                    <AntText type='secondary'>目前尚未有番茄鐘操作。</AntText>
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
                        'todo-delete': {
                          label: '刪除待辦',
                          icon: LuTrash2,
                          color: 'red',
                        },
                        'daily-todo-add': {
                          label: '新增每日任務',
                          icon: LuClipboardList,
                          color: 'pink',
                        },
                        'daily-todo-complete': {
                          label: '完成每日任務',
                          icon: LuCheck,
                          color: 'pink',
                        },
                        'daily-todo-reset': {
                          label: '重置每日任務',
                          icon: LuRotateCcw,
                          color: 'pink',
                        },
                        'daily-todo-delete': {
                          label: '刪除每日任務',
                          icon: LuTrash2,
                          color: 'red',
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
                      } else if (event.type === 'resume' || event.type === 'pause') {
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
                      } else if (event.type === 'todo-delete') {
                        detail = `刪除待辦 ${event.todoTitle}`
                      } else if (event.type === 'daily-todo-add') {
                        detail = `新增每日任務 ${event.todoTitle}`
                      } else if (event.type === 'daily-todo-complete') {
                        detail = `完成今日每日任務 ${event.todoTitle}`
                      } else if (event.type === 'daily-todo-reset') {
                        detail = `重新開始每日任務 ${event.todoTitle}`
                      } else if (event.type === 'daily-todo-delete') {
                        detail = `刪除每日任務 ${event.todoTitle}`
                      }

                      const IconComponent = meta.icon

                      return (
                        <div
                          key={event.id}
                          style={{ display: 'flex', gap: 12, marginBottom: 12 }}
                        >
                          <div style={{ marginTop: 4 }}>
                            <IconComponent
                              size={20}
                              color={iconColorMap[meta.color] ?? iconColorMap.gray}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: 8,
                              }}
                            >
                              <AntText strong>{meta.label}</AntText>
                              <AntText type='secondary' style={{ fontSize: 12 }}>
                                {formatTimeOfDay(event.timestamp)}
                              </AntText>
                            </div>
                            {detail && (
                              <AntText type='secondary' style={{ fontSize: 12, display: 'block' }}>
                                {detail}
                              </AntText>
                            )}
                            {event.categoryLabel && (
                              <AntText type='secondary' style={{ fontSize: 12, display: 'block' }}>
                                類別：{event.categoryLabel}
                              </AntText>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={24} xl={8} xxl={8} style={{ minWidth: 0 }}>
          <Card style={sideCardStyle} styles={{ body: cardBodyStyle }}>
            <Space direction='vertical' size={24} style={{ width: '100%' }}>
              <Space direction='vertical' size={8} align='center'>
                <Title level={4} style={{ margin: 0 }}>
                  每日任務與待辦執行
                </Title>
                <AntText type='secondary'>
                  在這裡勾選完成或重置每日任務與待辦事項。
                </AntText>
              </Space>

              <Space direction='vertical' size={20} style={{ width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    今日每日任務
                  </Title>
                  <div style={taskColumnsLayoutStyle}>
                    <div style={taskColumnStyle}>
                      <AntText style={taskColumnTitleStyle}>待完成</AntText>
                      {isLoadingDailyTasks ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          每日任務載入中…
                        </AntText>
                      ) : pendingDailyTodos.length === 0 ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          今日任務都完成了，太棒了！
                        </AntText>
                      ) : (
                        <div style={taskListStyle}>
                          {pendingDailyTodos.map((todo) => {
                            const category = getCategorySnapshot(todo.categoryId)
                            const isToggling = togglingDailyTodoId === todo.id
                            const isDeleting = deletingDailyTodoId === todo.id
                            return (
                              <div key={todo.id} style={taskCardBaseStyle}>
                                <Space direction='vertical' size={6} style={{ width: '100%' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <AntText strong style={{ fontSize: 14 }}>
                                      {todo.title}
                                    </AntText>
                                    <Space size={4}>
                                      <Button
                                        size='small'
                                        type='primary'
                                        onClick={() => handleToggleDailyTodo(todo.id)}
                                        disabled={isDeleting}
                                        loading={isToggling}
                                      >
                                        完成
                                      </Button>
                                      <Button
                                        size='small'
                                        type='text'
                                        danger
                                        icon={<LuTrash2 size={14} />}
                                        onClick={() => requestDailyTodoDeletion(todo)}
                                        disabled={isToggling || isDeleting}
                                        loading={isDeleting}
                                        aria-label='刪除每日任務'
                                      />
                                    </Space>
                                  </div>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    類別：{category.categoryLabel}
                                  </AntText>
                                </Space>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                   
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    待辦事項
                  </Title>
                  <div style={taskColumnsLayoutStyle}>
                    <div style={taskColumnStyle}>
                      <AntText style={taskColumnTitleStyle}>待完成</AntText>
                      {isLoadingTodosRemote ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          待辦事項載入中…
                        </AntText>
                      ) : pendingTodos.length === 0 ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          尚未新增待辦事項。
                        </AntText>
                      ) : (
                        <div style={taskListStyle}>
                          {pendingTodos.map((todo) => {
                            const category = getCategorySnapshot(todo.categoryId)
                            const isDeleting = deletingTodoId === todo.id
                            return (
                              <div key={todo.id} style={taskCardBaseStyle}>
                                <Space direction='vertical' size={6} style={{ width: '100%' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <AntText strong style={{ fontSize: 14 }}>
                                      {todo.title}
                                    </AntText>
                                    <Space size={4}>
                                      <Button
                                        size='small'
                                        type='primary'
                                        onClick={() => handleToggleTodo(todo.id)}
                                        disabled={isDeleting}
                                      >
                                        完成
                                      </Button>
                                      <Button
                                        size='small'
                                        type='text'
                                        danger
                                        icon={<LuTrash2 size={14} />}
                                        onClick={() => requestTodoDeletion(todo)}
                                        disabled={isDeleting}
                                        loading={isDeleting}
                                        aria-label='刪除待辦事項'
                                      />
                                    </Space>
                                  </div>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    類別：{category.categoryLabel}
                                  </AntText>
                                </Space>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    </div>

<div>
                      <Divider/>

                    <div style={taskColumnStyle}>
                      <AntText style={taskColumnTitleStyle}>每日任務已完成</AntText>
                      {isLoadingDailyTasks ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          每日任務載入中…
                        </AntText>
                      ) : completedDailyTodos.length === 0 ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          尚未有完成的每日任務。
                        </AntText>
                      ) : (
                        <div style={taskListStyle}>
                          {completedDailyTodos.map((todo) => {
                            const category = getCategorySnapshot(todo.categoryId)
                            const completedAtLabel = todo.completedAt
                              ? formatTimeOfDay(todo.completedAt)
                              : '—'
                            const isToggling = togglingDailyTodoId === todo.id
                            const isDeleting = deletingDailyTodoId === todo.id
                            return (
                              <div key={todo.id} style={taskCardCompletedStyle}>
                                <Space direction='vertical' size={6} style={{ width: '100%' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <AntText strong style={{ fontSize: 14 }}>
                                      {todo.title}
                                    </AntText>
                                    <Space size={4}>
                                      <Button
                                        size='small'
                                        onClick={() => handleToggleDailyTodo(todo.id)}
                                        disabled={isDeleting}
                                        loading={isToggling}
                                      >
                                        重新開始
                                      </Button>
                                      <Button
                                        size='small'
                                        type='text'
                                        danger
                                        icon={<LuTrash2 size={14} />}
                                        onClick={() => requestDailyTodoDeletion(todo)}
                                        disabled={isToggling || isDeleting}
                                        loading={isDeleting}
                                        aria-label='刪除每日任務'
                                      />
                                    </Space>
                                  </div>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    類別：{category.categoryLabel}
                                  </AntText>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    完成於：{completedAtLabel}
                                  </AntText>
                                </Space>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div style={taskColumnStyle}>
                      <AntText style={taskColumnTitleStyle}>待辦事項已完成</AntText>
                      {isLoadingTodosRemote ? (
                        <AntText type='secondary' style={{ textAlign: 'center'}}>
                          待辦事項載入中…
                        </AntText>
                      ) : completedTodos.length === 0 ? (
                        <AntText type='secondary' style={{ textAlign: 'center' }}>
                          還沒有完成的待辦。
                        </AntText>
                      ) : (
                        <div style={taskListStyle}>
                          {completedTodos.map((todo) => {
                            const category = getCategorySnapshot(todo.categoryId)
                            const isDeleting = deletingTodoId === todo.id
                            return (
                              <div key={todo.id} style={taskCardCompletedStyle}>
                                <Space direction='vertical' size={6} style={{ width: '100%' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <AntText strong style={{ fontSize: 14 }}>
                                      {todo.title}
                                    </AntText>
                                    <Space size={4}>
                                      <Button
                                        size='small'
                                        onClick={() => handleToggleTodo(todo.id)}
                                        disabled={isDeleting}
                                      >
                                        還原
                                      </Button>
                                      <Button
                                        size='small'
                                        type='text'
                                        danger
                                        icon={<LuTrash2 size={14} />}
                                        onClick={() => requestTodoDeletion(todo)}
                                        disabled={isDeleting}
                                        loading={isDeleting}
                                        aria-label='刪除待辦事項'
                                      />
                                    </Space>
                                  </div>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    類別：{category.categoryLabel}
                                  </AntText>
                                  <AntText type='secondary' style={{ fontSize: 12 }}>
                                    完成於：{todo.completedAt ? formatTimeOfDay(todo.completedAt) : '—'}
                                  </AntText>
                                </Space>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
      <Modal
        title='刪除待辦事項'
        open={isDeleteTodoModalVisible}
        onOk={confirmTodoDeletion}
        onCancel={cancelTodoDeletion}
        okText='刪除'
        okButtonProps={{ danger: true }}
        cancelText='取消'
        confirmLoading={
          todoToDelete ? deletingTodoId === todoToDelete.id : false
        }
      >
        <AntText>
          確定要刪除待辦事項「{todoToDelete?.title ?? ''}」嗎？刪除後無法復原。
        </AntText>
      </Modal>
      <Modal
        title='刪除每日任務'
        open={isDeleteDailyTodoModalVisible}
        onOk={confirmDailyTodoDeletion}
        onCancel={cancelDailyTodoDeletion}
        okText='刪除'
        okButtonProps={{ danger: true }}
        cancelText='取消'
        confirmLoading={
          dailyTodoToDelete
            ? deletingDailyTodoId === dailyTodoToDelete.id
            : false
        }
      >
        <AntText>
          確定要刪除每日任務「{dailyTodoToDelete?.title ?? ''}」嗎？刪除後無法復原。
        </AntText>
      </Modal>
      <Modal
        title='刪除分類'
        open={isDeleteModalVisible}
        onOk={confirmCategoryDeletion}
        onCancel={cancelCategoryDeletion}
        okText='刪除'
        okButtonProps={{ danger: true }}
        cancelText='取消'
        confirmLoading={
          categoryToDelete ? deletingCategoryId === categoryToDelete.id : false
        }
      >
        <AntText>
          確定要刪除分類「{categoryToDelete?.label ?? ''}」嗎？已建立的待辦與每日任務會保留，但會失去此分類連結。
        </AntText>
      </Modal>
    </Space>
  )
}
