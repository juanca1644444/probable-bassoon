// CallModal.jsx — Ventana de llamada de voz/video estilo WhatsApp Desktop
import React, { useState, useEffect, useRef, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Audio Ripple ─────────────────────────────────────────────────────────────
function AudioRipple({ active }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {active && [1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-wa-green opacity-0"
          style={{
            width: `${120 + i * 50}px`,
            height: `${120 + i * 50}px`,
            animation: `ripple 2s ease-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Control Button ───────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, title, children, large }) {
  const base = large ? 'w-16 h-16' : 'w-12 h-12'
  const color = danger
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : active
    ? 'bg-wa-green text-white hover:bg-wa-green/90'
    : 'bg-white/15 text-white hover:bg-white/25'
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${base} rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${color}`}
    >
      {children}
    </button>
  )
}

// ── Video Stream (simulado) ───────────────────────────────────────────────────
function VideoStream({ label, isSelf, avatar, name, cameraOn }) {
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gray-900 flex items-center justify-center ${
      isSelf ? 'w-32 h-44' : 'flex-1'
    }`}>
      {cameraOn ? (
        <div className={`w-full h-full flex items-center justify-center ${
          isSelf ? 'bg-gradient-to-br from-gray-700 to-gray-900' : 'bg-gradient-to-br from-wa-dark to-gray-900'
        }`}>
          <div className="text-center select-none">
            {avatar ? (
              <img src={avatar} alt={name} className="w-16 h-16 rounded-full mx-auto mb-2 object-cover opacity-50" />
            ) : (
              <div className={`w-16 h-16 rounded-full mx-auto mb-2 ${getAvatarGradient(name)} flex items-center justify-center text-white text-xl font-bold opacity-70`}>
                {getInitials(name)}
              </div>
            )}
            <span className="text-white/40 text-xs">Cámara activa</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {avatar ? (
            <img src={avatar} alt={name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className={`w-16 h-16 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-xl font-bold`}>
              {getInitials(name)}
            </div>
          )}
          <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.9 1.5L2.1 3.3 4.8 6H3a1 1 0 00-1 1v10a1 1 0 001 1h13.2l2.7 2.7 1.8-1.8L3.9 1.5zM21 6.5l-4 4V7a1 1 0 00-1-1H7.8l9 9L21 11.5a1 1 0 00-.6-.9L17 8.4V7a1 1 0 001-1V1l-5 5h3.5L21 6.5z"/>
          </svg>
        </div>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 text-white/80 text-xs bg-black/50 px-2 py-0.5 rounded-full">
          {label}
        </span>
      )}
    </div>
  )
}

// ── Main CallModal ────────────────────────────────────────────────────────────
export default function CallModal() {
  const { activeCall, endCall, activeChat } = useAppStore()
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(activeCall?.type === 'video')
  const [screenSharing, setScreenSharing] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const timerRef = useRef(null)
  const ws = useAppStore(s => s.ws)

  const chat = activeCall?.chat || activeChat
  const name = chat?.groupName || chat?.contactName || 'Contacto'
  const avatar = chat?.groupAvatar || chat?.contactAvatar || ''
  const callType = activeCall?.type || 'voice'
  const status = activeCall?.status || 'connected' // 'ringing' | 'connecting' | 'connected'

  // Timer
  useEffect(() => {
    if (status !== 'connected') return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [status])

  const handleEndCall = useCallback(() => {
    clearInterval(timerRef.current)
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'END_CALL', callId: activeCall?.callId }))
    }
    endCall()
  }, [ws, activeCall, endCall])

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleEndCall() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleEndCall])

  if (!activeCall) return null

  // ── Minimized pill ──────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div
        className="fixed bottom-24 right-6 z-50 bg-wa-green rounded-2xl shadow-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-wa-green/90 transition-colors animate-fade-in"
        onClick={() => setMinimized(false)}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-10 h-10 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {getInitials(name)}
          </div>
        )}
        <div>
          <p className="text-white text-sm font-semibold">{name}</p>
          <p className="text-white/80 text-xs">{formatDuration(elapsed)}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleEndCall() }}
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
      </div>
    )
  }

  // ── Voice Call UI ────────────────────────────────────────────────────────
  if (callType === 'voice') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop blur */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2027] via-[#0d1a21] to-[#0b141a] opacity-98" />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }} />

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6 select-none">
          {/* Minimize / close top bar */}
          <div className="w-full flex justify-between items-center mb-2">
            <span className="text-white/60 text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4 text-wa-green" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
              Llamada de voz
            </span>
            <button
              onClick={() => setMinimized(true)}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
              title="Minimizar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/>
              </svg>
            </button>
          </div>

          {/* Avatar + ripples */}
          <div className="relative flex items-center justify-center w-48 h-48">
            <AudioRipple active={status === 'connected' && !muted} />
            <div className="relative z-10">
              {avatar ? (
                <img src={avatar} alt={name} className="w-36 h-36 rounded-full object-cover ring-4 ring-wa-green/40 shadow-2xl" />
              ) : (
                <div className={`w-36 h-36 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-5xl font-bold ring-4 ring-wa-green/40 shadow-2xl`}>
                  {getInitials(name)}
                </div>
              )}
            </div>
          </div>

          {/* Name & status */}
          <div className="text-center">
            <h2 className="text-white text-2xl font-semibold">{name}</h2>
            <p className="text-wa-green text-sm mt-1 font-medium">
              {status === 'ringing' && '📳 Llamando...'}
              {status === 'connecting' && '⏳ Conectando...'}
              {status === 'connected' && formatDuration(elapsed)}
            </p>
            {muted && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-orange-400">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
                Silenciado
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 mt-4 w-full">
            <div className="flex flex-col items-center gap-2">
              <CtrlBtn onClick={() => setMuted(v => !v)} active={muted} title={muted ? 'Activar mic' : 'Silenciar'}>
                {muted ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </CtrlBtn>
              <span className="text-white/50 text-xs">{muted ? 'Activar' : 'Silenciar'}</span>
            </div>

            {/* Hang up — center, large */}
            <div className="flex flex-col items-center gap-2">
              <CtrlBtn onClick={handleEndCall} danger large title="Colgar">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </CtrlBtn>
              <span className="text-white/50 text-xs">Colgar</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <CtrlBtn onClick={() => setSpeakerOn(v => !v)} active={!speakerOn} title={speakerOn ? 'Altavoz activado' : 'Altavoz silenciado'}>
                {speakerOn ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                )}
              </CtrlBtn>
              <span className="text-white/50 text-xs">{speakerOn ? 'Altavoz' : 'Earpiece'}</span>
            </div>
          </div>

          {/* Switch to video */}
          <button
            onClick={() => useAppStore.getState().upgradeToVideo()}
            className="mt-2 flex items-center gap-2 text-wa-green/80 hover:text-wa-green text-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            Cambiar a videollamada
          </button>
        </div>
      </div>
    )
  }

  // ── Video Call UI ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Main video — remote */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        <VideoStream
          name={name}
          avatar={avatar}
          cameraOn={false}
          label={name}
        />

        {/* Self cam — PiP */}
        <div className="absolute bottom-4 right-4 shadow-2xl rounded-2xl overflow-hidden border-2 border-wa-green/40">
          <VideoStream
            name="Tú"
            avatar=""
            cameraOn={cameraOn}
            isSelf
            label="Tú"
          />
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent">
          <div>
            <p className="text-white font-semibold text-lg">{name}</p>
            <p className="text-wa-green text-sm">
              {status === 'ringing' ? '📳 Llamando...' : status === 'connecting' ? '⏳ Conectando...' : formatDuration(elapsed)}
            </p>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Controls bar */}
      <div className="bg-gray-950/95 px-6 py-5 flex items-center justify-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={() => setMuted(v => !v)} active={muted} title="Silenciar">
            {muted ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </CtrlBtn>
          <span className="text-white/40 text-xs">{muted ? 'Activar' : 'Mic'}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={() => setCameraOn(v => !v)} active={!cameraOn} title="Cámara">
            {cameraOn ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 1.5L2.1 3.3 4.8 6H3a1 1 0 00-1 1v10a1 1 0 001 1h13.2l2.7 2.7 1.8-1.8L3.9 1.5zM21 6.5l-4 4V7a1 1 0 00-1-1H7.8l9 9L21 11.5a1 1 0 00-.6-.9L17 8.4V7a1 1 0 001-1V1l-5 5h3.5L21 6.5z"/>
              </svg>
            )}
          </CtrlBtn>
          <span className="text-white/40 text-xs">{cameraOn ? 'Cámara' : 'Sin cam'}</span>
        </div>

        {/* Hang up */}
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={handleEndCall} danger large title="Colgar">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </CtrlBtn>
          <span className="text-white/40 text-xs">Colgar</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={() => setScreenSharing(v => !v)} active={screenSharing} title="Pantalla">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.5.69-4.54 4.5-5.53V8l3 3-2.5 3.47z"/>
            </svg>
          </CtrlBtn>
          <span className="text-white/40 text-xs">{screenSharing ? 'Compartido' : 'Pantalla'}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={() => setSpeakerOn(v => !v)} active={!speakerOn} title="Altavoz">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </CtrlBtn>
          <span className="text-white/40 text-xs">Altavoz</span>
        </div>
      </div>
    </div>
  )
}
