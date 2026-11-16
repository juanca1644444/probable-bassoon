import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

export default function NewBroadcastModal({ onClose }) {
  const [contacts, setContacts] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [createdBroadcast, setCreatedBroadcast] = useState(null)
  const [sending, setSending] = useState(false)
  const [sentResult, setSentResult] = useState(null) // { count, recipients }
  const [activeTab, setActiveTab] = useState('new') // 'new' | 'saved'
  const [savedLists, setSavedLists] = useState([])
  const [loadingLists, setLoadingLists] = useState(false)

  const { addToast, setChats } = useAppStore()

  const fetchContacts = () => {
    setLoading(true)
    fetch('http://localhost:3001/api/contacts')
      .then((r) => r.json())
      .then((data) => {
        // Exclude 'me' so user does not broadcast to themselves
        setContacts(data.filter((c) => c.id !== 'me'))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const fetchSavedLists = () => {
    setLoadingLists(true)
    fetch('http://localhost:3001/api/broadcasts')
      .then((r) => r.json())
      .then((data) => {
        setSavedLists(data)
        setLoadingLists(false)
      })
      .catch(() => setLoadingLists(false))
  }

  useEffect(() => {
    fetchContacts()
    fetchSavedLists()
  }, [])

  const toggleContact = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(contacts.map((c) => c.id))
    }
  }

  const handleCreate = async () => {
    if (selectedIds.length < 2) {
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Difusión',
        message: 'Selecciona al menos 2 contactos para la difusión',
      })
      return
    }

    const finalName = name.trim() || `Difusión (${selectedIds.length} destinatarios)`
    setCreating(true)

    try {
      const res = await fetch('http://localhost:3001/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          memberIds: selectedIds,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setCreatedBroadcast(data)
        fetchSavedLists()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Lista de difusión',
          message: `Lista "${finalName}" creada exitosamente`,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectSavedList = (list) => {
    setCreatedBroadcast(list)
    setActiveTab('new')
  }

  const handleDeleteSavedList = async (e, listId) => {
    e.stopPropagation()
    try {
      await fetch(`http://localhost:3001/api/broadcasts/${listId}`, { method: 'DELETE' })
      setSavedLists((prev) => prev.filter((l) => l.id !== listId))
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Difusión eliminada',
        message: 'La lista de difusión fue eliminada',
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSendBroadcast = async () => {
    if (!messageText.trim() || !createdBroadcast) return
    setSending(true)

    try {
      const res = await fetch(`http://localhost:3001/api/broadcasts/${createdBroadcast.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageText.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setSentResult(data)

        // Immediately refresh chats in store so the sidebar updates in real time
        try {
          const chatsRes = await fetch('http://localhost:3001/api/chats')
          if (chatsRes.ok) {
            const freshChats = await chatsRes.json()
            setChats(freshChats)
          }
        } catch (e) {
          console.error('Error refreshing chats:', e)
        }

        addToast({
          id: `toast-${Date.now()}`,
          name: 'Difusión enviada',
          message: `Mensaje enviado a ${data.count} destinatarios con éxito`,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const filteredContacts = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-sidebar border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="bg-wa-header px-5 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xl flex-shrink-0">
              📢
            </div>
            <div>
              <h3 className="font-semibold text-wa-text text-base">
                {sentResult
                  ? '¡Difusión Entregada!'
                  : createdBroadcast
                  ? 'Enviar mensaje de difusión'
                  : 'Listas de Difusión'}
              </h3>
              <p className="text-xs text-wa-secondary">
                {sentResult
                  ? `${sentResult.count} mensajes entregados correctamente`
                  : createdBroadcast
                  ? `${createdBroadcast.name} • ${createdBroadcast.memberCount || createdBroadcast.members?.length || 0} destinatarios`
                  : `${selectedIds.length} de ${contacts.length} contactos seleccionados`}
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

        {/* Tab switcher if not composing or sent */}
        {!createdBroadcast && !sentResult && (
          <div className="flex border-b border-gray-700/40 bg-wa-input/30">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2 ${
                activeTab === 'new'
                  ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                  : 'text-wa-secondary border-transparent hover:text-wa-text'
              }`}
            >
              ✨ Nueva Lista ({selectedIds.length})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2 ${
                activeTab === 'saved'
                  ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                  : 'text-wa-secondary border-transparent hover:text-wa-text'
              }`}
            >
              📋 Listas Guardadas ({savedLists.length})
            </button>
          </div>
        )}

        {/* Content Branches */}
        {sentResult ? (
          /* Step 3: Success Confirmation Screen */
          <div className="p-6 flex-1 flex flex-col items-center justify-between overflow-y-auto space-y-4">
            <div className="text-center space-y-2 mt-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl animate-bounce">
                ✓
              </div>
              <h4 className="text-base font-bold text-white">¡Difusión enviada con éxito!</h4>
              <p className="text-xs text-wa-secondary max-w-xs mx-auto">
                El mensaje se entregó de forma individual y privada a cada uno de los destinatarios:
              </p>
            </div>

            {/* List of confirmed recipients */}
            <div className="w-full bg-wa-header/70 border border-emerald-500/30 rounded-xl p-3 max-h-56 overflow-y-auto divide-y divide-white/5 space-y-1">
              {(sentResult.recipients || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={r.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.name}`}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{r.phone}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ✓✓ Entregado
                  </span>
                </div>
              ))}
            </div>

            <div className="w-full pt-3 border-t border-gray-700/30 flex justify-end">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg"
              >
                Volver a los chats
              </button>
            </div>
          </div>
        ) : createdBroadcast ? (
          /* Step 2: Message composer */
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto">
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs text-gray-300">
                <span className="text-emerald-400 font-semibold">ℹ️ Entrega Directa e Individual: </span>
                Cada uno de los destinatarios seleccionados recibirá este mensaje como una conversación privada y directa contigo.
              </div>

              {/* Recipients summary chips */}
              <div>
                <p className="text-xs font-semibold text-wa-secondary mb-1.5">
                  Destinatarios confirmados ({createdBroadcast.members?.length || createdBroadcast.memberCount || 0}):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-wa-header rounded-xl border border-gray-700/40">
                  {(createdBroadcast.members || []).map((m) => (
                    <span
                      key={m.id || m.contactId}
                      className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-2 py-0.5 rounded-full"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {m.name || 'Contacto'}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1.5">
                  Mensaje para {createdBroadcast.name}:
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe el mensaje de difusión..."
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl p-3 text-sm text-wa-text placeholder-wa-secondary outline-none focus:border-emerald-500 resize-none shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-700/30">
              <button
                onClick={() => setCreatedBroadcast(null)}
                className="px-4 py-2 text-xs text-wa-secondary hover:text-wa-text rounded-xl"
              >
                ← Volver a lista
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-wa-secondary hover:text-wa-text rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  disabled={sending || !messageText.trim()}
                  onClick={handleSendBroadcast}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {sending ? 'Enviando difusión...' : 'Enviar difusión 🚀'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'saved' ? (
          /* Saved lists tab */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 bg-wa-input/40 border-b border-gray-700/30 text-xs text-wa-secondary flex justify-between items-center">
              <span>Listas de difusión creadas con anterioridad</span>
              <button
                onClick={fetchSavedLists}
                className="text-emerald-400 hover:underline text-[11px]"
              >
                🔄 Actualizar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-white/5">
              {loadingLists ? (
                <div className="py-12 text-center text-wa-secondary text-xs">Cargando listas...</div>
              ) : savedLists.length === 0 ? (
                <div className="py-12 text-center text-wa-secondary text-xs">
                  No hay listas de difusión guardadas. ¡Crea una en la pestaña "Nueva Lista"!
                </div>
              ) : (
                savedLists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => handleSelectSavedList(list)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                        📢
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-wa-text truncate">{list.name}</p>
                        <p className="text-xs text-wa-secondary truncate">
                          {list.memberCount || list.members?.length || 0} destinatarios
                          {list.members && list.members.length > 0 && (
                            <span className="text-gray-400 ml-1">
                              ({list.members.map((m) => m.name).slice(0, 3).join(', ')}
                              {list.members.length > 3 ? '...' : ''})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteSavedList(e, list.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar lista"
                      >
                        🗑️
                      </button>
                      <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors">
                        Usar lista →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Step 1: Select contacts & name */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Name input */}
            <div className="p-4 bg-wa-input/40 border-b border-gray-700/30 space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Nombre de la lista (ej. Clientes VIP)..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/50 rounded-xl px-3.5 py-2 text-sm text-wa-text placeholder-wa-secondary outline-none focus:border-emerald-500"
                />
              </div>

              {/* Selected chips */}
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1">
                  {selectedIds.map((id) => {
                    const c = contacts.find((x) => x.id === id)
                    return (
                      <span
                        key={id}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
                      >
                        {c?.name || 'Contacto'}
                        <button
                          onClick={() => toggleContact(id)}
                          className="hover:text-red-400 text-xs font-bold"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Search contacts & Select All toggle */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-wa-header px-3 py-1.5 rounded-xl border border-gray-700/50">
                  <svg className="w-4 h-4 text-wa-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar contactos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent text-xs text-wa-text placeholder-wa-secondary outline-none flex-1"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0 ${
                    allSelected
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-wa-header border-gray-700/50 text-wa-secondary hover:text-white'
                  }`}
                >
                  {allSelected ? '✓ Deseleccionar todos' : '☑ Seleccionar todos'}
                </button>
              </div>
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-white/5">
              {loading ? (
                <div className="py-10 text-center text-wa-secondary text-xs">Cargando contactos...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-wa-secondary text-xs">No se encontraron contactos</div>
              ) : (
                filteredContacts.map((contact) => {
                  const selected = selectedIds.includes(contact.id)
                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        selected ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.name}`}
                          alt={contact.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        {selected && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-black text-[10px] font-bold">
                            ✓
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-wa-text truncate">{contact.name}</p>
                        <p className="text-xs text-wa-secondary truncate">{contact.phone || contact.status}</p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          selected
                            ? 'bg-emerald-500 border-emerald-500 text-black font-bold text-xs'
                            : 'border-gray-600 hover:border-emerald-500'
                        }`}
                      >
                        {selected && '✓'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-wa-header flex items-center justify-between border-t border-gray-700/30">
              <span className="text-xs text-wa-secondary">
                {selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'} (mínimo 2)
              </span>
              <button
                disabled={creating || selectedIds.length < 2}
                onClick={handleCreate}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs transition-all disabled:opacity-40 shadow-md flex items-center gap-1.5"
              >
                {creating ? 'Creando...' : `Crear lista (${selectedIds.length}) →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
