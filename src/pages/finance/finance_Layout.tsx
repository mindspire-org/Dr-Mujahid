import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Finance_Sidebar from '../../components/finance/finance_Sidebar'
import Finance_Header from '../../components/finance/finance_Header'

export default function Finance_Layout(){
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('finance.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try { return (localStorage.getItem('finance.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })
  useEffect(()=>{ try { localStorage.setItem('finance.theme', theme) } catch {} }, [theme])
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    const sync = () => {
      try { html.classList.toggle('dark', enable) } catch {}
    }
    sync()
    const obs = new MutationObserver(() => {
      try {
        const has = html.classList.contains('dark')
        if (has !== enable) sync()
      } catch {}
    })
    try { obs.observe(html, { attributes: true, attributeFilter: ['class'] }) } catch {}
    return () => {
      try { obs.disconnect() } catch {}
      try { html.classList.remove('dark') } catch {}
    }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('finance.sidebar_collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setCollapsed(true) }, 200)
  }

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'finance-scope dark' : 'finance-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Finance_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={()=> setTheme(t=> t==='dark'?'light':'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Finance_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
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
