import { useState, useEffect, useRef, useCallback } from 'react'
import api, { encolarOffline } from '../api'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../hooks/useOffline'
import {
  TrashIcon, BanknotesIcon, CreditCardIcon,
  ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon,
  MoonIcon, ChevronDownIcon, ChevronUpIcon, UserIcon, ShoppingBagIcon
} from '@heroicons/react/24/outline'

const MEDIOS = [
  { id: 'efectivo',    label: 'Efectivo',     Icon: BanknotesIcon },
  { id: 'tarjeta',     label: 'Tarjeta',       Icon: CreditCardIcon },
  { id: 'mercadopago', label: 'Mercado Pago',  Icon: ArrowPathIcon },
  { id: 'mixto',       label: 'Mixto',         Icon: BanknotesIcon },
]

export default function Caja() {
  const { user }          = useAuth()
  const { offline }       = useOffline()
  const [turno, setTurno] = useState(null)
  const [carrito, setCarrito]     = useState([])
  const [codigo, setCodigo]       = useState('')
  const [productosStock, setProductosStock] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [medio, setMedio]         = useState('efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoMP, setMontoMP]     = useState('')
  const [ventasTurno, setVentas]  = useState([])
  const [totalTurno, setTotal]    = useState(0)
  const [porMedioTurno, setPorMedio] = useState({})
  const [toast, setToast]         = useState(null)
  const [cargando, setCargando]   = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [montoCierre, setMontoCierre] = useState('')
  const [resumenCierre, setResumenCierre] = useState(null)
  const [recargoNocturno, setRecargoNocturno] = useState(false)
  const [verDetalleVentas, setVerDetalleVentas] = useState(false)
  const [verResumenProductos, setVerResumenProductos] = useState(true)
  // Consumos
  const [modoConsumo, setModoConsumo] = useState(null) // null | 'empleado' | 'dueno'
  const [motivoDueno, setMotivoDueno] = useState('consumo propio')
  const inputRef = useRef()

  const esDueno = ['admin','dueño'].includes(user?.rol)

  useEffect(() => { cargarTurno(); cargarProductos(); verificarRecargoNocturno() }, [])
  useEffect(() => {
    const intervalo = setInterval(verificarRecargoNocturno, 5 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [])

  const verificarRecargoNocturno = async () => {
    try {
      const res = await api.get('/ventas/recargo-nocturno')
      setRecargoNocturno(res.data.activo)
    } catch {
      const hora = new Date().getHours()
      setRecargoNocturno(hora >= 22 || hora < 6)
    }
  }

  const cargarProductos = async () => {
    try {
      const res = await api.get('/productos')
      setProductosStock(res.data)
    } catch {}
  }

  const cargarTurno = async () => {
    try {
      const res = await api.get(`/turnos/activo/${user.id}`)
      setTurno(res.data.turno)
      if (res.data.turno) cargarVentas(res.data.turno.id)
    } catch {}
  }

  const cargarVentas = async (turnoId) => {
    try {
      const res = await api.get(`/ventas/turno/${turnoId}`)
      setVentas(res.data.ventas)
      setTotal(res.data.total)
      setPorMedio(res.data.por_medio_pago || {})
    } catch {}
  }

  const abrirTurno = async (tipo) => {
    try {
      const res = await api.post('/turnos/abrir', { usuario_id: user.id, tipo, monto_apertura: 0 })
      setTurno({ id: res.data.turno_id, tipo, inicio: new Date().toISOString(), horario: res.data.horario })
      mostrarToast(`Turno ${tipo} abierto · ${res.data.horario || ''}`, 'ok')
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const buscarSugerencias = (texto) => {
    if (!texto.trim() || texto.length < 2) { setSugerencias([]); setMostrarSugerencias(false); return }
    const filtrados = productosStock.filter(p =>
      p.nombre.toLowerCase().includes(texto.toLowerCase())
    ).slice(0, 6)
    setSugerencias(filtrados)
    setMostrarSugerencias(filtrados.length > 0)
  }

  const agregarProducto = (p) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === p.id)
      if (existe) return prev.map(i =>
        i.producto_id === p.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario }
          : i
      )
      return [...prev, {
        producto_id: p.id, nombre: p.nombre,
        precio_unitario: p.precio_venta, cantidad: 1, subtotal: p.precio_venta
      }]
    })
    setCodigo(''); setSugerencias([]); setMostrarSugerencias(false)
    inputRef.current?.focus()
  }

  const escanear = useCallback(async (e) => {
    e.preventDefault()
    const cod = codigo.trim()
    if (!cod) return
    setSugerencias([]); setMostrarSugerencias(false); setCodigo('')
    try {
      const res = await api.get(`/productos/buscar?codigo=${cod}`)
      agregarProducto(res.data)
    } catch {
      const filtrados = productosStock.filter(p =>
        p.nombre.toLowerCase().includes(cod.toLowerCase())
      )
      if (filtrados.length === 1) agregarProducto(filtrados[0])
      else if (filtrados.length > 1) { setSugerencias(filtrados.slice(0, 6)); setMostrarSugerencias(true); setCodigo(cod) }
      else mostrarToast('Producto no encontrado', 'error')
    }
    inputRef.current?.focus()
  }, [codigo, productosStock])

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev
      .map(i => i.producto_id === id
        ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precio_unitario }
        : i
      )
      .filter(i => i.cantidad > 0)
    )
  }

  const totalCarrito    = carrito.reduce((s, i) => s + i.subtotal, 0)
  const totalConRecargo = (recargoNocturno && modoConsumo === null)
    ? Math.round(totalCarrito * 1.10 * 100) / 100
    : totalCarrito
  // Con descuento empleado 20%
  const totalEmpleado   = Math.round(totalCarrito * 0.80 * 100) / 100
  const montoNum        = parseFloat(montoRecibido) || 0
  const vuelto          = medio === 'efectivo' && montoNum >= totalConRecargo && totalConRecargo > 0 ? montoNum - totalConRecargo : 0

  // Pago mixto
  const montoEfNum = parseFloat(montoEfectivo) || 0
  const montoMPNum = parseFloat(montoMP) || 0
  const sumaMixto  = montoEfNum + montoMPNum
  const faltaMixto = Math.max(0, totalConRecargo - sumaMixto)
  const sobra      = sumaMixto > totalConRecargo ? sumaMixto - totalConRecargo : 0

  const cobrar = async () => {
    if (!carrito.length || cargando) return

    // Pago mixto — validar montos
    if (medio === 'mixto') {
      if (Math.abs(sumaMixto - totalConRecargo) > 1) {
        mostrarToast(`Los montos deben sumar $${totalConRecargo.toFixed(2)}`, 'error'); return
      }
    } else if (medio === 'efectivo' && montoNum > 0 && montoNum < totalConRecargo) {
      mostrarToast('El monto recibido es menor al total', 'error'); return
    }

    setCargando(true)
    const payload = {
      usuario_id: user.id,
      items: carrito,
      total: totalCarrito,
      medio_pago: medio,
      ...(medio === 'mixto' && { monto_efectivo: montoEfNum, monto_mp: montoMPNum })
    }
    try {
      if (offline) {
        encolarOffline({ method: 'post', url: '/ventas', data: payload })
        mostrarToast(`Venta guardada offline — $${totalConRecargo.toFixed(2)}`, 'ok')
      } else {
        const res = await api.post('/ventas', payload)
        if (res.data.recargo_nocturno) mostrarToast(`Cobrado $${totalConRecargo.toFixed(2)} (+10% nocturno)`, 'ok')
        else if (medio === 'mixto') mostrarToast(`Cobrado: $${montoEfNum} efectivo + $${montoMPNum} MP`, 'ok')
        else if (medio === 'efectivo' && vuelto > 0) mostrarToast(`Vuelto: $${vuelto.toFixed(2)}`, 'ok')
        else mostrarToast(`Cobrado $${totalConRecargo.toFixed(2)} en ${labelMedio(medio)}`, 'ok')
        if (turno) cargarVentas(turno.id)
      }
      setCarrito([]); setMontoRecibido(''); setMontoEfectivo(''); setMontoMP('')
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error al registrar', 'error')
    } finally {
      setCargando(false); inputRef.current?.focus()
    }
  }

  // ── Consumo empleado (20% off, paga en el momento) ──
  const registrarConsumoEmpleado = async () => {
    if (!carrito.length || cargando) return
    setCargando(true)
    const totalOriginal = carrito.reduce((s, i) => s + i.subtotal, 0)
    const totalConDescuento = Math.round(totalOriginal * 0.80 * 100) / 100
    try {
      await api.post('/ventas', {
        usuario_id: user.id,
        items: carrito,
        total: totalConDescuento,  // manda el total ya con 20% off
        medio_pago: medio,
        tipo_venta: 'empleado'
      })
      mostrarToast(`✓ Cobrado $${totalConDescuento.toFixed(2)} — 20% OFF empleado`, 'ok')
      if (turno) cargarVentas(turno.id)
      setCarrito([]); setModoConsumo(null)
      if (turno) cargarVentas(turno.id)
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    } finally { setCargando(false) }
  }

  // ── Consumo dueño (gratis, sale del stock) ──
  const registrarConsumoDueno = async () => {
    if (!carrito.length || cargando) return
    setCargando(true)
    try {
      await api.post('/ventas/consumo-dueno', {
        usuario_id: user.id,
        items: carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        motivo: motivoDueno
      })
      mostrarToast(`Consumo del dueño registrado. Stock descontado.`, 'ok')
      setCarrito([]); setModoConsumo(null); setMotivoDueno('consumo propio')
      if (turno) cargarVentas(turno.id)
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error', 'error')
    } finally { setCargando(false) }
  }

  const cerrarTurno = async () => {
    if (!turno) return
    try {
      const res = await api.post('/turnos/cerrar', {
        usuario_id: user.id, monto_cierre: parseFloat(montoCierre) || 0
      })
      setResumenCierre(res.data.resumen)
      setTurno(null); setCarrito([]); setVentas([]); setTotal(0); setPorMedio({})
      setModalCierre(false)
    } catch (e) {
      mostrarToast(e.response?.data?.detail || 'Error al cerrar', 'error')
      setModalCierre(false)
    }
  }

  const mostrarToast = (texto, tipo) => {
    setToast({ texto, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const labelMedio = (id) => ({ efectivo:'Efectivo', tarjeta:'Tarjeta', mercadopago:'Mercado Pago', mixto:'Mixto' })[id] || id
  const formatHora = (fecha) => new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const formatFecha = (fecha) => new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  // ── Sin turno ──
  if (!turno && !resumenCierre) return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-8 w-full max-w-sm text-center animate-fade-in">
        <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BanknotesIcon className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Abrí tu turno</h2>
        <p className="text-slate-400 text-sm mb-2">Seleccioná el turno que te corresponde</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { id: 'mañana', label: 'Mañana', hora: '06-14' },
            { id: 'tarde',  label: 'Tarde',  hora: '14-22' },
            { id: 'noche',  label: 'Noche',  hora: '22-06' },
          ].map(t => (
            <button key={t.id} onClick={() => abrirTurno(t.id)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-semibold capitalize transition-all">
              {t.label}
              <span className="block text-xs font-normal opacity-70 mt-0.5">{t.hora}hs</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Resumen cierre ──
  if (resumenCierre) return (
    <div className="flex items-center justify-center h-full p-4 overflow-auto">
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <CheckCircleIcon className="w-8 h-8 text-green-400 shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-white">Turno cerrado</h2>
            <p className="text-slate-400 text-sm capitalize">
              {resumenCierre.tipo} · {resumenCierre.horario} · {formatFecha(resumenCierre.inicio)} → {formatFecha(resumenCierre.cierre)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-700/40 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Total vendido</p>
            <p className="text-2xl font-bold text-green-400 font-mono">${resumenCierre.total_ventas?.toFixed(2)}</p>
          </div>
          <div className="bg-slate-700/40 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Cantidad de ventas</p>
            <p className="text-2xl font-bold text-white font-mono">{resumenCierre.cantidad_ventas}</p>
          </div>
          {resumenCierre.consumos_empleados > 0 && (
            <div className="bg-slate-700/40 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Consumos empleados</p>
              <p className="text-xl font-bold text-amber-400 font-mono">${resumenCierre.consumos_empleados?.toFixed(2)}</p>
              {resumenCierre.consumos_empleados_pendientes > 0 && (
                <p className="text-xs text-amber-600 mt-1">{resumenCierre.consumos_empleados_pendientes} pendiente(s) de cobro</p>
              )}
            </div>
          )}
          {resumenCierre.consumos_dueno > 0 && (
            <div className="bg-slate-700/40 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Consumo dueño</p>
              <p className="text-xl font-bold text-purple-400 font-mono">${resumenCierre.consumos_dueno?.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Costo total retirado</p>
            </div>
          )}
        </div>

        <div className="bg-slate-700/40 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Por medio de pago</p>
          <div className="space-y-2">
            {['efectivo','tarjeta','mercadopago','mixto'].map(m => {
              const val = resumenCierre.por_medio_pago?.[m] || 0
              if (!val) return null
              const colors = { efectivo:'text-green-400', tarjeta:'text-blue-400', mercadopago:'text-cyan-400', mixto:'text-orange-400' }
              return (
                <div key={m} className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">{labelMedio(m)}</span>
                  <span className={`font-bold font-mono ${colors[m]}`}>${val.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {resumenCierre.resumen_productos?.length > 0 && (
          <div className="bg-slate-700/40 rounded-xl p-4 mb-4">
            <button onClick={() => setVerResumenProductos(v => !v)}
              className="w-full flex items-center justify-between text-left">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Productos vendidos ({resumenCierre.resumen_productos.length})
              </p>
              {verResumenProductos ? <ChevronUpIcon className="w-4 h-4 text-slate-400" /> : <ChevronDownIcon className="w-4 h-4 text-slate-400" />}
            </button>
            {verResumenProductos && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-auto">
                {resumenCierre.resumen_productos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-600/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-500 text-xs w-5 shrink-0">{i + 1}.</span>
                      <span className="text-white text-sm truncate">{p.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-slate-400 text-xs">x{p.cantidad}</span>
                      <span className="text-indigo-400 font-mono text-sm font-semibold">${p.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {resumenCierre.detalle_ventas?.length > 0 && (
          <div className="bg-slate-700/40 rounded-xl p-4 mb-4">
            <button onClick={() => setVerDetalleVentas(v => !v)}
              className="w-full flex items-center justify-between text-left">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Detalle de ventas ({resumenCierre.detalle_ventas.length})
              </p>
              {verDetalleVentas ? <ChevronUpIcon className="w-4 h-4 text-slate-400" /> : <ChevronDownIcon className="w-4 h-4 text-slate-400" />}
            </button>
            {verDetalleVentas && (
              <div className="mt-3 space-y-3 max-h-64 overflow-auto">
                {resumenCierre.detalle_ventas.map((v, i) => (
                  <div key={v.id} className="bg-slate-800/60 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs">#{i + 1}</span>
                        <span className="text-xs text-slate-400">{formatHora(v.fecha)}</span>
                        <span className="text-xs text-slate-500">{labelMedio(v.medio_pago)}</span>
                        {v.medio_pago === 'mixto' && (
                          <span className="text-xs text-orange-400">Ef:${v.monto_efectivo} MP:${v.monto_mp}</span>
                        )}
                      </div>
                      <span className="text-white font-bold font-mono text-sm">${v.total.toFixed(2)}</span>
                    </div>
                    <div className="space-y-1">
                      {v.items.map((item, j) => (
                        <div key={j} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 truncate">{item.nombre}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-slate-500">x{item.cantidad}</span>
                            <span className="text-slate-400 font-mono">${item.subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-700/50 pt-3 mb-5 space-y-2">
          <Row label="Caja al abrir" value={`$${resumenCierre.monto_apertura?.toFixed(2)}`} />
          <Row label="Efectivo contado al cerrar" value={`$${resumenCierre.monto_cierre?.toFixed(2)}`} />
        </div>

        <button onClick={() => { setResumenCierre(null); setVerDetalleVentas(false); setVerResumenProductos(true) }}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all">
          Abrir nuevo turno
        </button>
      </div>
    </div>
  )

  // ── Caja principal ──
  return (
    <div className="flex h-full">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in ${
          toast.tipo === 'ok' ? 'bg-green-900/90 border border-green-700/50 text-green-300' : 'bg-red-900/90 border border-red-700/50 text-red-300'
        }`}>
          {toast.tipo === 'ok' ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationCircleIcon className="w-4 h-4" />}
          {toast.texto}
        </div>
      )}

      {/* Modal cierre */}
      {modalCierre && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-1">Cerrar turno</h3>
            <p className="text-slate-400 text-sm mb-4">Contá el efectivo y escribí el total</p>
            <div className="bg-slate-700/40 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total vendido</span>
                <span className="text-white font-bold">${totalTurno.toFixed(2)}</span>
              </div>
              {['efectivo','tarjeta','mercadopago','mixto'].map(m => {
                const val = porMedioTurno[m] || 0
                if (!val) return null
                const colors = { efectivo:'text-green-400', tarjeta:'text-blue-400', mercadopago:'text-cyan-400', mixto:'text-orange-400' }
                return (
                  <div key={m} className="flex justify-between text-sm">
                    <span className="text-slate-500">{labelMedio(m)}</span>
                    <span className={`font-semibold ${colors[m]}`}>${val.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
            <label className="block text-xs text-slate-400 mb-1.5">Efectivo contado en caja ($)</label>
            <input type="number" className="w-full mb-4" placeholder="0.00"
              value={montoCierre} onChange={e => setMontoCierre(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setModalCierre(false)}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={cerrarTurno}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel izquierdo */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">

        {/* Header turno */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white capitalize">
              Turno {turno?.tipo}
              {turno?.horario && <span className="text-slate-500 text-xs font-normal ml-2">{turno.horario}hs</span>}
            </h2>
            <p className="text-xs text-slate-500">{user?.nombre}</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Botón consumo empleado */}
            <button
              onClick={() => setModoConsumo(modoConsumo === 'empleado' ? null : 'empleado')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                modoConsumo === 'empleado'
                  ? 'bg-amber-600 text-white'
                  : 'border border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-600'
              }`}
              title="Consumo empleado (20% off)">
              <UserIcon className="w-3.5 h-3.5" /> Mi consumo
            </button>
            {/* Botón consumo dueño */}
            {esDueno && (
              <button
                onClick={() => setModoConsumo(modoConsumo === 'dueno' ? null : 'dueno')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoConsumo === 'dueno'
                    ? 'bg-purple-600 text-white'
                    : 'border border-slate-600 text-slate-400 hover:text-purple-400 hover:border-purple-600'
                }`}
                title="Consumo dueño (gratis)">
                <ShoppingBagIcon className="w-3.5 h-3.5" /> Retiro
              </button>
            )}
            <button onClick={() => setModalCierre(true)}
              className="text-xs border border-red-800/50 hover:bg-red-950/50 text-red-400 px-3 py-1.5 rounded-lg transition-all">
              Cerrar turno
            </button>
          </div>
        </div>

        {/* Banner modo consumo */}
        {modoConsumo === 'empleado' && (
          <div className="flex items-center justify-between bg-amber-950/50 border border-amber-700/50 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-amber-400" />
              <p className="text-amber-300 text-sm font-semibold">Modo empleado — 20% OFF. El empleado paga en el momento.</p>
            </div>
            <button onClick={() => { setModoConsumo(null); setCarrito([]) }} className="text-amber-500 hover:text-amber-300 text-xs">✕ Cancelar</button>
          </div>
        )}
        {modoConsumo === 'dueno' && (
          <div className="flex flex-col gap-2 bg-purple-950/40 border border-purple-700/40 rounded-xl px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBagIcon className="w-4 h-4 text-purple-400" />
                <p className="text-purple-300 text-sm font-semibold">Retiro dueño — Sale del stock, sin cobro.</p>
              </div>
              <button onClick={() => { setModoConsumo(null); setCarrito([]) }} className="text-purple-500 hover:text-purple-300 text-xs">✕ Cancelar</button>
            </div>
            <input className="w-full text-xs py-1.5 px-2 bg-purple-900/30 border border-purple-700/30 rounded-lg text-purple-200 placeholder-purple-600"
              placeholder="Motivo (consumo propio, regalo, etc.)"
              value={motivoDueno} onChange={e => setMotivoDueno(e.target.value)} />
          </div>
        )}

        {/* Banner recargo nocturno */}
        {recargoNocturno && modoConsumo === null && (
          <div className="flex items-center gap-2 bg-amber-950/60 border border-amber-700/50 rounded-xl px-4 py-2.5">
            <MoonIcon className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm font-semibold">Tarifa nocturna activa — +10% (22:00 a 06:00)</p>
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <form onSubmit={escanear} className="flex gap-2">
            <input
              ref={inputRef}
              value={codigo}
              onChange={e => { setCodigo(e.target.value); buscarSugerencias(e.target.value) }}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
              onFocus={() => codigo.length >= 2 && buscarSugerencias(codigo)}
              className="flex-1"
              placeholder="Escaneá código o buscá por nombre..."
              autoFocus
            />
            <button type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all">
              +
            </button>
          </form>
          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-2xl">
              {sugerencias.map(p => (
                <button key={p.id} onMouseDown={() => agregarProducto(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 transition-colors text-left border-b border-slate-700/50 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{p.nombre}</p>
                    <p className="text-slate-500 text-xs">Stock: {p.stock}</p>
                  </div>
                  <span className="text-indigo-400 font-semibold text-sm">${p.precio_venta.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-auto space-y-1.5">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
              <div className="text-4xl">🛒</div>
              <p className="text-sm">Escaneá un producto para empezar</p>
            </div>
          ) : carrito.map(item => (
            <div key={item.producto_id}
              className={`border rounded-xl px-4 py-3 flex items-center gap-3 animate-slide-in ${
                modoConsumo === 'empleado' ? 'bg-amber-950/30 border-amber-800/40' :
                modoConsumo === 'dueno'    ? 'bg-purple-950/30 border-purple-800/40' :
                'bg-slate-800/80 border-slate-700/40'
              }`}>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.nombre}</p>
                <p className="text-slate-400 text-xs">
                  ${item.precio_unitario.toFixed(2)} c/u
                  {modoConsumo === 'empleado' && (
                    <span className="text-amber-400 ml-1">→ ${(item.precio_unitario * 0.8).toFixed(2)} (-20%)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => cambiarCantidad(item.producto_id, -1)}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center transition-all">−</button>
                <span className="text-white font-mono text-sm w-5 text-center">{item.cantidad}</span>
                <button onClick={() => cambiarCantidad(item.producto_id, 1)}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center transition-all">+</button>
              </div>
              <span className={`font-semibold text-sm w-20 text-right ${
                modoConsumo === 'empleado' ? 'text-amber-400' :
                modoConsumo === 'dueno'    ? 'text-purple-400' :
                'text-indigo-400'
              }`}>${item.subtotal.toFixed(2)}</span>
              <button onClick={() => setCarrito(p => p.filter(i => i.producto_id !== item.producto_id))}
                className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Panel de cobro */}
        <div className={`border rounded-2xl p-4 space-y-3 ${
          modoConsumo === 'empleado' ? 'bg-amber-950/30 border-amber-800/40' :
          modoConsumo === 'dueno'    ? 'bg-purple-950/30 border-purple-800/40' :
          'bg-slate-800 border-slate-700/50'
        }`}>

          {/* Medios de pago — solo en venta normal */}
          {modoConsumo === null && (
            <div className="flex gap-2">
              {MEDIOS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => { setMedio(id); setMontoRecibido(''); setMontoEfectivo(''); setMontoMP('') }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    medio === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'bg-slate-700/60 text-slate-400 hover:text-white'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              {modoConsumo === 'empleado' ? 'Total a cobrar (20% off)' :
               modoConsumo === 'dueno'    ? 'Total costo (retiro)' : 'Total'}
            </span>
            <div className="text-right">
              {modoConsumo === 'empleado' && carrito.length > 0 && (
                <p className="text-slate-500 text-xs line-through">${totalCarrito.toFixed(2)}</p>
              )}
              {recargoNocturno && modoConsumo === null && carrito.length > 0 && (
                <p className="text-slate-500 text-xs line-through">${totalCarrito.toFixed(2)}</p>
              )}
              <span className={`text-2xl font-bold font-mono ${
                modoConsumo === 'empleado' ? 'text-amber-400' :
                modoConsumo === 'dueno'    ? 'text-purple-400' :
                recargoNocturno && carrito.length > 0 ? 'text-amber-400' : 'text-white'
              }`}>
                ${modoConsumo === 'empleado' ? totalEmpleado.toFixed(2) : totalConRecargo.toFixed(2)}
              </span>
              {modoConsumo === 'empleado' && carrito.length > 0 && (
                <p className="text-amber-600 text-xs">-20% empleado · se cobra después</p>
              )}
              {modoConsumo === 'dueno' && carrito.length > 0 && (
                <p className="text-purple-600 text-xs">retiro sin cobro</p>
              )}
            </div>
          </div>

          {/* Efectivo normal */}
          {medio === 'efectivo' && modoConsumo === null && carrito.length > 0 && (
            <div className="space-y-2">
              <input type="number" placeholder="Monto recibido ($)..."
                value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)} className="w-full" />
              {montoNum > 0 && montoNum >= totalConRecargo && (
                <div className="flex justify-between items-center bg-green-950/50 border border-green-800/40 rounded-xl px-4 py-2.5">
                  <span className="text-green-400 text-sm font-semibold">Vuelto</span>
                  <span className="text-green-300 font-bold font-mono text-xl">${vuelto.toFixed(2)}</span>
                </div>
              )}
              {montoNum > 0 && montoNum < totalConRecargo && (
                <div className="flex justify-between items-center bg-red-950/50 border border-red-800/40 rounded-xl px-4 py-2.5">
                  <span className="text-red-400 text-sm">Falta</span>
                  <span className="text-red-300 font-bold font-mono text-xl">${(totalConRecargo - montoNum).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Pago mixto */}
          {medio === 'mixto' && modoConsumo === null && carrito.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Efectivo ($)</label>
                  <input type="number" placeholder="0.00" value={montoEfectivo}
                    onChange={e => setMontoEfectivo(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mercado Pago ($)</label>
                  <input type="number" placeholder="0.00" value={montoMP}
                    onChange={e => setMontoMP(e.target.value)} className="w-full" />
                </div>
              </div>
              {(montoEfNum > 0 || montoMPNum > 0) && (
                <div className={`flex justify-between items-center rounded-xl px-4 py-2.5 ${
                  faltaMixto > 0 ? 'bg-red-950/50 border border-red-800/40' :
                  sobra > 0 ? 'bg-green-950/50 border border-green-800/40' :
                  'bg-indigo-950/50 border border-indigo-800/40'
                }`}>
                  <span className={`text-sm font-semibold ${faltaMixto > 0 ? 'text-red-400' : sobra > 0 ? 'text-green-400' : 'text-indigo-400'}`}>
                    {faltaMixto > 0 ? 'Falta' : sobra > 0 ? 'Vuelto' : '✓ Exacto'}
                  </span>
                  <span className={`font-bold font-mono text-xl ${faltaMixto > 0 ? 'text-red-300' : sobra > 0 ? 'text-green-300' : 'text-indigo-300'}`}>
                    {faltaMixto > 0 ? `$${faltaMixto.toFixed(2)}` : sobra > 0 ? `$${sobra.toFixed(2)}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botón cobrar / consumo */}
          {modoConsumo === null && (
            <button onClick={cobrar} disabled={!carrito.length || cargando}
              className={`w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-all shadow-lg ${
                recargoNocturno ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30' : 'bg-green-600 hover:bg-green-500 shadow-green-900/30'
              }`}>
              {cargando ? 'Procesando...' : `Cobrar $${totalConRecargo.toFixed(2)}${recargoNocturno ? ' 🌙' : ''}`}
            </button>
          )}
          {modoConsumo === 'empleado' && (
            <button onClick={registrarConsumoEmpleado} disabled={!carrito.length || cargando}
              className="w-full disabled:opacity-40 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl text-base transition-all">
              {cargando ? 'Procesando...' : `Registrar consumo · $${totalEmpleado.toFixed(2)} (20% OFF) 👤`}
            </button>
          )}
          {modoConsumo === 'dueno' && (
            <button onClick={registrarConsumoDueno} disabled={!carrito.length || cargando}
              className="w-full disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl text-base transition-all">
              {cargando ? 'Procesando...' : `Retirar del stock · $${totalCarrito.toFixed(2)} costo 🧾`}
            </button>
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="w-64 bg-slate-800/50 border-l border-slate-700/50 flex flex-col p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Este turno</h3>
          <span className="text-xs text-indigo-400 font-semibold">${totalTurno.toFixed(2)}</span>
        </div>
        <div className="flex-1 overflow-auto space-y-1.5">
          {ventasTurno.length === 0
            ? <p className="text-slate-600 text-xs text-center mt-8">Sin ventas aún</p>
            : [...ventasTurno].reverse().map(v => (
              <div key={v.id} className="bg-slate-700/40 rounded-lg px-3 py-2">
                <div className="flex justify-between items-start">
                  <span className="text-white text-xs font-medium">${v.total.toFixed(2)}</span>
                  <span className={`text-xs ${v.medio_pago === 'mixto' ? 'text-orange-400' : 'text-slate-500'}`}>
                    {labelMedio(v.medio_pago)}
                  </span>
                </div>
                {v.items?.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {v.items.map((item, i) => (
                      <p key={i} className="text-slate-500 text-xs truncate">· {item.nombre} x{item.cantidad}</p>
                    ))}
                  </div>
                )}
                <p className="text-slate-600 text-xs mt-0.5">{formatHora(v.fecha)}</p>
              </div>
            ))
          }
        </div>
        <div className="pt-3 border-t border-slate-700/50 mt-2 space-y-1">
          {['efectivo','tarjeta','mercadopago','mixto'].map(m => {
            const val = porMedioTurno[m] || 0
            if (!val) return null
            const colors = { efectivo:'text-green-300', tarjeta:'text-blue-300', mercadopago:'text-cyan-300', mixto:'text-orange-300' }
            return (
              <div key={m} className="flex justify-between text-xs">
                <span className="text-slate-500">{labelMedio(m)}</span>
                <span className={`font-mono ${colors[m]}`}>${val.toFixed(2)}</span>
              </div>
            )
          })}
          <div className="flex justify-between text-xs pt-1 border-t border-slate-700/30">
            <span className="text-slate-500">Ventas</span>
            <span className="text-slate-300">{ventasTurno.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, big }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${big ? 'text-white font-semibold' : 'text-slate-400'} text-sm`}>{label}</span>
      <span className={`${big ? 'text-green-400 font-bold text-lg' : 'text-slate-300'} font-mono`}>{value}</span>
    </div>
  )
}
