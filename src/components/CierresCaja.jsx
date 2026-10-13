import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api, { mensajeError } from '../api'
import { useRefrescoAutomatico } from '../hooks/useRefrescoAutomatico'
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon
} from '@heroicons/react/24/outline'

const TZ = 'America/Argentina/Buenos_Aires'

const TURNOS = [
  { id: '',       label: 'Todos',  icono: '🗓️' },
  { id: 'mañana', label: 'Mañana', icono: '☀️' },
  { id: 'tarde',  label: 'Tarde',  icono: '🌤️' },
  { id: 'noche',  label: 'Noche',  icono: '🌙' },
]
const TURNO_POR_ID = Object.fromEntries(TURNOS.map(t => [t.id, t]))
const ORDEN_TURNO = { mañana: 0, tarde: 1, noche: 2 }

// ── Helpers de fecha (siempre en hora Argentina, sin depender de la zona del dispositivo) ──
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })   // AAAA-MM-DD

const sumarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const etiquetaFecha = (iso) => {
  const hoy = hoyAR()
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  })
}

// El servidor manda la hora argentina "tal cual" (sin zona): se muestra sin convertir.
const hora = (f) => f
  ? new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  : null

const plata = (n) => '$' + Math.round(n ?? 0).toLocaleString('es-AR')

const sumarProductos = (listas) => {
  const m = {}
  for (const lista of listas) for (const p of lista) {
    m[p.nombre] ||= { nombre: p.nombre, cantidad: 0, subtotal: 0 }
    m[p.nombre].cantidad += p.cantidad
    m[p.nombre].subtotal += p.subtotal
  }
  return Object.values(m).sort((a, b) => b.subtotal - a.subtotal)
}

// Columnas compartidas por las dos tablas (en celular se apilan)
const COLS = 'md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.6fr)_repeat(4,minmax(0,1fr))_minmax(0,0.9fr)_1.25rem] md:items-center md:gap-3'

