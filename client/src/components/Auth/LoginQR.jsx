// client/src/components/Auth/LoginQR.jsx
// Pantalla de vinculación por código QR y acceso directo para dispositivos móviles
import React, { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

// ── Genera un token QR único ───────────────────────────────────────────────
const generateToken = () =>
  `wa-pro-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

// ── Perfiles predeterminados para pruebas multi-móvil ─────────────────────
const PRESET_USERS = [
  {
    id: 'agent-me',
    name: 'Juan Carlos',
    role: 'Super Admin / Coordinador',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    color: '#00a884',
    badge: '👑 Admin'
  },
  {
    id: 'agent-andre',
    name: 'Andre',
    role: 'Soporte Técnico / Móvil 1',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andre&backgroundColor=d1d4f9',
    color: '#3b82f6',
    badge: '📱 Móvil 1'
  },
  {
    id: 'agent-daniella',
    name: 'Daniella Rivera',
    role: 'Ventas Enterprise / Móvil 2',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniella&backgroundColor=ffd5dc',
    color: '#ec4899',
    badge: '📱 Móvil 2'
  },
  {
    id: 'agent-carolina',
    name: 'Carolina',
    role: 'Logística / Móvil 3',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carolina&backgroundColor=b6e3f4',
    color: '#10b981',
    badge: '📱 Móvil 3'
  },
  {
    id: 'agent-hilda',
    name: 'Hilda',
    role: 'Finanzas / Móvil 4',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hilda&backgroundColor=c0aede',
    color: '#8b5cf6',
    badge: '📱 Móvil 4'
  }
]

// ── Iconos ─────────────────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 flex-shrink-0">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
    <circle cx="12" cy="5"  r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
  </svg>
)
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 flex-shrink-0">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)
const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 flex-shrink-0">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const STEPS = [
  { icon: PhoneIcon, text: 'Abre CHASKYAPP o el navegador en tu teléfono' },
  { icon: MenuIcon,  text: 'Toca Menú (⋮) en Android o Compartir (⎋) en iPhone' },
  { icon: LinkIcon,  text: 'Selecciona "Agregar a pantalla principal" para instalar' },
  { icon: ScanIcon,  text: 'Apunta con tu cámara para sincronizar o entra directo abajo' },
]

function Spinner({ size = 48, color = '#00a884' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" className="animate-spin">
      <circle cx="25" cy="25" r="20" fill="none" stroke={color}
        strokeWidth="4" strokeDasharray="80 40" strokeLinecap="round"/>
    </svg>
  )
}

function QRCanvas({ token, isDark }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !token) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: 200,
      margin: 2,
      color: {
        dark:  isDark ? '#e9edef' : '#111b21',
        light: isDark ? '#202c33' : '#ffffff',
      },
      errorCorrectionLevel: 'M',
    }).catch(console.error)
  }, [token, isDark])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export default function LoginQR() {
  const { login, theme, setCurrentUser } = useAppStore()
  const isDark = theme === 'dark'

  // Tab activo: 'mobile' (Acceso móvil directo) o 'qr' (Vincular con QR)
  const [tab, setTab] = useState('mobile')
  const [selectedUser, setSelectedUser] = useState(PRESET_USERS[0])
  const [customName, setCustomName] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)

  const [phase, setPhase]     = useState('loading')
  const [token, setToken]     = useState('')
  const [countdown, setCountdown] = useState(30)
  const countdownRef = useRef(null)
  const autoScanRef  = useRef(null)

  // ── Genera nuevo QR ──────────────────────────────────────────────────────
  const generateQR = useCallback(() => {
    setPhase('loading')
    setToken('')
    clearInterval(countdownRef.current)
    clearTimeout(autoScanRef.current)

    setTimeout(() => {
      setToken(generateToken())
      setCountdown(30)
      setPhase('ready')

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current)
            setPhase('loading')
            setTimeout(generateQR, 400)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      autoScanRef.current = setTimeout(() => simulateScan(), 10000)
    }, 600)
  }, [])

  useEffect(() => {
    generateQR()
    return () => {
      clearInterval(countdownRef.current)
      clearTimeout(autoScanRef.current)
    }
  }, [generateQR])

  const simulateScan = useCallback(() => {
    clearInterval(countdownRef.current)
    clearTimeout(autoScanRef.current)
    setPhase('scanning')

    setTimeout(() => {
      setPhase('linking')
      setTimeout(() => {
        setPhase('success')
        setTimeout(() => {
          setCurrentUser(selectedUser)
          login()
        }, 900)
      }, 1200)
    }, 1000)
  }, [login, setCurrentUser, selectedUser])

  // Login directo con un perfil
  const handleDirectLogin = (user) => {
    const target = user || selectedUser
    setCurrentUser(target)
    login()
  }

  const handleCustomLogin = (e) => {
    e.preventDefault()
    if (!customName.trim()) return
    const customUser = {
      id: 'agent-' + customName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: customName.trim(),
      role: 'Miembro de Red Móvil',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customName)}`,
      color: '#00a884',
      badge: '📱 Celular'
    }
    setCurrentUser(customUser)
    login()
  }

  // Colores adaptativos
  const bg          = isDark ? 'bg-[#111b21]'  : 'bg-[#f0f2f5]'
  const cardBg      = isDark ? 'bg-[#202c33]'  : 'bg-white'
  const textPrimary = isDark ? 'text-[#e9edef]' : 'text-[#111b21]'
  const textSub     = isDark ? 'text-[#8696a0]' : 'text-[#54656f]'
  const divider     = isDark ? 'border-[#2a3942]' : 'border-[#e9edef]'
  const stepNumBg   = isDark ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-[#00a884]/10 text-[#008069]'
  const qrBg        = isDark ? 'bg-[#111b21]'  : 'bg-white'
  const qrBorder    = isDark ? 'ring-1 ring-[#2a3942]' : 'ring-1 ring-[#e9edef]'

  return (
    <div className={`min-h-screen w-screen flex flex-col ${bg} transition-colors duration-300`}>

      {/* ── Header verde corporativo ─────────────────────────────────── */}
      <div
        className="h-[180px] sm:h-[210px] flex-shrink-0 flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)' }}
      >
        <div className="flex items-center gap-3.5 max-w-xl w-full justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl flex-shrink-0 border border-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md">
              CHASKYAPP
            </h1>
            <p className="text-white/80 text-xs sm:text-sm font-medium tracking-wide">
              Red Privada de Comunicación Multi-Operador
            </p>
          </div>
        </div>
      </div>

      {/* ── Tarjeta central ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-3 sm:px-6 pb-8 -mt-8 sm:-mt-10">
        <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-white/10`}>

          {/* Selector de modo (Pestañas) */}
          <div className="flex border-b border-[#2a3942]/40 bg-black/10">
            <button
              onClick={() => setTab('mobile')}
              className={`flex-1 py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
                tab === 'mobile'
                  ? 'border-[#00a884] text-[#00a884] bg-[#00a884]/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>📱</span>
              <span>Acceso Móvil / Multi-Operador</span>
              <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold">
                Recomendado
              </span>
            </button>
            <button
              onClick={() => setTab('qr')}
              className={`flex-1 py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
                tab === 'qr'
                  ? 'border-[#00a884] text-[#00a884] bg-[#00a884]/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>💻</span>
              <span>Vincular por QR (WhatsApp Web)</span>
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              MODO 1: ACCESO DIRECTO MÓVIL (Claro, Movistar, Entel, Bitel)
             ═══════════════════════════════════════════════════════════════ */}
          {tab === 'mobile' ? (
            <div className="p-5 sm:p-8 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🌐</span>
                  <h2 className={`text-lg sm:text-xl font-bold ${textPrimary}`}>
                    Elige tu Perfil para este Teléfono
                  </h2>
                </div>
                <p className={`text-xs sm:text-sm ${textSub}`}>
                  Conéctate directamente sin escanear. Funciona en cualquier celular con datos móviles (Claro, Movistar, Entel, Bitel) o Wi-Fi.
                </p>
              </div>

              {/* Selector visual de usuarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_USERS.map((user) => {
                  const isSelected = !isCustomMode && selectedUser.id === user.id
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user)
                        setIsCustomMode(false)
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#00a884] bg-[#00a884]/15 ring-2 ring-[#00a884]/40 shadow-md'
                          : 'border-gray-700/50 hover:border-gray-600 hover:bg-white/5'
                      }`}
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-[#00a884]/30" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full ${getAvatarGradient(user.name)} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                          {getInitials(user.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`font-bold text-sm truncate ${isSelected ? 'text-[#00a884]' : textPrimary}`}>
                            {user.name}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-semibold flex-shrink-0">
                            {user.badge}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${textSub}`}>
                          {user.role}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Opción para escribir nombre personalizado */}
              <div className={`p-4 rounded-xl border ${divider} bg-black/10`}>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-semibold ${textPrimary} flex items-center gap-1.5`}>
                    <span>✍️</span> ¿Otro usuario o invitado? Escribe tu nombre:
                  </label>
                </div>
                <form onSubmit={handleCustomLogin} className="flex gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value)
                      setIsCustomMode(true)
                    }}
                    placeholder="Ej. Andre Móvil 2 (Claro)"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-black/20 border border-gray-600 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00a884]"
                  />
                  <button
                    type="submit"
                    disabled={!customName.trim()}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-all shadow"
                  >
                    Usar este Nombre
                  </button>
                </form>
              </div>

              {/* Botón principal de entrada */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleDirectLogin()}
                  className="w-full py-4 rounded-xl font-bold text-base text-white shadow-xl flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)' }}
                >
                  <span>🚀</span>
                  <span>
                    Entrar a CHASKYAPP como {isCustomMode && customName ? customName : selectedUser.name}
                  </span>
                </button>
              </div>

              {/* Banner de instalación PWA paso a paso */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">📲</span>
                <div className="text-xs text-gray-300 leading-relaxed">
                  <strong className="text-emerald-400 block mb-0.5">
                    ¿Quieres tener el icono en la pantalla de tu celular?
                  </strong>
                  En Android Chrome pulsa <strong>Menú (⋮) &gt; "Agregar a la pantalla principal"</strong> o "Instalar". En iPhone Safari pulsa <strong>Compartir (⎋) &gt; "Agregar a pantalla de inicio"</strong>.
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
                MODO 2: VINCULACIÓN POR CÓDIGO QR (Desktop / WhatsApp Web)
               ═══════════════════════════════════════════════════════════════ */
            <div className={`flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x ${divider}`}>
              {/* Columna izquierda: instrucciones */}
              <div className="flex-1 p-6 sm:p-8">
                <h2 className={`text-xl font-semibold mb-1 ${textPrimary}`}>
                  Acceso a la Suite CHASKYAPP
                </h2>
                <p className={`text-sm mb-6 ${textSub}`}>
                  Vincula tu sesión omnicanal y gestiona conversaciones en tiempo real.
                </p>

                <ol className="space-y-4">
                  {STEPS.map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-start gap-3.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${stepNumBg}`}>
                        {i + 1}
                      </div>
                      <div className="flex items-start gap-2.5 pt-0.5">
                        <Icon />
                        <span className={`text-xs sm:text-sm leading-relaxed ${textSub}`}>{text}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className={`mt-6 pt-5 border-t ${divider}`}>
                  <p className={`text-xs ${textSub}`}>
                    ¿Estás probando en un solo equipo?{' '}
                    <button
                      onClick={simulateScan}
                      className="text-[#00a884] hover:underline font-bold"
                    >
                      Haz clic aquí para simular escaneo instantáneo
                    </button>
                  </p>
                </div>
              </div>

              {/* Columna derecha: QR Canvas */}
              <div className="flex-shrink-0 p-6 sm:p-8 flex flex-col items-center justify-center gap-4">
                <p className={`text-xs font-semibold text-center uppercase tracking-wider ${textSub}`}>
                  Escanea con tu Cámara
                </p>

                <div className={`relative p-3 rounded-2xl ${qrBg} ${qrBorder} shadow-inner`}>
                  {['top-2 left-2', 'top-2 right-2 rotate-90', 'bottom-2 left-2 -rotate-90', 'bottom-2 right-2 rotate-180'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-5 h-5 border-[#00a884]`}
                      style={{ borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '3px 0 0 0' }} />
                  ))}

                  <div className="w-[190px] h-[190px] flex items-center justify-center">
                    {phase === 'loading' && (
                      <div className="flex flex-col items-center gap-3">
                        <Spinner size={44} />
                        <p className={`text-xs ${textSub}`}>Generando QR…</p>
                      </div>
                    )}

                    {phase === 'ready' && token && (
                      <div
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={simulateScan}
                        title="Haz clic para simular escaneo"
                      >
                        <QRCanvas token={token} isDark={isDark} />
                      </div>
                    )}

                    {(phase === 'scanning' || phase === 'linking') && (
                      <div className="flex flex-col items-center gap-3">
                        <Spinner size={44} color="#00a884" />
                        <p className="text-[#00a884] text-xs font-medium animate-pulse">
                          {phase === 'scanning' ? 'Código detectado…' : 'Vinculando dispositivo…'}
                        </p>
                      </div>
                    )}

                    {phase === 'success' && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-[#00a884]/20 flex items-center justify-center ring-4 ring-[#00a884]/30 animate-pulse">
                          <span className="text-[#00a884]"><CheckIcon /></span>
                        </div>
                        <p className="text-[#00a884] text-xs font-semibold">¡Vinculado con éxito!</p>
                      </div>
                    )}
                  </div>
                </div>

                {phase === 'ready' && (
                  <div className="flex flex-col items-center gap-1.5">
                    <p className={`text-xs ${textSub}`}>
                      Expira en{' '}
                      <span className={`font-mono font-semibold ${countdown <= 10 ? 'text-orange-400' : 'text-[#00a884]'}`}>
                        {countdown}s
                      </span>
                    </p>
                    <button
                      onClick={generateQR}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                        isDark ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-600 hover:text-emerald-600'
                      }`}
                    >
                      <RefreshIcon /> Actualizar código
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer de seguridad */}
          <div className={`px-6 py-3 border-t ${divider} flex items-center justify-between text-[11px] ${textSub}`}>
            <span>🔒 Conexión Cifrada WebRTC &amp; WSS</span>
            <span className="text-emerald-500 font-medium">CHASKYAPP Suite 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
