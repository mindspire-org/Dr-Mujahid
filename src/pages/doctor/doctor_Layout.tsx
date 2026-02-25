import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Doctor_Sidebar from '../../components/doctor/doctor_Sidebar'
import Doctor_Header from '../../components/doctor/doctor_Header'
import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Doctor_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('doctor.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('doctor.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('doctor.theme', theme) } catch { } }, [theme])
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
          const raw = localStorage.getItem('doctor.session') ||
            localStorage.getItem('hospital.session') ||
            localStorage.getItem('doctor.token') ||
            localStorage.getItem('hospital.token') ||
            localStorage.getItem('token')
          if (!raw) {
            setIsAuthorized(false)
            navigate('/doctor/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.doctor

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : role === 'Doctor'
          if (!isAdmin && !hasPortal) {
            setIsAuthorized(false)
            navigate('/doctor/login')
            return
          }

          if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes('*')) {
            const ok = allowed.some((r: string) => pathname === r || pathname.startsWith(`${r}/`))
            if (!ok) {
              navigate(String(allowed[0] || '/doctor'))
              return
            }
          }
          setIsAuthorized(true)
        } catch {
          if (!alive) return
          setIsAuthorized(false)
          navigate('/doctor/login')
        }
      })()
    return () => { alive = false }
  }, [navigate, pathname])

  useEffect(() => {
    try { localStorage.setItem('doctor.sidebar_collapsed', collapsed ? '1' : '0') } catch { }
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
    <div className={theme === 'dark' ? 'doctor-scope dark' : 'doctor-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Doctor_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Doctor_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
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
