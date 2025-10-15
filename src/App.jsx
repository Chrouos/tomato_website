import { useCallback } from 'react'
import { Box, Button, Container, Heading, HStack, Stack, Text, VStack } from '@chakra-ui/react'
import { ColorModeButton } from './components/ui/color-mode.jsx'
import { Toaster } from './components/ui/toaster.jsx'
import { TomatoTimer } from './components/tomato-timer.jsx'
import { AuthShell } from './components/auth/auth-shell.jsx'
import { useAuth } from './lib/auth-context.jsx'

export default function App() {
  const { isAuthenticated, user, logout } = useAuth()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <>
      <Container height='100vh' py='6' overflow='hidden'>
        <VStack gap='6' height='100%' maxH='100%' align='stretch'>
          <HStack justify='space-between' align='center'>
            <Stack gap='1'>
              <Heading size='lg'>Tomato Website</Heading>
              {isAuthenticated && (
                <Text fontSize='sm' color='fg.muted'>
                  歡迎回來，{user?.name || user?.email}
                </Text>
              )}
            </Stack>
            <HStack gap='2'>
              {isAuthenticated && (
                <Button size='sm' variant='outline' onClick={handleLogout}>
                  登出
                </Button>
              )}
              <ColorModeButton />
            </HStack>
          </HStack>
          <Box flex='1' minH='0'>
            {isAuthenticated ? <TomatoTimer /> : <AuthShell />}
          </Box>
        </VStack>
      </Container>
      <Toaster />
    </>
  )
}
