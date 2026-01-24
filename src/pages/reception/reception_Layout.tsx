import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Reception_Sidebar from '../../components/reception/reception_Sidebar'
import Reception_Header from '../../components/reception/reception_Header'

export default function Reception_Layout(){
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('reception.sidebar_collapsed') === '1'
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try { return (localStorage.getItem('reception.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })
  const navigate = useNavigate()
  useEffect(()=>{
    try {
      const sess = localStorage.getItem('reception.session')
      if (!sess) navigate('/reception/login')
    } catch { navigate('/reception/login') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(()=>{ try { localStorage.setItem('reception.theme', theme) } catch {} }, [theme])
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('reception.sidebar_collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const handleToggleSidebar = () => {
    if (collapsed) { setCollapsed(false); return }
    setCollapseSignal(s => s + 1)
    window.setTimeout(() => { setCollapsed(true) }, 200)
  }

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'reception-scope dark' : 'reception-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Reception_Header onToggleSidebar={handleToggleSidebar} collapsed={collapsed} onToggleTheme={()=> setTheme(t=> t==='dark'?'light':'dark')} theme={theme} />
          <div className="flex flex-1 min-h-0">
            <Reception_Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} collapseSignal={collapseSignal} />
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
