// client/src/components/Auth/LoginQR.jsx
// Pantalla de vinculación por código QR — estilo WhatsApp Web
import React, { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import useAppStore from '../../store/useAppStore'

// ── Genera un token QR único ───────────────────────────────────────────────
const generateToken = () =>
  `wa-pro-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

// ── Iconos ─────────────────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    className="w-6 h-6 flex-shrink-0">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0">
    <circle cx="12" cy="5"  r="1.5"/><circle cx="12" cy="12" r="1.5"/>
    <circle cx="12" cy="19" r="1.5"/>
  </svg>
)
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    className="w-6 h-6 flex-shrink-0">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)
const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    className="w-6 h-6 flex-shrink-0">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    className="w-4 h-4">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className="w-10 h-10">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ── Pasos de instrucciones ─────────────────────────────────────────────────
const STEPS = [
  { icon: PhoneIcon, text: 'Abre CHASKYAPP o WhatsApp Business en tu teléfono' },
  { icon: MenuIcon,  text: 'Toca Menú en Android o Configuración en iPhone' },
  { icon: LinkIcon,  text: 'Selecciona Dispositivos vinculados y luego Vincular dispositivo' },
  { icon: ScanIcon,  text: 'Apunta tu teléfono hacia esta pantalla para sincronizar tu sesión' },
]

// ── Spinner animado ────────────────────────────────────────────────────────
function Spinner({ size = 48, color = '#00a884' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" className="animate-spin">
      <circle cx="25" cy="25" r="20" fill="none" stroke={color}
        strokeWidth="4" strokeDasharray="80 40" strokeLinecap="round"/>
    </svg>
  )
}

// ── Componente QR canvas ───────────────────────────────────────────────────
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

// ── Componente principal ───────────────────────────────────────────────────
export default function LoginQR() {
  const { login, theme } = useAppStore()
  const isDark = theme === 'dark'

  const [phase, setPhase]     = useState('loading')   // 'loading'|'ready'|'scanning'|'linking'|'success'
  const [token, setToken]     = useState('')
  const [countdown, setCountdown] = useState(30)       // QR expira en 30 s
  const countdownRef = useRef(null)
  const autoScanRef  = useRef(null)

  // ── Genera nuevo QR ──────────────────────────────────────────────────────
  const generateQR = useCallback(() => {
    setPhase('loading')
    setToken('')
    clearInterval(countdownRef.current)
    clearTimeout(autoScanRef.current)

    // Simula latencia de servidor (~800 ms)
    setTimeout(() => {
      setToken(generateToken())
      setCountdown(30)
      setPhase('ready')

      // Countdown de expiración
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

      // Auto-escaneo a los 8 s (simulación)
      autoScanRef.current = setTimeout(() => simulateScan(), 8000)
    }, 800)
  }, [])

  useEffect(() => { generateQR(); return () => { clearInterval(countdownRef.current); clearTimeout(autoScanRef.current) } }, [])

  // ── Simula el escaneo ────────────────────────────────────────────────────
  const simulateScan = useCallback(() => {
    clearInterval(countdownRef.current)
    clearTimeout(autoScanRef.current)
    setPhase('scanning')

    setTimeout(() => {
      setPhase('linking')
      setTimeout(() => {
        setPhase('success')
        setTimeout(() => login(), 1000)
      }, 1500)
    }, 1200)
  }, [login])

  // ── Colores adaptativos ──────────────────────────────────────────────────
  const bg         = isDark ? 'bg-[#111b21]'  : 'bg-[#f0f2f5]'
  const cardBg     = isDark ? 'bg-[#202c33]'  : 'bg-white'
  const textPrimary = isDark ? 'text-[#e9edef]' : 'text-[#111b21]'
  const textSub    = isDark ? 'text-[#8696a0]' : 'text-[#54656f]'
  const divider    = isDark ? 'border-[#2a3942]' : 'border-[#e9edef]'
  const stepNumBg  = isDark ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-[#00a884]/10 text-[#008069]'
  const qrBg       = isDark ? 'bg-[#111b21]'  : 'bg-white'
  const qrBorder   = isDark ? 'ring-1 ring-[#2a3942]' : 'ring-1 ring-[#e9edef]'

  return (
    <div className={`min-h-screen w-screen flex flex-col ${bg} transition-colors duration-300`}>

      {/* ── Header verde ─────────────────────────────────────────────── */}
      <div
        className="h-[220px] flex-shrink-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white drop-shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-2xl font-semibold tracking-tight drop-shadow">CHASKYAPP</h1>
            <p className="text-white/70 text-xs tracking-wider">SUITE EMPRESARIAL</p>
          </div>
        </div>
      </div>

      {/* ── Tarjeta central ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 pb-8 -mt-6">
        <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden`}>

          {/* Franja verde superior */}
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #00a884, #008069, #00a884)' }} />

          <div className={`flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x ${divider}`}>

            {/* ── Columna izquierda: instrucciones ─────────────────── */}
            <div className="flex-1 p-8">
              <h2 className={`text-xl font-semibold mb-1 ${textPrimary}`}>
                Acceso a la Suite CHASKYAPP
              </h2>
              <p className={`text-sm mb-7 ${textSub}`}>
                Vincula tu sesión omnicanal y gestiona conversaciones de WhatsApp, Telegram y Web en tiempo real.
              </p>

              <ol className="space-y-5">
                {STEPS.map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${stepNumBg}`}>
                      {i + 1}
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <Icon />
                      <span className={`text-sm leading-relaxed ${textSub}`}>{text}</span>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Separador + enlace de ayuda */}
              <div className={`mt-8 pt-6 border-t ${divider}`}>
                <p className={`text-xs ${textSub}`}>
                  ¿Necesitas ayuda?{' '}
                  <span className="text-[#00a884] hover:underline cursor-pointer font-medium">
                    Visita nuestro centro de asistencia
                  </span>
                </p>
              </div>
            </div>

            {/* ── Columna derecha: QR ──────────────────────────────── */}
            <div className="flex-shrink-0 p-8 flex flex-col items-center justify-center gap-5">
              <p className={`text-sm font-medium text-center ${textSub}`}>
                Escanea el código QR
              </p>

              {/* Contenedor QR con esquinas decorativas */}
              <div className={`relative p-3 rounded-2xl ${qrBg} ${qrBorder} shadow-inner`}>
                {/* Esquinas decorativas estilo WhatsApp */}
                {['top-2 left-2', 'top-2 right-2 rotate-90', 'bottom-2 left-2 -rotate-90', 'bottom-2 right-2 rotate-180'].map((pos, i) => (
                  <div key={i} className={`absolute ${pos} w-5 h-5 border-[#00a884]`}
                    style={{ borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '3px 0 0 0' }} />
                ))}

                {/* Estados del QR */}
                <div className="w-[200px] h-[200px] flex items-center justify-center">
                  {phase === 'loading' && (
                    <div className="flex flex-col items-center gap-3">
                      <Spinner size={48} />
                      <p className={`text-xs ${textSub}`}>Generando código…</p>
                    </div>
                  )}

                  {phase === 'ready' && token && (
                    <div
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={simulateScan}
                      title="Haz clic para simular el escaneo"
                    >
                      <QRCanvas token={token} isDark={isDark} />
                    </div>
                  )}

                  {(phase === 'scanning' || phase === 'linking') && (
                    <div className="flex flex-col items-center gap-3">
                      <Spinner size={48} color="#00a884" />
                      <p className="text-[#00a884] text-sm font-medium animate-pulse">
                        {phase === 'scanning' ? 'Código detectado…' : 'Vinculando dispositivo…'}
                      </p>
                    </div>
                  )}

                  {phase === 'success' && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[#00a884]/20 flex items-center justify-center ring-4 ring-[#00a884]/30 animate-pulse">
                        <span className="text-[#00a884]"><CheckIcon /></span>
                      </div>
                      <p className="text-[#00a884] text-sm font-semibold">¡Vinculado!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Countdown + botón refresh (solo cuando QR visible) */}
              {phase === 'ready' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                    <p className={`text-xs ${textSub}`}>
                      El código expira en{' '}
                      <span className={`font-mono font-semibold ${countdown <= 10 ? 'text-orange-400' : 'text-[#00a884]'}`}>
                        {countdown}s
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={generateQR}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                      ${isDark
                        ? 'text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10'
                        : 'text-[#54656f] hover:text-[#008069] hover:bg-[#008069]/10'
                      }`}
                  >
                    <RefreshIcon /> Actualizar código
                  </button>
                </div>
              )}

              {/* Hint de simulación */}
              {phase === 'ready' && (
                <p className={`text-[10px] text-center max-w-[200px] leading-relaxed ${textSub} opacity-60`}>
                  Haz clic en el QR para simular el escaneo automáticamente
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={`px-8 py-3 border-t ${divider} flex items-center justify-center`}>
            <p className={`text-[11px] ${textSub}`}>
              🔒 Conexión cifrada de extremo a extremo &nbsp;·&nbsp; CHASKYAPP Suite Empresarial
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
