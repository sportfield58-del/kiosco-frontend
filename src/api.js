import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Cache del service worker (ver vite.config.js). Tras cualquier escritura se descarta para que
// la próxima lectura de productos/turnos/ventas venga siempre fresca del servidor.
const SW_API_CACHE = 'api-cache'

export async function invalidarCacheApi() {
  try {
    if ('caches' in window) await caches.delete(SW_API_CACHE)
  } catch { /* sin Cache API: nada que invalidar */ }
}

const ES_ESCRITURA = m => ['post', 'put', 'patch', 'delete'].includes((m || '').toLowerCase())

api.interceptors.response.use(
  res => {
    if (ES_ESCRITURA(res.config?.method)) invalidarCacheApi()
    return res
  },
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Cola offline ──────────────────────────────────────────
const QUEUE_KEY = 'offline_queue'

export function encolarOffline(request) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  queue.push({ ...request, ts: Date.now() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function sincronizarCola() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  if (!queue.length) return 0

  const pendientes = []
  let sincronizados = 0

  for (const req of queue) {
    try {
      await api({ method: req.method, url: req.url, data: req.data })
      sincronizados++
    } catch {
      pendientes.push(req)
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(pendientes))
  return sincronizados
}

export function contarPendientes() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length
}

/** Mensaje legible para mostrar al usuario a partir de un error de axios. */
export function mensajeError(e, porDefecto = 'Error inesperado') {
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg   // errores 422 de FastAPI
  if (!e?.response) return 'Sin conexión con el servidor. No se guardó nada, reintentá.'
  return porDefecto
}

// ── Keep-alive ─────────────────────────────────────────────
let keepAliveInterval = null

export function startKeepAlive() {
  stopKeepAlive()
  keepAliveInterval = setInterval(async () => {
    try { await api.get('/ping') } catch { /* silencioso */ }
  }, 4 * 60 * 1000)
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

export default api
