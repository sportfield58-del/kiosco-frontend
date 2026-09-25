import { useState, useEffect, useRef, useCallback } from 'react'
import api, { mensajeError } from '../api'
import { useRefrescoAutomatico } from '../hooks/useRefrescoAutomatico'
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon
} from '@heroicons/react/24/outline'

const TZ = 'America/Argentina/Buenos_Aires'

const TURNOS = [
  { id: '',       label: 'Todos',  icono: '🗓️' },
  { id: 'mañana', label: 'Mañana', icono: '☀️', horario: '06 a 14 hs' },
  { id: 'tarde',  label: 'Tarde',  icono: '🌤️', horario: '14 a 22 hs' },
  { id: 'noche',  label: 'Noche',  icono: '🌙', horario: '22 a 06 hs' },
]
const TURNO_POR_ID = Object.fromEntries(TURNOS.map(t => [t.id, t]))

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

const plata = (n) => (n ?? 0).toLocaleString('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2
})

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
      if (!silencioso) { setDatos(null); setError(mensajeError(e, 'No se pudieron cargar los cierres')) }
    } finally {
      if (id === pedido.current && !silencioso) setCargando(false)
    }
  }, [fecha, tipo])

  useEffect(() => { cargar() }, [cargar])
  // Solo tiene sentido refrescar solo cuando se mira el día de hoy (hay turnos en curso)
  useRefrescoAutomatico(() => cargar({ silencioso: true }), { activo: fecha === hoyAR(), cadaMs: 30000 })

  const esHoy = fecha === hoyAR()

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
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
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[3.25rem] rounded-xl text-xs font-semibold transition-all ${
                tipo === t.id
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-900/40'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-700/70'
              }`}>
              <span className="text-base leading-none" aria-hidden="true">{t.icono}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && <p className="text-slate-500 text-sm text-center animate-pulse-soft">Cargando cierres...</p>}

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
        // Título, fecha y turno salen de la respuesta (no del filtro elegido) y se atenúa mientras llega la nueva:
        // así nunca se ve el título de un filtro con los números de otro.
        <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* ── Acumulado del filtro ── */}
          <Totales
            titulo={datos.tipo ? `Acumulado turno ${TURNO_POR_ID[datos.tipo].label.toLowerCase()}` : 'Acumulado del día'}
            subtitulo={`${datos.acumulado.cantidad_ventas} venta${datos.acumulado.cantidad_ventas === 1 ? '' : 's'} · ${datos.turnos.length} turno${datos.turnos.length === 1 ? '' : 's'}`}
            desglose={datos.acumulado}
            destacado
          />

          {datos.turnos.length === 0 && (
            <div className="text-center text-slate-500 py-10 text-sm">
              No hay turnos {datos.tipo ? `de ${TURNO_POR_ID[datos.tipo].label.toLowerCase()} ` : ''}
              registrados el {datos.fecha.split('-').reverse().join('/')}.
            </div>
          )}

          {datos.turnos.map(t => <TarjetaTurno key={t.id} turno={t} />)}
        </div>
      )}
    </div>
  )
}

// ── Bloque Efectivo / Mercado Pago / (Tarjeta) / Total ──
function Totales({ titulo, subtitulo, desglose, totalEtiqueta = 'Total acumulado', destacado = false }) {
  const total = desglose.total || 0
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  return (
    <section className={`rounded-2xl border p-4 ${
      destacado ? 'bg-gradient-to-br from-indigo-900/40 to-slate-800/60 border-indigo-700/40'
                : 'bg-slate-800/50 border-slate-700/40'
    }`}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{titulo}</h3>
        {subtitulo && <span className="text-xs text-slate-500">{subtitulo}</span>}
      </div>

      <dl className="space-y-2.5">
        <Fila color="text-green-400" etiqueta="💵 Efectivo"
          valor={desglose.efectivo} porcentaje={pct(desglose.efectivo)} />
        <Fila color="text-cyan-400" etiqueta="💳 Mercado Pago / Transferencia"
          valor={desglose.mercadopago} porcentaje={pct(desglose.mercadopago)} />
        {desglose.tarjeta > 0 && (
          <Fila color="text-blue-400" etiqueta="Tarjeta"
            valor={desglose.tarjeta} porcentaje={pct(desglose.tarjeta)} />
        )}
      </dl>

      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700 mt-3" aria-hidden="true">
          <div className="bg-green-500" style={{ width: `${(desglose.efectivo / total) * 100}%` }} />
          <div className="bg-cyan-500"  style={{ width: `${(desglose.mercadopago / total) * 100}%` }} />
          <div className="bg-blue-500"  style={{ width: `${(desglose.tarjeta / total) * 100}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
        <span className="text-sm font-semibold text-slate-300">📊 {totalEtiqueta}</span>
        <span className={`font-bold font-mono text-white ${destacado ? 'text-2xl' : 'text-xl'}`}>{plata(total)}</span>
      </div>
    </section>
  )
}

