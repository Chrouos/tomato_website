import { useCallback, useMemo } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Typography, Space, Button, Card } from 'antd'
import { ColorModeButton } from './components/ui/color-mode.jsx'
import { Toaster } from './components/ui/toaster.jsx'
import { AuthShell } from './components/auth/auth-shell.jsx'
import { useAuth } from './lib/auth-context.jsx'
import TimerPage from './pages/TimerPage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'
import { LuClock3, LuListTree, LuLogOut } from 'react-icons/lu'

const { Header, Content } = Layout

export default function App() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  const navLinks = useMemo(
    () => [
      { to: '/', label: '番茄鐘', icon: <LuClock3 size={16} /> },
      { to: '/timeline', label: '時間軸', icon: <LuListTree size={16} /> },
    ],
    [],
  )

  if (!isAuthenticated) {
    return (
      <>
        <Layout style={{ minHeight: '100vh', padding: 24 }}>
          <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card style={{ width: '100%', maxWidth: 480 }}>
              <Space direction='vertical' size='large' style={{ width: '100%' }}>
                <Space direction='vertical' size={4}>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    Tomato Website
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    登入後即可使用番茄鐘並追蹤操作時間軸。
                  </Typography.Text>
                </Space>
                <AuthShell />
              </Space>
            </Card>
          </Content>
        </Layout>
        <Toaster />
      </>
    )
  }

  return (
    <>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            background: 'var(--ant-color-bg-elevated)',
            padding: '16px 32px',
            position: 'sticky',
            top: 0,
            zIndex: 20,
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Space direction='vertical' size={2}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  Tomato Website
                </Typography.Title>
                {user?.name ? (
                  <Typography.Text type='secondary'>歡迎回來，{user.name}</Typography.Text>
                ) : null}
              </Space>
            </div>
            <div
              style={{
                flex: '1 1 320px',
                minWidth: 240,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Button
                    key={link.to}
                    type={isActive ? 'primary' : 'default'}
                    icon={link.icon}
                    onClick={() => navigate(link.to)}
                    shape='round'
                  >
                    {link.label}
                  </Button>
                )
              })}
              <Button
                size='middle'
                type='default'
                icon={<LuLogOut size={16} />}
                onClick={handleLogout}
              >
                登出
              </Button>
              <ColorModeButton />
            </div>
          </div>
        </Header>
        <Content style={{ padding: '25px 24px 24px' }}>
          <div
            style={{
              minHeight: '100%',
              maxWidth: 1480,
              margin: '0 auto',
              paddingTop: 24,
              paddingBottom: 24,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Routes>
              <Route path='/' element={<TimerPage />} />
              <Route path='/timeline' element={<TimelinePage />} />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </div>
        </Content>
      </Layout>
      <Toaster />
    </>
  )
}
