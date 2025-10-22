import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { formatDateInput, getRangeBounds } from './utils.js'

export function useTimelineFilters(defaultRange = '7d') {
  const defaultBounds = useMemo(() => getRangeBounds(defaultRange), [defaultRange])

  const [filters, setFilters] = useState(() => ({
    from: formatDateInput(defaultBounds.from),
    to: formatDateInput(defaultBounds.to),
    minHours: '0',
  }))
  const [activeRangeKey, setActiveRangeKey] = useState(defaultRange)
  const [calendarValue, setCalendarValue] = useState(defaultBounds.to)
  const [selectedDate, setSelectedDate] = useState(defaultBounds.to)

  const setDateRange = useCallback((from, to) => {
    setFilters((prev) => ({
      ...prev,
      from: formatDateInput(from),
      to: formatDateInput(to),
    }))
  }, [])

  const applyQuickRange = useCallback(
    (key) => {
      const bounds = getRangeBounds(key)
      setActiveRangeKey(key)
      setDateRange(bounds.from, bounds.to)
      setSelectedDate(bounds.to)
      setCalendarValue(bounds.to)
    },
    [setDateRange],
  )

  const selectDate = useCallback(
    (value) => {
      const safeValue = dayjs(value)
      if (!safeValue.isValid()) return
      setActiveRangeKey('custom')
      setDateRange(safeValue, safeValue)
      setSelectedDate(safeValue)
      setCalendarValue(safeValue)
    },
    [setDateRange],
  )

  const handleMinHoursChange = useCallback((value) => {
    setFilters((prev) => ({
      ...prev,
      minHours: value != null && !Number.isNaN(value) ? String(value) : '',
    }))
  }, [])

  useEffect(() => {
    applyQuickRange(defaultRange)
  }, [applyQuickRange, defaultRange])

  return {
    filters,
    activeRangeKey,
    calendarValue,
    selectedDate,
    applyQuickRange,
    selectDate,
    handleMinHoursChange,
    setCalendarValue,
    setSelectedDate,
  }
}
