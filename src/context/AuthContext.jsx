import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { startKeepAlive, stopKeepAlive } from '../api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Trae rol / permisos actuales del servidor. La sesión de cada dispositivo es independiente
  // (cada uno tiene su propio token), pero los permisos viven en la base: si el dueño aprobó el
  // acceso al stock desde otro dispositivo, el usuario guardado acá quedaría desactualizado.
  // Un fallo de red se ignora; un 401 lo maneja el interceptor de api.js.
  const sincronizarUsuario = useCallback(async () => {
    if (!localStorage.getItem('token')) return
    try {
      const res = await api.get('/me')
      localStorage.setItem('usuario', JSON.stringify(res.data))
      setUser(res.data)
    } catch { /* sin conexión: se mantiene el usuario guardado */ }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('usuario')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
        startKeepAlive()
        sincronizarUsuario()
      } catch {
        localStorage.removeItem('usuario')
      }
    }
    setLoading(false)
  }, [sincronizarUsuario])

  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') sincronizarUsuario() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [sincronizarUsuario])

  const login = async (username, password) => {
    const form = new FormData()
    // El servidor ya compara sin mayúsculas/espacios, pero se recorta también acá por si algo
    // más (un script, un login automatizado) llama a esta función directamente.
    form.append('username', (username || '').trim())
    form.append('password', password)
    const res = await api.post('/login', form)
    localStorage.setItem('token', res.data.access_token)
    localStorage.setItem('usuario', JSON.stringify(res.data.usuario))
    setUser(res.data.usuario)
    startKeepAlive()
    return res.data.usuario
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUser(null)
    stopKeepAlive()
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
