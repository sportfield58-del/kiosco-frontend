import { useState, useEffect, useRef } from 'react'
import api, { mensajeError } from '../api'
import { useAuth } from '../context/AuthContext'
import { useRefrescoAutomatico } from '../hooks/useRefrescoAutomatico'
import {
  ArrowUpTrayIcon, PlusIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, PencilIcon, CheckIcon, XMarkIcon,
  LockClosedIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon,
  Square2StackIcon, PlusCircleIcon, ClockIcon
} from '@heroicons/react/24/outline'

const TIPO_MOV = {
  VENTA:            { label: 'Venta',              color: 'text-slate-300' },
  INGRESO_MANUAL:   { label: 'Carga de mercadería', color: 'text-green-400' },
  AJUSTE_POSITIVO:  { label: 'Corrección (+)',     color: 'text-green-400' },
  AJUSTE_NEGATIVO:  { label: 'Corrección (−)',     color: 'text-amber-400' },
  ANULACION_VENTA:  { label: 'Venta anulada',      color: 'text-sky-400' },
  CONSUMO_EMPLEADO: { label: 'Consumo empleado',   color: 'text-amber-400' },
  CONSUMO_DUENO:    { label: 'Retiro del dueño',   color: 'text-purple-400' },
  FUSION:           { label: 'Fusión duplicados',  color: 'text-indigo-400' },
}

