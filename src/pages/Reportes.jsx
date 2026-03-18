import { useState, useEffect } from 'react'
import api from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from 'recharts'
import {
  CalendarIcon, BanknotesIcon, ChartBarIcon, BellAlertIcon,
  UsersIcon, CubeIcon, ArrowTrendingUpIcon, ClockIcon,
  ExclamationTriangleIcon, PlusIcon, CheckIcon
} from '@heroicons/react/24/outline'

const TAB = { HOY: 'hoy', SEMANA: 'semana', EMPLEADOS: 'empleados', STOCK: 'stock', ALERTAS: 'alertas' }

const TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#a5b4fc' }
}

const LABEL_MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', mercadopago: 'Mercado Pago' }
const COLOR_MEDIO = { efectivo: '#22c55e', tarjeta: '#3b82f6', mercadopago: '#06b6d4' }

export default function Reportes() {
  const [tab, setTab]     = useState(TAB.HOY)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const [reporteHoy, setReporteHoy] = useState(null)
  const [semana, setSemana]         = useState([])
  const [turnos, setTurnos]         = useState([])
  const [productos, setProductos]   = useState([])
  const [alertas, setAlertas]       = useState([])
  const [stockBajo, setStockBajo]   = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [modalStock, setModalStock] = useState(null)
  const [nuevoStock, setNuevoStock] = useState('')
  const [motivoStock, setMotivoStock] = useState('')
  const [toastMsg, setToastMsg]     = useState(null)

  useEffect(() => {
    cargarSolicitudes()
  }, [])

  useEffect(() => {
    if (tab === TAB.HOY)       cargarHoy()
    if (tab === TAB.SEMANA)    cargarSemana()
    if (tab === TAB.EMPLEADOS) cargarTurnos()
    if (tab === TAB.STOCK)     cargarStock()
    if (tab === TAB.ALERTAS)   cargarAlertas()
  }, [tab, fecha])

  // Auto-refresh cada 30 segundos en Alertas y Empleados
  useEffect(() => {
    if (tab !== TAB.ALERTAS && tab !== TAB.EMPLEADOS) return
    const interval = setInterval(() => {
      if (tab === TAB.ALERTAS)   cargarAlertas()
      if (tab === TAB.EMPLEADOS) cargarTurnos()
    }, 30000)
    return () => clearInterval(interval)
  }, [tab])

  const cargarSolicitudes = async () => {
    try {
      const r = await api.get('/solicitudes/stock/pendientes')
      setSolicitudes(r.data)
    } catch {}
  }

  const cargarHoy = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/reportes/dia?fecha=${fecha}`)
      setReporteHoy(r.data)
      cargarSolicitudes()
    } catch {}
    finally { setLoading(false) }
  }

  const cargarSemana = async () => {
    setLoading(true)
    try { const r = await api.get('/reportes/semana'); setSemana(r.data) }
    catch {} finally { setLoading(false) }
  }

  const cargarTurnos = async () => {
    setLoading(true)
    try { const r = await api.get('/turnos/todos'); setTurnos(r.data) }
    catch {} finally { setLoading(false) }
  }

  const cargarStock = async () => {
    setLoading(true)
    try {
      const [rp, rs] = await Promise.all([api.get('/productos'), api.get('/reportes/stock-bajo')])
      setProductos(rp.data)
      setStockBajo(rs.data)
    } catch {} finally { setLoading(false) }
  }

  const cargarAlertas = async () => {
    setLoading(true)
    try {
      const r = await api.get('/reportes/alertas')
      setAlertas(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  const ajustarStock = async () => {
    if (!nuevoStock) return
    try {
      await api.post(`/productos/ajuste-stock/${modalStock.id}`, {
        stock_nuevo: parseInt(nuevoStock),
        motivo: motivoStock || 'ajuste manual desde panel dueño',
        usuario_id: 1
      })
      toast('Stock actualizado', 'ok')
      setModalStock(null); setNuevoStock(''); setMotivoStock('')
      cargarStock()
    } catch (e) {
      toast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const toast = (texto, tipo) => {
    setToastMsg({ texto, tipo })
    setTimeout(() => setToastMsg(null), 3000)
  }

  const proySemana = semana.reduce((s, d) => s + d.total, 0)
  const proyGanancia = semana.reduce((s, d) => s + d.ganancia, 0)
  const proyMes = (proySemana / 7) * 30
  const proyGanMes = (proyGanancia / 7) * 30

  const DIAS_ES = { Monday:'Lun', Tuesday:'Mar', Wednesday:'Mié', Thursday:'Jue', Friday:'Vie', Saturday:'Sáb', Sunday:'Dom' }

  const pieData = reporteHoy
    ? Object.entries(reporteHoy.por_medio_pago || {}).map(([k, v]) => ({ name: LABEL_MEDIO[k] || k, value: v, key: k }))
    : []

  return (
    <div className="flex flex-col h-full">
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in ${
          toastMsg.tipo === 'ok' ? 'bg-green-900/90 border border-green-700/50 text-green-300' : 'bg-red-900/90 border border-red-700/50 text-red-300'
        }`}>{toastMsg.texto}</div>
      )}

      <div className="px-5 pt-5 pb-3 border-b border-slate-700/50">
        <h1 className="text-xl font-bold text-white mb-3">Panel del dueño</h1>
        <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 w-fit overflow-x-auto">
          {[
            { id: TAB.HOY,       label: 'Hoy',        Icon: CalendarIcon },
            { id: TAB.SEMANA,    label: 'Semana',      Icon: ChartBarIcon },
            { id: TAB.EMPLEADOS, label: 'Empleados',   Icon: UsersIcon },
            { id: TAB.STOCK,     label: 'Stock',       Icon: CubeIcon },
            { id: TAB.ALERTAS,   label: 'Alertas',     Icon: BellAlertIcon },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                tab === id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading && <div className="text-slate-500 text-sm animate-pulse-soft mb-4">Cargando...</div>}

        {/* HOY */}
        {tab === TAB.HOY && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-auto" />
            </div>

            {solicitudes.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-700/40 rounded-xl p-4 space-y-2">
                <p className="text-amber-400 text-sm font-semibold">🔔 Solicitudes de acceso al stock ({solicitudes.length})</p>
                {solicitudes.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white text-sm font-medium">{s.usuario}</p>
                      <p className="text-slate-500 text-xs">solicita acceso al stock</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        await api.post(`/solicitudes/stock/${s.id}/aprobar`, { aprobado_por: 1 })
                        cargarSolicitudes()
                        toast('Acceso aprobado', 'ok')
                      }} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all font-medium">
                        Aprobar
                      </button>
                      <button onClick={async () => {
                        await api.post(`/solicitudes/stock/${s.id}/rechazar`, {})
                        cargarSolicitudes()
                      }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reporteHoy && <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI label="Total vendido"  value={`$${reporteHoy.total_vendido.toFixed(2)}`}  color="indigo" Icon={BanknotesIcon} />
                <KPI label="Ganancia neta"  value={`$${reporteHoy.ganancia_neta.toFixed(2)}`}  color="green"  Icon={ArrowTrendingUpIcon} />
                <KPI label="Costo repuesto" value={`$${reporteHoy.total_costo.toFixed(2)}`}    color="amber"  Icon={CubeIcon} />
                <KPI label="Ventas"         value={reporteHoy.cantidad_ventas}                  color="purple" Icon={ChartBarIcon} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Por medio de pago</h3>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                            {pieData.map((entry) => (
                              <Cell key={entry.key} fill={COLOR_MEDIO[entry.key] || '#6366f1'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => [`$${v.toFixed(2)}`]} contentStyle={TOOLTIP.contentStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {pieData.map(e => (
                          <div key={e.key} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_MEDIO[e.key] || '#6366f1' }} />
                              <span className="text-xs text-slate-400">{e.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-white">${e.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-slate-600 text-xs text-center py-8">Sin ventas este día</p>}
                </div>

                <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Por empleado</h3>
                  {Object.keys(reporteHoy.por_usuario || {}).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(reporteHoy.por_usuario).map(([nombre, datos]) => {
                        const pct = reporteHoy.total_vendido > 0 ? (datos.total / reporteHoy.total_vendido) * 100 : 0
                        return (
                          <div key={nombre}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-white">{nombre}</span>
                              <span className="text-sm font-semibold text-indigo-400">${datos.total.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{datos.cantidad} ventas · {pct.toFixed(0)}%</p>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="text-slate-600 text-xs text-center py-8">Sin ventas este día</p>}
                </div>

                <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Top productos</h3>
                  {reporteHoy.top_productos?.length > 0 ? (
                    <div className="space-y-2">
                      {reporteHoy.top_productos.slice(0, 6).map((p, i) => (
                        <div key={p.nombre} className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{p.nombre}</p>
                            <p className="text-xs text-slate-500">{p.cantidad} unidades</p>
                          </div>
                          <span className="text-xs font-semibold text-green-400">${p.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-600 text-xs text-center py-8">Sin datos</p>}
                </div>
              </div>
            </>}
            {!loading && !reporteHoy && (
              <div className="text-center text-slate-600 py-16 text-sm">Sin datos para esta fecha</div>
            )}
          </div>
        )}

        {/* SEMANA */}
        {tab === TAB.SEMANA && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-800/20 border border-indigo-700/30 rounded-2xl p-5">
                <p className="text-xs text-indigo-400 font-medium mb-1">Proyección ventas del mes</p>
                <p className="text-3xl font-bold text-white">${proyMes.toFixed(0)}</p>
                <p className="text-xs text-slate-500 mt-1">Basado en los últimos 7 días</p>
              </div>
              <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700/30 rounded-2xl p-5">
                <p className="text-xs text-green-400 font-medium mb-1">Proyección ganancia del mes</p>
                <p className="text-3xl font-bold text-white">${proyGanMes.toFixed(0)}</p>
                <p className="text-xs text-slate-500 mt-1">Ganancia neta estimada</p>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {semana.map(d => (
                <div key={d.fecha} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">{DIAS_ES[d.dia] || d.dia}</p>
                  <p className="text-xs text-slate-600 mb-1">{d.fecha.slice(5)}</p>
                  <p className="text-sm font-bold text-white">${d.total.toFixed(0)}</p>
                  <p className="text-xs text-green-400">+${d.ganancia.toFixed(0)}</p>
                </div>
              ))}
            </div>
            {semana.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Ventas vs Ganancia</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={semana} margin={{ left: -10 }}>
                    <CartesianGrid stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={f => f.slice(5)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP} formatter={(v, n) => [`$${v.toFixed(2)}`, n === 'total' ? 'Ventas' : 'Ganancia']} />
                    <Bar dataKey="total"    fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="ganancia" fill="#22c55e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* EMPLEADOS */}
        {tab === TAB.EMPLEADOS && (
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">Últimos 100 turnos de todos los empleados</p>
            {turnos.length === 0 && !loading && (
              <div className="text-center text-slate-600 py-16 text-sm">Sin turnos registrados</div>
            )}
            {turnos.map(t => (
              <div key={t.id} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                      t.tipo === 'mañana' ? 'bg-amber-900/50 text-amber-400' :
                      t.tipo === 'tarde'  ? 'bg-orange-900/50 text-orange-400' :
                                            'bg-indigo-900/50 text-indigo-400'
                    }`}>
                      {t.tipo === 'mañana' ? '☀️' : t.tipo === 'tarde' ? '🌤' : '🌙'}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.usuario}</p>
                      <p className="text-slate-500 text-xs capitalize">{t.tipo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">${t.total_ventas.toFixed(2)}</p>
                    <p className="text-slate-500 text-xs">{t.cantidad_ventas} ventas</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700/40">
                  <div>
                    <p className="text-xs text-slate-500">Fichó entrada</p>
                    <p className="text-xs text-white font-medium">
                      {new Date(t.inicio).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fichó salida</p>
                    <p className="text-xs text-white font-medium">
                      {t.cierre
                        ? new Date(t.cierre).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
                        : <span className="text-amber-400">Turno activo</span>
                      }
                    </p>
                  </div>
                  {t.monto_apertura != null && (
                    <div>
                      <p className="text-xs text-slate-500">Caja apertura</p>
                      <p className="text-xs text-white">${t.monto_apertura.toFixed(2)}</p>
                    </div>
                  )}
                  {t.monto_cierre != null && (
                    <div>
                      <p className="text-xs text-slate-500">Efectivo al cerrar</p>
                      <p className="text-xs text-white">${t.monto_cierre.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STOCK */}
        {tab === TAB.STOCK && (
          <div className="space-y-4">
            {stockBajo.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-400">{stockBajo.length} productos con stock bajo</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stockBajo.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-amber-950/30 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-white font-medium">{p.nombre}</p>
                        <p className="text-xs text-amber-600">Stock: {p.stock} / mín: {p.stock_minimo}</p>
                      </div>
                      <button onClick={() => { setModalStock(p); setNuevoStock(String(p.stock_minimo * 2)) }}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1">
                        <PlusIcon className="w-3 h-3" /> Sumar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/40">
                <h3 className="text-sm font-semibold text-slate-300">Todos los productos ({productos.length})</h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/40">
                      <th className="text-left px-4 py-2">Producto</th>
                      <th className="text-right px-3 py-2">Costo</th>
                      <th className="text-right px-3 py-2">Venta</th>
                      <th className="text-right px-3 py-2">Ganancia</th>
                      <th className="text-right px-3 py-2">Stock</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20">
                    {productos.map(p => (
                      <tr key={p.id} className={`hover:bg-slate-700/20 transition-colors ${p.stock_bajo ? 'bg-amber-950/10' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="text-white font-medium">{p.nombre}</p>
                          <p className="text-slate-600 font-mono">{p.codigo_barra}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">${p.precio_costo.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-white">${p.precio_venta.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-green-400 font-medium">+{p.ganancia_pct}%</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-bold font-mono ${p.stock_bajo ? 'text-amber-400' : 'text-white'}`}>{p.stock}</span>
                          {p.stock_bajo && <ExclamationTriangleIcon className="w-3 h-3 text-amber-400 inline ml-1" />}
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => { setModalStock(p); setNuevoStock('') }}
                            className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded-lg hover:bg-indigo-900/20">
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ALERTAS */}
        {tab === TAB.ALERTAS && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-xs">{alertas.length} movimientos registrados</p>
              <button onClick={cargarAlertas}
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800/40 px-3 py-1.5 rounded-lg transition-all">
                ↻ Actualizar
              </button>
            </div>
            {alertas.length === 0 && !loading && (
              <div className="text-center text-slate-600 py-16 text-sm">Sin alertas registradas</div>
            )}
            {alertas.map(a => (
              <div key={a.id} className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  a.accion.includes('stock')   ? 'bg-amber-400' :
                  a.accion.includes('venta')   ? 'bg-green-400' :
                  a.accion.includes('usuario') ? 'bg-purple-400' :
                  a.accion.includes('turno')   ? 'bg-blue-400' : 'bg-slate-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{a.usuario}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.accion.includes('stock')   ? 'bg-amber-900/50 text-amber-400' :
                      a.accion.includes('venta')   ? 'bg-green-900/50 text-green-400' :
                      a.accion.includes('usuario') ? 'bg-purple-900/50 text-purple-400' :
                      a.accion.includes('turno')   ? 'bg-blue-900/50 text-blue-400' :
                                                     'bg-slate-700 text-slate-400'
                    }`}>{a.accion}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{a.detalle}</p>
                </div>
                <span className="text-xs text-slate-600 shrink-0 whitespace-nowrap">
                  {new Date(a.fecha).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal ajuste stock */}
      {modalStock && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-1">Ajustar stock</h3>
            <p className="text-slate-400 text-sm mb-4">{modalStock.nombre}</p>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2 mb-4 text-sm flex justify-between">
              <span className="text-slate-400">Stock actual</span>
              <span className="text-white font-bold">{modalStock.stock} unidades</span>
            </div>
            <label className="block text-xs text-slate-400 mb-1.5">Nuevo stock total</label>
            <input type="number" className="w-full mb-3" value={nuevoStock}
              onChange={e => setNuevoStock(e.target.value)} placeholder="Ej: 24" autoFocus />
            <label className="block text-xs text-slate-400 mb-1.5">Motivo (opcional)</label>
            <input className="w-full mb-4" value={motivoStock}
              onChange={e => setMotivoStock(e.target.value)} placeholder="Ej: reposición semanal" />
            <div className="flex gap-3">
              <button onClick={() => { setModalStock(null); setNuevoStock(''); setMotivoStock('') }}
                className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-all">
                Cancelar
              </button>
              <button onClick={ajustarStock}
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

function KPI({ label, value, color, Icon }) {
  const colors = {
    indigo: 'bg-indigo-900/30 border-indigo-800/30 text-indigo-400',
    green:  'bg-green-900/30  border-green-800/30  text-green-400',
    amber:  'bg-amber-900/30  border-amber-800/30  text-amber-400',
    purple: 'bg-purple-900/30 border-purple-800/30 text-purple-400',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
