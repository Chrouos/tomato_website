import { TomatoTimer } from '../components/tomato-timer.jsx'

export function TimerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TomatoTimer />
      </div>
    </div>
  )
}

export default TimerPage
