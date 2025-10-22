import dayjs from 'dayjs'

export const DATE_FORMAT = 'YYYY-MM-DD'

export const formatDateInput = (value) => dayjs(value).format(DATE_FORMAT)

export const startOfDay = (value) => {
  const d = dayjs(value)
  if (!d.isValid()) return null
  return d.startOf('day').toDate()
}

export const endOfDay = (value) => {
  const d = dayjs(value)
  if (!d.isValid()) return null
  return d.endOf('day').toDate()
}

export const formatDurationLabel = (durationSeconds) => {
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

export const getEventColor = (eventType) => {
  if (!eventType) return 'gray'
  if (eventType.includes('complete')) return 'green'
  if (eventType.includes('reset') || eventType.includes('reopen')) return 'orange'
  if (eventType.includes('delete')) return 'red'
  if (eventType.includes('add')) return 'blue'
  return 'purple'
}

export const getEventLabel = (eventType) => {
  if (!eventType) return '事件'
  const map = {
    'todo-add': '新增待辦',
    'todo-complete': '完成待辦',
    'todo-reopen': '還原待辦',
    'todo-delete': '刪除待辦',
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
  return eventType
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getEventTags = (event) => {
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

export const getRangeBounds = (key) => {
  const today = dayjs()
  switch (key) {
    case 'today':
      return { from: today.startOf('day'), to: today.endOf('day') }
    case '14d': {
      const start = today.subtract(13, 'day')
      return { from: start.startOf('day'), to: today.endOf('day') }
    }
    case 'month': {
      const start = today.startOf('month')
      const end = today.endOf('month')
      return { from: start.startOf('day'), to: end.endOf('day') }
    }
    case '7d':
    default: {
      const start = today.subtract(6, 'day')
      return { from: start.startOf('day'), to: today.endOf('day') }
    }
  }
}
