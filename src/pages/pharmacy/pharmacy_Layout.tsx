import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Pharmacy_Sidebar from '../../components/pharmacy/pharmacy_Sidebar'
import Pharmacy_Header from '../../components/pharmacy/pharmacy_Header'
import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Pharmacy_Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('pharmacy.sidebar_collapsed') === '1'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('pharmacy.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const raw = localStorage.getItem('pharmacy.session') ||
            localStorage.getItem('hospital.session') ||
            localStorage.getItem('token')
          if (!raw) {
            setIsAuthorized(false)
            navigate('/pharmacy/login')
            return
          }

          const me: any = await hospitalApi.me()
          if (!alive) return

          const role = String(me?.user?.role || '')
          const perms = me?.user?.permissions || {}
          const allowed = perms?.pharmacy

          const isAdmin = role.toLowerCase() === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : role === 'Pharmacy Manager'
          if (!isAdmin && !hasPortal) {
            setIsAuthorized(false)
            navigate('/pharmacy/login')
            return
          }
          setIsAuthorized(true)
        } catch {
          if (!alive) return
          setIsAuthorized(false)
          navigate('/pharmacy/login')
        }
      })()
    return () => { alive = false }
  }, [navigate])

  useEffect(() => {
    try { localStorage.setItem('pharmacy.theme', theme) } catch { }
  }, [theme])

  useEffect(() => {
    const html = document.documentElement
    const enable = theme === 'dark'
    try { html.classList.toggle('dark', enable) } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileSidebarOpen])

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileSidebarOpen])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      localStorage.setItem('pharmacy.sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch { }
  }, [sidebarCollapsed])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = (t?.tagName || '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || !!t?.isContentEditable
      if (isTyping) return

      const key = e.key?.toLowerCase?.() || ''
      if (e.ctrlKey && !e.shiftKey && key === 'n') {
        e.preventDefault()
        navigate('/pharmacy/pos')
        return
      }
      if (e.shiftKey && !e.ctrlKey && key === 'r') {
        e.preventDefault()
        navigate('/pharmacy/reports')
        return
      }
      if (e.shiftKey && !e.ctrlKey && key === 'i') {
        e.preventDefault()
        navigate('/pharmacy/inventory')
        return
      }
      if (e.ctrlKey && !e.shiftKey && key === 'd') {
        if (location.pathname.startsWith('/pharmacy/pos')) {
          e.preventDefault()
          setTimeout(() => { (document.getElementById('pharmacy-pos-search') as HTMLInputElement | null)?.focus() }, 0)
        }
        return
      }
      if (e.shiftKey && !e.ctrlKey && key === 'f') {
        if (location.pathname.startsWith('/pharmacy/inventory')) {
          e.preventDefault()
          setTimeout(() => { (document.getElementById('pharmacy-inventory-search') as HTMLInputElement | null)?.focus() }, 0)
        }
        return
      }
      if (e.ctrlKey && !e.shiftKey && key === 'p') {
        if (location.pathname.startsWith('/pharmacy/pos')) {
          e.preventDefault()
          try { window.dispatchEvent(new Event('pharmacy:pos:pay')) } catch { }
        }
        return
      }
    }
    window.addEventListener('keydown', onKeyDown as any)
    return () => window.removeEventListener('keydown', onKeyDown as any)
  }, [navigate, location.pathname])

  if (isAuthorized === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthorized) return null

  const shell = theme === 'dark' ? 'h-dvh overflow-hidden bg-slate-900 text-slate-100' : 'h-dvh overflow-hidden bg-slate-50 text-slate-900'

  const handleToggleSidebar = () => {
    try {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(v => !v)
        return
      }
    } catch {}
    if (sidebarCollapsed) { setSidebarCollapsed(false); return }
    setSidebarCollapsed(true)
  }

  return (
    <div className={theme === 'dark' ? 'pharmacy-scope dark' : 'pharmacy-scope'}>
      <div className={shell}>
        <div className="flex h-full flex-col">
          <Pharmacy_Header
            onToggleSidebar={handleToggleSidebar}
            collapsed={sidebarCollapsed}
            onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            theme={theme}
          />
          <div className="flex flex-1 min-h-0">
            <Pharmacy_Sidebar
              collapsed={sidebarCollapsed}
              onExpand={() => setSidebarCollapsed(false)}
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
