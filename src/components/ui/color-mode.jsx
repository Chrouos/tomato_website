'use client'

import { Button, Skeleton } from 'antd'
import { ThemeProvider, useTheme } from 'next-themes'
import * as React from 'react'
import { LuMoon, LuSun } from 'react-icons/lu'

function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return fallback
  return <>{children}</>
}

export function ColorModeProvider(props) {
  return <ThemeProvider attribute='class' disableTransitionOnChange {...props} />
}

export function useColorMode() {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme()
  const colorMode = forcedTheme || resolvedTheme || 'light'
  const toggleColorMode = () => {
    setTheme(colorMode === 'dark' ? 'light' : 'dark')
  }
  return {
    colorMode,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

export function useColorModeValue(light, dark) {
  const { colorMode } = useColorMode()
  return colorMode === 'dark' ? dark : light
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === 'dark' ? <LuMoon /> : <LuSun />
}

export const ColorModeButton = React.forwardRef(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode()
  return (
    <ClientOnly fallback={<Skeleton.Button size='small' shape='circle' active />}>
      <Button
        {...props}
        ref={ref}
        type='text'
        shape='circle'
        size='small'
        onClick={toggleColorMode}
        icon={<ColorModeIcon />}
      />
    </ClientOnly>
  )
})

export const LightMode = React.forwardRef(function LightMode(props, ref) {
  return <span data-theme='light' style={{ display: 'contents' }} ref={ref} {...props} />
})

export const DarkMode = React.forwardRef(function DarkMode(props, ref) {
  return <span data-theme='dark' style={{ display: 'contents' }} ref={ref} {...props} />
})
