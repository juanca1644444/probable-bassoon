import React, { useState, useEffect } from 'react'

export const LABEL_COLORS = [
  { id: '#eab308', name: 'Amarillo', bg: 'bg-yellow-500', text: 'text-yellow-400' },
  { id: '#3b82f6', name: 'Azul', bg: 'bg-blue-500', text: 'text-blue-400' },
  { id: '#f97316', name: 'Naranja', bg: 'bg-orange-500', text: 'text-orange-400' },
  { id: '#22c55e', name: 'Verde', bg: 'bg-green-500', text: 'text-green-400' },
  { id: '#a855f7', name: 'Púrpura', bg: 'bg-purple-500', text: 'text-purple-400' },
  { id: '#ef4444', name: 'Rojo', bg: 'bg-red-500', text: 'text-red-400' },
  { id: '#06b6d4', name: 'Cian', bg: 'bg-cyan-500', text: 'text-cyan-400' },
  { id: '#ec4899', name: 'Rosa', bg: 'bg-pink-500', text: 'text-pink-400' },
]

export default function LabelsModal({ onClose, onSelectFilterLabel }) {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].id)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0].id)

  const fetchLabels = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/labels')
      if (res.ok) {
        const data = await res.json()
        setLabels(data)
      }
    } catch (e) {
      console.error('Error fetching labels:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLabels()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch('http://localhost:3001/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: selectedColor })
      })
      if (res.ok) {
        setNewName('')
        fetchLabels()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdate = async (id) => {
    if (!editName.trim()) return
    try {
      const res = await fetch(`http://localhost:3001/api/labels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor })
      })
      if (res.ok) {
        setEditingId(null)
        fetchLabels()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta etiqueta? Se quitará de todos los chats.')) return
    try {
      await fetch(`http://localhost:3001/api/labels/${id}`, { method: 'DELETE' })
      fetchLabels()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-wa-header border-b border-wa-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <div>
              <h3 className="text-sm font-bold text-wa-text">Etiquetas de WhatsApp Business</h3>
              <p className="text-[11px] text-wa-secondary">Organiza y segmenta tus conversaciones por estado comercial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-secondary hover:text-wa-text hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
          {/* Create new label */}
          <form onSubmit={handleCreate} className="p-4 bg-wa-input/50 rounded-xl border border-wa-border/60 space-y-3">
            <span className="text-xs font-semibold text-wa-text block">Crear Nueva Etiqueta</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. Cliente VIP, En Seguimiento..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={30}
                className="flex-1 bg-wa-header border border-wa-border/80 rounded-lg px-3 py-2 text-xs text-wa-text placeholder-wa-secondary outline-none focus:border-wa-green"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="px-4 py-2 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                + Crear
              </button>
            </div>

            {/* Color picker */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-wa-secondary">Color:</span>
              <div className="flex gap-2">
                {LABEL_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColor(col.id)}
                    className={`w-6 h-6 rounded-full transition-transform ${col.bg} ${
                      selectedColor === col.id ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={col.name}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* List of labels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-wa-secondary">
              <span>Etiquetas Activas ({labels.length})</span>
              <span>Chats</span>
            </div>

            {loading ? (
              <p className="text-xs text-wa-secondary text-center py-4">Cargando etiquetas...</p>
            ) : labels.length === 0 ? (
              <p className="text-xs text-wa-secondary text-center py-4">No hay etiquetas creadas aún.</p>
            ) : (
              labels.map((lbl) => (
                <div
                  key={lbl.id}
                  className="flex items-center justify-between p-3 bg-wa-header/80 rounded-xl border border-wa-border/40 hover:border-wa-border transition-colors group"
                >
                  {editingId === lbl.id ? (
                    <div className="flex-1 flex items-center gap-2 mr-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-wa-dark border border-wa-green rounded px-2 py-1 text-xs text-wa-text flex-1 outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {LABEL_COLORS.slice(0, 5).map((col) => (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setEditColor(col.id)}
                            className={`w-4 h-4 rounded-full ${col.bg} ${editColor === col.id ? 'ring-2 ring-white' : ''}`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleUpdate(lbl.id)}
                        className="text-xs text-emerald-400 font-bold px-2 py-1 hover:underline"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-wa-secondary px-1 hover:underline"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: lbl.color }}
                      />
                      <span className="text-xs font-semibold text-wa-text truncate">{lbl.name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-wa-input text-wa-secondary">
                      {lbl.chatCount || 0}
                    </span>

                    {onSelectFilterLabel && (
                      <button
                        onClick={() => {
                          onSelectFilterLabel(lbl)
                          onClose()
                        }}
                        className="p-1 rounded hover:bg-white/10 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Ver chats con esta etiqueta"
                      >
                        Filtrar
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingId(lbl.id)
                        setEditName(lbl.name)
                        setEditColor(lbl.color)
                      }}
                      className="p-1 rounded hover:bg-white/10 text-wa-secondary hover:text-wa-text transition-colors text-xs"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(lbl.id)}
                      className="p-1 rounded hover:bg-white/10 text-rose-400/70 hover:text-rose-400 transition-colors text-xs"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-wa-header/80 border-t border-wa-border/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-wa-input hover:bg-white/10 text-wa-text rounded-xl text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
