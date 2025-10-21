import { useCallback, useMemo } from 'react'
import { Link as RouterLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  ButtonGroup,
  Container,
  Heading,
  HStack,
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
import { LuClock3, LuListTree } from 'react-icons/lu'

export default function App() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  const navLinks = useMemo(
    () => [
      { to: '/', label: '番茄鐘', icon: LuClock3 },
      { to: '/timeline', label: '時間軸', icon: LuListTree },
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
      <Container  py='6' overflow='hidden'>
        <VStack gap='6' height='100%' maxH='100%' align='stretch'>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            justify='space-between'
            align={{ base: 'flex-start', md: 'center' }}
            spacing={{ base: 4, md: 6 }}
          >
            <Stack spacing={0}>
              <Heading size='lg'>Tomato Website</Heading>
            </Stack>
            <HStack spacing={{ base: 2, md: 3 }} wrap='wrap'>
              <ButtonGroup size='sm' variant='ghost'>
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.to
                  const Icon = link.icon
                  return (
                    <Button
                      key={link.to}
                      as={RouterLink}
                      to={link.to}
                      variant={isActive ? 'solid' : 'ghost'}
                      colorScheme='blue'
                      borderRadius='full'
                      leftIcon={<Icon size={16} />}
                    >
                      {link.label}
                    </Button>
                  )
                })}
              </ButtonGroup>
              <Button size='sm' variant='outline' onClick={handleLogout}>
                登出
              </Button>
              <ColorModeButton />
            </HStack>
          </Stack>
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
