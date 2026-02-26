import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Diagnostic_Sidebar from '../../components/diagnostic/diagnostic_Sidebar'
import Diagnostic_Header from '../../components/diagnostic/diagnostic_Header'
import { hospitalApi } from '../../utils/api'

export default function Diagnostic_Layout() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('diagnostic.sidebar.collapsed') === '1' } catch { return false }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('diagnostic.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('diagnostic.theme', theme) } catch { } }, [theme])
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
  }, [location.pathname])

  const toggle = () => {
    setCollapsed(v => {
      const nv = !v
      try { localStorage.setItem('diagnostic.sidebar.collapsed', nv ? '1' : '0') } catch { }
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
    window.setTimeout(() => { toggle() }, 200)
  }

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const raw = localStorage.getItem('hospital.session') || localStorage.getItem('token')
          if (!raw) {
            setIsAuthorized(false)
            navigate('/diagnostic/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.diagnostic

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : isAdmin
          if (!hasPortal) {
            setIsAuthorized(false)
            navigate('/diagnostic/login')
            return
          }
          setIsAuthorized(true)
        } catch {
          if (!alive) return
          setIsAuthorized(false)
          navigate('/diagnostic/login')
        }
      })()
    return () => { alive = false }
  }, [navigate])

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
    <div className={theme === 'dark' ? 'diagnostic-scope dark' : 'diagnostic-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Diagnostic_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Diagnostic_Sidebar
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              collapseSignal={collapseSignal}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-2 sm:px-4 py-4">
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
