import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { format } from 'date-fns'

export default function ScheduleMessageModal({ chat, initialText = '', onClose, onScheduled }) {
  const [content, setContent] = useState(initialText || '')
  const [scheduledDateTime, setScheduledDateTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingMessages, setPendingMessages] = useState([])
  const [loadingPending, setLoadingPending] = useState(true)

  const { addToast } = useAppStore()

  // Format datetime-local string (YYYY-MM-DDTHH:mm)
  const formatForInput = (date) => {
    const pad = (n) => String(n).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${y}-${m}-${d}T${h}:${min}`
  }

  // Set default time to 15 minutes from now
  useEffect(() => {
    const defaultDate = new Date(Date.now() + 15 * 60 * 1000)
    setScheduledDateTime(formatForInput(defaultDate))
    fetchPending()
  }, [chat?.id])

  const fetchPending = async () => {
    if (!chat?.id) return
    setLoadingPending(true)
    try {
      const res = await fetch(`http://localhost:3001/api/scheduled-messages?chatId=${chat.id}&status=pending`)
      if (res.ok) {
        const data = await res.json()
        setPendingMessages(data)
      }
    } catch (e) {
      console.error('Error fetching pending scheduled messages:', e)
    } finally {
      setLoadingPending(false)
    }
  }

  const applyPreset = (minutesAhead, setHours = null) => {
    const d = new Date()
    if (setHours !== null) {
      d.setDate(d.getDate() + 1)
      d.setHours(setHours, 0, 0, 0)
    } else {
      d.setTime(d.getTime() + minutesAhead * 60 * 1000)
    }
    setScheduledDateTime(formatForInput(d))
  }

  const handleSchedule = async (e) => {
    e.preventDefault()
    if (!content.trim() || !scheduledDateTime || !chat?.id) return

    const targetTime = new Date(scheduledDateTime).getTime()
    if (isNaN(targetTime) || targetTime <= Date.now()) {
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Error de programación',
        message: 'La fecha y hora deben ser futuras',
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          content: content.trim(),
          scheduledTime: targetTime,
          type: 'text'
        })
      })

      if (res.ok) {
        const saved = await res.json()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Mensaje programado',
          message: `Mensaje programado para el ${new Date(targetTime).toLocaleDateString()} a las ${new Date(targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        })
        if (onScheduled) onScheduled(saved)
        setContent('')
        fetchPending()
      }
    } catch (err) {
      console.error('Error scheduling message:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelScheduled = async (id) => {
    try {
      await fetch(`http://localhost:3001/api/scheduled-messages/${id}`, { method: 'DELETE' })
      setPendingMessages((prev) => prev.filter((m) => m.id !== id))
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Programación cancelada',
        message: 'El mensaje programado fue cancelado',
      })
    } catch (err) {
      console.error('Error cancelling scheduled message:', err)
    }
  }

  const recipientName = chat?.groupName || chat?.contactName || 'este chat'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-sidebar border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-wa-header px-5 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl flex-shrink-0">
              ⏰
            </div>
            <div>
              <h3 className="font-semibold text-wa-text text-base">Programar Mensaje Automático</h3>
              <p className="text-xs text-wa-secondary">Destinatario: <span className="text-emerald-400 font-medium">{recipientName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-wa-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Message Textarea */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Mensaje a enviar:
            </label>
            <textarea
              autoFocus
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el mensaje que se enviará automáticamente..."
              className="w-full bg-wa-header border border-gray-700/60 rounded-xl p-3 text-sm text-wa-text placeholder-wa-secondary outline-none focus:border-amber-500 resize-none shadow-inner"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">
              Atajos rápidos:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset(10)}
                className="py-1.5 px-2 bg-wa-input hover:bg-white/10 border border-gray-700/50 rounded-lg text-[11px] font-medium text-gray-200 transition-colors"
              >
                ⏱️ En 10 min
              </button>
              <button
                type="button"
                onClick={() => applyPreset(60)}
                className="py-1.5 px-2 bg-wa-input hover:bg-white/10 border border-gray-700/50 rounded-lg text-[11px] font-medium text-gray-200 transition-colors"
              >
                ⏰ En 1 hora
              </button>
              <button
                type="button"
                onClick={() => applyPreset(null, 9)}
                className="py-1.5 px-2 bg-wa-input hover:bg-white/10 border border-gray-700/50 rounded-lg text-[11px] font-medium text-gray-200 transition-colors"
              >
                🌅 Mañana 9:00
              </button>
              <button
                type="button"
                onClick={() => applyPreset(null, 18)}
                className="py-1.5 px-2 bg-wa-input hover:bg-white/10 border border-gray-700/50 rounded-lg text-[11px] font-medium text-gray-200 transition-colors"
              >
                🌆 Mañana 18:00
              </button>
            </div>
          </div>

          {/* DateTime Picker */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Fecha y hora programada:
            </label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-wa-text outline-none focus:border-amber-500"
            />
          </div>

          {/* Schedule Action Button */}
          <button
            type="button"
            disabled={loading || !content.trim()}
            onClick={handleSchedule}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>⏰</span>
            {loading ? 'Programando...' : 'Confirmar programación'}
          </button>

          {/* List of Pending Scheduled Messages */}
          <div className="pt-3 border-t border-gray-700/40">
            <h4 className="text-xs font-bold text-gray-300 mb-2 flex items-center justify-between">
              <span>Mensajes pendientes en este chat ({pendingMessages.length})</span>
              <button onClick={fetchPending} className="text-amber-400 hover:underline text-[10px]">
                🔄 Actualizar
              </button>
            </h4>

            {loadingPending ? (
              <div className="py-4 text-center text-xs text-gray-400">Cargando pendientes...</div>
            ) : pendingMessages.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500 bg-black/15 rounded-xl border border-white/5">
                No hay mensajes programados pendientes en este chat.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingMessages.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-3 bg-black/25 border border-gray-700/50 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1 text-[11px]">
                        <span>⏰</span>
                        <span>{new Date(pm.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <p className="text-gray-300 truncate font-mono text-[11px]">"{pm.content}"</p>
                    </div>
                    <button
                      onClick={() => handleCancelScheduled(pm.id)}
                      className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-wa-header flex items-center justify-end border-t border-gray-700/30">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-wa-secondary hover:text-white rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
