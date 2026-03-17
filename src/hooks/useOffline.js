import { useState, useEffect } from 'react'
import { sincronizarCola, contarPendientes } from '../api'

export function useOffline() {
  const [offline, setOffline]       = useState(!navigator.onLine)
  const [pendientes, setPendientes] = useState(contarPendientes())
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = async () => {
      setOffline(false)
      if (contarPendientes() > 0) {
        setSincronizando(true)
        await sincronizarCola()
        setPendientes(contarPendientes())
        setSincronizando(false)
      }
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return { offline, pendientes, sincronizando }
}
