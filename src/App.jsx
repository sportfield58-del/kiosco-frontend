import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login    from './pages/Login'
import Caja     from './pages/Caja'
import Stock    from './pages/Stock'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'
import Layout   from './components/Layout'

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-slate-400 text-sm animate-pulse-soft">Cargando...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/caja" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/caja" replace />} />
            <Route path="caja" element={<Caja />} />
            <Route path="stock" element={<Stock />} />
            <Route path="reportes" element={
              <PrivateRoute roles={['admin','dueño']}><Reportes /></PrivateRoute>
            } />
            <Route path="usuarios" element={
              <PrivateRoute roles={['admin','dueño']}><Usuarios /></PrivateRoute>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