export default function CierresCaja() {
  const [fecha, setFecha]   = useState(hoyAR)
  const [tipo, setTipo]     = useState('')
  const [datos, setDatos]   = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError]   = useState(null)
  const pedido = useRef(0)

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const id = ++pedido.current
    if (!silencioso) setCargando(true)
    try {
      const res = await api.get('/turnos/cierres', { params: { fecha, ...(tipo && { tipo }) } })
      if (id !== pedido.current) return   // llegó tarde: el usuario ya cambió de fecha/turno
      setDatos(res.data)
      setError(null)
    } catch (e) {
      if (id !== pedido.current) return
      if (!silencioso) { setDatos(null); setError(mensajeError(e, 'No se pudieron cargar los turnos')) }
    } finally {
      if (id === pedido.current && !silencioso) setCargando(false)
    }
  }, [fecha, tipo])

  useEffect(() => { cargar() }, [cargar])
  // Solo tiene sentido refrescar solo cuando se mira el día de hoy (hay turnos en curso)
  useRefrescoAutomatico(() => cargar({ silencioso: true }), { activo: fecha === hoyAR(), cadaMs: 30000 })

  const esHoy = fecha === hoyAR()

  const turnos = useMemo(
    () => [...(datos?.turnos || [])].sort((a, b) => (ORDEN_TURNO[a.tipo] ?? 9) - (ORDEN_TURNO[b.tipo] ?? 9) || a.inicio.localeCompare(b.inicio)),
    [datos]
  )

  // Por empleado: suma todos sus turnos del día
  const empleados = useMemo(() => {
    const m = {}
    for (const t of turnos) {
      const e = (m[t.usuario] ||= { nombre: t.usuario, turnos: [], ventas: 0, efectivo: 0, mercadopago: 0, tarjeta: 0, total: 0, diferencia: null })
      e.turnos.push(t)
      e.ventas += t.cantidad_ventas
      for (const k of ['efectivo', 'mercadopago', 'tarjeta', 'total']) e[k] += t.desglose[k]
      if (t.diferencia != null) e.diferencia = (e.diferencia ?? 0) + t.diferencia
    }
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [turnos])

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* ── Filtro de fecha ── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 space-y-3">
        <div className="flex items-stretch gap-2">
          <button onClick={() => setFecha(f => sumarDias(f, -1))} aria-label="Día anterior"
            className="w-12 shrink-0 flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 text-slate-200 transition-colors">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <label className="flex-1 min-w-0 relative rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-center cursor-pointer">
            <span className="block text-white font-semibold capitalize truncate">{etiquetaFecha(fecha)}</span>
            <span className="block text-xs text-slate-500">{fecha.split('-').reverse().join('/')}</span>
            {/* El input cubre toda la tarjeta: tocar la fecha abre el calendario nativo del celular */}
            <input type="date" value={fecha} max={hoyAR()} aria-label="Elegir fecha"
              onChange={e => e.target.value && setFecha(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </label>
          <button onClick={() => setFecha(f => sumarDias(f, 1))} disabled={esHoy} aria-label="Día siguiente"
            className="w-12 shrink-0 flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-700 active:bg-slate-600 text-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Filtro de turno ── */}
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Filtrar por turno">
          {TURNOS.map(t => (
            <button key={t.id || 'todos'} onClick={() => setTipo(t.id)} aria-pressed={tipo === t.id}
              className={`flex items-center justify-center gap-1.5 min-h-[2.75rem] rounded-xl text-xs font-semibold transition-all ${
                tipo === t.id
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-900/40'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-700/70'
              }`}>
              <span aria-hidden="true">{t.icono}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && !datos && <p className="text-slate-500 text-sm text-center animate-pulse-soft">Cargando...</p>}

      {error && (
        <div role="alert" className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-center">
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button onClick={() => cargar()}
            className="bg-red-700 hover:bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {datos && !error && (
        // Todo sale de la respuesta (no del filtro elegido) y se atenúa mientras llega la nueva:
        // así nunca se ve el título de un filtro con los números de otro.
        <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* ── Total del día / del turno filtrado ── */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Tile etiqueta={datos.tipo ? `Total turno ${TURNO_POR_ID[datos.tipo].label.toLowerCase()}` : 'Total del día'}
              valor={plata(datos.acumulado.total)} clase="text-white" grande />
            <Tile etiqueta="💵 Efectivo" valor={plata(datos.acumulado.efectivo)} clase="text-green-400" />
            <Tile etiqueta="📱 Mercado Pago" valor={plata(datos.acumulado.mercadopago)} clase="text-cyan-400" />
            <Tile etiqueta="💳 Tarjeta" valor={plata(datos.acumulado.tarjeta)} clase="text-blue-400" />
            <Tile etiqueta="🧾 Ventas" valor={datos.acumulado.cantidad_ventas} clase="text-slate-200" />
          </section>

          {turnos.length === 0 ? (
            <div className="text-center text-slate-500 py-10 text-sm">
              No hay turnos {datos.tipo ? `de ${TURNO_POR_ID[datos.tipo].label.toLowerCase()} ` : ''}
              registrados el {datos.fecha.split('-').reverse().join('/')}.
            </div>
          ) : (
            <>
              <Tabla titulo="Por turno" primeraCol="Turno · empleado" ultimaCol="Caja">
                {turnos.map(t => <FilaTurno key={t.id} t={t} />)}
              </Tabla>

              <Tabla titulo="Por empleado" primeraCol="Empleado" ultimaCol="Ticket prom.">
                {empleados.map(e => <FilaEmpleado key={e.nombre} e={e} />)}
              </Tabla>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Tile({ etiqueta, valor, clase, grande = false }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${grande
      ? 'col-span-2 md:col-span-1 bg-gradient-to-br from-indigo-900/50 to-slate-800/60 border-indigo-700/40'
      : 'bg-slate-800/50 border-slate-700/40'}`}>
      <p className="text-xs text-slate-400 truncate">{etiqueta}</p>
      <p className={`font-mono font-bold ${grande ? 'text-2xl' : 'text-lg'} ${clase}`}>{valor}</p>
    </div>
  )
}

function Tabla({ titulo, primeraCol, ultimaCol, children }) {
  return (
    <section className="bg-slate-800/50 border border-slate-700/40 rounded-2xl overflow-hidden">
      <h3 className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-200">{titulo}</h3>
      <div className={`hidden ${COLS} px-4 pb-2 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700/40`}>
        <span>{primeraCol}</span>
        <span className="text-right">Ventas</span>
        <span className="text-right">Efectivo</span>
        <span className="text-right">MP</span>
        <span className="text-right">Tarjeta</span>
        <span className="text-right">Total</span>
        <span className="text-right">{ultimaCol}</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-700/40">{children}</ul>
    </section>
  )
}

// Una fila desplegable: en PC son columnas, en el celular nombre+total arriba y el desglose abajo
function FilaDesplegable({ titulo, subtitulo, ventas, d, extra, detalle }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <li>
      <button onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        className={`w-full text-left px-4 py-3 hover:bg-slate-700/30 transition-colors ${COLS}`}>
        <div className="flex items-start justify-between gap-3 md:block min-w-0">
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{titulo}</p>
            {subtitulo && <p className="text-xs text-slate-400 truncate">{subtitulo}</p>}
          </div>
          <div className="md:hidden text-right shrink-0">
            <p className="text-white font-bold font-mono">{plata(d.total)}</p>
            <div className="text-xs">{extra}</div>
          </div>
        </div>
        {/* celular: desglose en una línea */}
        <div className="md:hidden mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono">
          <span className="text-slate-400">{ventas} vtas</span>
          <span className="text-green-400">💵 {plata(d.efectivo)}</span>
          <span className="text-cyan-400">📱 {plata(d.mercadopago)}</span>
          <span className="text-blue-400">💳 {plata(d.tarjeta)}</span>
        </div>
        {/* PC: columnas */}
        <span className="hidden md:block text-right font-mono text-slate-300">{ventas}</span>
        <span className="hidden md:block text-right font-mono text-green-400">{plata(d.efectivo)}</span>
        <span className="hidden md:block text-right font-mono text-cyan-400">{plata(d.mercadopago)}</span>
        <span className="hidden md:block text-right font-mono text-blue-400">{plata(d.tarjeta)}</span>
        <span className="hidden md:block text-right font-mono font-bold text-white">{plata(d.total)}</span>
        <span className="hidden md:block text-right text-xs">{extra}</span>
        <ChevronDownIcon className={`hidden md:block w-4 h-4 text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && <div className="border-t border-slate-700/40 bg-slate-900/40 px-4 py-3 space-y-3">{detalle}</div>}
    </li>
  )
}

function EstadoCaja({ t }) {
  if (!t.cerrado) return <span className="text-amber-400 font-medium">En curso</span>
  if (t.diferencia == null) return <span className="text-slate-500">—</span>
  if (Math.abs(t.diferencia) < 1) return <span className="text-green-400 font-medium">✓ Cerró</span>
  return <span className={`font-mono font-medium ${t.diferencia > 0 ? 'text-amber-400' : 'text-red-400'}`}>
    {t.diferencia > 0 ? '+' : '−'}{plata(Math.abs(t.diferencia))}
  </span>
}

function FilaTurno({ t }) {
  const info = TURNO_POR_ID[t.tipo] || { icono: '🗓️', label: t.tipo }
  const desde = hora(t.inicio), hasta = hora(t.cierre)
  return (
    <FilaDesplegable
      titulo={<>{info.icono} {info.label} · {t.usuario}</>}
      subtitulo={`${desde}${hasta ? ` → ${hasta}` : ' → en curso'}`}
      ventas={t.cantidad_ventas}
      d={t.desglose}
      extra={<EstadoCaja t={t} />}
      detalle={<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
          <Dato etiqueta="Caja al abrir" valor={plata(t.monto_apertura)} />
          <Dato etiqueta="Efectivo esperado" valor={plata(t.efectivo_esperado)} />
          <Dato etiqueta="Contado al cerrar" valor={t.cerrado ? plata(t.monto_cierre) : '—'} />
          <Dato etiqueta="Diferencia" valor={<EstadoCaja t={t} />} />
        </div>
        <Productos lista={t.resumen_productos} />
      </>}
    />
  )
}

function FilaEmpleado({ e }) {
  const turnos = e.turnos.map(t => TURNO_POR_ID[t.tipo]?.label.toLowerCase() || t.tipo)
  return (
    <FilaDesplegable
      titulo={e.nombre}
      subtitulo={`${e.turnos.length} turno${e.turnos.length === 1 ? '' : 's'}: ${turnos.join(', ')}`}
      ventas={e.ventas}
      d={e}
      extra={<span className="font-mono text-slate-300">{e.ventas ? plata(e.total / e.ventas) : '—'}</span>}
      detalle={<Productos lista={sumarProductos(e.turnos.map(t => t.resumen_productos))} />}
    />
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex justify-between md:block gap-3">
      <span className="text-slate-400 text-xs md:block">{etiqueta}</span>
      <span className="font-mono text-white">{valor}</span>
    </div>
  )
}

function Productos({ lista }) {
  if (!lista.length) return <p className="text-xs text-slate-500">Sin ventas.</p>
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
        Lo que vendió · {lista.reduce((s, p) => s + p.cantidad, 0)} unidades
      </p>
      <ul className="grid md:grid-cols-2 gap-x-6">
        {lista.map(p => (
          <li key={p.nombre} className="flex items-center justify-between gap-3 py-1 border-b border-slate-700/20">
            <span className="text-sm text-white truncate min-w-0">{p.nombre}</span>
            <span className="shrink-0 text-xs text-slate-400">
              x{p.cantidad} · <span className="text-indigo-400 font-mono font-semibold">{plata(p.subtotal)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
