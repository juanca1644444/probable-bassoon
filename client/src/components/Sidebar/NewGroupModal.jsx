import React, { useState, useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

const PRESET_EMOJIS = ['🚀', '💼', '🎮', '🏠', '❤️', '🌟', '🎉', '🏆', '🎵', '📚']

function Avatar({ name, avatar, size = 'md' }) {
  const sz = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm'
  return avatar ? (
    <img src={avatar} alt={name} className={`${sz} rounded-full object-cover`} />
  ) : (
    <div className={`${sz} rounded-full ${getAvatarGradient(name || 'G')} flex items-center justify-center font-bold text-white`}>
      {name ? getInitials(name) : '👥'}
    </div>
  )
}

export default function NewGroupModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([]) // array of contact objects
  const [groupName, setGroupName] = useState('')
  const [groupAvatar, setGroupAvatar] = useState('') // URL or emoji
  const [avatarMode, setAvatarMode] = useState('auto') // 'auto' | 'emoji' | 'upload'
  const [selectedEmoji, setSelectedEmoji] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef()
  const { addToast, setActiveChat } = useAppStore()

  // Load contacts
  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(() => setContacts([]))
  }, [])

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleContact = (contact) => {
    setSelected(prev =>
      prev.find(c => c.id === contact.id)
        ? prev.filter(c => c.id !== contact.id)
        : [...prev, contact]
    )
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    // Upload file
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setGroupAvatar(data.url || data.filePath || '')
        setAvatarMode('upload')
      }
    } catch {}
  }

  const getAvatarUrl = () => {
    if (avatarMode === 'upload' && groupAvatar) return groupAvatar
    if (avatarMode === 'emoji') return '' // show emoji as text
    // auto: dicebear
    if (groupName.trim()) return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName.trim())}`
    return ''
  }

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('El nombre del grupo es obligatorio'); return }
    if (selected.length === 0) { setError('Selecciona al menos un participante'); return }
    setLoading(true)
    setError('')
    try {
      const avatarUrl = avatarMode === 'emoji'
        ? '' // server will use dicebear
        : getAvatarUrl()

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          avatar: avatarUrl,
          memberIds: selected.map(c => c.id),
          emoji: avatarMode === 'emoji' ? selectedEmoji : null,
        }),
      })
      if (!res.ok) throw new Error('Error al crear el grupo')
      const data = await res.json()
      addToast({
        id: Date.now().toString(),
        name: 'Sistema',
        message: `Grupo "${groupName.trim()}" creado`,
        avatar: '',
        chatId: data.chat?.id,
      })
      onCreated(data.chat)
      onClose()
    } catch (e) {
      setError(e.message || 'Error al crear el grupo')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: Contact Selection ────────────────────────────────────────────
  const renderStep1 = () => (
    <>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {selected.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 bg-wa-green/20 border border-wa-green/40 rounded-full pl-1 pr-2 py-1"
            >
              <Avatar name={c.name} avatar={c.avatar} size="xs" />
              <span className="text-xs text-wa-text">{c.name.split(' ')[0]}</span>
              <button
                onClick={() => toggleContact(c)}
                className="text-wa-secondary hover:text-red-400 transition-colors ml-0.5"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center bg-wa-input rounded-lg px-3 gap-2">
          <svg className="w-4 h-4 text-wa-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar contactos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent flex-1 py-2 text-sm text-wa-text placeholder:text-wa-secondary outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-wa-secondary text-sm">
            <span>Sin resultados</span>
          </div>
        ) : (
          filtered.map(contact => {
            const isSelected = selected.some(c => c.id === contact.id)
            return (
              <div
                key={contact.id}
                onClick={() => toggleContact(contact)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${isSelected ? 'bg-wa-green/5' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${isSelected ? 'ring-2 ring-wa-green' : ''}`}>
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${getAvatarGradient(contact.name)} flex items-center justify-center text-white text-sm font-semibold`}>
                        {getInitials(contact.name)}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-wa-green rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-wa-text text-sm font-medium truncate">{contact.name}</p>
                  <p className="text-wa-secondary text-xs truncate">{contact.phone || contact.status || 'Contacto'}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-wa-green border-wa-green' : 'border-wa-secondary'}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-wa-secondary text-xs">{selected.length} seleccionado{selected.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setStep(2)}
          disabled={selected.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            selected.length > 0
              ? 'bg-wa-green text-white hover:bg-wa-green/90 shadow-lg shadow-wa-green/20'
              : 'bg-wa-input text-wa-secondary cursor-not-allowed'
          }`}
        >
          Siguiente
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  )

  // ── Step 2: Group Info ───────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
      {/* Avatar section */}
      <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-white/5">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {avatarMode === 'emoji' && selectedEmoji ? (
            <div className="w-24 h-24 rounded-full bg-wa-input flex items-center justify-center text-5xl ring-2 ring-wa-green ring-offset-2 ring-offset-wa-header">
              {selectedEmoji}
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-wa-green ring-offset-2 ring-offset-wa-header">
              {groupAvatar && avatarMode === 'upload' ? (
                <img src={groupAvatar} alt="avatar" className="w-full h-full object-cover" />
              ) : groupName.trim() ? (
                <img
                  src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName.trim())}&backgroundColor=00897b`}
                  alt="avatar"
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display='none' }}
                />
              ) : (
                <div className="w-full h-full bg-wa-input flex items-center justify-center">
                  <svg className="w-10 h-10 text-wa-secondary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
              )}
            </div>
          )}
          {/* Camera overlay */}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zm6.4-8.4h-1.68l-1.08-1.6H8.36L7.28 6.8H5.6C4.72 6.8 4 7.52 4 8.4v9.6c0 .88.72 1.6 1.6 1.6h12.8c.88 0 1.6-.72 1.6-1.6V8.4c0-.88-.72-1.6-1.6-1.6z"/>
            </svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <p className="text-wa-secondary text-xs mt-2">Toca para cambiar la foto</p>
      </div>

      {/* Emoji presets */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-wa-secondary text-xs mb-2 uppercase tracking-wider">Avatar rápido</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { setSelectedEmoji(emoji); setAvatarMode('emoji'); setGroupAvatar('') }}
              className={`w-10 h-10 rounded-full text-xl transition-all ${
                avatarMode === 'emoji' && selectedEmoji === emoji
                  ? 'bg-wa-green shadow-lg shadow-wa-green/30 scale-110'
                  : 'bg-wa-input hover:bg-white/10'
              }`}
            >
              {emoji}
            </button>
          ))}
          {/* Reset to auto */}
          {avatarMode !== 'auto' && (
            <button
              onClick={() => { setAvatarMode('auto'); setSelectedEmoji(''); setGroupAvatar('') }}
              className="w-10 h-10 rounded-full bg-wa-input hover:bg-white/10 transition-all flex items-center justify-center"
              title="Restablecer"
            >
              <svg className="w-4 h-4 text-wa-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Group name */}
      <div className="px-4 py-4">
        <label className="text-wa-secondary text-xs uppercase tracking-wider">Nombre del grupo</label>
        <div className="mt-2 flex items-center border-b-2 border-wa-green pb-1">
          <input
            type="text"
            placeholder="Nombre del grupo (requerido)"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            maxLength={40}
            className="flex-1 bg-transparent text-wa-text text-sm outline-none placeholder:text-wa-secondary"
            autoFocus
          />
          <span className="text-wa-secondary text-xs">{groupName.length}/40</span>
        </div>
      </div>

      {/* Selected members preview */}
      <div className="px-4 pb-3">
        <p className="text-wa-secondary text-xs uppercase tracking-wider mb-2">
          Participantes · {selected.length}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <span key={c.id} className="flex items-center gap-1 bg-wa-input text-wa-secondary text-xs px-2 py-1 rounded-full">
              {c.name.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between mt-auto">
        <button
          onClick={() => { setStep(1); setError('') }}
          className="flex items-center gap-1.5 text-wa-secondary hover:text-wa-text transition-colors text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <button
          onClick={handleCreate}
          disabled={loading || !groupName.trim()}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            !loading && groupName.trim()
              ? 'bg-wa-green text-white hover:bg-wa-green/90 shadow-lg shadow-wa-green/20'
              : 'bg-wa-input text-wa-secondary cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83" />
              </svg>
              Creando...
            </>
          ) : (
            <>
              Crear grupo
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-sm flex flex-col animate-fade-in-up overflow-hidden"
           style={{ maxHeight: '90vh' }}>
        {/* Modal header */}
        <div className="flex items-center gap-3 px-4 py-4 bg-wa-header sticky top-0 z-10 border-b border-white/5">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-wa-icon transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h2 className="text-wa-text font-semibold text-sm">
              {step === 1 ? 'Nuevo grupo' : 'Info. del grupo'}
            </h2>
            <p className="text-wa-secondary text-xs">
              {step === 1 ? 'Selecciona participantes' : 'Personaliza tu grupo'}
            </p>
          </div>
          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-wa-green' : 'bg-wa-secondary'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-wa-green' : 'bg-wa-secondary'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {step === 1 ? renderStep1() : renderStep2()}
        </div>
      </div>
    </div>
  )
}
