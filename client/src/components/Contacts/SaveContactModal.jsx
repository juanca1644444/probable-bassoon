// SaveContactModal.jsx — Modal para guardar o editar un número como contacto en la libreta
import React, { useState } from 'react'
import useAppStore from '../../store/useAppStore'

export default function SaveContactModal({ chat, onClose, onSaved }) {
  const [name, setName] = useState(chat?.contactName && !chat.contactName.startsWith('+') ? chat.contactName : '')
  const [phone, setPhone] = useState(chat?.contactPhone || '')
  const [status, setStatus] = useState(chat?.contactStatus || 'Disponible')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { chats, setChats, updateChat, addToast, addContact } = useAppStore()

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor ingresa un nombre para el contacto.')
      return
    }

    setLoading(true)
    setError('')

    try {
      let contactData = null
      // If chat already has a valid contactId, update it; otherwise create a new contact
      if (chat?.contactId) {
        const res = await fetch(`/api/contacts/${chat.contactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            status: status.trim()
          })
        })
        if (res.ok) contactData = await res.json()
      }

      if (!contactData) {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim() || chat?.contactPhone,
            status: status.trim() || 'Disponible',
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`
          })
        })
        if (res.ok) contactData = await res.json()
      }

      if (contactData) {
        if (addContact) addContact(contactData)
      }

      if (contactData && chat?.id) {
        // Update local chat info
        updateChat(chat.id, {
          contactName: contactData.name,
          contactPhone: contactData.phone,
          contactStatus: contactData.status,
          contactAvatar: contactData.avatar
        })

        // Also update chats list
        setChats(
          chats.map((c) =>
            c.id === chat.id
              ? {
                  ...c,
                  contactName: contactData.name,
                  contactPhone: contactData.phone,
                  contactStatus: contactData.status,
                  contactAvatar: contactData.avatar
                }
              : c
          )
        )

        addToast({
          id: `toast-${Date.now()}`,
          name: contactData.name,
          message: 'Contacto guardado en tu libreta exitosamente',
          chatId: chat.id
        })

        if (onSaved) onSaved(contactData)
        onClose()
      } else {
        throw new Error('No se pudo guardar el contacto.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al guardar contacto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/10 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-wa-header">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👤</span>
            <h3 className="text-wa-text font-bold text-sm">Guardar en Contactos</h3>
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

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1">
              Nombre del contacto <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. María Elena, Proveedor XYZ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1">
              Número de Teléfono
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-wa-secondary mb-1">
              Estado / Info.
            </label>
            <input
              type="text"
              placeholder="Ej. Disponible, Cliente Frecuente"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2.5 border border-white/10 outline-none focus:border-wa-green transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-wa-secondary hover:text-wa-text hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-wa-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {loading ? 'Guardando...' : 'Guardar Contacto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
