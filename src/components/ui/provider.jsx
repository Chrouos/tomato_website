'use client'

import { ConfigProvider, theme as antdTheme } from 'antd'
import { ColorModeProvider, useColorModeValue } from './color-mode'

const lightThemeTokens = {
  token: {
    colorBgBase: '#f9fafb',
    colorBgContainer: '#ffffff',
    colorTextBase: '#0f172a',
    colorBorder: '#e5e7eb',
  },
}

const darkThemeTokens = {
  token: {
    colorBgBase: '#0b1120',
    colorBgContainer: '#111827',
    colorTextBase: '#f8fafc',
    colorBorder: '#1f2937',
  },
}

function AntdThemeBridge({ children }) {
  const algorithm = useColorModeValue(antdTheme.defaultAlgorithm, antdTheme.darkAlgorithm)
  const tokens = useColorModeValue(lightThemeTokens, darkThemeTokens)

  return (
    <ConfigProvider
      theme={{
        algorithm,
        token: {
          ...tokens.token,
        },
        components: {
          Card: {
            colorBgContainer: tokens.token.colorBgContainer,
          },
          Button: {
            colorBgContainer: tokens.token.colorBgContainer,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}

export function Provider({ children }) {
  return (
    <ColorModeProvider>
      <AntdThemeBridge>{children}</AntdThemeBridge>
    </ColorModeProvider>
  )
}
