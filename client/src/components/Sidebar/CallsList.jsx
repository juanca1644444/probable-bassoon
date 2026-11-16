// CallsList.jsx — Historial de llamadas de voz y video en el Sidebar
import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { formatChatTime, getAvatarGradient, getInitials } from '../../utils/formatters'
import IvrBuilder from '../Telephony/IvrBuilder'

function formatDuration(secs = 0) {
  if (!secs) return '0 seg'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s} seg`
  return `${m} min ${s > 0 ? `${s} seg` : ''}`
}

export default function CallsList({ onSelectChat }) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIvrBuilder, setShowIvrBuilder] = useState(false)
  const { startCall, chats } = useAppStore()

  useEffect(() => {
    setLoading(true)
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => {
        setCalls(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCallAgain = (call, callType) => {
    // Find associated chat
    let chat = chats.find((c) => c.id === call.chatId || c.contactId === call.receiverId || c.contactId === call.callerId)
    if (!chat) {
      chat = {
        id: call.chatId || `ch-${call.receiverId}`,
        contactName: call.contactName || 'Contacto',
        contactAvatar: call.contactAvatar || '',
        type: 'individual',
      }
    }
    if (onSelectChat) onSelectChat(chat)
    startCall(chat, callType || call.type || 'voice')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-wa-secondary text-xs gap-2">
        <svg className="w-4 h-4 animate-spin text-wa-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83" />
        </svg>
        Cargando llamadas...
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-wa-secondary text-xs gap-3">
        <div className="w-12 h-12 rounded-full bg-wa-input flex items-center justify-center text-xl text-wa-green">
          📞
        </div>
        <div>
          <p className="text-wa-text font-medium text-sm">Sin historial de llamadas</p>
          <p className="text-xs text-wa-secondary mt-1">
            Las llamadas de voz y video que realices o recibas se registrarán aquí.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-white/5">
      {/* Centralita Telefónica & IVR Quick Access Button */}
      <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-black/40 border-b border-white/5">
        <button
          onClick={() => setShowIvrBuilder(true)}
          className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm hover:scale-[1.01]"
        >
          <span className="text-sm">📞</span> Centralita IVR & Diseñador de Voz IA
        </button>
      </div>

      <div className="px-3 py-2 bg-wa-header flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-wa-secondary font-semibold">
          Historial reciente ({calls.length})
        </span>
      </div>

      {calls.map((call) => {
        const isVideo = call.type === 'video'
        const isIncoming = call.callerId !== 'me'
        const isMissed = call.status === 'rejected' || call.status === 'missed'
        const name = call.contactName || (isIncoming ? 'Contacto' : 'Saliente')
        const avatar = call.contactAvatar

        return (
          <div
            key={call.id}
            className="flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors group"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className={`w-10 h-10 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-xs font-semibold`}>
                  {getInitials(name)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-wa-text text-sm font-medium truncate">{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Status arrow */}
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isMissed ? 'text-red-400' : 'text-wa-green'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  {isIncoming ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 5l-14 14m0 0h10m-10 0V9" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19L19 5m0 0H9m10 0v10" />
                  )}
                </svg>
                <span className="text-xs text-wa-secondary">
                  {formatChatTime(call.timestamp)} · {formatDuration(call.duration)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleCallAgain(call, isVideo ? 'video' : 'voice')}
                className="p-2 rounded-full hover:bg-wa-green/20 text-wa-green transition-colors"
                title={isVideo ? 'Iniciar videollamada' : 'Iniciar llamada de voz'}
              >
                {isVideo ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )
      })}

      {showIvrBuilder && (
        <IvrBuilder
          onClose={() => setShowIvrBuilder(false)}
        />
      )}
    </div>
  )
}
