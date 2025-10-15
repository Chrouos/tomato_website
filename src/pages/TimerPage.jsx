import { Box, Heading, HStack, Stack, Text } from '@chakra-ui/react'
import { TomatoTimer } from '../components/tomato-timer.jsx'
import { useAuth } from '../lib/auth-context.jsx'

export function TimerPage() {
  const { user } = useAuth()

  return (
    <Stack gap='6' height='100%'>
      <Stack gap='1'>
        <Heading size='lg'>番茄鐘</Heading>
        <Text color='fg.muted'>
          專注於當下的番茄鐘循環，開始、暫停、重置和紀錄待辦。
        </Text>
        {user && (
          <Text fontSize='sm' color='fg.subtle'>
            歡迎回來，{user.name || user.email}
          </Text>
        )}
      </Stack>
      <Box flex='1' minH='0'>
        <TomatoTimer />
      </Box>
    </Stack>
  )
}

export default TimerPage
