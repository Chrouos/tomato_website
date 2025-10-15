import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const storageKey = 'tomato_auth_state'

function loadInitialState() {
  if (typeof window === 'undefined') {
    return { user: null, token: null }
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return { user: null, token: null }
    }
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
    }
  } catch (error) {
    console.warn('Failed to parse auth state from storage', error)
    return { user: null, token: null }
  }
}

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => loadInitialState())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (!state?.token) {
        window.localStorage.removeItem(storageKey)
        return
      }
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          user: state.user,
          token: state.token,
        }),
      )
    } catch (error) {
      console.warn('Failed to persist auth state', error)
    }
  }, [state])

  const login = useCallback((user, token) => {
    setState({
      user,
      token,
    })
  }, [])

  const logout = useCallback(() => {
    setState({
      user: null,
      token: null,
    })
  }, [])

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state?.token && state?.user),
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 中使用')
  }
  return context
}
