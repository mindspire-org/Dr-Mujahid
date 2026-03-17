import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

export default function Doctor_Login() {
  const navigate = useNavigate()
  const DEFAULT_HOSPITAL_NAME = "Men's Care Clinic"
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
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
  const [theme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('doctor.theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    const html = document.documentElement
    try { html.classList.toggle('dark', theme === 'dark') } catch { }
    return () => { try { html.classList.remove('dark') } catch { } }
  }, [theme])

  useEffect(() => {
    const onUpd = (e: any) => {
      const d = e?.detail || {}
      const name = String(d?.name || '').trim()
      setBrand({ name: name || DEFAULT_HOSPITAL_NAME, logoDataUrl: d?.logoDataUrl })
    }
    try { window.addEventListener('hospital:settings-updated', onUpd as any) } catch { }
    return () => { try { window.removeEventListener('hospital:settings-updated', onUpd as any) } catch { } }
  }, [])

  const fallbackLogoSrc = `${(import.meta as any).env?.BASE_URL || '/'}mcclogo.png`
  const logoSrc = brand.logoDataUrl || fallbackLogoSrc

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const uname = username.trim()
    if (!uname || !password) {
      setError('Enter username and password')
      return
    }

    try {
      const res: any = await hospitalApi.loginHospitalUser(uname, password, 'doctor')
      const u = res?.user
      const token = res?.token
      const permissions = (u?.permissions && typeof u.permissions === 'object') ? u.permissions : undefined

      const canDoctor = (() => {
        if (!permissions) return false
        const arr = (permissions as any)?.doctor
        return Array.isArray(arr) && arr.length > 0
      })()

      if (!u || (!canDoctor && String(u.role) !== 'Doctor')) {
        setError('Access denied: This portal is only for Doctor users')
        return
      }

      try {
        localStorage.setItem('doctor.session', JSON.stringify({ username: u.username, role: u.role, permissions }))
      } catch { }

      try {
        if (token) {
          localStorage.setItem('hospital.token', String(token))
          localStorage.setItem('token', String(token))
          localStorage.setItem('doctor.token', String(token))
        }
      } catch { }

      try {
        localStorage.setItem('hospital.session', JSON.stringify({ username: u.username, role: u.role, permissions }))
      } catch { }

      navigate('/doctor')
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials')
    }
  }

  return (
    <div className={theme === 'dark' ? 'doctor-scope dark' : 'doctor-scope'}>
      <div className="min-h-screen bg-gradient-to-br from-[#0a1e3c] via-[#0b2b55] to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-56 -left-56 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        </div>

        <style>{`@keyframes rotate3d{0%{transform:perspective(1000px) rotateY(0deg) rotateX(10deg)}100%{transform:perspective(1000px) rotateY(360deg) rotateX(10deg)}}.card-3d{transform-style:preserve-3d;transition:transform .6s cubic-bezier(.23,1,.32,1)}.card-3d:hover{transform:none}`}</style>

        <div className="card-3d relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent" />
          <div className="relative">
            <div className="relative p-8 pb-6 text-center">
              <div className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400/20 to-blue-600/20 p-1 backdrop-blur-sm" style={{ animation: 'rotate3d 20s linear infinite' }}>
                <div className="h-full w-full overflow-hidden rounded-[1.3rem] bg-white/10 ring-1 ring-white/20">
                  <img src={logoSrc} alt="Healthspire" className="h-full w-full object-cover" />
                </div>
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-sky-200 via-blue-200 to-indigo-200 bg-clip-text text-transparent mb-2">{String(brand.name || '').trim() || DEFAULT_HOSPITAL_NAME}</h1>
              <p className="text-sm text-white/60 font-medium">Doctor Portal</p>
            </div>

            <div className="p-8 pt-4">
              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-white/90">Username</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-2xl border-2 border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3.5 text-white placeholder-white/40 outline-none transition-all focus:border-sky-400/50 focus:bg-white/10 focus:ring-4 focus:ring-sky-400/20" placeholder="Enter username" autoComplete="username" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/90">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border-2 border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3.5 pr-14 text-white placeholder-white/40 outline-none transition-all focus:border-blue-400/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-400/20" placeholder="Enter password" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.53 2.47 2.47 3.53 5.3 6.36A11.6 11.6 0 0 0 1.4 12c2.1 4.4 6.33 7.5 10.6 7.5 2.07 0 4.1-.66 5.9-1.84l2.6 2.6 1.06-1.06L3.53 2.47ZM12 7.5c.63 0 1.22.18 1.72.48l-5.7 5.7A4.5 4.5 0 0 1 12 7.5Zm0-3c-4.27 0-8.5 3.1-10.6 7.5a12.8 12.8 0 0 0 3 4.05l2.14-2.14A6 6 0 0 1 18 12c0-.52-.06-1.02-.18-1.5H20c-2.1-4.4-6.33-7.5-10.6-7.5Z" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 4.5c-4.27 0-8.5 3.1-10.6 7.5 2.1 4.4 6.33 7.5 10.6 7.5s8.5-3.1 10.6-7.5C20.5 7.6 16.27 4.5 12 4.5Zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border-2 border-rose-400/30 bg-rose-500/10 backdrop-blur-sm px-4 py-3 text-sm text-rose-200 font-medium">{error}</div>
                )}

                <button type="submit" className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 px-4 py-4 font-bold text-white shadow-2xl shadow-sky-500/30 transition-all hover:shadow-sky-500/50 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-sky-400/50">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative flex items-center justify-center gap-2">Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mt-3 w-full rounded-2xl border-2 border-white/20 bg-white/5 px-4 py-3 font-semibold text-white/90 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-sky-400/30 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Back to Portal</span>
                </button>
              </form>
            </div>

            <div className="border-t border-white/10 px-8 py-4 text-center">
              <p className="text-xs text-white/40">©Developed by HealthSpire. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
