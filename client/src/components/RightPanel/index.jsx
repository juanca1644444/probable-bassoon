import React, { useState, useEffect, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials, formatRelativeTime } from '../../utils/formatters'
import MediaGallery from './MediaGallery'
import ExportModal from '../ChatArea/ExportModal'
import AgentAssignment from './AgentAssignment'
import AISentimentTracker from './AISentimentTracker'
import BusinessProfileModal, { MetaVerifiedBadge } from '../Business/BusinessProfileModal'
import AssignLabelsModal from '../Labels/AssignLabelsModal'
import SaveContactModal from '../Contacts/SaveContactModal'
import AICopilotPanel from './AICopilotPanel'

function Avatar({ name, avatar, size = 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-sm'
  return avatar ? (
    <img src={avatar} alt={name} className={`${sz} rounded-full object-cover`} />
  ) : (
    <div className={`${sz} rounded-full ${getAvatarGradient(name)} flex items-center justify-center font-semibold text-white`}>
      {getInitials(name)}
    </div>
  )
}

function EmptyMedia({ icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center h-24 text-wa-secondary">
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

export default function RightPanel() {
  const { activeChat, messages, toggleRightPanel, updateChat, setActiveChat, chats, startCall, setInChatSearchOpen } = useAppStore()
  const [activeTab, setActiveTab] = useState('Fotos')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [members, setMembers] = useState([])
  const [showGallery, setShowGallery] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [allContacts, setAllContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [showDisappearingModal, setShowDisappearingModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isChatLocked, setIsChatLocked] = useState(false)
  const [chatLabels, setChatLabels] = useState([])
  const [showAssignLabels, setShowAssignLabels] = useState(false)
  const [showBusinessProfile, setShowBusinessProfile] = useState(false)
  const [showSaveContact, setShowSaveContact] = useState(false)
  const [targetLang, setTargetLang] = useState('qu')
  const [translating, setTranslating] = useState(false)
  const [panelTranslation, setPanelTranslation] = useState(null)

  const fetchChatLabels = useCallback(async () => {
    if (!activeChat?.id) return
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${activeChat.id}/labels`)
      if (res.ok) {
        const data = await res.json()
        setChatLabels(data)
      }
    } catch (e) {
      console.error(e)
    }
  }, [activeChat?.id])

  useEffect(() => {
    fetchChatLabels()
  }, [fetchChatLabels])

  useEffect(() => {
    if (!activeChat?.id) return
    fetch('http://localhost:3001/api/locked-chats')
      .then(r => r.json())
      .then(ids => setIsChatLocked(ids.includes(activeChat.id)))
      .catch(() => {})
  }, [activeChat?.id])

  const handleToggleLockChat = async () => {
    try {
      if (isChatLocked) {
        await fetch(`http://localhost:3001/api/locked-chats/${activeChat.id}`, { method: 'DELETE' })
        setIsChatLocked(false)
      } else {
        await fetch('http://localhost:3001/api/locked-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: activeChat.id })
        })
        setIsChatLocked(true)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSetDisappearing = async (timerMs) => {
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disappearingTimer: timerMs }),
      })
      if (res.ok) {
        useAppStore.setState((s) => ({
          chats: s.chats.map((c) =>
            c.id === activeChat.id ? { ...c, disappearingTimer: timerMs } : c
          ),
          activeChat: { ...s.activeChat, disappearingTimer: timerMs },
        }))
        setShowDisappearingModal(false)
      }
    } catch (err) {
      console.error('Error setting disappearing timer:', err)
    }
  }

  if (!activeChat) return null

  const chatMessages = messages[activeChat.id] || []
  const name = activeChat.groupName || activeChat.contactName || 'Chat'
  const isGroup = activeChat.type === 'group'

  const photoMessages = chatMessages.filter((m) => m.type === 'image')
  const audioMessages = chatMessages.filter((m) => m.type === 'audio')
  const fileMessages  = chatMessages.filter((m) => m.type === 'file')
  const pinnedMessages = chatMessages.filter((m) => m.isPinned)
  const lastClientMessage = [...chatMessages].reverse().find(m => m.senderId !== 'me' && m.content)

  const handleTranslateLastMessage = async () => {
    if (!lastClientMessage?.content) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lastClientMessage.content,
          targetLang
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPanelTranslation(data)
      }
    } catch (err) {
      console.error('Error translating in panel:', err)
    } finally {
      setTranslating(false)
    }
  }

  // Load group members
  const loadMembers = useCallback(() => {
    if (!isGroup || !activeChat.id) return
    fetch(`/api/chats/${activeChat.id}/members`)
      .then(r => r.json())
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [activeChat.id, isGroup])

  useEffect(() => { loadMembers() }, [loadMembers])

  // Load contacts for add-member picker
  useEffect(() => {
    if (!showAddMember) return
    fetch('/api/contacts')
      .then(r => r.json())
      .then(data => setAllContacts(Array.isArray(data) ? data : []))
      .catch(() => setAllContacts([]))
  }, [showAddMember])

  const handleAddMember = async (contact) => {
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      })
      if (res.ok) { loadMembers(); setShowAddMember(false); setContactSearch('') }
      else {
        const err = await res.json()
        alert(err.error || 'Error al añadir miembro')
      }
    } catch (e) { console.error(e) }
  }

  const handleRemoveMember = async (contactId) => {
    if (!window.confirm('¿Eliminar este participante del grupo?')) return
    setRemovingId(contactId)
    try {
      await fetch(`/api/chats/${activeChat.id}/members/${contactId}`, { method: 'DELETE' })
      loadMembers()
    } catch (e) { console.error(e) }
    setRemovingId(null)
  }

  // Members not already in the group
  const availableContacts = allContacts.filter(c =>
    c.id !== 'me' &&
    !members.find(m => m.contactId === c.id) &&
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  // Toggle mute
  const handleToggleMute = async () => {
    const newVal = !activeChat.isMuted
    try {
      await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted: newVal }),
      })
      updateChat(activeChat.id, { isMuted: newVal })
    } catch (e) { console.error(e) }
  }

  // Toggle archive
  const handleToggleArchive = async () => {
    const newVal = !activeChat.isArchived
    try {
      await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newVal }),
      })
      updateChat(activeChat.id, { isArchived: newVal })
      if (newVal) {
        // Close chat and deselect
        setActiveChat(null)
        toggleRightPanel()
      }
    } catch (e) { console.error(e) }
  }

  // Delete / leave chat
  const handleDeleteChat = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    try {
      // Mark archived + clear local messages
      await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: 1 }),
      })
      useAppStore.setState((s) => ({
        messages: { ...s.messages, [activeChat.id]: [] },
        chats: s.chats.filter((c) => c.id !== activeChat.id),
      }))
      setActiveChat(null)
      toggleRightPanel()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="w-full flex flex-col bg-wa-sidebar border-l border-white/5 overflow-y-auto scrollbar-thin animate-slide-in-right">
      {/* MediaGallery overlay — se muestra cuando showGallery es true */}
      {showGallery && (
        <div className="absolute inset-0 z-20">
          <MediaGallery
            chatId={activeChat.id}
            messages={chatMessages}
            onClose={() => setShowGallery(false)}
          />
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-wa-header sticky top-0 z-10">
        <button
          onClick={toggleRightPanel}
          className="p-1.5 rounded-full hover:bg-white/10 text-wa-icon transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-wa-text font-semibold text-sm">
          {isGroup ? 'Info. del grupo' : 'Info. de contacto'}
        </span>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center py-6 px-4 border-b border-white/5">
        <Avatar name={name} avatar={activeChat.groupAvatar || activeChat.contactAvatar} size="lg" />
        <div className="flex items-center gap-1.5 mt-3">
          <h3 className="text-wa-text font-semibold text-lg">{name}</h3>
          <MetaVerifiedBadge size="md" />
        </div>
        {!isGroup && (
          <p className="text-wa-secondary text-sm mt-1">
            {activeChat.contactIsOnline === 1 ? (
              <span className="text-wa-green">en línea</span>
            ) : activeChat.contactLastSeen ? (
              `Última vez ${formatRelativeTime(activeChat.contactLastSeen)}`
            ) : 'Desconectado'}
          </p>
        )}
        {isGroup && (
          <p className="text-wa-secondary text-sm mt-1">
            {members.length > 0 ? `${members.length} participantes` : (activeChat.members?.length || 0) + ' participantes'}
          </p>
        )}
        {activeChat.contactPhone && (
          <p className="text-wa-secondary text-xs mt-1">{activeChat.contactPhone}</p>
        )}
        <p className="text-wa-secondary text-xs mt-2 text-center px-4">
          {activeChat.contactStatus || (isGroup ? 'Grupo de CHASKYAPP' : 'Hola, estoy usando CHASKYAPP')}
        </p>

        {!isGroup && (
          <button
            onClick={() => setShowSaveContact(true)}
            className="mt-2.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>👤</span>
            <span>{activeChat.contactName?.startsWith('+') ? 'Agregar a contactos' : 'Editar en contactos'}</span>
          </button>
        )}

        {/* Muted / Pinned badges */}
        <div className="flex gap-2 mt-3">
          {activeChat.isMuted && (
            <span className="bg-wa-input text-wa-secondary text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
              Silenciado
            </span>
          )}
          {activeChat.isPinned && (
            <span className="bg-wa-input text-wa-secondary text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              📌 Fijado
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex justify-around py-4 border-b border-white/5">
        {[
          { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label: 'Llamar', action: () => startCall(activeChat, 'voice') },
          { icon: 'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', label: 'Video', action: () => startCall(activeChat, 'video') },
          { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', label: 'Buscar', action: () => setInChatSearchOpen(true) },
        ].map((action) => (
          <button key={action.label} onClick={action.action} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-full bg-wa-input flex items-center justify-center">
              <svg className="w-5 h-5 text-wa-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
              </svg>
            </div>
            <span className="text-wa-secondary text-xs">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Omnichannel & Agent Assignment Suite */}
      <div className="px-3 border-b border-white/5 pb-2">
        <AgentAssignment chat={activeChat} />
        <div className="mt-2">
          <AISentimentTracker chatId={activeChat.id} />
        </div>

        {/* Chasky Copilot AI & Autonomous RAG Assistant */}
        <div className="mt-2.5">
          <AICopilotPanel chat={activeChat} />
        </div>

        {/* Real-Time Translation & Language Preference */}
        <div className="mt-2.5 bg-wa-header/50 rounded-xl p-3 border border-emerald-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🌐</span>
              <span>Traductor Multilingüe IA</span>
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono">
              Tiempo Real
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-wa-secondary block font-medium">
              Idioma preferido del cliente:
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full bg-wa-input border border-wa-border/50 text-wa-text rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="qu">🇵🇪 Quechua (Runasimi)</option>
              <option value="en">🇺🇸 English</option>
              <option value="pt">🇧🇷 Português</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="es">🇪🇸 Español</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleTranslateLastMessage}
            disabled={translating || !lastClientMessage}
            className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-40"
          >
            {translating ? (
              <>
                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Traduciendo con IA...</span>
              </>
            ) : (
              <>
                <span>🌐</span>
                <span>Traducir último mensaje a {targetLang === 'qu' ? 'Quechua' : targetLang === 'en' ? 'Inglés' : targetLang === 'pt' ? 'Portugués' : targetLang === 'fr' ? 'Francés' : 'Español'}</span>
              </>
            )}
          </button>

          {panelTranslation && (
            <div className="bg-black/30 rounded-lg p-2.5 border border-emerald-500/30 text-xs space-y-1 animate-fade-in select-text">
              <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold">
                <span>{panelTranslation.targetLangName}:</span>
                <button
                  type="button"
                  onClick={() => setPanelTranslation(null)}
                  className="text-gray-400 hover:text-white"
                  title="Cerrar traducción"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-200 italic leading-relaxed">
                "{panelTranslation.translatedText}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Official WhatsApp Business Labels */}
      <div className="px-4 py-3 border-b border-white/5 bg-wa-input/20">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-wa-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span>🏷️</span>
            <span>Etiquetas WhatsApp Business</span>
          </h4>
          <button
            onClick={() => setShowAssignLabels(true)}
            className="text-xs text-wa-green hover:text-emerald-400 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>+</span>
            <span>Editar</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chatLabels.length === 0 ? (
            <p className="text-xs text-wa-secondary italic">Sin etiquetas asignadas</p>
          ) : (
            chatLabels.map((lbl) => (
              <span
                key={lbl.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm"
                style={{ backgroundColor: lbl.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                <span>{lbl.name}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Media quick-stats + botón galería */}
      <div className="border-b border-white/5">
        {/* Miniaturas de fotos (hasta 6) */}
        {photoMessages.length > 0 && (
          <div className="grid grid-cols-3 gap-0.5 p-2">
            {photoMessages.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="aspect-square rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.open(m.filePath, '_blank')}
              >
                <img src={m.filePath} alt="media" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Botón "Ver todos los archivos" */}
        <button
          onClick={() => setShowGallery(true)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wa-input flex items-center justify-center">
              <svg className="w-4 h-4 text-wa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-wa-text text-sm font-medium">Archivos, enlaces y docs</p>
              <p className="text-wa-secondary text-xs">
                {photoMessages.length} fotos · {fileMessages.length} docs · {audioMessages.length} audios
              </p>
            </div>
          </div>
          <svg className="w-4 h-4 text-wa-secondary group-hover:text-wa-green transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-t border-white/5 p-3">
          <h4 className="text-wa-secondary text-xs font-semibold uppercase tracking-wider mb-2">Mensajes fijados</h4>
          {pinnedMessages.map((m) => (
            <div key={m.id} className="p-2 bg-wa-input rounded-lg mb-2">
              <p className="text-wa-text text-xs truncate">{m.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Group members */}
      {isGroup && (
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-wa-secondary text-xs font-semibold uppercase tracking-wider">
              {members.length} participante{members.length !== 1 ? 's' : ''}
            </h4>
            <button
              onClick={() => { setShowAddMember(v => !v); setContactSearch('') }}
              className="flex items-center gap-1 text-wa-green text-xs hover:text-wa-green/80 transition-colors"
              title="Añadir participante"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Añadir
            </button>
          </div>

          {/* Add member picker */}
          {showAddMember && (
            <div className="mb-3 bg-wa-input rounded-xl overflow-hidden">
              <div className="flex items-center px-3 py-2 gap-2 border-b border-white/5">
                <svg className="w-3.5 h-3.5 text-wa-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar contacto..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="bg-transparent flex-1 text-xs text-wa-text placeholder:text-wa-secondary outline-none py-0.5"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto scrollbar-thin">
                {availableContacts.length === 0 ? (
                  <p className="text-wa-secondary text-xs text-center py-3">Sin contactos disponibles</p>
                ) : (
                  availableContacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleAddMember(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-7 h-7 rounded-full ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
                          {getInitials(c.name)}
                        </div>
                      )}
                      <div className="text-left min-w-0">
                        <p className="text-wa-text text-xs font-medium truncate">{c.name}</p>
                        <p className="text-wa-secondary text-[10px] truncate">{c.phone || c.status}</p>
                      </div>
                      <svg className="w-3.5 h-3.5 text-wa-green ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
                      </svg>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Members list */}
          {members.map((member) => (
            <div key={member.id || member.contactId} className="flex items-center gap-2 py-2 group">
              {member.avatar ? (
                <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className={`w-8 h-8 rounded-full ${getAvatarGradient(member.name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                  {getInitials(member.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-wa-text text-xs font-medium truncate">{member.name}</p>
                <div className="flex items-center gap-1.5">
                  {member.isAdmin ? (
                    <span className="text-wa-green text-[10px] font-semibold">Admin del grupo</span>
                  ) : (
                    <span className="text-wa-secondary text-[10px]">{member.phone || member.status || 'Participante'}</span>
                  )}
                </div>
              </div>
              {/* Remove button (only shown for non-admin members) */}
              {!member.isAdmin && member.contactId !== 'me' && (
                <button
                  onClick={() => handleRemoveMember(member.contactId)}
                  disabled={removingId === member.contactId}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/20 text-wa-secondary hover:text-red-400 transition-all"
                  title="Eliminar del grupo"
                >
                  {removingId === member.contactId ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83"/>
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-wa-secondary text-xs text-center py-3">Sin participantes</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-white/5 p-3 space-y-1 pb-6">
        {/* Mensajes temporales */}
        <div className="relative">
          <button
            onClick={() => setShowDisappearingModal(!showDisappearingModal)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm text-wa-secondary flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-base">⏱️</span>
              <div>
                <p className="text-wa-text text-sm leading-tight">Mensajes temporales</p>
                <p className="text-[11px] text-wa-secondary">
                  {activeChat.disappearingTimer === 86400000
                    ? '24 horas'
                    : activeChat.disappearingTimer === 604800000
                    ? '7 días'
                    : activeChat.disappearingTimer === 7776000000
                    ? '90 días'
                    : 'Desactivados'}
                </p>
              </div>
            </div>
            <span className="text-xs text-wa-secondary">›</span>
          </button>

          {showDisappearingModal && (
            <div className="mt-1 bg-wa-input p-2 rounded-xl border border-gray-700/60 shadow-xl space-y-1 animate-scale-in">
              <p className="text-xs font-semibold text-wa-text px-2 py-1">Duración de los mensajes:</p>
              {[
                { label: 'Desactivado', val: 0 },
                { label: '24 horas', val: 86400000 },
                { label: '7 días', val: 604800000 },
                { label: '90 días', val: 7776000000 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => handleSetDisappearing(opt.val)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                    (activeChat.disappearingTimer || 0) === opt.val
                      ? 'bg-wa-green/20 text-wa-green font-semibold'
                      : 'hover:bg-white/5 text-wa-secondary hover:text-wa-text'
                  }`}
                >
                  <span>{opt.label}</span>
                  {(activeChat.disappearingTimer || 0) === opt.val && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm text-wa-secondary hover:text-emerald-400 flex items-center gap-3"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Exportar chat (PDF, CSV, JSON)</span>
        </button>

        <button
          onClick={() => setShowBusinessProfile(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm text-wa-secondary hover:text-emerald-400 flex items-center gap-3"
        >
          <span className="text-base">🏢</span>
          <span>Perfil de Empresa Oficial (Meta Verified)</span>
        </button>

        <button
          onClick={handleToggleLockChat}
          className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm flex items-center gap-3 ${
            isChatLocked ? 'text-emerald-400 font-semibold' : 'text-wa-secondary'
          }`}
        >
          <span className="text-base">{isChatLocked ? '🔓' : '🔒'}</span>
          <span>{isChatLocked ? 'Desbloquear chat (Hacer visible)' : 'Bloquear chat con PIN'}</span>
        </button>

        <button
          onClick={handleToggleMute}
          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm text-wa-secondary flex items-center gap-3"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            {activeChat.isMuted
              ? <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              : <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            }
          </svg>
          {activeChat.isMuted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
        </button>

        <button
          onClick={handleToggleArchive}
          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-sm text-wa-secondary flex items-center gap-3"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
          {activeChat.isArchived ? 'Desarchivar chat' : 'Archivar chat'}
        </button>

        <button
          onClick={handleDeleteChat}
          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-3 ${
            confirmDelete ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'hover:bg-white/5 text-red-400'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          {confirmDelete
            ? '⚠️ Confirmar: eliminar chat'
            : (isGroup ? 'Salir del grupo' : 'Eliminar chat')}
        </button>
        {confirmDelete && (
          <button
            onClick={() => setConfirmDelete(false)}
            className="w-full text-left px-3 py-1.5 text-xs text-wa-secondary hover:text-wa-text transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      {showExportModal && (
        <ExportModal
          chat={activeChat}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* WhatsApp Business Labels Assignment Modal */}
      {showAssignLabels && (
        <AssignLabelsModal
          chat={activeChat}
          onClose={() => setShowAssignLabels(false)}
          onLabelsChanged={(updated) => setChatLabels(updated)}
        />
      )}

      {/* Meta Verified Business Profile Modal */}
      {showBusinessProfile && (
        <BusinessProfileModal
          onClose={() => setShowBusinessProfile(false)}
        />
      )}

      {/* Save Contact Modal */}
      {showSaveContact && (
        <SaveContactModal
          chat={activeChat}
          onClose={() => setShowSaveContact(false)}
        />
      )}
    </div>
  )
}
