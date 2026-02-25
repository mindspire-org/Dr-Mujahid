import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import TherapyLab_Sidebar from './therapyLab_Sidebar'
import TherapyLab_Header from './therapyLab_Header'

export default function TherapyLab_Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [theme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('hospital.theme') as 'light' | 'dark') || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const html = document.documentElement
    try {
      html.classList.toggle('dark', theme === 'dark')
    } catch { }
    return () => {
      try {
        html.classList.remove('dark')
      } catch { }
    }
  }, [theme])

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
          <TherapyLab_Header />
          <div className="flex flex-1 min-h-0">
            <TherapyLab_Sidebar />
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
