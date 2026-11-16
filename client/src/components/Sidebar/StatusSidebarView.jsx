import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { formatRelativeTime } from '../../utils/formatters'

export default function StatusSidebarView({ onOpenStatusViewer, onOpenCreateStatus }) {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const { ws } = useAppStore()

  const loadStatuses = () => {
    fetch('http://localhost:3001/api/statuses')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStatuses(data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatuses()
  }, [])

  // Listen for real-time status updates via WS
  useEffect(() => {
    if (!ws) return
    const handleMsg = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'new_status') {
          loadStatuses()
        }
      } catch {}
    }
    ws.addEventListener('message', handleMsg)
    return () => ws.removeEventListener('message', handleMsg)
  }, [ws])

  const myStatus = statuses.find((s) => s.contactId === 'me')
  const contactStatuses = statuses.filter((s) => s.contactId !== 'me')

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-white/5 animate-fade-in">
      {/* Header Info */}
      <div className="p-4 bg-wa-header/40 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-wa-text flex items-center gap-2">
            <span>⭕</span> Estados
          </h2>
          <p className="text-xs text-wa-secondary">Desaparecen después de 24 horas</p>
        </div>
        <button
          onClick={onOpenCreateStatus}
          className="p-2 rounded-full bg-wa-green/20 hover:bg-wa-green/30 text-wa-green transition-colors"
          title="Añadir estado"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Mi estado */}
      <div className="p-3">
        <div
          onClick={() => {
            if (myStatus) onOpenStatusViewer(statuses.indexOf(myStatus))
            else onOpenCreateStatus()
          }}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
        >
          <div className="relative">
            <div className={`w-12 h-12 rounded-full p-0.5 ${myStatus ? 'ring-2 ring-wa-green ring-offset-2 ring-offset-wa-sidebar' : ''}`}>
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Yo"
                alt="Mi estado"
                className="w-full h-full rounded-full object-cover bg-wa-input"
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenCreateStatus()
              }}
              className="absolute bottom-0 right-0 w-5 h-5 bg-wa-green text-wa-dark rounded-full flex items-center justify-center font-bold text-xs shadow-md hover:scale-110 transition-transform"
              title="Añadir actualización"
            >
              +
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-wa-text">Mi estado</p>
            <p className="text-xs text-wa-secondary truncate">
              {myStatus ? formatRelativeTime(myStatus.timestamp) : 'Añade una actualización a tu estado'}
            </p>
          </div>
        </div>
      </div>

      {/* Actualizaciones recientes */}
      <div className="p-3">
        <p className="text-xs font-semibold text-wa-secondary uppercase tracking-wider px-2 mb-2">
          Actualizaciones recientes ({contactStatuses.length})
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-wa-secondary flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
            <span>Cargando estados...</span>
          </div>
        ) : contactStatuses.length === 0 ? (
          <div className="py-8 text-center text-xs text-wa-secondary">
            No hay actualizaciones recientes de tus contactos
          </div>
        ) : (
          <div className="space-y-1">
            {contactStatuses.map((status) => {
              const fullIndex = statuses.indexOf(status)
              return (
                <div
                  key={status.id}
                  onClick={() => onOpenStatusViewer(fullIndex >= 0 ? fullIndex : 0)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  {/* Glowing Green Avatar ring */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full p-0.5 ring-2 ring-wa-green ring-offset-2 ring-offset-wa-sidebar">
                      <img
                        src={status.contactAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${status.contactName}`}
                        alt={status.contactName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-wa-text truncate">{status.contactName}</p>
                    <p className="text-xs text-wa-secondary truncate">
                      {formatRelativeTime(status.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
