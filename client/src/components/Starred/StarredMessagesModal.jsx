import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { formatChatTime, formatTime } from '../../utils/formatters'

export default function StarredMessagesModal({ onClose }) {
  const [starred, setStarred] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { setActiveChat, chats, addToast } = useAppStore()

  const loadStarred = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/starred')
      if (res.ok) {
        const data = await res.json()
        setStarred(data)
      }
    } catch (err) {
      console.error('Error fetching starred messages:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStarred()
  }, [])

  const handleUnstar = async (msgId, e) => {
    e?.stopPropagation()
    try {
      const res = await fetch(`http://localhost:3001/api/messages/${msgId}/star`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setStarred((prev) => prev.filter((m) => m.id !== msgId))
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Mensajes destacados',
          message: 'Mensaje eliminado de destacados',
        })
      }
    } catch (err) {
      console.error('Error unstarring message:', err)
    }
  }

  const handleJumpToChat = (msg) => {
    let targetChat = chats.find((c) => c.id === msg.chatId)
    if (!targetChat) {
      targetChat = {
        id: msg.chatId,
        type: msg.chatType || 'individual',
        groupName: msg.groupName,
        groupAvatar: msg.groupAvatar,
        contactName: msg.contactName,
        contactAvatar: msg.contactAvatar,
      }
    }
    setActiveChat(targetChat)
    onClose()

    // Smooth scroll to message after opening
    setTimeout(() => {
      const el = document.getElementById(`msg-${msg.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-amber-400', 'rounded-xl')
        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'rounded-xl'), 2500)
      }
    }, 400)
  }

  const filteredStarred = starred.filter((m) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (m.content || '').toLowerCase().includes(term) ||
      (m.contactName || m.groupName || '').toLowerCase().includes(term) ||
      (m.fileName || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-sidebar border border-gray-700/50 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-wa-header px-5 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <span className="text-xl">⭐</span>
            <div>
              <h3 className="font-semibold text-wa-text text-base">Mensajes destacados</h3>
              <p className="text-xs text-wa-secondary">
                {starred.length} {starred.length === 1 ? 'mensaje guardado' : 'mensajes guardados'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-wa-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search filter */}
        <div className="px-4 py-2.5 bg-wa-input/60 border-b border-gray-700/30">
          <div className="flex items-center gap-2 bg-wa-sidebar px-3 py-1.5 rounded-lg border border-white/5">
            <svg className="w-4 h-4 text-wa-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar en mensajes destacados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-sm text-wa-text placeholder-wa-secondary outline-none flex-1"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-xs text-wa-secondary hover:text-wa-text">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-wa-secondary flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Cargando destacados...</span>
            </div>
          ) : filteredStarred.length === 0 ? (
            <div className="py-16 text-center text-wa-secondary flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl mb-3">
                ⭐
              </div>
              <p className="text-wa-text font-medium text-sm">No hay mensajes destacados</p>
              <p className="text-xs text-wa-secondary mt-1 max-w-xs">
                {searchTerm
                  ? 'No se encontraron coincidencias con tu búsqueda.'
                  : 'Haz clic derecho en cualquier mensaje y selecciona "Destacar" para guardarlo aquí.'}
              </p>
            </div>
          ) : (
            filteredStarred.map((msg) => {
              const chatTitle = msg.groupName || msg.contactName || 'Chat'
              const chatAvatar = msg.groupAvatar || msg.contactAvatar
              const isMe = msg.senderId === 'me'

              return (
                <div
                  key={msg.id}
                  onClick={() => handleJumpToChat(msg)}
                  className="bg-wa-header/70 hover:bg-wa-header border border-gray-700/40 rounded-xl p-3.5 transition-all cursor-pointer group hover:border-wa-green/40 shadow-sm"
                >
                  {/* Message Chat Meta */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={chatAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatTitle}`}
                        alt={chatTitle}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                      <span className="text-xs font-semibold text-wa-text truncate">{chatTitle}</span>
                      <span className="text-[10px] text-wa-secondary">
                        {isMe ? '· Tú' : `· ${msg.senderName || 'Contacto'}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-wa-secondary">{formatChatTime(msg.timestamp)}</span>
                      <button
                        onClick={(e) => handleUnstar(msg.id, e)}
                        className="p-1 text-amber-400 hover:text-wa-secondary transition-colors"
                        title="Quitar estrella"
                      >
                        ⭐
                      </button>
                    </div>
                  </div>

                  {/* Message Content preview */}
                  <div className="text-sm text-wa-text">
                    {msg.type === 'image' || (msg.filePath && /\.(png|jpg|jpeg|gif|webp)$/i.test(msg.filePath)) ? (
                      <div className="flex items-center gap-2 text-xs text-wa-secondary">
                        <span>🖼️ Imagen</span>
                        {msg.content && <span className="text-wa-text">{msg.content}</span>}
                      </div>
                    ) : msg.type === 'file' ? (
                      <div className="flex items-center gap-2 text-xs text-wa-secondary">
                        <span>📄 {msg.fileName || 'Documento adjunto'}</span>
                      </div>
                    ) : msg.type === 'audio' ? (
                      <div className="flex items-center gap-2 text-xs text-wa-secondary">
                        <span>🎤 Mensaje de voz</span>
                      </div>
                    ) : (
                      <p className="line-clamp-3 whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Jump button */}
                  <div className="mt-2.5 flex justify-end">
                    <span className="text-[11px] text-wa-green font-medium group-hover:underline flex items-center gap-1">
                      Ir al mensaje →
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
