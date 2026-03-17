import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 8000 })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
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

export default api