function Fila({ etiqueta, valor, porcentaje, color }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-slate-300 min-w-0">{etiqueta}</dt>
      <dd className="shrink-0 text-right leading-tight">
        <span className={`block font-mono font-semibold ${color}`}>{plata(valor)}</span>
        <span className="block text-xs text-slate-500">{porcentaje}%</span>
      </dd>
    </div>
  )
}

// ── Un turno ──
function TarjetaTurno({ turno: t }) {
  const [abierto, setAbierto] = useState(false)
  const info = TURNO_POR_ID[t.tipo] || { icono: '🗓️', label: t.tipo }
  const desde = hora(t.inicio)
  const hasta = hora(t.cierre)

  return (
    <article className="bg-slate-800/50 border border-slate-700/40 rounded-2xl overflow-hidden">
      <header className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-700/60 flex items-center justify-center text-lg" aria-hidden="true">
            {info.icono}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold leading-tight">
              Turno {info.label.toLowerCase()} <span className="text-slate-500 text-xs font-normal">{t.horario && `${t.horario} hs`}</span>
            </p>
            <p className="text-slate-400 text-xs truncate">{t.usuario} · {desde}{hasta ? ` → ${hasta}` : ''}</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
          t.cerrado ? 'bg-slate-700 text-slate-300' : 'bg-amber-900/50 text-amber-400'
        }`}>
          {t.cerrado ? 'Cerrado' : 'En curso'}
        </span>
      </header>

      <div className="p-2">
        <Totales
          titulo="Cobrado por medio de pago"
          subtitulo={`${t.cantidad_ventas} venta${t.cantidad_ventas === 1 ? '' : 's'}`}
          desglose={t.desglose}
          totalEtiqueta="Total acumulado del turno"
        />
      </div>

      <button onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        className="w-full flex items-center justify-center gap-1.5 min-h-[2.75rem] text-xs text-indigo-400 hover:text-indigo-300 border-t border-slate-700/40 transition-colors">
        {abierto
          ? <><ChevronUpIcon className="w-4 h-4" /> Ocultar control de caja</>
          : <><ChevronDownIcon className="w-4 h-4" /> Control de caja y productos</>}
      </button>

      {abierto && (
        <div className="border-t border-slate-700/40 bg-slate-900/40 p-4 space-y-4">
          <div className="space-y-1.5 text-sm">
            <DatoCaja etiqueta="Caja al abrir" valor={plata(t.monto_apertura)} />
            <DatoCaja etiqueta="+ Efectivo cobrado" valor={plata(t.desglose.efectivo)} />
            <DatoCaja etiqueta="Efectivo esperado" valor={plata(t.efectivo_esperado)} fuerte />
            {t.cerrado && <DatoCaja etiqueta="Efectivo contado al cerrar" valor={plata(t.monto_cierre)} />}
            {t.diferencia != null && (
              <DatoCaja etiqueta="Diferencia"
                valor={`${t.diferencia > 0 ? '+' : ''}${plata(t.diferencia)}`}
                clase={t.diferencia === 0 ? 'text-green-400' : t.diferencia > 0 ? 'text-amber-400' : 'text-red-400'} />
            )}
          </div>

          {t.resumen_productos.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Productos vendidos</p>
              <ul className="divide-y divide-slate-700/30">
                {t.resumen_productos.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-white truncate min-w-0">{p.nombre}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      x{p.cantidad} · <span className="text-indigo-400 font-mono font-semibold">{plata(p.subtotal)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center">Este turno no registró ventas.</p>
          )}
        </div>
      )}
    </article>
  )
}

function DatoCaja({ etiqueta, valor, fuerte = false, clase = 'text-white' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={fuerte ? 'text-slate-200 font-medium' : 'text-slate-400'}>{etiqueta}</span>
      <span className={`font-mono ${fuerte ? 'font-semibold' : ''} ${clase}`}>{valor}</span>
    </div>
  )
}
