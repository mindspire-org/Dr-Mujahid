import {
    Ticket,
    ListChecks,
    CalendarDays,
    Search,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Reception_Dashboard() {
    const navigate = useNavigate()

    const modules = [
        { title: 'Token Generator', icon: Ticket, to: '/reception/token-generator', color: 'bg-emerald-500', desc: 'Generate new tokens for patients' },
        { title: "Today's Tokens", icon: ListChecks, to: '/reception/today-tokens', color: 'bg-blue-500', desc: 'View and manage daily tokens' },
        { title: 'Appointments', icon: CalendarDays, to: '/reception/appointments', color: 'bg-violet-500', desc: 'Create and manage hospital appointments' },
        { title: 'Patient History', icon: Search, to: '/reception/search-patients', color: 'bg-indigo-500', desc: 'Search and view patient records' },
        { title: 'Diagnostic Tokens', icon: Ticket, to: '/reception/diagnostic/token-generator', color: 'bg-rose-500', desc: 'Generate diagnostic tokens' },
        { title: 'Diagnostic Tracking', icon: ListChecks, to: '/reception/diagnostic/sample-tracking', color: 'bg-orange-500', desc: 'Track diagnostic samples' },
        { title: 'Diagnostic Appointments', icon: CalendarDays, to: '/reception/diagnostic/appointments', color: 'bg-fuchsia-500', desc: 'Create and manage diagnostic appointments' },
    ]

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Reception Dashboard</h1>
                <p className="text-slate-500">Welcome to the reception portal overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modules.map((m) => (
                    <button
                        key={m.title}
                        onClick={() => navigate(m.to)}
                        className="flex flex-col items-start p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200"
                    >
                        <div className={`p-3 rounded-lg ${m.color} text-white mb-4 group-hover:scale-110 transition-transform`}>
                            <m.icon className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-1">{m.title}</h3>
                        <p className="text-sm text-slate-500">{m.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}
