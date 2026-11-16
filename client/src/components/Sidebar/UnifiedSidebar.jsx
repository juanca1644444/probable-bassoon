import React, { useRef } from 'react'

export const CHANNELS = [
  {
    id: 'all',
    name: 'Todos',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    color: 'text-wa-text',
    badgeBg: 'bg-wa-input'
  },
  {
    id: 'whatsapp',
    name: 'Red Privada',
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: (
      <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
      </svg>
    ),
    color: 'text-sky-400',
    badgeBg: 'bg-sky-500/15 border-sky-500/30'
  },
  {
    id: 'web',
    name: 'Web Widget',
    icon: (
      <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/15 border-purple-500/30'
  }
]

export function ChannelBadge({ channel, size = 'sm' }) {
  const isInternal = !channel || channel === 'whatsapp' || channel === 'chasky' || channel === 'internal';
  const ch = isInternal
    ? { id: 'chasky', name: 'CHASKY', color: 'text-emerald-500' }
    : (CHANNELS.find(c => c.id === channel) || { id: 'chasky', name: 'CHASKY', color: 'text-emerald-500' });
  const isSm = size === 'sm'

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full border transition-all ${
        isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-500/40`}
      title="Red Privada CHASKY"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span>{ch.name}</span>
    </span>
  )
}

export function TicketStatusBadge({ status, size = 'sm' }) {
  const stat = status || 'open'
  const isSm = size === 'sm'

  if (stat === 'open') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-full ${
          isSm ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-0.5 text-xs'
        } bg-green-500/15 text-green-800 dark:text-green-400 border border-green-500/40`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <span>Abierto</span>
      </span>
    )
  }
  if (stat === 'pending') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-full ${
          isSm ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-0.5 text-xs'
        } bg-amber-500/15 text-amber-900 dark:text-amber-400 border border-amber-500/40`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>En Espera</span>
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full ${
        isSm ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      } bg-slate-500/15 text-slate-800 dark:text-slate-300 border border-slate-500/40`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
      <span>Resuelto</span>
    </span>
  )
}

export default function UnifiedSidebar({
  chats = [],
  selectedChannel = 'all',
  onSelectChannel,
  selectedStatus = 'all',
  onSelectStatus,
  selectedAssignment = 'all',
  onSelectAssignment
}) {
  // Counts by channel
  const counts = {
    all: chats.length,
    whatsapp: chats.filter(c => (c.channel || 'whatsapp') === 'whatsapp').length,
    telegram: chats.filter(c => c.channel === 'telegram').length,
    web: chats.filter(c => c.channel === 'web').length
  }

  // Counts by assignment
  const myAssignedCount = chats.filter(c => c.assignedAgentId === 'agent-me').length
  const unassignedCount = chats.filter(c => !c.assignedAgentId).length

  const scrollRef = useRef(null)
  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' })
    }
  }

  const handleWheel = (e) => {
    if (scrollRef.current && e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY
    }
  }

  return (
    <div className="px-3 pt-1 pb-2 border-b border-wa-border/40 space-y-2">
      {/* Channel Tabs */}
      <div className="flex items-center justify-between text-xs font-semibold text-wa-secondary mb-1">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-wa-green font-bold">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          Bandeja Omnicanal
        </span>
        <span className="text-[10px] text-wa-secondary">{counts.all} conversaciones</span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {CHANNELS.map(ch => {
          const isSelected = selectedChannel === ch.id
          const count = counts[ch.id] || 0
          return (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch.id)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition-all text-[11px] ${
                isSelected
                  ? 'bg-wa-green/15 border-wa-green text-wa-green font-bold shadow-sm'
                  : 'bg-black/5 dark:bg-wa-input/60 hover:bg-black/10 dark:hover:bg-wa-input border-transparent text-slate-700 dark:text-wa-secondary hover:text-wa-text font-medium'
              }`}
            >
              <div className="flex items-center gap-1">
                {ch.icon}
                <span className="font-semibold truncate">{ch.name.split(' ')[0]}</span>
              </div>
              <span className={`text-[10px] font-bold ${isSelected ? 'text-wa-green' : 'text-slate-600 dark:text-wa-secondary'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quick Filters Row (Assignment & Status) with Visible Scrollbar and Arrows */}
      <div className="flex items-center gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => scroll('left')}
          className="w-6 h-6 rounded-full bg-black/5 dark:bg-wa-input/80 hover:bg-black/10 dark:hover:bg-wa-input text-wa-secondary hover:text-wa-text border border-wa-border/50 text-[10px] flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
          title="Desplazar filtros a la izquierda"
        >
          ◀
        </button>

        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 flex-1 scroll-smooth"
        >
          {/* Assignment filters */}
          <button
            onClick={() => onSelectAssignment(selectedAssignment === 'mine' ? 'all' : 'mine')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
              selectedAssignment === 'mine'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary border-wa-border/50 hover:text-wa-text'
            }`}
          >
            <span>👤 Mis Asignados</span>
            <span className="text-[10px] px-1 rounded-full bg-black/20 font-bold">{myAssignedCount}</span>
          </button>

          <button
            onClick={() => onSelectAssignment(selectedAssignment === 'unassigned' ? 'all' : 'unassigned')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
              selectedAssignment === 'unassigned'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary border-wa-border/50 hover:text-wa-text'
            }`}
          >
            <span>❓ Sin Asignar</span>
            <span className="text-[10px] px-1 rounded-full bg-black/20 font-bold">{unassignedCount}</span>
          </button>

          {/* Status filters */}
          <button
            onClick={() => onSelectStatus(selectedStatus === 'open' ? 'all' : 'open')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 ${
              selectedStatus === 'open'
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary border-wa-border/50 hover:text-wa-text'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Abiertos</span>
          </button>

          <button
            onClick={() => onSelectStatus(selectedStatus === 'pending' ? 'all' : 'pending')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 ${
              selectedStatus === 'pending'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary border-wa-border/50 hover:text-wa-text'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>En Espera</span>
          </button>

          <button
            onClick={() => onSelectStatus(selectedStatus === 'resolved' ? 'all' : 'resolved')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 ${
              selectedStatus === 'resolved'
                ? 'bg-slate-600 text-white border-slate-600 shadow-sm'
                : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary border-wa-border/50 hover:text-wa-text'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Resueltos</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => scroll('right')}
          className="w-6 h-6 rounded-full bg-black/5 dark:bg-wa-input/80 hover:bg-black/10 dark:hover:bg-wa-input text-wa-secondary hover:text-wa-text border border-wa-border/50 text-[10px] flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
          title="Desplazar filtros a la derecha"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
