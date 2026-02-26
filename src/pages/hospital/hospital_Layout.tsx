import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Hospital_Sidebar from '../../components/hospital/hospital_Sidebar'
import Hospital_Header from '../../components/hospital/hospital_Header'
import { hospitalApi } from '../../utils/api'

export default function Hospital_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('hospital.sidebar_collapsed') === '1'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('hospital.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('hospital.theme', theme) } catch { } }, [theme])
  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const raw = localStorage.getItem('hospital.session') || localStorage.getItem('token')
          if (!raw) {
            setIsAuthorized(false)
            navigate('/hospital/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.hospital

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : isAdmin
          if (!hasPortal) {
            setIsAuthorized(false)
            navigate('/hospital/login')
            return
          }

          if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
            const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
            if (!ok) {
              navigate(String(allowed[0] || '/hospital'))
              return
            }
          }
          setIsAuthorized(true)
        } catch {
          if (!alive) return
          setIsAuthorized(false)
          navigate('/hospital/login')
        }
      })()
    return () => { alive = false }
  }, [navigate, pathname])

  useEffect(() => {
    try {
      localStorage.setItem('hospital.sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch (_) { }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!mobileSidebarOpen) return
    try { document.body.style.overflow = 'hidden' } catch { }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false)
    }
    const onResize = () => {
      try {
        if (window.innerWidth >= 768) setMobileSidebarOpen(false)
      } catch { }
    }

    try { window.addEventListener('keydown', onKeyDown) } catch { }
    try { window.addEventListener('resize', onResize) } catch { }
    return () => {
      try { document.body.style.overflow = '' } catch { }
      try { window.removeEventListener('keydown', onKeyDown) } catch { }
      try { window.removeEventListener('resize', onResize) } catch { }
    }
  }, [mobileSidebarOpen])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  const handleToggleSidebar = () => {
    try {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(v => !v)
        return
      }
    } catch { }
    // If currently collapsed, expand immediately
    if (sidebarCollapsed) { setSidebarCollapsed(false); return }
    // If expanding -> collapsing, close submenu first then collapse
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setSidebarCollapsed(true) }, 200)
  }

  if (isAuthorized === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthorized) return null

  return (
    <div className={theme === 'dark' ? 'hospital-scope dark' : 'hospital-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Hospital_Header onToggleSidebar={handleToggleSidebar} collapsed={sidebarCollapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Hospital_Sidebar
              collapsed={sidebarCollapsed}
              onExpand={() => setSidebarCollapsed(false)}
              collapseSignal={collapseSignal}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-4 py-6 sm:px-6">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
