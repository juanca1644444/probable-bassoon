// GlobalSearch.jsx — Panel de búsqueda global de mensajes en todas las conversaciones
import React, { useState, useEffect } from 'react'
import { formatChatTime, getAvatarGradient, getInitials } from '../../utils/formatters'

// Helper to highlight matching text occurrences
function HighlightText({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-wa-green/30 text-emerald-300 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

export default function GlobalSearch({
  query,
  chats = [],
  onSelectChat,
  onSelectMessage,
  onClose,
}) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'messages' | 'chats'

  // Fetch messages from backend when query changes
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setMessages([])
      setLoading(false)
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setMessages(Array.isArray(data) ? data : [])
          setLoading(false)
        })
        .catch(() => {
          setMessages([])
          setLoading(false)
        })
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  // Filter local chats by contact/group name
  const matchedChats = chats.filter((c) => {
    const q = query.toLowerCase()
    return (
      (c.groupName || '').toLowerCase().includes(q) ||
      (c.contactName || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 flex flex-col bg-wa-sidebar overflow-hidden animate-fade-in">
      {/* Header with result counts & tabs */}
      <div className="px-3 py-2 bg-wa-header flex items-center justify-between border-b border-white/5">
        <span className="text-xs text-wa-secondary uppercase tracking-wider font-semibold">
          Resultados de búsqueda
        </span>
        <button
          onClick={onClose}
          className="text-xs text-wa-green hover:underline font-medium"
        >
          Limpiar
        </button>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-white/5">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-wa-green text-white'
              : 'bg-wa-input text-wa-secondary hover:text-wa-text'
          }`}
        >
          Todo ({matchedChats.length + messages.length})
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'chats'
              ? 'bg-wa-green text-white'
              : 'bg-wa-input text-wa-secondary hover:text-wa-text'
          }`}
        >
          Chats ({matchedChats.length})
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'messages'
              ? 'bg-wa-green text-white'
              : 'bg-wa-input text-wa-secondary hover:text-wa-text'
          }`}
        >
          Mensajes ({messages.length})
        </button>
      </div>

      {/* Results content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-white/5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-wa-secondary gap-2 text-xs">
            <svg className="w-4 h-4 animate-spin text-wa-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83" />
            </svg>
            Buscando en mensajes...
          </div>
        )}

        {/* ── Section: Matching Chats ── */}
        {(activeTab === 'all' || activeTab === 'chats') && matchedChats.length > 0 && (
          <div className="py-2">
            <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-wa-secondary font-semibold">
              Chats
            </p>
            {matchedChats.map((chat) => {
              const name = chat.groupName || chat.contactName || 'Chat'
              const avatar = chat.groupAvatar || chat.contactAvatar
              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                      {getInitials(name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-wa-text text-sm font-medium truncate">
                      <HighlightText text={name} query={query} />
                    </p>
                    <p className="text-wa-secondary text-xs truncate">
                      {chat.lastMessage || 'Sin mensajes'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Section: Matching Messages ── */}
        {(activeTab === 'all' || activeTab === 'messages') && (
          <div className="py-2">
            <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-wa-secondary font-semibold">
              Mensajes
            </p>
            {messages.length === 0 && !loading && (
              <p className="px-3 py-4 text-center text-xs text-wa-secondary">
                No se encontraron mensajes con "{query}"
              </p>
            )}
            {messages.map((msg) => {
              const chatName = msg.groupName || msg.contactName || 'Chat'
              const chatAvatar = msg.groupAvatar || msg.contactAvatar
              return (
                <div
                  key={msg.id}
                  onClick={() => onSelectMessage(msg)}
                  className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-white/5 transition-colors group"
                >
                  {chatAvatar ? (
                    <img src={chatAvatar} alt={chatName} className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full ${getAvatarGradient(chatName)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5`}>
                      {getInitials(chatName)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-wa-text text-xs font-semibold truncate group-hover:text-wa-green transition-colors">
                        {chatName}
                      </span>
                      <span className="text-[10px] text-wa-secondary flex-shrink-0 ml-2">
                        {formatChatTime(msg.timestamp)}
                      </span>
                    </div>

                    <p className="text-wa-secondary text-xs leading-relaxed line-clamp-2">
                      <HighlightText text={msg.content} query={query} />
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && matchedChats.length === 0 && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-wa-secondary text-xs gap-2">
            <span className="text-3xl">🔍</span>
            <p>No se encontraron resultados para "{query}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
