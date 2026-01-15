import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Lab_Sidebar from '../../components/lab/lab_Sidebar'
import Lab_Header from '../../components/lab/lab_Header'

export default function Lab_Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(()=>{
    try { return localStorage.getItem('lab.sidebar.collapsed') === '1' } catch { return false }
  })
  const toggle = () => {
    setCollapsed(v=>{
      const nv = !v
      try { localStorage.setItem('lab.sidebar.collapsed', nv ? '1' : '0') } catch {}
      return nv
    })
  }
  // Theme (dark/light) scoped to Lab only
  const [theme, setTheme] = useState<'light'|'dark'>(()=>{
    try {
      const t = (localStorage.getItem('lab.theme') as 'light'|'dark')
      return t || 'light'
    } catch { return 'light' }
  })
  useEffect(()=>{
    try { localStorage.setItem('lab.theme', theme) } catch {}
  }, [theme])
  // Also mirror Lab theme to <html> while Lab is mounted so Tailwind dark: variants apply
  useEffect(()=>{
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const navigate = useNavigate()
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lab.session')
      if (!raw) navigate('/lab/login')
    } catch {
      navigate('/lab/login')
    }
  }, [navigate])
  const shell = theme === 'dark' ? 'min-h-dvh bg-slate-900 text-slate-100' : 'min-h-dvh bg-slate-50 text-slate-900'
  return (
    <div className={theme === 'dark' ? 'lab-scope dark' : 'lab-scope'}>
      <div className={shell}>
        <div className="flex">
          <Lab_Sidebar collapsed={collapsed} />
          <div className="flex min-h-dvh flex-1 flex-col">
            <Lab_Header onToggleSidebar={toggle} onToggleTheme={toggleTheme} theme={theme} />
            <main className="w-full flex-1 px-2 py-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
