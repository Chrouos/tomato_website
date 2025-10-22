'use client'

import { ConfigProvider, theme as antdTheme } from 'antd'
import { ColorModeProvider, useColorModeValue } from './color-mode'

function AntdThemeBridge({ children }) {
  const algorithm = useColorModeValue(antdTheme.defaultAlgorithm, antdTheme.darkAlgorithm)
  return <ConfigProvider theme={{ algorithm }}>{children}</ConfigProvider>
}

export function Provider({ children }) {
  return (
    <ColorModeProvider>
      <AntdThemeBridge>{children}</AntdThemeBridge>
    </ColorModeProvider>
  )
}
