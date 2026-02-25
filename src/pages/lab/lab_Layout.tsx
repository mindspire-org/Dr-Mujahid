import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Lab_Sidebar from '../../components/lab/lab_Sidebar'
import Lab_Header from '../../components/lab/lab_Header'

export default function Lab_Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('lab.sidebar.collapsed') === '1' } catch { return false }
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const toggle = () => {
    setCollapsed(v => {
      const nv = !v
      try { localStorage.setItem('lab.sidebar.collapsed', nv ? '1' : '0') } catch { }
      return nv
    })
  }
  // Theme (dark/light) scoped to Lab only
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const t = (localStorage.getItem('lab.theme') as 'light' | 'dark')
      return t || 'light'
    } catch { return 'light' }
  })
  useEffect(() => {
    try { localStorage.setItem('lab.theme', theme) } catch { }
  }, [theme])
  // Keep dark mode scoped to Lab only (do not set global html/body dark class)
  useEffect(() => {
    try { document.documentElement.classList.remove('dark') } catch { }
    try { document.body.classList.remove('dark') } catch { }
    return () => {
      try { document.documentElement.classList.remove('dark') } catch { }
      try { document.body.classList.remove('dark') } catch { }
    }
  }, [])
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  const navigate = useNavigate()
  useEffect(() => {
    ; (async () => {
      try {
        const raw = localStorage.getItem('lab.session') ||
          localStorage.getItem('hospital.session') ||
          localStorage.getItem('token')
        if (!raw) {
          setIsAuthorized(false)
          navigate('/lab/login')
          return
        }
        // If needed, can call hospitalApi.me() here, but current logic just checks session
        setIsAuthorized(true)
      } catch {
        setIsAuthorized(false)
        navigate('/lab/login')
      }
    })()
  }, [navigate])

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { toggle() }, 200)
  }

  if (isAuthorized === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthorized) return null

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'lab-scope dark' : 'lab-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Lab_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={toggleTheme} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Lab_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-2 py-4">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
