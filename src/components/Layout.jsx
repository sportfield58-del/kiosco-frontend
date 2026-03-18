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

  const esDueno = ['admin','dueño'].includes(user?.rol)

  const navDesktop = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
    }`

  const navMobile = ({ isActive }) =>
    `flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium transition-all flex-1 ${
      isActive ? 'text-indigo-400' : 'text-slate-500'
    }`

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Barra offline */}
      {offline && (
        <div className="offline-banner flex items-center justify-center gap-2 z-50">
          <SignalSlashIcon className="w-4 h-4" />
          Sin conexión — modo offline
          {pendientes > 0 && <span className="font-bold">({pendientes} pendientes)</span>}
        </div>
      )}
      {sincronizando && (
        <div className="offline-banner flex items-center justify-center gap-2 z-50" style={{ background: '#1d4ed8' }}>
          Sincronizando {pendientes} operaciones...
        </div>
      )}

      {/* Layout desktop */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
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

          <NavLink to="/caja" className={navDesktop}>
            <ShoppingCartIcon className="w-4 h-4 shrink-0" /> Caja
          </NavLink>

          <NavLink to="/stock" className={navDesktop}>
            <CubeIcon className="w-4 h-4 shrink-0" /> Stock
          </NavLink>

          {esDueno && <>
            <NavLink to="/reportes" className={navDesktop}>
              <ChartBarIcon className="w-4 h-4 shrink-0" /> Reportes
            </NavLink>
            <NavLink to="/usuarios" className={navDesktop}>
              <UsersIcon className="w-4 h-4 shrink-0" /> Usuarios
            </NavLink>
          </>}

          <div className="mt-auto pt-3 border-t border-slate-700/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all">
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Salir
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Layout mobile */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Header mobile */}
        <header className="bg-slate-800 border-b border-slate-700/50 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">K</div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">Kiosco POS</p>
              <p className="text-slate-400 text-xs leading-tight">{user?.nombre}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all">
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Contenido mobile */}
        <main className="flex-1 overflow-auto pb-20">
          <Outlet />
        </main>

        {/* Navbar inferior mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700/50 px-2 py-1 flex items-center z-40">
          <NavLink to="/caja" className={navMobile}>
            <ShoppingCartIcon className="w-6 h-6" />
            <span>Caja</span>
          </NavLink>

          <NavLink to="/stock" className={navMobile}>
            <CubeIcon className="w-6 h-6" />
            <span>Stock</span>
          </NavLink>

          {esDueno && <>
            <NavLink to="/reportes" className={navMobile}>
              <ChartBarIcon className="w-6 h-6" />
              <span>Reportes</span>
            </NavLink>
            <NavLink to="/usuarios" className={navMobile}>
              <UsersIcon className="w-6 h-6" />
              <span>Usuarios</span>
            </NavLink>
          </>}
        </nav>
      </div>
    </div>
  )
}
