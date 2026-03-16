import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Counselling_Sidebar from './counselling_Sidebar'
import Counselling_Header from './counselling_Header'

export default function Counselling_Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('counselling.theme') as 'light' | 'dark') || 'light'
    } catch {
      return 'light'
    }
  })
  const navigate = useNavigate()

  useEffect(() => {
    const session = localStorage.getItem('counselling.session') || localStorage.getItem('hospital.session')
    if (!session) {
      navigate('/counselling/login')
    }
  }, [navigate])

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    } catch {}
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('counselling.theme', next)
    } catch {}
  }

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  return (
    <div className={`hospital-scope ${theme === 'dark' ? 'dark' : ''}`}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Counselling_Header 
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenMobile={() => setMobileOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
          
          <div className="flex flex-1 min-h-0">
            <Counselling_Sidebar 
              collapsed={sidebarCollapsed} 
              onExpand={() => setSidebarCollapsed(false)}
              mobileOpen={mobileOpen}
              onCloseMobile={() => setMobileOpen(false)}
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
