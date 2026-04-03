import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import {
  ArrowUpTrayIcon, PlusIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, PencilIcon, CheckIcon, XMarkIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'

export default function Stock() {
  const { user }            = useAuth()
  const [acceso, setAcceso] = useState(null)  // null=cargando, true=tiene acceso, false=bloqueado
  const [solicitado, setSolicitado] = useState(false)
  const [productos, setProductos] = useState([])
  const [filtro, setFiltro]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState(null)
  const [modal, setModal]         = useState(null)
  const [editando, setEditando]   = useState(null)
  const fileRef = useRef()

  const [form, setForm] = useState({
    codigo_barra: '', nombre: '', precio_costo: '', precio_venta: '',
    stock: '', stock_minimo: '5', categoria: 'general'
  })

  const esDueno = ['admin','dueño'].includes(user?.rol)
  const puedeEditar = esDueno || user?.stock_habilitado === true

  useEffect(() => { verificarAcceso() }, [])

  const verificarAcceso = async () => {
    if (esDueno) { setAcceso(true); cargar(); return }
    try {
      const res = await api.get(`/solicitudes/stock/acceso/${user.id}`)
      setAcceso(res.data.acceso)
      if (res.data.acceso) cargar()
    } catch { setAcceso(false) }
  }

  const solicitarAcceso = async () => {
    try {
      await api.post('/solicitudes/stock', { usuario_id: user.id })
      setSolicitado(true)
      mostrarToast('Solicitud enviada al dueño', 'ok')
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get('/productos')
      setProductos(res.data)
    } catch { mostrarToast('Error al cargar productos', 'error') }
    finally { setLoading(false) }
  }

  const productos_filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.codigo_barra.includes(filtro)
  )

  const alertas = productos.filter(p => p.stock_bajo)

  const guardar = async () => {
    try {
      const datos = {
        ...form,
        precio_costo: parseFloat(form.precio_costo) || 0,
        precio_venta: parseFloat(form.precio_venta),
        stock: parseInt(form.stock) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 5,
        usuario_id: user.id
      }
      if (editando) {
        await api.put(`/productos/${editando.id}`, datos)
        mostrarToast('Producto actualizado', 'ok')
      } else {
        await api.post('/productos', datos)
        mostrarToast('Producto creado', 'ok')
      }
      cerrarModal(); cargar()
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const ajustarStock = async (p) => {
    const nuevo = prompt(`Stock actual: ${p.stock}\nNuevo stock para "${p.nombre}":`)
    if (nuevo === null || isNaN(parseInt(nuevo))) return
    const motivo = prompt('Motivo del ajuste:') || 'ajuste manual'
    try {
      await api.post(`/productos/ajuste-stock/${p.id}`, {
        stock_nuevo: parseInt(nuevo), motivo, usuario_id: user.id
      })
      mostrarToast('Stock actualizado', 'ok'); cargar()
    } catch (e) { mostrarToast(e.response?.data?.detail || 'Error', 'error') }
  }

  const importarExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post(`/productos/importar-excel?usuario_id=${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      mostrarToast(`✓ ${res.data.creados} creados, ${res.data.actualizados} actualizados`, 'ok')
      cargar()
    } catch (e) { mostrarToast(e.response?.data?.detail || 'Error al importar', 'error') }
    e.target.value = ''
  }

  const abrirEditar = (p) => {
    setEditando(p)
    setForm({ codigo_barra: p.codigo_barra, nombre: p.nombre, precio_costo: p.precio_costo,
      precio_venta: p.precio_venta, stock: p.stock, stock_minimo: p.stock_minimo, categoria: p.categoria })
    setModal('editar')
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ codigo_barra: '', nombre: '', precio_costo: '', precio_venta: '', stock: '', stock_minimo: '5', categoria: 'general' })
    setModal('nuevo')
  }

  const cerrarModal = () => { setModal(null); setEditando(null) }

  const mostrarToast = (texto, tipo) => {
    setToast({ texto, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Pantalla bloqueada ──
  if (acceso === false) return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-8 w-full max-w-sm text-center animate-fade-in">
        <div className="w-16 h-16 bg-slate-700/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <LockClosedIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Stock bloqueado</h2>
        <p className="text-slate-400 text-sm mb-6">
          Necesitás autorización del dueño para ver y modificar el stock.
        </p>
        {solicitado ? (
          <div className="bg-indigo-900/30 border border-indigo-700/40 rounded-xl p-4 text-indigo-400 text-sm">
            ✓ Solicitud enviada. Esperá que el dueño la apruebe.
          </div>
        ) : (
          <button onClick={solicitarAcceso}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all">
            Solicitar acceso al stock
          </button>
        )}
      </div>
    </div>
  )

  if (acceso === null) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 text-sm animate-pulse-soft">Verificando acceso...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in ${
          toast.tipo === 'ok' ? 'bg-green-900/90 border border-green-700/50 text-green-300' : 'bg-red-900/90 border border-red-700/50 text-red-300'
        }`}>{toast.texto}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Stock</h1>
          <p className="text-slate-400 text-sm">{productos.length} productos</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} />
            {esDueno && (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-all">
                <ArrowUpTrayIcon className="w-4 h-4" /> Importar Excel
              </button>
            )}
            <button onClick={abrirNuevo}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
              <PlusIcon className="w-4 h-4" /> Nuevo
            </button>
          </div>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="bg-amber-950/50 border border-amber-800/50 rounded-xl p-3 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 text-sm font-semibold mb-1">Stock bajo en {alertas.length} productos</p>
            <p className="text-amber-600 text-xs">{alertas.map(p => p.nombre).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="w-full pl-9" placeholder="Buscar por nombre o código..."
          value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-slate-500 py-16 text-sm animate-pulse-soft">Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">
                <th className="text-left pb-2 px-2">Código</th>
                <th className="text-left pb-2 px-2">Nombre</th>
                <th className="text-right pb-2 px-2">Costo</th>
                <th className="text-right pb-2 px-2">Venta</th>
                <th className="text-right pb-2 px-2">Ganancia</th>
                <th className="text-right pb-2 px-2">Stock</th>
                <th className="text-right pb-2 px-2">Mín.</th>
                {puedeEditar && <th className="pb-2 px-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {productos_filtrados.map(p => (
                <tr key={p.id} className={`hover:bg-slate-800/50 transition-colors ${p.stock_bajo ? 'bg-amber-950/20' : ''}`}>
                  <td className="py-2.5 px-2 text-slate-400 font-mono text-xs">{p.codigo_barra}</td>
                  <td className="py-2.5 px-2 text-white font-medium">{p.nombre}</td>
                  <td className="py-2.5 px-2 text-right text-slate-400">${p.precio_costo.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-white">${p.precio_venta.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right"><span className="text-green-400 font-medium">+{p.ganancia_pct}%</span></td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`font-semibold font-mono ${p.stock_bajo ? 'text-amber-400' : 'text-white'}`}>{p.stock}</span>
                    {p.stock_bajo && <ExclamationTriangleIcon className="w-3 h-3 text-amber-400 inline ml-1" />}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-500">{p.stock_minimo}</td>
                  {puedeEditar && (
                    <td className="py-2.5 px-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => abrirEditar(p)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => ajustarStock(p)}
                          className="p-1.5 rounded-lg hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400 transition-all text-xs font-bold">
                          ±
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {puedeEditar && modal && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{editando ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={cerrarModal} className="text-slate-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Código de barra</label>
                <input className="w-full" value={form.codigo_barra} onChange={e => setForm({...form, codigo_barra: e.target.value})} autoFocus />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                <input className="w-full" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Precio costo</label>
                <input type="number" className="w-full" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Precio venta</label>
                <input type="number" className="w-full" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stock actual</label>
                <input type="number" className="w-full" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stock mínimo</label>
                <input type="number" className="w-full" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                <input className="w-full" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
              </div>
            </div>
            {form.precio_costo && form.precio_venta && (
              <div className="mt-3 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400">
                Ganancia: <span className="text-green-400 font-semibold">
                  +{(((parseFloat(form.precio_venta) - parseFloat(form.precio_costo)) / parseFloat(form.precio_costo)) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={cerrarModal}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
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
