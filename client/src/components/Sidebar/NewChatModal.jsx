// NewChatModal.jsx — Modal para iniciar un nuevo chat seleccionando un contacto
import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'
import DirectPhoneModal from '../Contacts/DirectPhoneModal'

export default function NewChatModal({ onClose, onSelectChat }) {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDirectPhone, setShowDirectPhone] = useState(false)
  const { chats, setChats, addToast } = useAppStore()

  useEffect(() => {
    setLoading(true)
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((data) => {
        // Exclude 'me'
        const list = (Array.isArray(data) ? data : []).filter((c) => c.id !== 'me')
        setContacts(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.status || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleContactClick = async (contact) => {
    // Check if chat already exists
    let existingChat = chats.find(
      (c) => c.type === 'individual' && (c.contactId === contact.id || c.id === contact.id)
    )

    if (existingChat) {
      onSelectChat(existingChat)
      onClose()
      return
    }

    // Create new individual chat
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          type: 'individual',
        }),
      })

      if (res.ok) {
        const newChat = await res.json()
        const fullChat = {
          ...newChat,
          contactName: contact.name,
          contactAvatar: contact.avatar,
          contactPhone: contact.phone,
          contactStatus: contact.status,
          contactIsOnline: contact.isOnline,
        }
        setChats([fullChat, ...chats])
        onSelectChat(fullChat)
        addToast({
          id: `toast-${Date.now()}`,
          name: contact.name,
          message: 'Conversación iniciada',
          avatar: contact.avatar,
          chatId: fullChat.id,
        })
      }
    } catch (e) {
      console.error('Error creating chat:', e)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-sm flex flex-col h-[520px] overflow-hidden border border-white/10 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-wa-header border-b border-white/5">
          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-icon hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h3 className="text-wa-text font-semibold text-sm">Nuevo chat</h3>
            <p className="text-wa-secondary text-[11px]">{contacts.length} contactos disponibles</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-3 py-2 bg-wa-sidebar border-b border-white/5">
          <div className="flex items-center bg-wa-input rounded-lg px-2.5 py-1.5 gap-2">
            <svg className="w-4 h-4 text-wa-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar contacto o número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="bg-transparent flex-1 text-xs text-wa-text placeholder:text-wa-secondary outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-wa-secondary hover:text-wa-text text-xs">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Action: Message a phone number directly */}
        <div className="p-2.5 border-b border-white/5 bg-wa-sidebar">
          <button
            type="button"
            onClick={() => setShowDirectPhone(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-all text-left shadow-sm group"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow flex-shrink-0 group-hover:scale-105 transition-transform">
              📞
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-emerald-300">Escribir a un número de teléfono</p>
              <p className="text-[10px] text-wa-secondary">Chatea sin guardar o añade a la libreta</p>
            </div>
            <span className="text-xs text-emerald-400 font-bold">→</span>
          </button>
        </div>

        {/* Quick Phone Match if typed digits */}
        {search.trim().length >= 3 && /[\d+]/.test(search) && (
          <div
            onClick={() => setShowDirectPhone(true)}
            className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer border-b border-emerald-500/20 text-emerald-400 text-xs transition-colors"
          >
            <span>📞</span>
            <span>Escribir directamente al número: <strong>{search}</strong></span>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-white/5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-wa-secondary text-xs gap-2">
              <svg className="w-4 h-4 animate-spin text-wa-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83" />
              </svg>
              Cargando contactos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-wa-secondary text-xs">
              <p>No se encontraron contactos</p>
            </div>
          ) : (
            filtered.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors group"
              >
                <div className="relative flex-shrink-0">
                  {contact.avatar ? (
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full ${getAvatarGradient(
                        contact.name
                      )} flex items-center justify-center text-white text-xs font-semibold`}
                    >
                      {getInitials(contact.name)}
                    </div>
                  )}
                  {contact.isOnline === 1 && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-wa-green rounded-full border-2 border-wa-header" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-wa-text text-sm font-medium truncate group-hover:text-wa-green transition-colors">
                      {contact.name}
                    </p>
                    {contact.isOnline === 1 && (
                      <span className="text-[10px] text-wa-green font-medium">en línea</span>
                    )}
                  </div>
                  <p className="text-wa-secondary text-xs truncate">
                    {contact.status || contact.phone || 'Disponible'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Direct Phone Number Modal */}
      {showDirectPhone && (
        <DirectPhoneModal
          initialPhone={search}
          onClose={() => setShowDirectPhone(false)}
          onSelectChat={(c) => {
            setShowDirectPhone(false)
            onSelectChat(c)
            onClose()
          }}
        />
      )}
    </div>
  )
}
