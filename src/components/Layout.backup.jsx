import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../hooks/useOffline'
import {
  ShoppingCartIcon, CubeIcon, ChartBarIcon,
  UsersIcon, ArrowRightOnRectangleIcon, SignalSlashIcon
} from '@heroicons/react/24/outline'

export default function Layout() {
  const { user, logout } = useAuth()
  const { offline, pendientes, sincronizando } = useOffline()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const nav = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
    }`

  const esDueno = ['admin','dueño'].includes(user?.rol)

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Barra offline */}
      {offline && (
        <div className="offline-banner flex items-center justify-center gap-2">
          <SignalSlashIcon className="w-4 h-4" />
          Sin conexión — trabajando en modo offline
          {pendientes > 0 && <span className="font-bold">({pendientes} operaciones pendientes)</span>}
        </div>
      )}
      {sincronizando && (
        <div className="offline-banner" style={{ background: '#1d4ed8' }}>
          Sincronizando {pendientes} operaciones pendientes...
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-52 bg-slate-800 border-r border-slate-700/50 flex flex-col p-3 gap-1 shrink-0">
        <div className="px-2 py-3 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">K</div>
            <span className="text-white font-semibold text-sm">Kiosco POS</span>
          </div>
          <p className="text-xs text-slate-400 pl-9">{user?.nombre}</p>
          <span className={`ml-9 text-xs px-2 py-0.5 rounded-full inline-block mt-1 font-medium ${
            user?.rol === 'dueño' ? 'bg-amber-900/50 text-amber-400' :
            user?.rol === 'admin' ? 'bg-purple-900/50 text-purple-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {user?.rol}
          </span>
        </div>

        <NavLink to="/caja" className={nav}>
          <ShoppingCartIcon className="w-4 h-4 shrink-0" /> Caja
        </NavLink>

        {esDueno && <>
          <NavLink to="/stock" className={nav}>
            <CubeIcon className="w-4 h-4 shrink-0" /> Stock
          </NavLink>
          <NavLink to="/reportes" className={nav}>
            <ChartBarIcon className="w-4 h-4 shrink-0" /> Reportes
          </NavLink>
          <NavLink to="/usuarios" className={nav}>
            <UsersIcon className="w-4 h-4 shrink-0" /> Usuarios
          </NavLink>
        </>}

        <div className="mt-auto pt-3 border-t border-slate-700/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all duration-150"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" /> Salir
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
