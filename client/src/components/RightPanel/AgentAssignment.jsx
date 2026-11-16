import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { ChannelBadge, TicketStatusBadge } from '../Sidebar/UnifiedSidebar'

export default function AgentAssignment({ chat }) {
  const { updateChat } = useAppStore()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState(chat?.assignedAgentId || '')
  const [ticketStatus, setTicketStatus] = useState(chat?.status || 'open')
  const [chatChannel, setChatChannel] = useState(chat?.channel || 'whatsapp')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setSelectedAgentId(chat?.assignedAgentId || '')
    setTicketStatus(chat?.status || 'open')
    setChatChannel(chat?.channel || 'whatsapp')
  }, [chat?.id, chat?.assignedAgentId, chat?.status, chat?.channel])

  useEffect(() => {
    fetch('http://localhost:3001/api/agents')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data)
      })
      .catch(err => console.error('Error fetching agents:', err))
  }, [])

  const handleAssign = async (agentId) => {
    if (!chat?.id) return
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chat.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agentId || null, assignedBy: 'Yo' })
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedAgentId(agentId || '')
        if (data.chat) {
          updateChat(chat.id, data.chat)
        }
        setSaveMessage('Agente asignado exitosamente')
        setTimeout(() => setSaveMessage(''), 2500)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (!chat?.id) return
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chat.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        const data = await res.json()
        setTicketStatus(newStatus)
        if (data.chat) {
          updateChat(chat.id, data.chat)
        }
        setSaveMessage('Estado de ticket actualizado')
        setTimeout(() => setSaveMessage(''), 2500)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleChannelChange = async (newChannel) => {
    if (!chat?.id) return
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chat.id}/channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: newChannel })
      })
      if (res.ok) {
        const data = await res.json()
        setChatChannel(newChannel)
        if (data.chat) {
          updateChat(chat.id, data.chat)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const currentAgent = agents.find(a => a.id === selectedAgentId)

  return (
    <div className="bg-wa-input/40 rounded-xl p-3 border border-wa-border/60 space-y-3.5 my-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-wa-text uppercase tracking-wide">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Gestión de Ticket & Agente</span>
        </div>
        <ChannelBadge channel={chatChannel} size="sm" />
      </div>

      {saveMessage && (
        <div className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-center animate-fade-in font-medium">
          ✓ {saveMessage}
        </div>
      )}

      {/* Ticket Status Selector */}
      <div>
        <label className="text-[11px] font-semibold text-wa-secondary block mb-1.5">
          Estado del Ticket
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handleStatusChange('open')}
            disabled={loading}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              ticketStatus === 'open'
                ? 'bg-green-500/20 border-green-500 text-green-400 font-bold shadow-sm'
                : 'bg-wa-input border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span>Abierto</span>
          </button>

          <button
            onClick={() => handleStatusChange('pending')}
            disabled={loading}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              ticketStatus === 'pending'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-sm'
                : 'bg-wa-input border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>En Espera</span>
          </button>

          <button
            onClick={() => handleStatusChange('resolved')}
            disabled={loading}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              ticketStatus === 'resolved'
                ? 'bg-slate-500/30 border-slate-400 text-slate-200 font-bold shadow-sm'
                : 'bg-wa-input border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Resuelto</span>
          </button>
        </div>
      </div>

      {/* Assigned Agent Box */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-wa-secondary">
            Agente Asignado
          </label>
          {selectedAgentId !== 'agent-me' && (
            <button
              onClick={() => handleAssign('agent-me')}
              disabled={loading}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline transition-colors"
            >
              + Asignármelo a mí
            </button>
          )}
        </div>

        {/* Current Agent Info Card */}
        {currentAgent ? (
          <div className="flex items-center gap-2.5 p-2 bg-wa-input rounded-xl border border-wa-border/50">
            <img
              src={currentAgent.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={currentAgent.name}
              className="w-9 h-9 rounded-full object-cover border border-emerald-500/50"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-wa-text truncate">{currentAgent.name}</span>
                <span className={`w-2 h-2 rounded-full ${currentAgent.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}`} title={currentAgent.status}></span>
              </div>
              <p className="text-[10px] text-wa-secondary truncate">{currentAgent.role}</p>
            </div>
            <button
              onClick={() => handleAssign(null)}
              title="Desasignar agente"
              className="p-1.5 text-wa-secondary hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="p-2.5 bg-wa-input/60 rounded-xl border border-dashed border-wa-border text-center text-xs text-wa-secondary">
            <span>Conversación sin asignar</span>
          </div>
        )}

        {/* Select Agent Dropdown */}
        <div className="mt-2">
          <select
            value={selectedAgentId}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={loading}
            className="w-full bg-wa-input border border-wa-border rounded-lg px-2.5 py-1.5 text-xs text-wa-text focus:outline-none focus:border-wa-green transition-colors"
          >
            <option value="">Seleccionar agente del equipo...</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name} ({ag.role}) {ag.id === 'agent-me' ? '★ Yo' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Channel Switcher */}
      <div>
        <label className="text-[11px] font-semibold text-wa-secondary block mb-1">
          Canal de Origen
        </label>
        <div className="flex items-center gap-1 text-xs">
          {['whatsapp', 'telegram', 'web'].map(c => (
            <button
              key={c}
              onClick={() => handleChannelChange(c)}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] capitalize border transition-all ${
                chatChannel === c
                  ? 'bg-wa-green/20 border-wa-green text-wa-green font-bold'
                  : 'bg-wa-input border-transparent text-wa-secondary hover:text-wa-text'
              }`}
            >
              {c === 'web' ? 'Web Widget' : c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
