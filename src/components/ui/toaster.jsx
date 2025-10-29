'use client'

import { useEffect } from 'react'
import { App as AntdApp, message as antdMessage, notification as antdNotification } from 'antd'

const normalizeType = (type = 'info') => {
  if (['success', 'info', 'warning', 'error', 'loading'].includes(type)) return type
  return 'info'
}

let messageApi = antdMessage
let notificationApi = antdNotification

export const toaster = {
  setApis({ message, notification }) {
    messageApi = message ?? antdMessage
    notificationApi = notification ?? antdNotification
  },
  resetApis() {
    messageApi = antdMessage
    notificationApi = antdNotification
  },
  create({ title, description, type = 'info', duration }) {
    const normalized = normalizeType(type)
    if (normalized === 'loading') {
      messageApi.loading({ content: description || title || '載入中...', duration: duration ?? 0 })
      return
    }
    if (description) {
      const notify = notificationApi[normalized] ?? notificationApi.info
      notify({ message: title, description, duration })
      return
    }
    const msg = messageApi[normalized] ?? messageApi.info
    msg({ content: title, duration })
  },
}

export const Toaster = () => {
  const { message, notification } = AntdApp.useApp()

  useEffect(() => {
    toaster.setApis({ message, notification })
    return () => {
      toaster.resetApis()
    }
  }, [message, notification])

  return null
}
