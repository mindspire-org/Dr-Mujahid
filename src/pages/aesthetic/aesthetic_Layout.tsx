import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Aesthetic_Sidebar from '../../components/aesthetic/aesthetic_Sidebar'
import Aesthetic_Header from '../../components/aesthetic/aesthetic_Header'
import { aestheticApi } from '../../utils/api'

export default function Aesthetic_Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('aesthetic.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('aesthetic.theme', theme) } catch { } }, [theme])
  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  const navigate = useNavigate()
  const [username, setUsername] = useState<string>('')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aesthetic.session') ||
        localStorage.getItem('hospital.session') ||
        localStorage.getItem('token')
      if (!raw) {
        setIsAuthorized(false)
        navigate('/aesthetic/login')
        return
      }
      try {
        const s = JSON.parse(raw || '{}')
        setUsername(String(s?.username || ''))
        setIsAuthorized(true)
      } catch {
        setIsAuthorized(false)
        navigate('/aesthetic/login')
      }
    } catch {
      setIsAuthorized(false)
      navigate('/aesthetic/login')
    }
  }, [navigate])

  const onLogout = async () => {
    try { await aestheticApi.logout() } catch { }
    try {
      localStorage.removeItem('aesthetic.token')
      localStorage.removeItem('token')
      localStorage.removeItem('aesthetic.session')
    } catch { }
    navigate('/aesthetic/login')
  }

  if (isAuthorized === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthorized) return null

  const shell = theme === 'dark' ? 'min-h-dvh bg-slate-900 text-slate-100' : 'min-h-dvh bg-slate-50 text-slate-900'

  return (
    <div className={theme === 'dark' ? 'aesthetic-scope dark' : 'aesthetic-scope'}>
      <div className={shell}>
        <div className="flex">
          <Aesthetic_Sidebar collapsed={collapsed} />
          <div className="flex min-h-dvh flex-1 flex-col">
            <Aesthetic_Header onToggleSidebar={() => setCollapsed(c => !c)} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} onLogout={onLogout} username={username} />
            <main className="w-full flex-1 px-2 py-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
