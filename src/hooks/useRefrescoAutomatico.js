import { useEffect, useRef } from 'react'

/**
 * Ejecuta `fn` cada `cadaMs` mientras la pestaña está visible y también apenas el usuario vuelve
 * a la app (celular desbloqueado, cambio de pestaña, PC que estuvo en reposo). Así el stock y los
 * turnos que se modificaron desde otro dispositivo se ven sin tener que recargar a mano.
 */
export function useRefrescoAutomatico(fn, { activo = true, cadaMs = 60000 } = {}) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!activo) return
    const refrescar = () => {
      if (document.visibilityState === 'visible') fnRef.current()
    }
    const intervalo = setInterval(refrescar, cadaMs)
    document.addEventListener('visibilitychange', refrescar)
    window.addEventListener('focus', refrescar)
    window.addEventListener('online', refrescar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', refrescar)
      window.removeEventListener('focus', refrescar)
      window.removeEventListener('online', refrescar)
    }
  }, [activo, cadaMs])
}
