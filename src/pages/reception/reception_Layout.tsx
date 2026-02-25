import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Reception_Sidebar from '../../components/reception/reception_Sidebar'
import Reception_Header from '../../components/reception/reception_Header'
import { hospitalApi } from '../../utils/api'

export default function Reception_Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('reception.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('reception.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const sess = localStorage.getItem('reception.session') ||
            localStorage.getItem('hospital.session') ||
            localStorage.getItem('token')
          if (!sess) {
            setIsAuthorized(false)
            navigate('/reception/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.reception

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : role === 'Reception'
          if (!isAdmin && !hasPortal) {
            setIsAuthorized(false)
            navigate('/reception/login')
            return
          }

          if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
            const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
            if (!ok) {
              navigate(String(allowed[0] || '/reception'))
              return
            }
          }
          setIsAuthorized(true)
        } catch {
          if (!alive) return
          try {
            localStorage.removeItem('reception.session')
            localStorage.removeItem('reception.token')
            localStorage.removeItem('hospital.session')
            localStorage.removeItem('hospital.token')
            localStorage.removeItem('token')
          } catch { }
          setIsAuthorized(false)
          navigate('/reception/login')
        }
      })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  useEffect(() => { try { localStorage.setItem('reception.theme', theme) } catch { } }, [theme])
  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('reception.sidebar_collapsed', collapsed ? '1' : '0') } catch { }
  }, [collapsed])

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setCollapsed(true) }, 200)
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
    <div className={theme === 'dark' ? 'reception-scope dark' : 'reception-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Reception_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Reception_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-6 py-6">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
