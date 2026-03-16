import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRightLeft } from 'lucide-react'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'

type Portal = {
    key: string
    label: string
    path: string
    color: string
}

const ALL_PORTALS: Portal[] = [
    { key: 'hospital', label: 'Hospital Portal', path: '/hospital', color: 'bg-blue-600' },
    { key: 'doctor', label: 'Doctor Portal', path: '/doctor', color: 'bg-emerald-600' },
    { key: 'reception', label: 'Reception Portal', path: '/reception', color: 'bg-purple-600' },
    { key: 'diagnostic', label: 'Diagnostic Portal', path: '/diagnostic', color: 'bg-amber-600' },
    // { key: 'lab', label: 'Lab Portal', path: '/lab', color: 'bg-sky-600' },
    { key: 'pharmacy', label: 'Pharmacy Portal', path: '/pharmacy', color: 'bg-teal-600' },
    { key: 'therapyLab', label: 'Therapy Portal', path: '/therapy-lab', color: 'bg-indigo-600' },
    { key: 'counselling', label: 'Counselling Portal', path: '/counselling', color: 'bg-rose-600' },
    { key: 'finance', label: 'Finance Portal', path: '/finance', color: 'bg-green-600' },
    { key: 'aesthetic', label: 'Aesthetic Portal', path: '/aesthetic', color: 'bg-pink-600' },
]

export default function PortalSwitcher({ collapsed, onExpand }: { collapsed?: boolean; onExpand?: () => void }) {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [open, setOpen] = useState(false)
    const [accessiblePortals, setAccessiblePortals] = useState<Portal[]>([])
    const [placement, setPlacement] = useState<'top' | 'bottom'>('top')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    const sessions: Array<{ key: string; storageKey: string }> = [
                        { key: 'hospital', storageKey: 'hospital.session' },
                        { key: 'doctor', storageKey: 'doctor.session' },
                        { key: 'reception', storageKey: 'reception.session' },
                        { key: 'diagnostic', storageKey: 'diagnostic.session' },
                        { key: 'lab', storageKey: 'lab.session' },
                        { key: 'pharmacy', storageKey: 'pharmacy.session' },
                        { key: 'therapyLab', storageKey: 'therapyLab.session' },
                        { key: 'counselling', storageKey: 'counselling.session' },
                        { key: 'finance', storageKey: 'finance.session' },
                        { key: 'aesthetic', storageKey: 'aesthetic.session' },
                    ]

                    const allPermissions: Record<string, any> = {}
                    const roles: string[] = []
                    let hasAnySession = false

                    for (const s of sessions) {
                        try {
                            const raw = localStorage.getItem(s.storageKey)
                            if (!raw) continue
                            hasAnySession = true
                            const obj = JSON.parse(raw)
                            const role = String(obj?.role || '').trim()
                            if (role) roles.push(role)
                            const perms = obj?.permissions && typeof obj.permissions === 'object' ? obj.permissions : {}
                            if (perms && typeof perms === 'object') {
                                for (const k of Object.keys(perms)) {
                                    if (allPermissions[k] == null) allPermissions[k] = perms[k]
                                }
                            }
                        } catch { }
                    }

                    // SESSION GUARD: if nothing is logged in anywhere, hide
                    if (!hasAnySession && !localStorage.getItem('token')) {
                        if (alive) setAccessiblePortals([])
                        return
                    }

                    // const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin')
                    
                    const canPortal = (key: string) => {
                        // 1. Check for explicit session
                        const sessionKey = sessions.find(s => s.key === key)?.storageKey
                        if (sessionKey) {
                            const raw = localStorage.getItem(sessionKey)
                            if (raw) return true
                        }
                        
                        // 2. Check permissions from any active session
                        const arr = allPermissions?.[key]
                        if (arr === '*') return true
                        if (Array.isArray(arr) && arr.length > 0) return true
                        
                        return false
                    }

                    const portals: Portal[] = []
                    for (const p of ALL_PORTALS) {
                        if (canPortal(p.key)) portals.push(p)
                    }

                    setAccessiblePortals(portals)
                } catch {
                    if (!alive) return
                    setAccessiblePortals([])
                }
            })()

        return () => { alive = false }
    }, [pathname])

    useEffect(() => {
        function out(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', out)
        return () => document.removeEventListener('mousedown', out)
    }, [])

    useLayoutEffect(() => {
        if (open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const spaceAbove = rect.top
            const spaceBelow = window.innerHeight - rect.bottom
            // Prefer top if enough space (250px) OR if top has more space than bottom
            if (spaceAbove > 250 || spaceAbove > spaceBelow) {
                setPlacement('top')
            } else {
                setPlacement('bottom')
            }
        }
    }, [open])

    if (accessiblePortals.length <= 1) return null

    return (
        <div className="pt-2 relative" ref={containerRef}>
            <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
            <button
                onClick={() => {
                    if (collapsed && onExpand) {
                        onExpand()
                        setTimeout(() => setOpen(true), 100)
                    } else {
                        setOpen(prev => !prev)
                    }
                }}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-white/10 text-white/90 hover:text-white"
                title="Switch Portal"
            >
                <ArrowRightLeft className="h-4 w-4" />
                {!collapsed && <span>Switch Portal</span>}
            </button>

            {open && !collapsed && (
                <div
                    className={`absolute left-2 right-2 overflow-hidden rounded-lg bg-slate-800 shadow-xl ring-1 ring-white/10 z-50 ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                >
                    <div className="bg-slate-900/50 px-3 py-2 text-xs font-semibold text-white/50 border-b border-white/5">
                        AVAILABLE PORTALS
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                        {accessiblePortals.map(p => (
                            <button
                                key={p.key}
                                onClick={() => {
                                    navigate(p.path)
                                    setOpen(false)
                                }}
                                className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5 transition-colors"
                                title={p.label}
                            >
                                <div className={`h-2 w-2 rounded-full ${p.color}`} />
                                <span className="text-sm text-white/90">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
