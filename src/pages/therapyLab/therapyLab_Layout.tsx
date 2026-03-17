import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import TherapyLab_Sidebar from './therapyLab_Sidebar'
import TherapyLab_Header from './therapyLab_Header'

export default function TherapyLab_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('therapyLab.sidebar_collapsed') === '1'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('hospital.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    try { localStorage.setItem('hospital.theme', theme) } catch { }
  }, [theme])

  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem('therapyLab.sidebar_collapsed', sidebarCollapsed ? '1' : '0')
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

  const handleToggleSidebar = () => {
    try {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(v => !v)
        return
      }
    } catch { }
    if (sidebarCollapsed) { setSidebarCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setSidebarCollapsed(true) }, 200)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('therapyLab.session') ||
        localStorage.getItem('hospital.session') ||
        localStorage.getItem('token')
      if (!raw) {
        navigate('/therapy-lab/login')
        return
      }
      const s = JSON.parse(raw)
      const role = String(s?.role || '')
      const perms = s?.permissions
      const allowed = perms?.therapyLab

      const legacyOk = role === 'Admin' || role === 'Staff' || role === 'Therapy & Lab Reports Entry'
      const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : legacyOk
      if (!hasPortal) {
        navigate('/therapy-lab/login')
        return
      }

      if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
        const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
        if (!ok) navigate(String(allowed[0] || '/therapy-lab/lab-reports-entry'))
      }
    } catch {
      navigate('/therapy-lab/login')
    }
  }, [navigate, pathname])

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  return (
    <div className={theme === 'dark' ? 'hospital-scope dark' : 'hospital-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <TherapyLab_Header 
            onToggleSidebar={handleToggleSidebar} 
            collapsed={sidebarCollapsed} 
            onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
            theme={theme} 
          />
          <div className="flex flex-1 min-h-0">
            <TherapyLab_Sidebar 
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
