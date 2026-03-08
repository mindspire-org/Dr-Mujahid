import { Link, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = { onToggleSidebar?: () => void; collapsed?: boolean; onToggleTheme?: () => void; theme?: 'light'|'dark' }

export default function Counselling_Header({ onToggleSidebar, collapsed, onToggleTheme, theme }: Props) {
  const navigate = useNavigate()
  const DEFAULT_HOSPITAL_NAME = "Men's Care Clinic"
  const [displayName, setDisplayName] = useState<string>('—')
  const [brand, setBrand] = useState<{ name?: string; logoDataUrl?: string }>(() => {
    try {
      const raw = localStorage.getItem('hospital.settings')
      const s = raw ? JSON.parse(raw) : null
      const name = String(s?.name || '').trim()
      return { name: name || DEFAULT_HOSPITAL_NAME, logoDataUrl: s?.logoDataUrl }
    } catch {
      return { name: DEFAULT_HOSPITAL_NAME, logoDataUrl: undefined }
    }
  })

  useEffect(() => {
    const onUpd = (e: any) => {
      const d = e?.detail || {}
      const name = String(d?.name || '').trim()
      setBrand({ name: name || DEFAULT_HOSPITAL_NAME, logoDataUrl: d?.logoDataUrl })
    }
    try { window.addEventListener('hospital:settings-updated', onUpd as any) } catch {}
    return () => { try { window.removeEventListener('hospital:settings-updated', onUpd as any) } catch {} }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('counselling.session') || localStorage.getItem('hospital.session') || localStorage.getItem('user') || '{}'
      const s = JSON.parse(raw)
      const name = String(s?.username || s?.fullName || s?.name || '').trim()
      setDisplayName(name || '—')
    } catch {
      setDisplayName('—')
    }
  }, [])

  function handleToggleTheme(){
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('counselling.theme', next) } catch {}
    try { document.documentElement.classList.toggle('dark', next === 'dark') } catch {}
    try {
      const scope = document.querySelector('.counselling-scope')
      if (scope) scope.classList.toggle('dark', next === 'dark')
    } catch {}
    onToggleTheme?.()
  }

  return (
    <header
      className="sticky top-0 z-10 h-14 w-full border-b border-white/10 shadow-sm"
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)' }}
    >
      <div className="flex h-full items-center">
        <div className="hidden h-full w-16 items-center justify-center md:flex">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="hidden h-8 w-px bg-white/15 md:block" />

        <div className="flex h-full flex-1 items-center gap-0 px-3 sm:px-5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/counselling" className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
              {brand.logoDataUrl ? (
                <img src={brand.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-700 shadow-inner">
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5'><path d='M12 21s-8-4.6-8-11.1C4 6.3 6.1 4 8.8 4c1.5 0 2.9.7 3.8 1.8C13.5 4.7 14.9 4 16.4 4 19.1 4 21 6.3 21 9.9 21 16.4 12 21 12 21Z'/></svg>
                </div>
              )}
            </div>
            <div className="min-w-0 font-semibold text-white text-sm sm:text-base truncate">{String(brand.name || '').trim() || DEFAULT_HOSPITAL_NAME}</div>
            <span className="ml-2 hidden sm:inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Counselling</span>
          </Link>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="hidden items-center gap-2 text-white/85 sm:flex">
              <span>{new Date().toLocaleDateString()}</span>
              <span className="opacity-60">{new Date().toLocaleTimeString()}</span>
            </div>
            <button onClick={handleToggleTheme} className="hidden rounded-md border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 sm:flex items-center gap-2">
              {theme === 'dark' ? 'Dark: On' : 'Dark: Off'}
            </button>
            <div className="rounded-md border border-white/15 px-3 py-1.5 text-white">{displayName}</div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-md border border-white/15 px-3 py-1.5 text-white hover:bg-white/10"
            >
              Switch Portal
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
