import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Hospital_Sidebar from '../../components/hospital/hospital_Sidebar'
import Hospital_Header from '../../components/hospital/hospital_Header'

export default function Hospital_Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('hospital.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try { return (localStorage.getItem('hospital.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })
  useEffect(()=>{ try { localStorage.setItem('hospital.theme', theme) } catch {} }, [theme])
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem('hospital.sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch (_) {}
  }, [sidebarCollapsed])

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  const handleToggleSidebar = () => {
    // If currently collapsed, expand immediately
    if (sidebarCollapsed) { setSidebarCollapsed(false); return }
    // If expanding -> collapsing, close submenu first then collapse
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setSidebarCollapsed(true) }, 200)
  }

  return (
    <div className={theme === 'dark' ? 'hospital-scope dark' : 'hospital-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Hospital_Header onToggleSidebar={handleToggleSidebar} collapsed={sidebarCollapsed} onToggleTheme={() => setTheme(t=>t==='dark'?'light':'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Hospital_Sidebar collapsed={sidebarCollapsed} onExpand={() => setSidebarCollapsed(false)} collapseSignal={collapseSignal} />
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
