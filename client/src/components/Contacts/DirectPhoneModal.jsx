// DirectPhoneModal.jsx — Modal Unificado de Comunicación: Búsqueda de Contactos, Llamadas WebRTC y Marcado Directo
import React, { useState, useEffect, useMemo } from 'react'
import useAppStore from '../../store/useAppStore'
import { sendMessage, fetchContacts, createContact, createChat } from '../../utils/api'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

export const COUNTRY_CODES = [
  { code: '+51', country: 'Perú', flag: '🇵🇪', digits: 9 },
  { code: '+34', country: 'España', flag: '🇪🇸', digits: 9 },
  { code: '+52', country: 'México', flag: '🇲🇽', digits: 10 },
  { code: '+1', country: 'Estados Unidos / Canadá', flag: '🇺🇸', digits: 10 },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', digits: 10 },
  { code: '+54', country: 'Argentina', flag: '🇦🇷', digits: 10 },
  { code: '+56', country: 'Chile', flag: '🇨🇱', digits: 9 },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨', digits: 9 },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴', digits: 8 },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪', digits: 10 },
  { code: '+55', country: 'Brasil', flag: '🇧🇷', digits: 11 },
]

export default function DirectPhoneModal({ onClose, onSelectChat, initialPhone = '' }) {
  const [activeTab, setActiveTab] = useState('contacts') // 'contacts' | 'direct'
  const [search, setSearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0])
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.replace(/^\+\d+\s*/, ''))
  const [contactName, setContactName] = useState('')
  const [saveToContacts, setSaveToContacts] = useState(true)
  const [channel, setChannel] = useState('whatsapp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    chats,
    contacts,
    setContacts,
    setActiveChat,
    addToast,
    addContact,
    addOrUpdateChat,
    startCall
  } = useAppStore()

  // Cargar contactos actualizados al abrir el modal si está vacío
  useEffect(() => {
    if (!contacts || contacts.length === 0) {
      fetch('/api/contacts')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setContacts(data)
        })
        .catch(() => {})
    }
  }, [contacts, setContacts])

  // Filtrado de contactos existentes para búsqueda rápida
  const filteredContacts = useMemo(() => {
    const list = (contacts || []).filter((c) => c.id !== 'me')
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    )
  }, [contacts, search])

  // Clean raw phone numbers
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/[^\d\s-]/g, '')
    setPhoneNumber(val)
    if (error) setError('')
  }

  // Helper para resolver o crear el chat correspondiente
  const resolveChatForContact = async (targetContact) => {
    let existing = chats.find(
      (c) =>
        c.type === 'individual' &&
        (c.contactId === targetContact.id ||
          c.id === targetContact.id ||
          (c.contactPhone && c.contactPhone === targetContact.phone))
    )
    if (existing) return existing

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: targetContact.id,
          type: 'individual',
          channel: 'whatsapp',
          status: 'open'
        })
      })
      if (res.ok) {
        const newChat = await res.json()
        const fullChat = {
          ...newChat,
          contactName: targetContact.name,
          contactPhone: targetContact.phone,
          contactAvatar: targetContact.avatar || null,
          contactStatus: targetContact.status || '',
          contactIsOnline: targetContact.isOnline ?? 1,
          channel: 'whatsapp'
        }
        addOrUpdateChat(fullChat)
        return fullChat
      }
    } catch (e) {
      console.warn('Error resolviendo chat:', e)
    }

    const fallbackChat = {
      id: targetContact.id,
      contactId: targetContact.id,
      contactName: targetContact.name,
      contactPhone: targetContact.phone,
      contactAvatar: targetContact.avatar || null,
      contactStatus: targetContact.status || '',
      type: 'individual',
      channel: 'whatsapp'
    }
    addOrUpdateChat(fallbackChat)
    return fallbackChat
  }

  // Acción sobre un contacto existente (Chat, Voz o Video)
  const handleContactAction = async (contact, actionType) => {
    setLoading(true)
    try {
      const chat = await resolveChatForContact(contact)
      if (onSelectChat) onSelectChat(chat)
      else setActiveChat(chat)

      onClose()

      if (actionType === 'voice') {
        startCall(chat, 'voice')
      } else if (actionType === 'video') {
        startCall(chat, 'video')
      }
    } catch (err) {
      console.error(err)
      setError('No se pudo iniciar la comunicación.')
    } finally {
      setLoading(false)
    }
  }

  // Acción sobre un número nuevo directo
  const handleDirectAction = async (actionType = 'chat') => {
    const cleanDigits = phoneNumber.replace(/[\s-]/g, '')
    if (!cleanDigits || cleanDigits.length < 6) {
      setError('Por favor ingresa un número de teléfono válido (al menos 6 dígitos).')
      return
    }

    setLoading(true)
    setError('')

    const fullPhoneNumber = phoneNumber.startsWith('+')
      ? phoneNumber.trim()
      : `${selectedCountry.code} ${cleanDigits}`

    const displayName = contactName.trim() || fullPhoneNumber

    try {
      // 1. Verificar si ya existe conversación con este teléfono
      const existingChat = chats.find(
        (c) =>
          c.type === 'individual' &&
          (c.contactPhone === fullPhoneNumber ||
            (c.contactPhone && c.contactPhone.replace(/[\s-]/g, '') === fullPhoneNumber.replace(/[\s-]/g, '')) ||
            (c.contactName && c.contactName === fullPhoneNumber))
      )

      if (existingChat) {
        if (onSelectChat) onSelectChat(existingChat)
        else setActiveChat(existingChat)

        onClose()

        if (actionType === 'voice') startCall(existingChat, 'voice')
        else if (actionType === 'video') startCall(existingChat, 'video')
        return
      }

      // 2. Crear o guardar contacto si corresponde
      let contactId = null
      let createdContact = null

      const contactRes = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          phone: fullPhoneNumber,
          status: saveToContacts ? 'Contacto guardado' : 'Número temporal',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
        })
      })

      if (contactRes.ok) {
        createdContact = await contactRes.json()
        contactId = createdContact.id
        if (saveToContacts && addContact) {
          addContact(createdContact)
        }
      }

      // 3. Crear el chat
      const chatRes = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contactId,
          type: 'individual',
          channel: channel,
          status: 'open'
        })
      })

      if (!chatRes.ok) {
        throw new Error('No se pudo crear la conversación.')
      }

      const newChat = await chatRes.json()
      const fullChat = {
        ...newChat,
        contactName: displayName,
        contactPhone: fullPhoneNumber,
        contactAvatar: createdContact?.avatar || null,
        contactStatus: createdContact?.status || '',
        contactIsOnline: 1,
        channel: channel
      }

      addOrUpdateChat(fullChat)
      if (onSelectChat) onSelectChat(fullChat)
      else setActiveChat(fullChat)

      addToast({
        id: `toast-${Date.now()}`,
        name: displayName,
        message: saveToContacts ? 'Contacto guardado' : 'Chat temporal iniciado',
        chatId: fullChat.id
      })

      onClose()

      if (actionType === 'voice') startCall(fullChat, 'voice')
      else if (actionType === 'video') startCall(fullChat, 'video')
    } catch (err) {
      console.error('Error starting communication:', err)
      setError(err.message || 'Error al iniciar la comunicación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-wa-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shadow-sm">
              📞
            </div>
            <div>
              <h3 className="text-wa-text font-bold text-base leading-tight">Iniciar Llamada o Chat</h3>
              <p className="text-wa-secondary text-xs">Busca un contacto o marca un número directo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-wa-icon hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-wa-header/80 px-4 pt-1">
          <button
            type="button"
            onClick={() => { setActiveTab('contacts'); setError('') }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'contacts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>👥</span>
            <span>Contactos Guardados ({filteredContacts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('direct'); setError('') }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'direct'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>📱</span>
            <span>Número Directo</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: CONTACTOS GUARDADOS */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o rol..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-wa-input text-wa-text text-xs rounded-xl pl-9 pr-4 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors"
                />
                <span className="absolute left-3 top-2.5 text-wa-secondary text-sm">🔍</span>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-2.5 text-wa-secondary hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Contacts List */}
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-thin pr-1">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-wa-secondary text-xs">
                    <p className="text-2xl mb-1">🔍</p>
                    <p>No se encontraron contactos</p>
                    <button
                      onClick={() => setActiveTab('direct')}
                      className="mt-2 text-emerald-400 hover:underline font-semibold"
                    >
                      Escribir o llamar a un número nuevo ➔
                    </button>
                  </div>
                ) : (
                  filteredContacts.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-wa-input/40 hover:bg-wa-input/80 border border-white/5 rounded-xl flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {c.avatar ? (
                          <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow`}>
                            {getInitials(c.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-wa-text font-bold text-sm truncate leading-tight">{c.name}</p>
                          <p className="text-wa-secondary text-[11px] truncate">{c.phone || c.status || 'Contacto de Red'}</p>
                        </div>
                      </div>

                      {/* Direct Call & Chat Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Audio Call */}
                        <button
                          type="button"
                          onClick={() => handleContactAction(c, 'voice')}
                          disabled={loading}
                          title="Llamada de voz WebRTC"
                          className="w-8 h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white flex items-center justify-center transition-all transform hover:scale-105"
                        >
                          <span className="text-sm">📞</span>
                        </button>
                        {/* Video Call */}
                        <button
                          type="button"
                          onClick={() => handleContactAction(c, 'video')}
                          disabled={loading}
                          title="Videollamada WebRTC"
                          className="w-8 h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white flex items-center justify-center transition-all transform hover:scale-105"
                        >
                          <span className="text-sm">📹</span>
                        </button>
                        {/* Open Chat */}
                        <button
                          type="button"
                          onClick={() => handleContactAction(c, 'chat')}
                          disabled={loading}
                          title="Abrir Chat"
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-wa-icon hover:text-white flex items-center justify-center transition-all"
                        >
                          <span className="text-sm">💬</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: NÚMERO DIRECTO */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              {/* Phone Field */}
              <div>
                <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
                  Número Telefónico <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = COUNTRY_CODES.find((c) => c.code === e.target.value)
                        if (found) setSelectedCountry(found)
                      }}
                      className="bg-wa-input text-wa-text text-xs rounded-xl px-3 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors cursor-pointer appearance-none pr-7 h-11"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-wa-header text-wa-text">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-wa-secondary text-xs">
                      ▼
                    </div>
                  </div>

                  <input
                    type="tel"
                    placeholder="Ej. 987 654 321"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    autoFocus
                    className="flex-1 bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors h-11 placeholder:text-wa-secondary/60"
                  />
                </div>
                <p className="text-[11px] text-wa-secondary mt-1">
                  Se marcará como: <span className="text-emerald-400 font-mono font-semibold">{phoneNumber.startsWith('+') ? phoneNumber : `${selectedCountry.code} ${phoneNumber || '...'}`}</span>
                </p>
              </div>

              {/* Contact Name (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
                  Nombre del Contacto (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Carlos (Cliente Mayorista)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors h-11 placeholder:text-wa-secondary/60"
                />
              </div>

              {/* Checkbox: Guardar o no en la lista de contactos */}
              <div
                className="bg-wa-input/40 border border-white/5 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-wa-input/60 transition-colors select-none"
                onClick={() => setSaveToContacts(!saveToContacts)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">📇</span>
                  <div>
                    <p className="text-xs font-semibold text-wa-text">Incluir en mi lista de contactos</p>
                    <p className="text-[10px] text-wa-secondary">
                      {saveToContacts ? 'Se guardará permanentemente en el directorio' : 'No se guardará, solo se abrirá para esta llamada o chat'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={saveToContacts}
                  onChange={(e) => setSaveToContacts(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Botonera de Acción Triple (Llamar Voz, Videollamada, Chat) */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-wa-secondary mb-2 uppercase tracking-wider text-center">
                  ¿Cómo deseas comunicarte?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {/* Voz */}
                  <button
                    type="button"
                    onClick={() => handleDirectAction('voice')}
                    disabled={loading}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md flex flex-col items-center gap-1 disabled:opacity-50"
                  >
                    <span className="text-xl">📞</span>
                    <span>Llamada Voz</span>
                  </button>

                  {/* Video */}
                  <button
                    type="button"
                    onClick={() => handleDirectAction('video')}
                    disabled={loading}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md flex flex-col items-center gap-1 disabled:opacity-50"
                  >
                    <span className="text-xl">📹</span>
                    <span>Videollamada</span>
                  </button>

                  {/* Chat */}
                  <button
                    type="button"
                    onClick={() => handleDirectAction('chat')}
                    disabled={loading}
                    className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-wa-text rounded-xl text-xs font-bold transition-all border border-white/10 flex flex-col items-center gap-1 disabled:opacity-50"
                  >
                    <span className="text-xl">💬</span>
                    <span>Abrir Chat</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
