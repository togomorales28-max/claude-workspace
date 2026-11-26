import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { session, cargando } = useAuth()
  const location = useLocation()
  if (cargando) return <Cargando />
  if (!session) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  return children
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-tinta-suave" role="status">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-marca border-t-transparent" />
        {texto}
      </div>
    </div>
  )
}
