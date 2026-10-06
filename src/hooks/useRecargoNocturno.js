import { useState, useEffect } from 'react'
import api from '../api'

// Misma regla que el backend (ventas.py → aplicar_recargo_nocturno): +10% de 22:00 a 06:00, hora argentina.
const AR_OFFSET_MS = -3 * 60 * 60 * 1000
const esNocturno = (utcMs) => {
  const h = new Date(utcMs + AR_OFFSET_MS).getUTCHours()
  return h >= 22 || h < 6
}

// Diferencia entre el reloj del servidor y el del dispositivo (por si el celular tiene mal la hora).
let desfaseMs = 0
async function sincronizarReloj() {
  try {
    const t0 = Date.now()
    const res = await api.get('/ping')   // /ping no pasa por la caché del service worker
    const t1 = Date.now()
    const servidor = Date.parse(`${res.data.timestamp}Z`)
    if (!Number.isNaN(servidor)) desfaseMs = servidor - (t0 + t1) / 2
  } catch { /* sin conexión: se usa el reloj del dispositivo */ }
}

/**
 * Si la tarifa nocturna está activa ahora. Se calcula en el dispositivo (no depende de la red ni de
 * la caché), se reevalúa cada 15 s y apenas se vuelve a la app, así a las 22:00 en punto la pantalla
 * ya muestra el mismo total que va a registrar el servidor.
 */
export function useRecargoNocturno() {
  const calcular = () => esNocturno(Date.now() + desfaseMs)
  const [activo, setActivo] = useState(calcular)

  useEffect(() => {
    const actualizar = () => setActivo(calcular())
    sincronizarReloj().then(actualizar)
    const tick = setInterval(actualizar, 15000)
    const resync = setInterval(() => sincronizarReloj().then(actualizar), 30 * 60 * 1000)
    const alVolver = () => { if (document.visibilityState === 'visible') actualizar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      clearInterval(tick); clearInterval(resync)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])

  return activo
}
