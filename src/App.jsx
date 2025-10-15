import { useCallback, useMemo } from 'react'
import { Link as RouterLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Link,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ColorModeButton } from './components/ui/color-mode.jsx'
import { Toaster } from './components/ui/toaster.jsx'
import { AuthShell } from './components/auth/auth-shell.jsx'
import { useAuth } from './lib/auth-context.jsx'
import TimerPage from './pages/TimerPage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'

export default function App() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  const navLinks = useMemo(
    () => [
      { to: '/', label: '番茄鐘' },
      { to: '/timeline', label: '時間軸' },
    ],
    [],
  )

  if (!isAuthenticated) {
    return (
      <>
        <Container height='100vh' py='6'>
          <VStack gap='6' height='100%' align='stretch' maxW='lg' mx='auto'>
            <Stack gap='3' textAlign='center'>
              <Heading size='lg'>Tomato Website</Heading>
              <Text color='fg.muted'>登入後即可使用番茄鐘並追蹤操作時間軸。</Text>
            </Stack>
            <AuthShell />
          </VStack>
        </Container>
        <Toaster />
      </>
    )
  }

  return (
    <>
      <Container height='100vh' py='6' overflow='hidden'>
        <VStack gap='6' height='100%' maxH='100%' align='stretch'>
          <HStack justify='space-between' align='center' flexWrap='wrap' gap='4'>
            <Stack gap='0'>
              <Heading size='lg'>Tomato Website</Heading>
              <Text fontSize='sm' color='fg.muted'>
                {user?.name || user?.email}
              </Text>
            </Stack>
            <HStack gap='3' flexWrap='wrap'>
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    as={RouterLink}
                    key={link.to}
                    to={link.to}
                    px='3'
                    py='2'
                    borderRadius='md'
                    fontWeight='semibold'
                    bg={isActive ? 'primary.solid' : 'transparent'}
                    color={isActive ? 'white' : 'fg.muted'}
                    _hover={{ bg: isActive ? 'primary.solid' : 'bg.muted' }}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Button size='sm' variant='outline' onClick={handleLogout}>
                登出
              </Button>
              <ColorModeButton />
            </HStack>
          </HStack>
          <Box flex='1' minH='0' overflow='hidden'>
            <Routes>
              <Route path='/' element={<TimerPage />} />
              <Route path='/timeline' element={<TimelinePage />} />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </Box>
        </VStack>
      </Container>
      <Toaster />
    </>
  )
}
