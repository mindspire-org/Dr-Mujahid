import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Diagnostic_Sidebar from '../../components/diagnostic/diagnostic_Sidebar'
import Diagnostic_Header from '../../components/diagnostic/diagnostic_Header'

export default function Diagnostic_Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(()=>{
    try { return localStorage.getItem('diagnostic.sidebar.collapsed') === '1' } catch { return false }
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try { return (localStorage.getItem('diagnostic.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })
  useEffect(()=>{ try { localStorage.setItem('diagnostic.theme', theme) } catch {} }, [theme])
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])
  const toggle = () => {
    setCollapsed(v=>{
      const nv = !v
      try { localStorage.setItem('diagnostic.sidebar.collapsed', nv ? '1' : '0') } catch {}
      return nv
    })
  }

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { toggle() }, 200)
  }

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'diagnostic-scope dark' : 'diagnostic-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Diagnostic_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={()=> setTheme(t=>t==='dark'?'light':'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Diagnostic_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <main className="w-full px-2 py-4">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
