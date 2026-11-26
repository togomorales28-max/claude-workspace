import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import RecuperarPassword from './pages/RecuperarPassword.jsx'
import RestablecerPassword from './pages/RestablecerPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Servicios from './pages/Servicios.jsx'
import Horarios from './pages/Horarios.jsx'
import EnlacePublico from './pages/EnlacePublico.jsx'
import PublicBooking from './pages/PublicBooking.jsx'
import MiCita from './pages/MiCita.jsx'

export default function App() {
  return (
    <Routes>
      {/* Panel del cliente (público, sin cuenta) */}
      <Route path="/barbero/:slug" element={<PublicBooking />} />
      <Route path="/cita/:token" element={<MiCita />} />

      {/* Cuenta del barbero */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-password" element={<RecuperarPassword />} />
      <Route path="/restablecer-password" element={<RestablecerPassword />} />

      {/* Panel del barbero (privado) */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/servicios" element={<Servicios />} />
        <Route path="/dashboard/horarios" element={<Horarios />} />
        <Route path="/dashboard/enlace" element={<EnlacePublico />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}

function NoEncontrada() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="font-display text-3xl">Página no encontrada</p>
        <a href="/dashboard" className="btn-secundario mt-4">Ir al inicio</a>
      </div>
    </div>
  )
}
