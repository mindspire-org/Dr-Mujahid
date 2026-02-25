import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { hospitalApi } from '../../utils/api'

type DoctorSession = { id: string; name: string; username: string }

type Props = { onToggleSidebar?: () => void; collapsed?: boolean; onToggleTheme?: () => void; theme?: 'light'|'dark' }

export default function Doctor_Header({ onToggleSidebar, collapsed, onToggleTheme, theme }: Props) {
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [displayUser, setDisplayUser] = useState<string>('—')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      setDoc(raw ? JSON.parse(raw) : null)
    } catch { setDoc(null) }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session') || localStorage.getItem('hospital.session') || '{}'
      const s = JSON.parse(raw)
      const name = String(s?.username || s?.fullName || s?.name || '').trim()
      setDisplayUser(name || '—')
    } catch {
      setDisplayUser('—')
    }
  }, [])
  useEffect(() => {
    try {
      const sess = doc
      if (!sess) return
      let stopped = false
      ;(async () => {
        try {
          const res = await hospitalApi.listDoctors() as any
          if (stopped) return
          const docs: any[] = res?.doctors || []
          const match = docs.find(d => String(d._id || d.id) === String(sess.id || '')) ||
                        docs.find(d => String(d.username||'').toLowerCase() === String(sess.username||'').toLowerCase()) ||
                        docs.find(d => String(d.name||'').toLowerCase() === String(sess.name||'').toLowerCase())
          if (match) {
            const nextId = String(match._id || match.id)
            const nextName = String(match.name || sess.name || '')
            if (String(sess.id || '') !== nextId || String(sess.name || '') !== nextName) {
              const next = { ...sess, id: nextId, name: nextName }
              try { localStorage.setItem('doctor.session', JSON.stringify(next)) } catch {}
              setDoc(next)
            }
          }
        } catch {}
      })()
      return () => { stopped = true }
    } catch {}
  }, [doc])
  function handleToggleTheme(){
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('doctor.theme', next) } catch {}
    try { document.documentElement.classList.toggle('dark', next === 'dark') } catch {}
    try { const scope = document.querySelector('.doctor-scope'); if (scope) scope.classList.toggle('dark', next === 'dark') } catch {}
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

          <div className="ml-3 font-semibold text-white">Dr. {doc?.name || '—'}</div>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="hidden items-center gap-2 text-white/85 sm:flex">
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V5.75A2.75 2.75 0 0 0 17.25 3H6.75Zm0 1.5h10.5c.69 0 1.25.56 1.25 1.25v12.5c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V5.75c0-.69.56-1.25 1.25-1.25Z'/></svg>
              <span>{new Date().toLocaleDateString()}</span>
              <span className="opacity-60">{new Date().toLocaleTimeString()}</span>
            </div>
            <button onClick={handleToggleTheme} className="hidden rounded-md border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 sm:flex items-center gap-2">
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M7.5 3h9A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5v-13A2.5 2.5 0 0 1 7.5 3Zm0 2A.5.5 0 0 0 7 5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-9Z'/></svg>
              {theme === 'dark' ? 'Dark: On' : 'Dark: Off'}
            </button>
            <div className="rounded-md border border-white/15 px-3 py-1.5 text-white">{displayUser}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
