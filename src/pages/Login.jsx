import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ username: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 100)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Completá usuario y contraseña'); return }
    setLoading(true); setError('')
    try {
      const user = await login(form.username, form.password)
      navigate(user.rol === 'vendedor' ? '/caja' : '/reportes', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#080808' }}>

      {/* ── Panel izquierdo — decorativo ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative overflow-hidden"
        style={{ background: '#0d0d0d' }}
      >
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(232,255,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(232,255,0,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        {/* Glow circles animados */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(232,255,0,0.08), transparent 65%)',
          animation: 'pulse-slow 4s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(232,255,0,0.05), transparent 65%)',
          animation: 'pulse-slow 6s ease-in-out infinite reverse'
        }} />

        {/* Barra amarilla izquierda */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#e8ff00' }} />

        {/* Logo arriba */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '2rem', letterSpacing: '0.08em',
            color: '#f5f5f0'
          }}>
            KIOSCO<span style={{ color: '#e8ff00' }}>POS</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(245,245,240,0.3)', marginTop: '4px', letterSpacing: '0.1em' }}>
            Sistema de punto de venta
          </div>
        </div>

        {/* Texto central grande */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '5.5rem', lineHeight: '0.88',
            letterSpacing: '0.01em', marginBottom: '24px'
          }}>
            <div style={{ color: '#f5f5f0' }}>TU KIOSCO</div>
            <div style={{ color: '#e8ff00' }}>SIEMPRE</div>
            <div style={{
              color: 'transparent',
              WebkitTextStroke: '2px #f5f5f0'
            }}>EN CONTROL</div>
          </div>
          <div style={{
            fontSize: '1rem', fontWeight: 300,
            color: 'rgba(245,245,240,0.35)',
            lineHeight: 1.6, maxWidth: '380px'
          }}>
            Stock, ventas y caja en un solo lugar. Desde cualquier dispositivo, en cualquier momento.
          </div>
        </div>

        {/* Stats abajo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '40px' }}>
          {[
            { n: '100%', l: 'Sin internet OK' },
            { n: '24hs', l: 'Alertas de stock' },
            { n: '∞', l: 'Productos' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: '2rem', color: '#e8ff00', lineHeight: 1
              }}>{s.n}</div>
              <div style={{
                fontSize: '0.7rem', fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.25)', marginTop: '4px'
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">

        {/* Glow center */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(232,255,0,0.05), transparent 65%)',
          pointerEvents: 'none'
        }} />

        {/* Card formulario */}
        <div
          style={{
            width: '100%', maxWidth: '400px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '40px',
            backdropFilter: 'blur(20px)',
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            opacity: mounted ? 1 : 0,
            transition: 'all 0.6s ease',
            position: 'relative', zIndex: 1
          }}
        >
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: '2rem', letterSpacing: '0.08em', color: '#f5f5f0'
            }}>
              KIOSCO<span style={{ color: '#e8ff00' }}>POS</span>
            </div>
          </div>

          {/* Título */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(232,255,0,0.6)', marginBottom: '8px'
            }}>Bienvenido de vuelta</div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: '2.5rem', color: '#f5f5f0', lineHeight: 1
            }}>INGRESÁ A TU<br /><span style={{ color: '#e8ff00' }}>SISTEMA</span></div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block', fontSize: '0.72rem', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.4)', marginBottom: '8px'
              }}>Usuario</label>
              <input
                className="w-full"
                placeholder="tu_usuario"
                value={form.username}
                autoComplete="username"
                onChange={e => setForm({ ...form, username: e.target.value })}
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '12px 16px',
                  color: '#f5f5f0', fontSize: '0.95rem',
                  outline: 'none', width: '100%',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#e8ff00'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '0.72rem', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.4)', marginBottom: '8px'
              }}>Contraseña</label>
              <input
                type="password"
                className="w-full"
                placeholder="••••••••"
                value={form.password}
                autoComplete="current-password"
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '12px 16px',
                  color: '#f5f5f0', fontSize: '0.95rem',
                  outline: 'none', width: '100%',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#e8ff00'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,60,60,0.1)',
                border: '1px solid rgba(255,60,60,0.3)',
                color: 'rgba(255,120,120,0.9)',
                fontSize: '0.82rem', borderRadius: '8px',
                padding: '10px 14px'
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'rgba(232,255,0,0.5)' : '#e8ff00',
                color: '#080808', fontWeight: 800,
                fontSize: '0.85rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '14px',
                borderRadius: '8px', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', marginTop: '8px',
                width: '100%'
              }}
            >
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>

          {/* Hint */}
          <div style={{
            marginTop: '20px', textAlign: 'center',
            fontSize: '0.72rem', color: 'rgba(245,245,240,0.2)'
          }}>
            Primera vez: admin / admin123
          </div>
        </div>

        {/* Footer FMCODE */}
        <div style={{
          position: 'absolute', bottom: '24px',
          display: 'flex', alignItems: 'center', gap: '8px',
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.8s ease 0.3s'
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 400,
            color: 'rgba(245,245,240,0.2)',
            letterSpacing: '0.08em'
          }}>Desarrollado por</div>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '1rem', letterSpacing: '0.06em',
            color: 'rgba(245,245,240,0.35)'
          }}>FM<span style={{ color: 'rgba(232,255,0,0.5)' }}>CODE</span></div>
        </div>
      </div>

      {/* Estilos globales para animaciones */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        input::placeholder { color: rgba(245,245,240,0.2); }
      `}</style>
    </div>
  )
}
