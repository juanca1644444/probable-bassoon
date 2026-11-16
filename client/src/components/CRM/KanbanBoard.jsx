import React, { useState, useEffect, useMemo } from 'react'
import useAppStore from '../../store/useAppStore'
import { formatChatTime, getAvatarGradient, getInitials } from '../../utils/formatters'

export default function KanbanBoard({ onClose, onSelectChat }) {
  const [pipeline, setPipeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dragOverStageId, setDragOverStageId] = useState(null)
  const [editingValueChatId, setEditingValueChatId] = useState(null)
  const [newDealValue, setNewDealValue] = useState('')
  const [showNewStageModal, setShowNewStageModal] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#10b981')
  const [activeCardId, setActiveCardId] = useState(null)

  const { addToast } = useAppStore()

  const fetchPipeline = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/crm/pipeline')
      if (res.ok) {
        const data = await res.json()
        setPipeline(data)
      }
    } catch (err) {
      console.error('Error fetching CRM pipeline:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPipeline()
  }, [])

  // Calculate totals
  const totalLeads = useMemo(() => {
    return pipeline.reduce((sum, s) => sum + (s.chatCount || 0), 0)
  }, [pipeline])

  const totalPipelineValue = useMemo(() => {
    return pipeline.reduce((sum, s) => sum + (s.totalValue || 0), 0)
  }, [pipeline])

  // Drag and Drop Handlers
  const handleDragStart = (e, chat, fromStageId) => {
    setActiveCardId(chat.id)
    e.dataTransfer.setData('application/json', JSON.stringify({
      chatId: chat.id,
      fromStageId,
      dealValue: chat.dealValue || 0,
      notes: chat.notes || ''
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setActiveCardId(null)
    setDragOverStageId(null)
  }

  const handleDragOver = (e, stageId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId)
    }
  }

  const handleDragLeave = (e, stageId) => {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null)
    }
  }

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault()
    setDragOverStageId(null)
    setActiveCardId(null)

    const rawData = e.dataTransfer.getData('application/json')
    if (!rawData) return

    try {
      const { chatId, fromStageId, dealValue, notes } = JSON.parse(rawData)
      if (fromStageId === targetStageId) return

      // Optimistic UI update
      setPipeline((prev) => {
        let draggedChat = null
        const next = prev.map((stage) => {
          if (stage.id === fromStageId) {
            draggedChat = stage.chats.find((c) => c.id === chatId)
            const remaining = stage.chats.filter((c) => c.id !== chatId)
            return {
              ...stage,
              chats: remaining,
              chatCount: remaining.length,
              totalValue: remaining.reduce((sum, c) => sum + (c.dealValue || 0), 0)
            }
          }
          return stage
        })

        if (!draggedChat) return prev

        return next.map((stage) => {
          if (stage.id === targetStageId) {
            const updatedChats = [{ ...draggedChat, stageId: targetStageId }, ...stage.chats]
            return {
              ...stage,
              chats: updatedChats,
              chatCount: updatedChats.length,
              totalValue: updatedChats.reduce((sum, c) => sum + (c.dealValue || 0), 0)
            }
          }
          return stage
        })
      })

      // Backend sync
      const res = await fetch(`http://localhost:3001/api/crm/chats/${chatId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: targetStageId, dealValue, notes })
      })

      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'CRM Pipeline',
          message: 'Estado del cliente actualizado',
        })
      }
    } catch (err) {
      console.error('Error on drop:', err)
      fetchPipeline() // Revert on error
    }
  }

  const handleSaveDealValue = async (chatId, stageId) => {
    const val = parseFloat(newDealValue) || 0
    try {
      await fetch(`http://localhost:3001/api/crm/chats/${chatId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, dealValue: val })
      })
      setEditingValueChatId(null)
      fetchPipeline()
    } catch (e) {
      console.error('Error saving deal value:', e)
    }
  }

  const handleCreateStage = async () => {
    if (!newStageName.trim()) return
    try {
      const res = await fetch('http://localhost:3001/api/crm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStageName.trim(), color: newStageColor })
      })
      if (res.ok) {
        setNewStageName('')
        setShowNewStageModal(false)
        fetchPipeline()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'CRM',
          message: 'Nueva etapa creada',
        })
      }
    } catch (e) {
      console.error('Error creating stage:', e)
    }
  }

  const handleDeleteStage = async (stageId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta etapa del pipeline?')) return
    try {
      await fetch(`http://localhost:3001/api/crm/stages/${stageId}`, { method: 'DELETE' })
      fetchPipeline()
    } catch (e) {
      console.error('Error deleting stage:', e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-wa-dark text-wa-text animate-fade-in select-none">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="h-16 bg-wa-header border-b border-gray-700/50 px-6 flex items-center justify-between flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                CRM Pipeline Kanban
              </h2>
              <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                WhatsApp Business Suite
              </span>
            </div>
            <p className="text-xs text-wa-secondary">
              Organiza tus conversaciones por etapas de venta y gestiona el ciclo de vida de tus clientes
            </p>
          </div>
        </div>

        {/* Metrics, Search and Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center gap-4 bg-black/20 border border-gray-700/40 rounded-xl px-4 py-1.5 text-xs">
            <div>
              <span className="text-gray-400 block text-[10px]">TOTAL LEADS</span>
              <span className="font-bold text-white text-sm">{totalLeads}</span>
            </div>
            <div className="h-6 w-px bg-gray-700" />
            <div>
              <span className="text-gray-400 block text-[10px]">VALOR PIPELINE</span>
              <span className="font-bold text-emerald-400 text-sm">€{totalPipelineValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Search Leads */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente o lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-60 bg-wa-input border border-gray-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-wa-text placeholder-wa-secondary outline-none focus:border-emerald-500 transition-all"
            />
            <span className="absolute left-2.5 top-2 text-xs text-wa-secondary">🔍</span>
          </div>

          {/* Add Stage Button */}
          <button
            onClick={() => setShowNewStageModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <span>➕</span>
            <span className="hidden sm:inline">Nueva Etapa</span>
          </button>

          {/* Close / Return Button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-white transition-colors"
            title="Cerrar y volver a chats"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Kanban Columns Board ───────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-6 bg-gradient-to-b from-wa-dark to-[#0c1317]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-wa-secondary text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Cargando pipeline comercial...
            </div>
          </div>
        ) : pipeline.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-wa-secondary text-sm">
            <p className="mb-2">No hay etapas en el CRM.</p>
            <button
              onClick={() => setShowNewStageModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Crear primera etapa
            </button>
          </div>
        ) : (
          <div className="flex gap-5 h-full items-start min-w-max pb-4">
            {pipeline.map((stage) => {
              const isOver = dragOverStageId === stage.id
              const filteredChats = (stage.chats || []).filter((c) => {
                const name = c.groupName || c.contactName || ''
                const msg = c.lastMessage || ''
                return name.toLowerCase().includes(search.toLowerCase()) || msg.toLowerCase().includes(search.toLowerCase())
              })

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={(e) => handleDragLeave(e, stage.id)}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className={`w-80 flex-shrink-0 flex flex-col max-h-full rounded-2xl border transition-all duration-200 shadow-xl ${
                    isOver
                      ? 'bg-emerald-950/20 border-emerald-500 shadow-emerald-500/10'
                      : 'bg-wa-sidebar/90 border-gray-700/50 hover:border-gray-600/70'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-gray-700/40 flex items-center justify-between bg-wa-header/80 rounded-t-2xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color || '#10b981' }}
                      />
                      <h3 className="font-bold text-sm text-wa-text truncate">{stage.name}</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/30 text-gray-300 flex-shrink-0">
                        {stage.chatCount || 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        €{(stage.totalValue || 0).toFixed(0)}
                      </span>
                      {pipeline.length > 1 && (
                        <button
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors text-xs"
                          title="Eliminar etapa"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cards List / Drop Area */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[160px]">
                    {filteredChats.length === 0 ? (
                      <div className="py-12 border-2 border-dashed border-gray-700/40 rounded-xl flex flex-col items-center justify-center text-gray-500 text-xs">
                        <span>Arrastra un cliente aquí</span>
                      </div>
                    ) : (
                      filteredChats.map((chat) => {
                        const isDragging = activeCardId === chat.id
                        const title = chat.groupName || chat.contactName || 'Contacto'

                        return (
                          <div
                            key={chat.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, chat, stage.id)}
                            onDragEnd={handleDragEnd}
                            className={`p-3.5 rounded-xl bg-wa-header border border-gray-700/50 hover:border-emerald-500/50 transition-all cursor-grab active:cursor-grabbing shadow-md group ${
                              isDragging ? 'opacity-40 scale-95 border-emerald-500' : 'hover:-translate-y-0.5'
                            }`}
                          >
                            {/* Card Top: Avatar, Name & Value */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {chat.contactAvatar ? (
                                  <img
                                    src={chat.contactAvatar}
                                    alt={title}
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className={`w-8 h-8 rounded-full ${getAvatarGradient(title)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                                    {getInitials(title)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-xs text-white truncate">{title}</h4>
                                  <p className="text-[10px] text-gray-400 truncate">{chat.contactPhone || 'WhatsApp Contact'}</p>
                                </div>
                              </div>

                              {/* Deal Value Tag / Editable */}
                              {editingValueChatId === chat.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    autoFocus
                                    defaultValue={chat.dealValue || 0}
                                    onChange={(e) => setNewDealValue(e.target.value)}
                                    className="w-16 bg-black border border-emerald-500 rounded px-1 py-0.5 text-xs text-white outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveDealValue(chat.id, stage.id)
                                      if (e.key === 'Escape') setEditingValueChatId(null)
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveDealValue(chat.id, stage.id)}
                                    className="text-emerald-400 text-xs font-bold"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingValueChatId(chat.id)
                                    setNewDealValue(String(chat.dealValue || 0))
                                  }}
                                  className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-0.5 rounded-full flex-shrink-0 transition-colors"
                                  title="Clic para editar valor del trato"
                                >
                                  €{Number(chat.dealValue || 0).toFixed(0)} ✎
                                </button>
                              )}
                            </div>

                            {/* Last message preview */}
                            {chat.lastMessage && (
                              <p className="text-[11px] text-wa-secondary line-clamp-2 mb-2.5 bg-black/20 p-2 rounded-lg border border-white/5">
                                "{chat.lastMessage}"
                              </p>
                            )}

                            {/* Card Footer: Timestamp & Open chat action */}
                            <div className="flex items-center justify-between pt-1 border-t border-gray-700/30 text-[10px] text-gray-400">
                              <span>{formatChatTime(chat.lastMessageTime)}</span>
                              <button
                                onClick={() => {
                                  if (onSelectChat) onSelectChat(chat)
                                  if (onClose) onClose()
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-emerald-600 hover:text-white rounded-lg text-gray-300 font-semibold transition-colors flex items-center gap-1"
                              >
                                <span>💬</span>
                                <span>Abrir chat</span>
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Create New Stage ───────────────────────────────── */}
      {showNewStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-wa-sidebar border border-gray-700/60 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">Crear nueva etapa en el Pipeline</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">Nombre de la etapa:</label>
                <input
                  type="text"
                  placeholder="Ej. En Negociación, Demo Agendada..."
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">Color distintivo:</label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#ef4444', '#06b6d4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewStageColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newStageColor === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/40">
              <button
                type="button"
                onClick={() => setShowNewStageModal(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateStage}
                disabled={!newStageName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors shadow"
              >
                Crear etapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
