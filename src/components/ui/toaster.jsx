'use client'

import { message, notification } from 'antd'

const normalizeType = (type = 'info') => {
  if (['success', 'info', 'warning', 'error', 'loading'].includes(type)) return type
  return 'info'
}

export const toaster = {
  create({ title, description, type = 'info', duration }) {
    const normalized = normalizeType(type)
    if (normalized === 'loading') {
      message.loading({ content: description || title || '載入中...', duration: duration ?? 0 })
      return
    }
    if (description) {
      const notify = notification[normalized] ?? notification.info
      notify({ message: title, description, duration })
      return
    }
    const msg = message[normalized] ?? message.info
    msg({ content: title, duration })
  },
}

export const Toaster = () => null
