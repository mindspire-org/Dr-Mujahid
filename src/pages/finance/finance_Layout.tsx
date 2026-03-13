import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Finance_Sidebar from '../../components/finance/finance_Sidebar'
import Finance_Header from '../../components/finance/finance_Header'
import { hospitalApi } from '../../utils/api'

export default function Finance_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('finance.sidebar_collapsed') === '1'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('finance.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('finance.theme', theme) } catch { } }, [theme])
  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    const sync = () => {
      try { html.classList.toggle('dark', enable) } catch { }
    }
    sync()
    const obs = new MutationObserver(() => {
      try {
        const has = html.classList.contains('dark')
        if (has !== enable) sync()
      } catch { }
    })
    try { obs.observe(html, { attributes: true, attributeFilter: ['class'] }) } catch { }
    return () => {
      try { obs.disconnect() } catch { }
      try { html.classList.remove('dark') } catch { }
    }
  }, [theme])

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const raw = localStorage.getItem('finance.session') ||
            localStorage.getItem('hospital.session') ||
            localStorage.getItem('token')

          if (!raw) {
            setIsAuthorized(false)
            navigate('/finance/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const roleLower = role.toLowerCase()
          const perms = me?.user?.permissions || {}
          const allowed = perms?.finance

          const isAdmin = roleLower === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : roleLower === 'finance'

          if (!isAdmin && !hasPortal) {
            setIsAuthorized(false)
            navigate('/finance/login')
            return
          }

          if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
            const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
            if (!ok) {
              navigate(String(allowed[0] || '/finance'))
              return
            }
          }

          setIsAuthorized(true)
        } catch {
          if (!alive) return
          try {
            localStorage.removeItem('finance.session')
            localStorage.removeItem('finance.token')
            localStorage.removeItem('hospital.session')
            localStorage.removeItem('hospital.token')
            localStorage.removeItem('token')
          } catch { }
          setIsAuthorized(false)
          navigate('/finance/login')
        }
      })()
    return () => { alive = false }
  }, [navigate, pathname])

  useEffect(() => {
    try { localStorage.setItem('finance.sidebar_collapsed', collapsed ? '1' : '0') } catch { }
  }, [collapsed])

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

  const handleToggleSidebar = () => {
    try {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(v => !v)
        return
      }
    } catch { }
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
    <div className={theme === 'dark' ? 'finance-scope dark' : 'finance-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Finance_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Finance_Sidebar
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              collapseSignal={collapseSignal}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-2 sm:px-4 py-4">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
