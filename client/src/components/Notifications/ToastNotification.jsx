// client/src/components/Notifications/ToastNotification.jsx
// Sistema de notificaciones toast en tiempo real — CHASKYAPP
import React, { useEffect, useState, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'

// ── Web Audio API — sonido tipo WhatsApp (Do–Mi–Sol ascendente) ───────────
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const notes = [
      { freq: 1046.50, start: 0.00, dur: 0.10 },   // Do6
      { freq: 1318.51, start: 0.10, dur: 0.10 },   // Mi6
      { freq: 1567.98, start: 0.20, dur: 0.16 },   // Sol6
    ]

    notes.forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)

      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime  + start + dur + 0.06)
    })
  } catch (err) {
    console.warn('[Toast] Web Audio API no disponible:', err)
  }
}

// ── Toast Individual ───────────────────────────────────────────────────────
function Toast({ toast, onClose, onNavigate }) {
  const [phase, setPhase] = useState('entering') // 'entering' | 'visible' | 'exiting'

  useEffect(() => {
    // Entrada con micro-retraso para disparar la transición CSS
    const enterTimer = setTimeout(() => setPhase('visible'), 20)
    // Auto-dismiss a los 5 s
    const autoTimer  = setTimeout(() => handleClose(), 5000)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(autoTimer)
    }
  }, []) // eslint-disable-line

  const handleClose = useCallback(() => {
    setPhase('exiting')
    setTimeout(() => onClose(toast.id), 320)
  }, [toast.id, onClose])

  const handleClick = () => {
    onNavigate(toast.chatId)
    handleClose()
  }

  const transitionStyle = {
    transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease',
    transform:  phase === 'visible' ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.9)',
    opacity:    phase === 'visible' ? 1 : 0,
  }

  return (
    <div
      style={transitionStyle}
      onClick={handleClick}
      role="alert"
      aria-live="polite"
      className="
        flex items-start gap-3 cursor-pointer select-none
        bg-wa-header border border-gray-700/50 rounded-2xl
        shadow-2xl p-3 w-80 max-w-[calc(100vw-2rem)]
        hover:bg-wa-input active:scale-95 transition-colors
      "
    >
      {/* Avatar + indicador verde */}
      <div className="relative flex-shrink-0">
        <img
          src={toast.avatar}
          alt={toast.name}
          className="w-10 h-10 rounded-full object-cover"
          onError={(e) => {
            e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(toast.name)}`
          }}
        />
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green rounded-full border-2 border-wa-header" />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-wa-text truncate">{toast.name}</p>
          <span className="text-[10px] text-wa-secondary flex-shrink-0">ahora</span>
        </div>
        <p className="text-xs text-wa-secondary truncate leading-relaxed">{toast.message}</p>
      </div>

      {/* Botón cerrar */}
      <button
        onClick={(e) => { e.stopPropagation(); handleClose() }}
        className="flex-shrink-0 text-wa-secondary hover:text-wa-text transition-colors p-0.5 -mt-0.5 rounded-full hover:bg-black/20"
        title="Cerrar notificación"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

// ── Contenedor de Toasts (posición fixed) ─────────────────────────────────
export default function ToastNotification() {
  const { toasts, removeToast, setActiveChat, chats } = useAppStore()

  const handleNavigate = useCallback((chatId) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat) setActiveChat(chat)
  }, [chats, setActiveChat])

  if (!toasts?.length) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 items-end"
      style={{ pointerEvents: 'none' }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast
            toast={toast}
            onClose={removeToast}
            onNavigate={handleNavigate}
          />
        </div>
      ))}
    </div>
  )
}
