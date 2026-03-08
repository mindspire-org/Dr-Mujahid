import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Counselling_Header from './counselling_Header'
import Counselling_Sidebar from './counselling_Sidebar'

export default function Counselling_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('counselling.sidebar_collapsed') === '1' } catch { return false }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('counselling.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })

  useEffect(() => { try { localStorage.setItem('counselling.theme', theme) } catch { } }, [theme])
  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

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

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const raw = localStorage.getItem('counselling.session') || localStorage.getItem('hospital.session') || localStorage.getItem('token')
          if (!raw) {
            setIsAuthorized(false)
            navigate('/counselling/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.counselling
          const canView = perms?.['counselling.view'] !== false

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : isAdmin
          if (!hasPortal || !canView) {
            setIsAuthorized(false)
            navigate('/counselling/login')
            return
          }

          if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
            const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
            if (!ok) {
              navigate(String(allowed[0] || '/counselling'))
              return
            }
          }

          setIsAuthorized(true)
        } catch {
          if (!alive) return
          setIsAuthorized(false)
          navigate('/counselling/login')
        }
      })()
    return () => { alive = false }
  }, [navigate, pathname])

  useEffect(() => {
    try { localStorage.setItem('counselling.sidebar_collapsed', collapsed ? '1' : '0') } catch { }
  }, [collapsed])

  const toggleCollapsed = () => {
    setCollapsed(v => {
      const nv = !v
      try { localStorage.setItem('counselling.sidebar_collapsed', nv ? '1' : '0') } catch { }
      return nv
    })
  }

  const handleToggleSidebar = () => {
    try {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(v => !v)
        return
      }
    } catch { }
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { toggleCollapsed() }, 200)
  }

  if (isAuthorized === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthorized) return null

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  return (
    <div className={theme === 'dark' ? 'counselling-scope dark' : 'counselling-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Counselling_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Counselling_Sidebar
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              collapseSignal={collapseSignal}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-4 py-6 sm:px-6">
                <div className="mx-auto w-full max-w-7xl">
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
