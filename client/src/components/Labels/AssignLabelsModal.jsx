import React, { useState, useEffect } from 'react'

export default function AssignLabelsModal({ chat, onClose, onLabelsChanged }) {
  const [allLabels, setAllLabels] = useState([])
  const [assignedIds, setAssignedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!chat) return
    const load = async () => {
      try {
        const [labelsRes, chatRes] = await Promise.all([
          fetch('http://localhost:3001/api/labels'),
          fetch(`http://localhost:3001/api/chats/${chat.id}/labels`)
        ])
        if (labelsRes.ok) setAllLabels(await labelsRes.json())
        if (chatRes.ok) {
          const chatLabels = await chatRes.json()
          setAssignedIds(chatLabels.map((l) => l.id))
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [chat])

  const toggleLabel = (id) => {
    setAssignedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chat.id}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelIds: assignedIds })
      })
      if (res.ok) {
        const updated = await res.json()
        if (onLabelsChanged) onLabelsChanged(updated)
        onClose()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const chatName = chat?.groupName || chat?.contactName || 'Chat'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-wa-header border-b border-wa-border/50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-wa-text flex items-center gap-1.5">
              <span>🏷️</span>
              <span>Etiquetas del Chat</span>
            </h3>
            <p className="text-[10px] text-wa-secondary truncate max-w-[220px]">
              {chatName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-secondary hover:text-wa-text hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
          {loading ? (
            <p className="text-xs text-wa-secondary text-center py-4">Cargando etiquetas...</p>
          ) : allLabels.length === 0 ? (
            <p className="text-xs text-wa-secondary text-center py-4">No hay etiquetas disponibles.</p>
          ) : (
            allLabels.map((lbl) => {
              const isChecked = assignedIds.includes(lbl.id)
              return (
                <div
                  key={lbl.id}
                  onClick={() => toggleLabel(lbl.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-white/10 border-emerald-500/40 text-wa-text'
                      : 'bg-wa-input/40 border-transparent hover:bg-white/5 text-wa-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                      style={{ backgroundColor: lbl.color }}
                    />
                    <span className="text-xs font-medium text-wa-text">{lbl.name}</span>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-wa-green focus:ring-0 bg-transparent border-gray-600"
                  />
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-wa-header/80 border-t border-wa-border/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-wa-input hover:bg-white/10 text-wa-text rounded-xl text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-wa-green hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            {saving ? 'Guardando...' : 'Guardar Etiquetas'}
          </button>
        </div>
      </div>
    </div>
  )
}
