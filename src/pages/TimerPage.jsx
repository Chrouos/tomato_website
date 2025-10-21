import { Box, Heading, HStack, Stack, Text } from '@chakra-ui/react'
import { TomatoTimer } from '../components/tomato-timer.jsx'
import { useAuth } from '../lib/auth-context.jsx'

export function TimerPage() {
  const { user } = useAuth()

  return (
    <Stack gap='6' height='100%'>
      <Box flex='1' minH='0'>
        <TomatoTimer />
      </Box>
    </Stack>
  )
}

export default TimerPage
