// DirectPhoneModal.jsx — Modal para escribir a un número telefónico directamente y guardarlo en contactos
import React, { useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { sendMessage } from '../../utils/api'

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
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0])
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.replace(/^\+\d+\s*/, ''))
  const [contactName, setContactName] = useState('')
  const [saveToContacts, setSaveToContacts] = useState(true)
  const [initialMessage, setInitialMessage] = useState('')
  const [channel, setChannel] = useState('whatsapp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { chats, setChats, setActiveChat, addToast, addMessage } = useAppStore()

  // Clean raw phone numbers
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/[^\d\s-]/g, '')
    setPhoneNumber(val)
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      // 1. Check if a chat already exists with this phone number
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

        // Send initial message if present
        if (initialMessage.trim()) {
          const sent = await sendMessage(existingChat.id, {
            content: initialMessage.trim(),
            senderId: 'me'
          })
          addMessage(existingChat.id, sent)
        }

        addToast({
          id: `toast-${Date.now()}`,
          name: existingChat.contactName || fullPhoneNumber,
          message: 'Conversación existente abierta',
          chatId: existingChat.id
        })
        onClose()
        return
      }

      // 2. Create or save contact
      let contactId = null
      let createdContact = null

      // Always create a contact record in DB so SQLite relationships work perfectly
      const contactRes = await fetch('http://localhost:3001/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          phone: fullPhoneNumber,
          status: saveToContacts ? 'Contacto guardado' : 'Número no guardado',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
        })
      })

      if (contactRes.ok) {
        createdContact = await contactRes.json()
        contactId = createdContact.id
      }

      // 3. Create the chat
      const chatRes = await fetch('http://localhost:3001/api/chats', {
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

      // 4. Update application state
      setChats([fullChat, ...chats])
      if (onSelectChat) onSelectChat(fullChat)
      else setActiveChat(fullChat)

      // 5. Send initial message if provided
      if (initialMessage.trim()) {
        const sent = await sendMessage(fullChat.id, {
          content: initialMessage.trim(),
          senderId: 'me'
        })
        addMessage(fullChat.id, sent)
      }

      addToast({
        id: `toast-${Date.now()}`,
        name: displayName,
        message: saveToContacts
          ? 'Contacto guardado y chat iniciado con éxito'
          : 'Chat directo iniciado con éxito',
        chatId: fullChat.id
      })

      onClose()
    } catch (err) {
      console.error('Error starting direct chat:', err)
      setError(err.message || 'Error al iniciar la conversación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-wa-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
              📞
            </div>
            <div>
              <h3 className="text-wa-text font-bold text-base">Escribir a un Número</h3>
              <p className="text-wa-secondary text-xs">Chatea sin guardar o añade a tus contactos</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Phone Number Input with Country Code */}
          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
              Número de Teléfono <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              {/* Country Select */}
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
                      {c.flag} {c.code} ({c.country})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-wa-secondary text-xs">
                  ▼
                </div>
              </div>

              {/* Number Field */}
              <div className="flex-1 relative">
                <input
                  type="tel"
                  placeholder="Ej. 987 654 321"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  autoFocus
                  className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors h-11 placeholder:text-wa-secondary/60"
                />
              </div>
            </div>
            <p className="text-[11px] text-wa-secondary mt-1">
              Se enviará como: <span className="text-emerald-400 font-mono font-semibold">{phoneNumber.startsWith('+') ? phoneNumber : `${selectedCountry.code} ${phoneNumber || '...'}`}</span>
            </p>
          </div>

          {/* Contact Name (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
              Nombre o Alias del Contacto (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Juan Carlos (Cliente Mayorista)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors h-11 placeholder:text-wa-secondary/60"
            />
          </div>

          {/* Save to contacts toggle checkbox */}
          <div className="bg-wa-input/40 border border-white/5 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-wa-input/60 transition-colors"
               onClick={() => setSaveToContacts(!saveToContacts)}>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-xs font-semibold text-wa-text">Guardar en mi lista de contactos</p>
                <p className="text-[10px] text-wa-secondary">Quedará registrado permanentemente en la libreta</p>
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

          {/* Channel of Origin */}
          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
              Canal de Origen
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'whatsapp', label: 'WhatsApp', color: 'text-emerald-400', border: 'border-emerald-500/40 bg-emerald-500/10' },
                { id: 'telegram', label: 'Telegram', color: 'text-sky-400', border: 'border-sky-500/40 bg-sky-500/10' },
                { id: 'web', label: 'Web Widget', color: 'text-purple-400', border: 'border-purple-500/40 bg-purple-500/10' }
              ].map((ch) => (
                <button
                  type="button"
                  key={ch.id}
                  onClick={() => setChannel(ch.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    channel === ch.id
                      ? `${ch.border} ${ch.color} font-bold shadow-sm`
                      : 'border-white/5 bg-wa-input/60 text-wa-secondary hover:text-wa-text'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Message (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1.5 uppercase tracking-wider">
              Mensaje Inicial (Opcional)
            </label>
            <textarea
              rows="2"
              placeholder="Hola, te escribo para consultar..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full bg-wa-input text-wa-text text-xs rounded-xl p-3 border border-white/10 outline-none focus:border-wa-green transition-colors resize-none placeholder:text-wa-secondary/60"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-wa-secondary hover:text-wa-text hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-wa-green hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                  </svg>
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <span>💬</span>
                  <span>Iniciar Conversación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
