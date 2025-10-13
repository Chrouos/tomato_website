import {
  Box,
  Container,
  Heading,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ColorModeButton } from './components/ui/color-mode.jsx'
import { Toaster } from './components/ui/toaster.jsx'
import { TomatoTimer } from './components/tomato-timer.jsx'

export default function App() {
  return (
    <>
      <Container py='12'>
        <VStack gap='8'>
          <Box alignSelf='flex-end'>
            <ColorModeButton />
          </Box>
          <Stack gap='3' textAlign='center'>
            <Heading size='2xl'>Tomato Website</Heading>
            <Text color='fg.muted'>
              已經使用 Vite + Chakra UI 初始化。開始把你的番茄鐘點子搬進來吧！
            </Text>
          </Stack>
          <TomatoTimer />
        </VStack>
      </Container>
      <Toaster />
    </>
  )
}
