import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../utils/api'

export default function Finance() {
  const navigate = useNavigate()
  useEffect(() => {
    try {
      const sess = localStorage.getItem('finance.session') || localStorage.getItem('hospital.session')
      if (!sess) {
        navigate('/finance/login', { replace: true })
        return
      }

      ;(async () => {
        try {
          const me: any = await hospitalApi.me()
          const role = String(me?.user?.role || '')
          const roleLower = role.toLowerCase()
          const allowed = me?.user?.permissions?.finance
          const isAdmin = roleLower === 'admin'
          const hasPortal = Array.isArray(allowed) ? allowed.length > 0 : roleLower === 'finance'
          if (!isAdmin && !hasPortal) {
            navigate('/finance/login', { replace: true })
            return
          }
          navigate('/finance/hospital-dashboard', { replace: true })
        } catch {
          try {
            localStorage.removeItem('finance.session')
            localStorage.removeItem('finance.token')
            localStorage.removeItem('hospital.session')
            localStorage.removeItem('hospital.token')
            localStorage.removeItem('token')
          } catch { }
          navigate('/finance/login', { replace: true })
        }
      })()
    } catch {
      navigate('/finance/login', { replace: true })
    }
  }, [navigate])
  return <div className="px-6 py-10"></div>
}
