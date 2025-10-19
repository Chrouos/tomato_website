import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  loginWithEmail,
  registerWithEmail,
  requestEmailVerificationCode,
  loginWithGoogle,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.jsx'
import { toaster } from '../ui/toaster.jsx'

const INITIAL_REGISTER_STATE = {
  email: '',
  name: '',
  password: '',
  verificationCode: '',
}

const INITIAL_LOGIN_STATE = {
  email: '',
  password: '',
}

export function AuthShell() {
  const { login } = useAuth()
  const [mode, setMode] = useState('login')
  const [registerState, setRegisterState] = useState(INITIAL_REGISTER_STATE)
  const [loginState, setLoginState] = useState(INITIAL_LOGIN_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [codeInfo, setCodeInfo] = useState(null)

  // ---- Google Sign-In ----
  const gsiButtonRef = useRef(null)
  const [gsiReady, setGsiReady] = useState(false)

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGsiReady(true)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => setGsiReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!gsiReady || !gsiButtonRef.current) return
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      toaster.create({
        title: '缺少 Google Client ID',
        description: '請在 .env.local 設定 VITE_GOOGLE_CLIENT_ID',
        type: 'error',
      })
      return
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (resp) => {
        try {
          setIsSubmitting(true)
          const payload = await loginWithGoogle({ idToken: resp.credential })
          login(payload.user, payload.token)
          toaster.create({ title: 'Google 登入成功', type: 'success' })
        } catch (error) {
          toaster.create({
            title: 'Google 登入失敗',
            description: error.message,
            type: 'error',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
      ux_mode: 'popup',
      auto_select: false,
    })

    // 避免重複渲染按鈕
    gsiButtonRef.current.innerHTML = ''

    window.google.accounts.id.renderButton(gsiButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left',
    })
  }, [gsiReady])

  const handleSwitchMode = (nextMode) => {
    setMode(nextMode)
    if (nextMode === 'login') {
      setRegisterState(INITIAL_REGISTER_STATE)
      setCodeInfo(null)
    } else {
      setLoginState(INITIAL_LOGIN_STATE)
    }
  }

  const handleRegisterChange = (field) => (event) => {
    setRegisterState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const handleLoginChange = (field) => (event) => {
    setLoginState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const handleRequestCode = async () => {
    if (!registerState.email) {
      toaster.create({ title: '請先輸入 Email', type: 'warning' })
      return
    }
    setIsRequestingCode(true)
    try {
      const result = await requestEmailVerificationCode({ email: registerState.email })
      setCodeInfo(result)
      toaster.create({
        title: '驗證碼已寄送',
        description: '請於 1 小時內完成註冊',
        type: 'success',
      })
      if (result?.verificationCode) {
        toaster.create({
          title: '開發測試用驗證碼',
          description: result.verificationCode,
          type: 'info',
        })
        setRegisterState((prev) => ({
          ...prev,
          verificationCode: result.verificationCode ?? '',
        }))
      }
    } catch (error) {
      toaster.create({
        title: '取得驗證碼失敗',
        description: error.message,
        type: 'error',
      })
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleRegisterSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = await registerWithEmail(registerState)
      login(payload.user, payload.token)
      toaster.create({ title: '註冊成功', type: 'success' })
    } catch (error) {
      toaster.create({ title: '註冊失敗', description: error.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = await loginWithEmail(loginState)
      login(payload.user, payload.token)
      toaster.create({ title: '登入成功', type: 'success' })
    } catch (error) {
      toaster.create({ title: '登入失敗', description: error.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Flex height='100%' align='center' justify='center'>
      <Box
        borderWidth='1px'
        borderRadius='lg'
        padding='8'
        maxW='480px'
        width='100%'
        bg='bg.surface'
        boxShadow='md'
      >
        <VStack gap='4' align='stretch'>
          <Stack gap='1'>
            <Heading size='lg'>
              {mode === 'login' ? '登入您的帳號' : '建立新帳號'}
            </Heading>
            <Text color='fg.muted'>
              {mode === 'login'
                ? '登入後即可管理你的番茄鐘紀錄。'
                : '輸入 Email 取得驗證碼，再完成註冊流程。'}
            </Text>
          </Stack>

          {/* Google 登入按鈕 */}
          <Stack gap='3'>
            <Box ref={gsiButtonRef} display='flex' justifyContent='center' />
            <Box as='hr' borderTopWidth='1px' borderColor='border' mt='2' />
          </Stack>

          {mode === 'login' ? (
            <Stack as='form' gap='4' onSubmit={handleLoginSubmit}>
              <Field.Root required>
                <Field.Label>Email</Field.Label>
                <Input
                  type='email'
                  value={loginState.email}
                  onChange={handleLoginChange('email')}
                  autoComplete='email'
                  placeholder='you@example.com'
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>密碼</Field.Label>
                <Input
                  type='password'
                  value={loginState.password}
                  onChange={handleLoginChange('password')}
                  autoComplete='current-password'
                  placeholder='請輸入密碼'
                />
              </Field.Root>
              <Button type='submit' colorScheme='primary' isLoading={isSubmitting}>
                登入
              </Button>
            </Stack>
          ) : (
            <Stack as='form' gap='4' onSubmit={handleRegisterSubmit}>
              <Field.Root required>
                <Field.Label>Email</Field.Label>
                <HStack align='start'>
                  <Input
                    type='email'
                    value={registerState.email}
                    onChange={handleRegisterChange('email')}
                    autoComplete='email'
                    placeholder='you@example.com'
                  />
                  <Button
                    onClick={handleRequestCode}
                    isLoading={isRequestingCode}
                    variant='outline'
                    flexShrink={0}
                  >
                    取得驗證碼
                  </Button>
                </HStack>
                <Field.HelperText>
                  按下按鈕後會寄送 6 位數驗證碼到填寫的 Email。
                </Field.HelperText>
              </Field.Root>

              <Field.Root required>
                <Field.Label>驗證碼</Field.Label>
                <Input
                  value={registerState.verificationCode}
                  onChange={handleRegisterChange('verificationCode')}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  placeholder='請輸入 6 位數驗證碼'
                />
                {codeInfo?.expiresAt && (
                  <Field.HelperText>
                    驗證碼將於 {new Date(codeInfo.expiresAt).toLocaleString()} 到期
                  </Field.HelperText>
                )}
              </Field.Root>

              <Field.Root required>
                <Field.Label>暱稱</Field.Label>
                <Input
                  value={registerState.name}
                  onChange={handleRegisterChange('name')}
                  placeholder='你的名字或暱稱'
                />
              </Field.Root>

              <Field.Root required>
                <Field.Label>密碼</Field.Label>
                <Input
                  type='password'
                  value={registerState.password}
                  onChange={handleRegisterChange('password')}
                  autoComplete='new-password'
                  placeholder='至少 8 個字元'
                  minLength={8}
                />
              </Field.Root>

              <Button type='submit' colorScheme='primary' isLoading={isSubmitting}>
                建立帳號
              </Button>
            </Stack>
          )}

          <Alert.Root status='info' variant='subtle'>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                目前開放 Email 與 Google 登入。完成註冊後即可使用番茄鐘。
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>

          <HStack justify='center'>
            <Text>{mode === 'login' ? '還沒有帳號？' : '已經有帳號了？'}</Text>
            <Link
              onClick={() => handleSwitchMode(mode === 'login' ? 'register' : 'login')}
              fontWeight='semibold'
            >
              {mode === 'login' ? '建立帳號' : '立即登入'}
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Flex>
  )
}
