import ModuleCard from '../components/ModuleCard'
import { Stethoscope, FlaskConical, Pill, FileText, PhoneIncoming, HeartHandshake } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { hospitalApi } from '../utils/api'
import './home.css'

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const DEFAULT_HOSPITAL_NAME = "Men's Care Clinic"
  const [brand, setBrand] = useState<{ name: string; logoDataUrl?: string }>(() => {
    try {
      const raw = localStorage.getItem('hospital.settings')
      const s = raw ? JSON.parse(raw) : null
      const n = String(s?.name || '').trim()
      return { name: n || DEFAULT_HOSPITAL_NAME, logoDataUrl: s?.logoDataUrl }
    } catch {
      return { name: DEFAULT_HOSPITAL_NAME, logoDataUrl: undefined }
    }
  })

  useEffect(() => {
    const onUpd = (e: any) => {
      const d = e?.detail || {}
      const n = String(d?.name || '').trim()
      setBrand({ name: n || DEFAULT_HOSPITAL_NAME, logoDataUrl: d?.logoDataUrl })
    }
    try { window.addEventListener('hospital:settings-updated', onUpd as any) } catch {}
    return () => { try { window.removeEventListener('hospital:settings-updated', onUpd as any) } catch {} }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res: any = await hospitalApi.getSettings()
        const s = res?.settings || res
        const n = String(s?.name || '').trim()
        const logoDataUrl = s?.logoDataUrl
        if (!mounted) return
        if (n || logoDataUrl) {
          setBrand(prev => ({ name: n || prev.name || DEFAULT_HOSPITAL_NAME, logoDataUrl: logoDataUrl || prev.logoDataUrl }))
        }
      } catch {
        // Best-effort: Home is accessible without auth in some setups
      }
    })()
    return () => { mounted = false }
  }, [])

  const onHeroMove = (e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const midX = rect.width / 2
    const midY = rect.height / 2
    const rotX = ((midY - y) / midY) * 6
    const rotY = ((x - midX) / midX) * 6
    el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`
  }
  const onHeroLeave = () => {
    const el = heroRef.current
    if (el) el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
  }

  const fallbackLogoSrc = `${(import.meta as any).env?.BASE_URL || '/'}hospital_icon.jpeg`
  const logoSrc = brand.logoDataUrl || fallbackLogoSrc

  const modules = [
    { to: '/hospital/login', title: 'Clinic', description: 'Appointments, admissions, billing, and EMR.', icon: <Stethoscope className="size-7 text-sky-600" />, tone: 'sky' as const },
    { to: '/doctor/login', title: 'Doctor', description: 'Doctor portal login.', icon: <Stethoscope className="size-7 text-sky-600" />, tone: 'sky' as const },
    { to: '/diagnostic/login', title: 'Diagnostics', description: 'Diagnostic tokens, tests, tracking, and reports.', icon: <FlaskConical className="size-7 text-teal-600" />, tone: 'teal' as const },
    { to: '/pharmacy/login', title: 'Pharmacy', description: 'Prescriptions, inventory, and POS.', icon: <Pill className="size-7 text-violet-600" />, tone: 'violet' as const },
    { to: '/therapy-lab/login', title: 'Therapy & Lab Reports Entry', description: 'Therapy and OPD lab reports entry.', icon: <FileText className="size-7 text-amber-600" />, tone: 'amber' as const },
    { to: '/finance/login', title: 'Finance & Accounts', description: 'Financial management and accounting.', icon: <FileText className="size-7 text-amber-600" />, tone: 'amber' as const },
    { to: '/reception/login', title: 'Reception', description: 'Front-desk, patient registration, and triage.', icon: <PhoneIncoming className="size-7 text-teal-600" />, tone: 'teal' as const },
    { to: '/counselling/login', title: 'Counselling', description: 'Counselling portal login.', icon: <HeartHandshake className="size-7 text-emerald-600" />, tone: 'emerald' as const },
  ]

  return (
    <div className="min-h-dvh relative overflow-hidden">
      <div className="home-grid" />
      <div className="home-spotlight" />
      <div className="home-orb" style={{ left: '-160px', top: '-120px' }} />
      <div className="home-orb secondary" style={{ right: '-140px', bottom: '-160px' }} />

      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-12 text-center home-hero">
        <div ref={heroRef} onMouseMove={onHeroMove} onMouseLeave={onHeroLeave} className="home-hero-tilt mx-auto">
          <div className="flex items-center justify-center gap-4" style={{ transform: 'translateZ(60px)' }}>
            <div
              className="h-16 w-16 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400/20 to-blue-600/20 p-1 backdrop-blur-sm"
            >
              <div className="h-full w-full overflow-hidden rounded-[1.3rem] bg-white/50 ring-1 ring-white/40">
                <img src={logoSrc} alt="Healthspire" className="h-full w-full object-cover" />
              </div>
            </div>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
              style={{
                backgroundImage: 'linear-gradient(90deg, #0f2d5c 0%, #3b82f6 50%, #0f2d5c 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {String(brand.name || '').trim() || DEFAULT_HOSPITAL_NAME}
            </h1>
          </div>
          <p className="mt-3 text-slate-600" style={{ transform: 'translateZ(24px)' }}>Select a module to start</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {modules.map((m, i) => (
            <div key={m.title} className="home-card-appear" style={{ animationDelay: `${i * 90}ms` }}>
              <ModuleCard {...m} />
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-10 text-center">
        <p className="text-xs text-black">©Developed by HealthSpire. All rights reserved.</p>
      </footer>
    </div>
  )
}

