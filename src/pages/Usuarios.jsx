import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { PlusIcon, PencilIcon, XMarkIcon, CheckIcon, UserCircleIcon } from '@heroicons/react/24/outline'

const ROLES = ['vendedor', 'admin', 'dueño']
const ROL_COLOR = { dueño: 'amber', admin: 'purple', vendedor: 'slate' }

export default function Usuarios() {
  const { user: yo }        = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [modal, setModal]   = useState(false)
  const [editando, setEditando] = useState(null)
  const [toast, setToast]   = useState(null)
  const [form, setForm]     = useState({ nombre: '', username: '', password: '', rol: 'vendedor' })

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const res = await api.get('/usuarios')
      setUsuarios(res.data)
    } catch {}
  }

  const guardar = async () => {
    if (!form.nombre || !form.username) { mostrarToast('Completá nombre y usuario', 'error'); return }
    if (!editando && !form.password) { mostrarToast('Ingresá una contraseña', 'error'); return }
    try {
      if (editando) {
        await api.put(`/usuarios/${editando.id}`, form)
        mostrarToast('Usuario actualizado', 'ok')
      } else {
        await api.post('/usuarios', form)
        mostrarToast('Usuario creado', 'ok')
      }
      cerrar(); cargar()
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const desactivar = async (u) => {
    if (!confirm(`¿Desactivar a ${u.nombre}?`)) return
    try {
      await api.delete(`/usuarios/${u.id}`)
      mostrarToast('Usuario desactivado', 'ok')
      cargar()
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const abrirEditar = (u) => {
    setEditando(u)
    setForm({ nombre: u.nombre, username: u.username, password: '', rol: u.rol })
    setModal(true)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', username: '', password: '', rol: 'vendedor' })
    setModal(true)
  }

  const toggleStock = async (u) => {
    try {
      await api.put(`/usuarios/${u.id}`, { stock_habilitado: !u.stock_habilitado })
      mostrarToast(
        u.stock_habilitado ? `Stock desactivado para ${u.nombre}` : `Stock activado para ${u.nombre}`,
        'ok'
      )
      cargar()
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const cerrar = () => { setModal(false); setEditando(null) }

  const mostrarToast = (texto, tipo) => {
    setToast({ texto, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in ${
          toast.tipo === 'ok' ? 'bg-green-900/90 border border-green-700/50 text-green-300' : 'bg-red-900/90 border border-red-700/50 text-red-300'
        }`}>{toast.texto}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-400 text-sm">{usuarios.length} activos</p>
        </div>
        <button onClick={abrirNuevo}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
          <PlusIcon className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {usuarios.map(u => {
          const color = ROL_COLOR[u.rol] || 'slate'
          const colors = {
            amber:  'border-amber-800/30  bg-amber-900/10',
            purple: 'border-purple-800/30 bg-purple-900/10',
            slate:  'border-slate-700/40  bg-slate-800/50',
          }
          const badge = {
            amber:  'bg-amber-900/50  text-amber-400',
            purple: 'bg-purple-900/50 text-purple-400',
            slate:  'bg-slate-700     text-slate-400',
          }
          return (
            <div key={u.id} className={`border rounded-2xl p-4 ${colors[color]} animate-fade-in`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <UserCircleIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{u.nombre}</p>
                    <p className="text-slate-400 text-xs">@{u.username}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge[color]}`}>
                  {u.rol}
                </span>
              </div>

              {u.rol === 'vendedor' && (
                <div className={`flex items-center justify-between mt-3 px-2 py-1.5 rounded-lg text-xs ${u.stock_habilitado ? 'bg-green-900/20 border border-green-800/30' : 'bg-slate-700/30'}`}>
                  <span className={u.stock_habilitado ? 'text-green-400 font-medium' : 'text-slate-500'}>
                    {u.stock_habilitado ? '🔓 Stock activo' : '🔒 Stock bloqueado'}
                  </span>
                  <button onClick={() => toggleStock(u)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      u.stock_habilitado
                        ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400'
                        : 'bg-green-900/40 hover:bg-green-900/60 text-green-400'
                    }`}>
                    {u.stock_habilitado ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => abrirEditar(u)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white py-1.5 rounded-lg text-xs transition-all">
                  <PencilIcon className="w-3.5 h-3.5" /> Editar
                </button>
                {u.id !== yo?.id && (
                  <button onClick={() => desactivar(u)}
                    className="flex items-center justify-center gap-1.5 border border-red-800/40 hover:bg-red-950/30 text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg text-xs transition-all">
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">
                {editando ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button onClick={cerrar} className="text-slate-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre completo</label>
                <input className="w-full" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Usuario (para login)</label>
                <input className="w-full" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Contraseña {editando && <span className="text-slate-600">(dejá vacío para no cambiar)</span>}
                </label>
                <input type="password" className="w-full" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Rol</label>
                <select className="w-full" value={form.rol} onChange={e => setForm({...form, rol: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="bg-slate-700/40 rounded-lg p-3 text-xs text-slate-500 mt-2">
                <p><span className="text-amber-400 font-medium">dueño</span> — acceso total + reportes</p>
                <p><span className="text-purple-400 font-medium">admin</span> — stock + usuarios</p>
                <p><span className="text-slate-400 font-medium">vendedor</span> — solo caja</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={cerrar}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all hover:border-slate-500">
                Cancelar
              </button>
              <button onClick={guardar}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                <CheckIcon className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
