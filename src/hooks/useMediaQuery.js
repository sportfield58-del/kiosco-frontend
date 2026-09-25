import { useState, useEffect } from 'react'

/** true mientras la ventana cumple la media query (se actualiza al rotar el celular o redimensionar). */
export function useMediaQuery(query) {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const alCambiar = (e) => setCoincide(e.matches)
    setCoincide(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [query])

  return coincide
}
