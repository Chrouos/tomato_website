import { useEffect, useRef } from 'react'
import { API_BASE_URL } from '../lib/api.js'

const EVENT_MAP = [
  { sse: 'session:recorded', browser: 'tomato:session-event-recorded' },
  { sse: 'study-group:presence', browser: 'tomato:study-group-presence' },
  { sse: 'daily-task:changed', browser: 'tomato:daily-task-changed' },
  { sse: 'todo:changed', browser: 'tomato:todo-changed' },
  { sse: 'encouragement:updated', browser: 'tomato:encouragement-updated' },
  { sse: 'study-group:message', browser: 'tomato:study-group-message' },
]

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function RealtimeBridge({ token }) {
  const sourceRef = useRef(null)

  useEffect(() => {
    if (!token) {
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
      return undefined
    }

    const base = normalizeBaseUrl(API_BASE_URL)
    const url = new URL(`${base}/stream`)
    url.searchParams.set('token', token)

    const eventSource = new EventSource(url.toString(), { withCredentials: false })

    const dispatch = (eventName, detail) => {
      try {
        window.dispatchEvent(new CustomEvent(eventName, { detail }))
      } catch (error) {
        console.warn('Failed to dispatch realtime event', eventName, error)
      }
    }

    EVENT_MAP.forEach(({ sse, browser }) => {
      eventSource.addEventListener(sse, (event) => {
        if (!event?.data) {
          dispatch(browser, null)
          return
        }
        try {
          const raw = JSON.parse(event.data)
          const payload = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw
          dispatch(browser, payload)
        } catch (error) {
          console.warn('Failed to parse SSE payload', sse, error)
        }
      })
    })

    eventSource.onerror = (error) => {
      console.warn('SSE connection error', error)
    }

    sourceRef.current = eventSource

    return () => {
      eventSource.close()
      sourceRef.current = null
    }
  }, [token])

  return null
}

export default RealtimeBridge