export default function Stock() {
  const { user }            = useAuth()
  const [acceso, setAcceso] = useState(null)
  const [solicitado, setSolicitado] = useState(false)
  const [productos, setProductos] = useState([])
  const [filtro, setFiltro]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState(null)
  const [modal, setModal]         = useState(null)
  const [editando, setEditando]   = useState(null)
  const [mostrarAlertas, setMostrarAlertas] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [duplicados, setDuplicados] = useState([])
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false)
  const [grupoFusion, setGrupoFusion] = useState(null)
  const [principalFusion, setPrincipalFusion] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [ingreso, setIngreso]     = useState(null)   // { producto, cantidad, nota }
  const [ajuste, setAjuste]       = useState(null)   // { producto, valor, motivo }
  const [historial, setHistorial] = useState(null)   // { producto, movs: [] | null, error }
  const fileRef = useRef()
  const toastTimer = useRef()

  const [form, setForm] = useState({
    codigo_barra: '', nombre: '', precio_costo: '', precio_venta: '',
    stock: '', stock_minimo: '5', categoria: 'general'
  })

  const esDueno = ['admin','dueño'].includes(user?.rol)
  // `acceso` viene del servidor (dueño, o empleado con acceso aprobado). No usar el flag guardado
  // en localStorage: queda viejo cuando el dueño aprueba el acceso desde otro dispositivo.
  const puedeEditar = acceso === true

  useEffect(() => { verificarAcceso() }, [])

  // Refresco silencioso (cada 60s y al volver a la app) para ver cambios hechos desde otros dispositivos
  useRefrescoAutomatico(async () => {
    try {
      if (!esDueno) {
        // Re-verifica el permiso: se desbloquea solo al aprobarse y se bloquea si lo revocan
        const permiso = await api.get(`/solicitudes/stock/acceso/${user.id}`)
        setAcceso(permiso.data.acceso)
        if (!permiso.data.acceso) return
      }
      const [res, dup] = await Promise.all([
        api.get('/productos'),
        esDueno ? api.get('/productos/duplicados') : Promise.resolve({ data: [] })
      ])
      setProductos(res.data)
      setDuplicados(dup.data)
      setLoading(false)   // si el acceso se acaba de aprobar, cargar() nunca corrió
    } catch {}
  }, { activo: acceso !== null })

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
      mostrarToast(mensajeError(e, 'No se pudo enviar la solicitud'), 'error')
    }
  }

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get('/productos')
      setProductos(res.data)
      if (esDueno) cargarDuplicados()
    } catch (e) { mostrarToast(mensajeError(e, 'Error al cargar productos'), 'error') }
    finally { setLoading(false) }
  }

  const cargarDuplicados = async () => {
    try {
      const res = await api.get('/productos/duplicados')
      setDuplicados(res.data)
    } catch {}
  }

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}" (código ${p.codigo_barra})?\nStock actual: ${p.stock} unidades.\nEsta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/productos/${p.id}?usuario_id=${user.id}`)
      mostrarToast('Producto eliminado', 'ok')
      cargar()
    } catch (e) {
      mostrarToast(mensajeError(e, 'Error al eliminar'), 'error')
    }
  }

  const abrirFusion = (grupo) => {
    setGrupoFusion(grupo)
    // Por defecto sugiere mantener el que tiene más stock
    const sugerido = [...grupo.productos].sort((a, b) => b.stock - a.stock)[0]
    setPrincipalFusion(sugerido.id)
  }

  const confirmarFusion = async () => {
    if (!grupoFusion || !principalFusion) return
    try {
      const res = await api.post('/productos/fusionar', {
        principal_id: principalFusion,
        ids: grupoFusion.productos.map(p => p.id),
        usuario_id: user.id
      })
      mostrarToast(`✓ Fusionado — stock final: ${res.data.stock_final} unidades`, 'ok')
      setGrupoFusion(null); setPrincipalFusion(null)
      cargar()
    } catch (e) {
      mostrarToast(mensajeError(e, 'Error al fusionar'), 'error')
    }
  }

  const productos_filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.codigo_barra.includes(filtro)
  )

  const alertas = productos.filter(p => p.stock_bajo)

  const guardar = async () => {
    // Validaciones antes de enviar
    if (!form.nombre.trim()) {
      mostrarToast('El nombre del producto es obligatorio', 'error'); return
    }
    if (!form.precio_venta || parseFloat(form.precio_venta) <= 0) {
      mostrarToast('El precio de venta debe ser mayor a 0', 'error'); return
    }
    if (!form.codigo_barra.trim() && !editando) {
      if (!window.confirm('No ingresaste código de barra. El producto no se podrá escanear desde Caja.\n¿Continuás igual?')) return
    }

    // Aviso si ya existe un producto con nombre muy similar (solo al crear)
    if (!editando) {
      const nombreNorm = form.nombre.trim().toLowerCase()
      const similar = productos.find(p => {
        const pNorm = p.nombre.trim().toLowerCase()
        return pNorm === nombreNorm || pNorm.includes(nombreNorm) || nombreNorm.includes(pNorm)
      })
      if (similar) {
        if (!window.confirm(
          `Ya existe "${similar.nombre}" con ${similar.stock} unidades de stock.\n\n` +
          `¿Seguro que querés crear uno nuevo?\n` +
          `Si es el mismo producto, mejor usá el botón verde (+) para ingresar la mercadería al existente.`
        )) return
      }
    }

    if (guardando) return
    setGuardando(true)
    try {
      const datos = {
        ...form,
        codigo_barra: form.codigo_barra.trim(),
        nombre: form.nombre.trim(),
        precio_costo: parseFloat(form.precio_costo) || 0,
        precio_venta: parseFloat(form.precio_venta),
        stock: parseInt(form.stock) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 5,
        usuario_id: user.id
      }
      if (editando) {
        // Editar nunca cambia el stock (el servidor además lo ignora): reemplazar el número desde acá
        // pisaba cargas de otras personas sin dejar rastro. Para eso están "Cargar" y "Corregir".
        delete datos.stock
        const res = await api.put(`/productos/${editando.id}`, datos)
        aplicarProductoGuardado(res.data.producto)
        mostrarToast(`✓ "${datos.nombre}" actualizado`, 'ok')
      } else {
        const res = await api.post('/productos', datos)
        aplicarProductoGuardado(res.data.producto)
        mostrarToast(
          `✓ "${datos.nombre}" ${res.data.reactivado ? 'reactivado' : 'creado'} — stock: ${res.data.producto?.stock ?? datos.stock}`,
          'ok'
        )
      }
      cerrarModal()
      cargar()   // relee desde el servidor: lo que se ve es lo que quedó guardado
    } catch (e) {
      mostrarToast(mensajeError(e, 'No se pudo guardar el producto'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  // Refleja de inmediato en la tabla lo que el servidor confirmó, sin esperar la relectura
  const aplicarProductoGuardado = (prod) => {
    if (!prod) return
    setProductos(prev => prev.some(p => p.id === prod.id)
      ? prev.map(p => p.id === prod.id ? prod : p)
      : [...prev, prod].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  }

  const abrirIngreso = (p) => setIngreso({ producto: p, cantidad: '', nota: '' })

  const confirmarIngreso = async () => {
    const cantidad = parseInt(ingreso?.cantidad)
    if (!cantidad || cantidad < 1) {
      mostrarToast('Ingresá una cantidad mayor a 0', 'error'); return
    }
    if (guardando) return
    setGuardando(true)
    try {
      const res = await api.post(`/productos/${ingreso.producto.id}/ingreso`, {
        cantidad, nota: ingreso.nota, usuario_id: user.id
      })
      aplicarProductoGuardado(res.data.producto)
      mostrarToast(
        `✓ ${ingreso.producto.nombre}: +${res.data.cantidad} → stock ${res.data.stock_nuevo}`, 'ok'
      )
      setIngreso(null)
      cargar()
    } catch (e) {
      mostrarToast(mensajeError(e, 'No se pudo registrar el ingreso'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const abrirAjuste = (p) => setAjuste({ producto: p, valor: String(p.stock), motivo: '' })

  // Kardex del producto: quién cambió el stock, cuándo y por qué
  const abrirHistorial = async (p) => {
    setHistorial({ producto: p, movs: null, error: null })
    try {
      const res = await api.get(`/productos/${p.id}/movimientos`, { params: { limite: 100 } })
      setHistorial(h => h && h.producto.id === p.id ? { ...h, movs: res.data } : h)
    } catch (e) {
      setHistorial(h => h && h.producto.id === p.id ? { ...h, error: mensajeError(e, 'No se pudo cargar el historial') } : h)
    }
  }

  const confirmarAjuste = async () => {
    const valor = parseInt(ajuste?.valor)
    if (isNaN(valor) || valor < 0) {
      mostrarToast('Ingresá un stock válido (0 o más)', 'error'); return
    }
    if (valor < ajuste.producto.stock && !ajuste.motivo.trim()) {
      mostrarToast('Para bajar el stock indicá el motivo (conteo, rotura, vencido...)', 'error'); return
    }
    if (guardando) return
    setGuardando(true)
    try {
      const res = await api.post(`/productos/ajuste-stock/${ajuste.producto.id}`, {
        stock_nuevo: valor, motivo: ajuste.motivo, usuario_id: user.id
      })
      aplicarProductoGuardado(res.data.producto)
      mostrarToast(`✓ ${ajuste.producto.nombre}: stock ${res.data.stock_anterior} → ${res.data.producto.stock}`, 'ok')
      setAjuste(null)
      cargar()
    } catch (e) {
      mostrarToast(mensajeError(e, 'No se pudo ajustar el stock'), 'error')
    } finally {
      setGuardando(false)
    }
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
    } catch (e) { mostrarToast(mensajeError(e, 'Error al importar'), 'error') }
    e.target.value = ''
  }

  const abrirEditar = (p) => {
    setEditando(p)
    setForm({
      codigo_barra: p.codigo_barra, nombre: p.nombre,
      precio_costo: p.precio_costo, precio_venta: p.precio_venta,
      stock: p.stock, stock_minimo: p.stock_minimo, categoria: p.categoria
    })
    setModal('editar')
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ codigo_barra: '', nombre: '', precio_costo: '', precio_venta: '', stock: '', stock_minimo: '5', categoria: 'general' })
    setModal('nuevo')
  }

  const cerrarModal = () => { setModal(null); setEditando(null) }

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const res = await api.get('/productos/exportar-excel', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `productos_kiosco_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      mostrarToast('Error al exportar', 'error')
    } finally {
      setExportando(false)
    }
  }

  const mostrarToast = (texto, tipo) => {
    setToast({ texto, tipo })
    clearTimeout(toastTimer.current)
    // Los errores quedan más tiempo en pantalla: es lo que el empleado necesita poder leer
    toastTimer.current = setTimeout(() => setToast(null), tipo === 'error' ? 6000 : 3500)
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
    <div className="flex flex-col h-full">
      {toast && (
        <div role="status" className={`fixed top-4 left-4 right-4 sm:left-auto z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in ${
          toast.tipo === 'ok' ? 'bg-green-900/90 border border-green-700/50 text-green-300' : 'bg-red-900/90 border border-red-700/50 text-red-300'
        }`}>{toast.texto}</div>
      )}

      {/* ── HEADER + BUSCADOR fijos arriba ── */}
      <div className="flex-shrink-0 p-4 pb-2 flex flex-col gap-3 border-b border-slate-700/40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Stock</h1>
            <p className="text-slate-400 text-sm">{productos.length} productos</p>
          </div>
          {puedeEditar && (
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} />
              {esDueno && (
                <>
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-all">
                    <ArrowUpTrayIcon className="w-4 h-4" /> Importar
                  </button>
                  <button onClick={exportarExcel} disabled={exportando}
                    className="flex items-center gap-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {exportando ? 'Descargando...' : 'Excel'}
                  </button>
                </>
              )}
              <button onClick={abrirNuevo}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
                <PlusIcon className="w-4 h-4" /> Nuevo
              </button>
            </div>
          )}
        </div>

        {/* Buscador siempre visible arriba */}
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="w-full pl-9" placeholder="Buscar por nombre o código..."
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
      </div>

      {/* ── TABLA scrolleable ── */}
      <div className="flex-1 overflow-auto p-4 pt-2">
        {loading ? (
          <div className="text-center text-slate-500 py-16 text-sm animate-pulse-soft">Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">
                <th className="text-left pb-2 px-2 hidden md:table-cell">Código</th>
                <th className="text-left pb-2 px-2">Nombre</th>
                <th className="text-right pb-2 px-2 hidden md:table-cell">Costo</th>
                <th className="text-right pb-2 px-2 hidden md:table-cell">Venta</th>
                <th className="text-right pb-2 px-2 hidden md:table-cell">Gan.</th>
                <th className="text-right pb-2 px-2">Stock</th>
                <th className="text-right pb-2 px-2 hidden md:table-cell">Mín.</th>
                {puedeEditar && <th className="pb-2 px-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {productos_filtrados.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-2 text-slate-400 font-mono text-xs hidden md:table-cell">{p.codigo_barra}</td>
                  <td className="py-2.5 px-2 text-white font-medium">
                    {p.nombre}
                    <span className="md:hidden block text-xs font-normal text-slate-500">${p.precio_venta.toFixed(2)}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-400 hidden md:table-cell">${p.precio_costo.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-white hidden md:table-cell">${p.precio_venta.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right hidden md:table-cell"><span className="text-green-400 font-medium">+{p.ganancia_pct}%</span></td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`font-semibold font-mono ${p.stock_bajo ? 'text-amber-400' : 'text-white'}`}>{p.stock}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-500 hidden md:table-cell">{p.stock_minimo}</td>
                  {puedeEditar && (
                    <td className="py-2.5 px-2">
                      {/* Lápiz siempre visible — permanente hasta que el dueño cancele el acceso */}
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => abrirIngreso(p)}
                          className="p-2 md:p-1.5 rounded-lg hover:bg-green-900/40 text-green-400 hover:text-green-300 transition-all"
                          title="Cargar mercadería (suma al stock)" aria-label={`Ingresar mercadería de ${p.nombre}`}>
                          <span className="flex items-center gap-1">
                            <PlusCircleIcon className="w-5 h-5 md:w-4 md:h-4" />
                            <span className="hidden lg:inline text-xs font-semibold">Cargar</span>
                          </span>
                        </button>
                        <button onClick={() => abrirHistorial(p)}
                          className="p-2 md:p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                          title="Historial de stock" aria-label={`Historial de stock de ${p.nombre}`}>
                          <ClockIcon className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        </button>
                        <button onClick={() => abrirEditar(p)}
                          className="p-2 md:p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                          title="Editar producto">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => abrirAjuste(p)}
                          className="p-2 md:p-1.5 min-w-[2rem] rounded-lg hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400 transition-all text-xs font-bold"
                          title="Corregir stock a partir de un conteo físico" aria-label={`Corregir stock de ${p.nombre}`}>
                          ±
                        </button>
                        {esDueno && (
                          <button onClick={() => eliminarProducto(p)}
                            className="p-2 md:p-1.5 rounded-lg hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-all"
                            title="Eliminar producto">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {productos_filtrados.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500 text-sm">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── DUPLICADOS — productos cargados más de una vez ── */}
      {esDueno && duplicados.length > 0 && (
        <div className="flex-shrink-0 border-t border-red-800/30">
          <button
            onClick={() => setMostrarDuplicados(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-red-950/40 hover:bg-red-950/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Square2StackIcon className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-semibold">
                {duplicados.length} producto{duplicados.length > 1 ? 's' : ''} cargado{duplicados.length > 1 ? 's' : ''} repetido{duplicados.length > 1 ? 's' : ''} — stock fragmentado
              </span>
            </div>
            {mostrarDuplicados
              ? <ChevronDownIcon className="w-4 h-4 text-red-500" />
              : <ChevronUpIcon className="w-4 h-4 text-red-500" />
            }
          </button>
          {mostrarDuplicados && (
            <div className="bg-red-950/30 px-4 pb-3 pt-1 space-y-2 max-h-56 overflow-auto">
              {duplicados.map((grupo, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-white text-sm font-medium">{grupo.nombre}</p>
                    <p className="text-red-300 text-xs">
                      {grupo.productos.length} cargas · stock total real: {grupo.stock_total} unidades
                    </p>
                  </div>
                  <button onClick={() => abrirFusion(grupo)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg transition-all font-medium shrink-0">
                    Fusionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ALERTAS STOCK BAJO — abajo, colapsable ── */}
      {alertas.length > 0 && (
        <div className="flex-shrink-0 border-t border-amber-800/30">
          <button
            onClick={() => setMostrarAlertas(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-950/40 hover:bg-amber-950/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold">
                Stock bajo en {alertas.length} producto{alertas.length > 1 ? 's' : ''}
              </span>
            </div>
            {mostrarAlertas
              ? <ChevronDownIcon className="w-4 h-4 text-amber-500" />
              : <ChevronUpIcon className="w-4 h-4 text-amber-500" />
            }
          </button>
          {mostrarAlertas && (
            <div className="bg-amber-950/30 px-4 pb-3 pt-1">
              <p className="text-amber-600 text-xs">{alertas.map(p => p.nombre).join(' · ')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL EDITAR/NUEVO ── */}
      {puedeEditar && modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
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
              {editando ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Stock actual</label>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-semibold">{editando.stock}</span>
                    <button type="button" onClick={() => { const p = editando; cerrarModal(); abrirIngreso(p) }}
                      className="px-2.5 py-2 rounded-lg bg-green-700/80 hover:bg-green-600 text-white text-xs font-semibold" title="Sumar mercadería">
                      + Cargar
                    </button>
                    <button type="button" onClick={() => { const p = editando; cerrarModal(); abrirAjuste(p) }}
                      className="px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold" title="Corregir con un conteo">
                      ±
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Stock inicial</label>
                  <input type="number" inputMode="numeric" className="w-full" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stock mínimo</label>
                <input type="number" className="w-full" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                <input className="w-full" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
              </div>
            </div>
            {form.precio_costo && form.precio_venta && parseFloat(form.precio_costo) > 0 && (
              <div className="mt-3 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400">
                Ganancia: <span className="text-green-400 font-semibold">
                  +{(((parseFloat(form.precio_venta) - parseFloat(form.precio_costo)) / parseFloat(form.precio_costo)) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={cerrarModal}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <CheckIcon className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL INGRESO DE MERCADERÍA ── */}
      {puedeEditar && ingreso && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-white">Ingresar mercadería</h3>
              <button onClick={() => setIngreso(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-300 text-sm">{ingreso.producto.nombre}</p>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2 my-4 text-sm flex justify-between">
              <span className="text-slate-400">Stock actual</span>
              <span className="text-white font-bold">{ingreso.producto.stock} u.</span>
            </div>
            <label className="block text-xs text-slate-400 mb-1.5">Unidades que entraron</label>
            <input type="number" inputMode="numeric" min="1" className="w-full mb-3" autoFocus
              value={ingreso.cantidad} placeholder="Ej: 24"
              onChange={e => setIngreso({ ...ingreso, cantidad: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && confirmarIngreso()} />
            <label className="block text-xs text-slate-400 mb-1.5">Nota (opcional)</label>
            <input className="w-full mb-3" value={ingreso.nota} placeholder="Ej: remito 1234, proveedor"
              onChange={e => setIngreso({ ...ingreso, nota: e.target.value })} />
            {parseInt(ingreso.cantidad) > 0 && (
              <div className="bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2 mb-4 text-sm flex justify-between">
                <span className="text-green-300">Stock después del ingreso</span>
                <span className="text-green-400 font-bold">{ingreso.producto.stock + parseInt(ingreso.cantidad)} u.</span>
              </div>
            )}
            <p className="text-slate-500 text-xs mb-4">Se suma al stock que haya al momento de guardar, aunque se hayan hecho ventas desde otro dispositivo.</p>
            <div className="flex gap-3">
              <button onClick={() => setIngreso(null)}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={confirmarIngreso} disabled={guardando}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <CheckIcon className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Registrar ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AJUSTE DE STOCK (conteo físico) ── */}
      {puedeEditar && ajuste && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-white">Corregir stock</h3>
              <button onClick={() => setAjuste(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-300 text-sm">{ajuste.producto.nombre}</p>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2 my-4 text-sm flex justify-between">
              <span className="text-slate-400">Stock actual (sistema)</span>
              <span className="text-white font-bold">{ajuste.producto.stock} u.</span>
            </div>
            <label className="block text-xs text-slate-400 mb-1.5">Stock real contado</label>
            <input type="number" inputMode="numeric" min="0" className="w-full mb-3" autoFocus
              value={ajuste.valor} placeholder="Ej: 18"
              onChange={e => setAjuste({ ...ajuste, valor: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && confirmarAjuste()} />
            <label className="block text-xs text-slate-400 mb-1.5">
              Motivo {parseInt(ajuste.valor) < ajuste.producto.stock
                ? <span className="text-amber-400">(obligatorio si baja el stock)</span>
                : '(opcional)'}
            </label>
            <input className="w-full mb-3" value={ajuste.motivo} placeholder="Ej: conteo mensual, rotura, vencido"
              onChange={e => setAjuste({ ...ajuste, motivo: e.target.value })} />
            {ajuste.valor !== '' && !isNaN(parseInt(ajuste.valor)) && parseInt(ajuste.valor) !== ajuste.producto.stock && (
              <div className={`rounded-lg px-3 py-2 mb-4 text-sm flex justify-between ${
                parseInt(ajuste.valor) > ajuste.producto.stock ? 'bg-green-900/20 border border-green-800/30' : 'bg-amber-900/20 border border-amber-800/30'
              }`}>
                <span className={parseInt(ajuste.valor) > ajuste.producto.stock ? 'text-green-300' : 'text-amber-300'}>
                  {parseInt(ajuste.valor) > ajuste.producto.stock ? 'Suma' : 'Resta'} al stock actual
                </span>
                <span className={`font-bold ${parseInt(ajuste.valor) > ajuste.producto.stock ? 'text-green-400' : 'text-amber-400'}`}>
                  {parseInt(ajuste.valor) > ajuste.producto.stock ? '+' : ''}{parseInt(ajuste.valor) - ajuste.producto.stock} u.
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setAjuste(null)}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={confirmarAjuste} disabled={guardando}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <CheckIcon className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL DE STOCK (Kardex) ── */}
      {historial && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setHistorial(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-white">Historial de stock</h3>
              <button onClick={() => setHistorial(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              {historial.producto.nombre} · stock actual <span className="font-bold text-white">{historial.producto.stock}</span>
            </p>
            <div className="flex-1 overflow-auto -mx-1 px-1">
              {historial.error && <p className="text-red-300 text-sm py-6 text-center">{historial.error}</p>}
              {!historial.error && historial.movs === null && (
                <p className="text-slate-500 text-sm py-6 text-center animate-pulse-soft">Cargando...</p>
              )}
              {historial.movs?.length === 0 && (
                <p className="text-slate-500 text-sm py-6 text-center">Sin movimientos registrados todavía.</p>
              )}
              <ul className="divide-y divide-slate-700/40">
                {historial.movs?.map(m => {
                  const t = TIPO_MOV[m.tipo_movimiento] || { label: m.tipo_movimiento, color: 'text-slate-300' }
                  return (
                    <li key={m.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${t.color}`}>{t.label}</p>
                        <p className="text-xs text-slate-400">
                          {m.usuario} · {new Date(m.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                        </p>
                        {m.nota && <p className="text-xs text-slate-500 truncate">“{m.nota}”</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono font-bold ${m.cantidad >= 0 ? 'text-green-400' : 'text-amber-400'}`}>
                          {m.cantidad >= 0 ? '+' : ''}{m.cantidad}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">{m.stock_anterior} → {m.stock_nuevo}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FUSIONAR DUPLICADOS ── */}
      {grupoFusion && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white">Fusionar "{grupoFusion.nombre}"</h3>
              <button onClick={() => { setGrupoFusion(null); setPrincipalFusion(null) }} className="text-slate-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Elegí qué código de barra vas a seguir usando. El stock de los demás se suma a ese y los otros se eliminan.
            </p>
            <div className="space-y-2 mb-4 max-h-64 overflow-auto">
              {grupoFusion.productos.map(p => (
                <label key={p.id}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer border transition-all ${
                    principalFusion === p.id ? 'bg-indigo-900/40 border-indigo-600' : 'bg-slate-700/40 border-slate-600/40'
                  }`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="principal" checked={principalFusion === p.id}
                      onChange={() => setPrincipalFusion(p.id)} />
                    <div>
                      <p className="text-white text-sm font-medium">Código: {p.codigo_barra}</p>
                      <p className="text-slate-400 text-xs">${p.precio_venta.toFixed(2)} · stock minimo {p.stock_minimo}</p>
                    </div>
                  </div>
                  <span className="text-indigo-400 font-bold font-mono">{p.stock} u.</span>
                </label>
              ))}
            </div>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2 mb-4 text-sm flex justify-between">
              <span className="text-slate-400">Stock final tras fusionar</span>
              <span className="text-green-400 font-bold">{grupoFusion.stock_total} unidades</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setGrupoFusion(null); setPrincipalFusion(null) }}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">
                Cancelar
              </button>
              <button onClick={confirmarFusion}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                <CheckIcon className="w-4 h-4" /> Fusionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
