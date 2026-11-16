// IncomingCallNotification.jsx — Notificación de llamada entrante
import React, { useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

// Ring tone usando Web Audio API
function useRingTone(active) {
  const ctx = useRef(null)
  const nodes = useRef([])

  useEffect(() => {
    if (!active) {
      nodes.current.forEach(n => { try { n.stop() } catch {} })
      nodes.current = []
      return
    }

    const play = () => {
      try {
        ctx.current = ctx.current || new (window.AudioContext || window.webkitAudioContext)()
        const ac = ctx.current

        // Simple ring pattern: two tones
        const pattern = [
          { freq: 480, start: 0, dur: 0.4 },
          { freq: 620, start: 0, dur: 0.4 },
          { freq: 480, start: 0.5, dur: 0.4 },
          { freq: 620, start: 0.5, dur: 0.4 },
        ]

        pattern.forEach(({ freq, start, dur }) => {
          const osc = ac.createOscillator()
          const gain = ac.createGain()
          osc.connect(gain)
          gain.connect(ac.destination)
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0, ac.currentTime + start)
          gain.gain.linearRampToValueAtTime(0.08, ac.currentTime + start + 0.05)
          gain.gain.linearRampToValueAtTime(0, ac.currentTime + start + dur)
          osc.start(ac.currentTime + start)
          osc.stop(ac.currentTime + start + dur + 0.1)
          nodes.current.push(osc)
        })
      } catch {}
    }

    play()
    const interval = setInterval(play, 2500)
    return () => {
      clearInterval(interval)
      nodes.current.forEach(n => { try { n.stop() } catch {} })
      nodes.current = []
    }
  }, [active])
}

export default function IncomingCallNotification() {
  const { incomingCall, acceptCall, rejectCall } = useAppStore()
  useRingTone(!!incomingCall)

  if (!incomingCall) return null

  const name = incomingCall.callerName || 'Contacto'
  const avatar = incomingCall.callerAvatar || ''
  const callType = incomingCall.type || 'voice'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-wa-header rounded-3xl shadow-2xl w-80 overflow-hidden animate-fade-in-up">
        {/* Green top gradient */}
        <div className="h-2 bg-gradient-to-r from-wa-green via-emerald-400 to-wa-green" />

        <div className="p-6 flex flex-col items-center gap-4">
          {/* Pulsing avatar */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-wa-green/20 animate-ping" />
            {avatar ? (
              <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover ring-4 ring-wa-green/30 relative z-10" />
            ) : (
              <div className={`w-24 h-24 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-3xl font-bold ring-4 ring-wa-green/30 relative z-10`}>
                {getInitials(name)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="text-center">
            <p className="text-wa-secondary text-xs uppercase tracking-wider mb-1">
              {callType === 'video' ? '📹 Videollamada entrante' : '📞 Llamada de voz entrante'}
            </p>
            <h2 className="text-wa-text text-xl font-semibold">{name}</h2>
          </div>

          {/* Sound wave animation */}
          <div className="flex items-end gap-1 h-6">
            {[1,2,3,4,5].map(i => (
              <div
                key={i}
                className="w-1 bg-wa-green rounded-full"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animation: `bounce-dot 0.8s ease-in-out ${i * 0.12}s infinite alternate`
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-around w-full pt-2">
            {/* Reject */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30"
              >
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)"/>
                </svg>
              </button>
              <span className="text-wa-secondary text-xs">Rechazar</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-wa-green hover:bg-wa-green/90 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-wa-green/30 animate-pulse"
              >
                {callType === 'video' ? (
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                  </svg>
                )}
              </button>
              <span className="text-wa-secondary text-xs">Aceptar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
