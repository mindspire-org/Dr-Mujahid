import { Outlet, useNavigate } from 'react-router-dom'
import Doctor_Sidebar from '../../components/doctor/doctor_Sidebar'
import Doctor_Header from '../../components/doctor/doctor_Header'
import { useEffect, useState } from 'react'

export default function Doctor_Layout() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('doctor.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try { return (localStorage.getItem('doctor.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })
  useEffect(()=>{ try { localStorage.setItem('doctor.theme', theme) } catch {} }, [theme])
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      if (!raw) navigate('/hospital/login')
    } catch { navigate('/hospital/login') }
  }, [navigate])

  useEffect(() => {
    try { localStorage.setItem('doctor.sidebar_collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setCollapsed(true) }, 200)
  }

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'doctor-scope dark' : 'doctor-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Doctor_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={() => setTheme(t=>t==='dark'?'light':'dark')} theme={theme} />
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
