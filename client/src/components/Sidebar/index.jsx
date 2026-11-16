import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { fetchMessages } from '../../utils/api'
import { formatChatTime, getAvatarGradient, getInitials } from '../../utils/formatters'
import NewGroupModal from './NewGroupModal'
import NewChatModal from './NewChatModal'
import NewBroadcastModal from './NewBroadcastModal'
import StarredMessagesModal from '../Starred/StarredMessagesModal'
import CallsList from './CallsList'
import StatusSidebarView from './StatusSidebarView'
import StatusModal from '../Status/StatusModal'
import SettingsModal from '../Settings/SettingsModal'
import GlobalSearch from './GlobalSearch'
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard'
import LockedChats from './LockedChats'
import KanbanBoard from '../CRM/KanbanBoard'
import CampaignManager from '../Campaigns/CampaignManager'
import FlowBuilder from '../Bots/FlowBuilder'
import UnifiedSidebar, { ChannelBadge, TicketStatusBadge } from './UnifiedSidebar'
import LabelsModal from '../Labels/LabelsModal'
import AssignLabelsModal from '../Labels/AssignLabelsModal'
import BusinessProfileModal, { MetaVerifiedBadge } from '../Business/BusinessProfileModal'
import DirectPhoneModal from '../Contacts/DirectPhoneModal'
import BulkSenderModal from '../Campaigns/BulkSenderModal'
import TenantManager from '../Admin/TenantManager'
import SubscriptionBillingModal from '../Settings/SubscriptionBillingModal'
import ChannelsHub from '../Settings/ChannelsHub'
import IvrBuilder from '../Telephony/IvrBuilder'
import DocumentGenerator from '../Documents/DocumentGenerator'
import BusinessIntelligenceDashboard from '../Analytics/BusinessIntelligenceDashboard'
import AiAgentsHub from '../Settings/AiAgentsHub'
import useTenantStore from '../../store/useTenantStore'

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, avatar, size = 'md', isOnline }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm'
  return (
    <div className={`relative flex-shrink-0 ${sz}`}>
      {avatar ? (
        <img src={avatar} alt={name} className={`${sz} rounded-full object-cover`} />
      ) : (
        <div className={`${sz} rounded-full ${getAvatarGradient(name)} flex items-center justify-center font-semibold text-white`}>
          {getInitials(name)}
        </div>
      )}
      {isOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green rounded-full border-2 border-wa-sidebar" />
      )}
    </div>
  )
}

// ─── ChatItem ─────────────────────────────────────────────────────────────────
function ChatItem({ chat, isActive, onClick, onLockChat, onAssignLabels, sentiment, labels = [] }) {
  const [showCtx, setShowCtx] = useState(false)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const hasUnread = chat.unreadCount > 0

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxPos({ x: e.clientX, y: e.clientY })
    setShowCtx(true)
  }

  useEffect(() => {
    if (!showCtx) return
    const close = () => setShowCtx(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showCtx])

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative ${
        isActive ? 'bg-[#f0f2f5] dark:bg-wa-input shadow-sm' : ''
      }`}
    >
      <Avatar name={chat.groupName || chat.contactName} avatar={chat.groupAvatar || chat.contactAvatar} isOnline={chat.contactIsOnline === 1} />

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {chat.isPinned && (
              <svg className="w-3 h-3 text-wa-secondary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/>
              </svg>
            )}
            <span className="text-wa-text font-semibold text-sm truncate">
              {chat.groupName || chat.contactName || 'Chat'}
            </span>
            <ChannelBadge channel={chat.channel} size="sm" />
            {sentiment?.urgent ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/40 animate-pulse flex-shrink-0" title={`Urgente / Crítico: Tono del cliente ${sentiment.sentiment}`}>
                <span>⚠️</span>
                <span>Urgente</span>
              </span>
            ) : sentiment?.sentiment === 'positive' ? (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex-shrink-0" title="Sentimiento Positivo">
                <span>🟢</span>
              </span>
            ) : null}
          </div>
          <span className={`text-[11px] flex-shrink-0 ml-1.5 ${hasUnread ? 'text-wa-green font-bold' : 'text-slate-500 dark:text-wa-secondary font-medium'}`}>
            {formatChatTime(chat.lastMessageTime)}
          </span>
        </div>

        {/* Status, Labels, Agent & Last message snippet */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <TicketStatusBadge status={chat.status} size="sm" />

            {/* WhatsApp Business Labels */}
            {labels.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0" title={labels.map(l => l.name).join(', ')}>
                {labels.slice(0, 3).map((lbl) => (
                  <span
                    key={lbl.id}
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: lbl.color }}
                  />
                ))}
                {labels.length > 3 && (
                  <span className="text-[9px] text-slate-600 dark:text-wa-secondary font-bold">+{labels.length - 3}</span>
                )}
              </div>
            )}

            {chat.assignedAgentName && (
              <span className="text-[10px] text-slate-700 dark:text-wa-secondary bg-black/5 dark:bg-white/5 border border-wa-border px-1 py-0.2 rounded truncate max-w-[95px] flex items-center gap-0.5 font-medium" title={`Asignado a: ${chat.assignedAgentName}`}>
                <span>👤</span>
                <span className="truncate">{chat.assignedAgentName.split(' ')[0]}</span>
              </span>
            )}
            <span className="text-slate-600 dark:text-wa-secondary text-xs truncate font-medium">
              {chat.lastMessage && (chat.lastMessage.startsWith('data:image') || (chat.lastMessage.startsWith('http') && chat.lastMessage.includes('dicebear')))
                ? '💟 Sticker'
                : (chat.lastMessage || 'Sin mensajes')}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {hasUnread && (
              <span className={`min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-xs font-bold text-white ${chat.isMuted ? 'bg-slate-500' : 'bg-wa-green'}`}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showCtx && (
        <div
          className="fixed z-50 bg-wa-header border border-gray-700/70 rounded-xl shadow-2xl py-1 w-44 text-xs animate-scale-in"
          style={{ top: ctxPos.y, left: ctxPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setShowCtx(false); onAssignLabels && onAssignLabels(chat) }}
            className="w-full text-left px-3 py-2 hover:bg-white/10 text-wa-text font-semibold flex items-center gap-2 transition-colors"
          >
            <span>🏷️</span>
            <span>Etiquetas del chat</span>
          </button>
          <button
            onClick={() => { setShowCtx(false); onLockChat && onLockChat(chat.id) }}
            className="w-full text-left px-3 py-2 hover:bg-white/10 text-emerald-400 font-semibold flex items-center gap-2 transition-colors"
          >
            <span>🔒</span>
            <span>Bloquear chat</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'No leídos' },
  { key: 'status', label: 'Estados' },
  { key: 'groups', label: 'Grupos' },
  { key: 'favorites', label: 'Favoritos' },
  { key: 'calls', label: 'Llamadas' },
  { key: 'archived', label: 'Archivados' }
]

export default function Sidebar() {
  const {
    chats, activeChat, setActiveChat, setMessages, messages,
    searchQuery, setSearchQuery, activeFilter, setActiveFilter,
    sidebarCollapsed, setSidebarCollapsed, markChatRead, toggleTheme, theme,
    isConnected, logout, setLocked,
  } = useAppStore()

  const [showMenu, setShowMenu] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewBroadcast, setShowNewBroadcast] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('profile')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showKanban, setShowKanban] = useState(false)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [showFlowBuilder, setShowFlowBuilder] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusInitialIndex, setStatusInitialIndex] = useState(0)
  const [statusShowCreate, setStatusShowCreate] = useState(false)
  const [lockedChatIds, setLockedChatIds] = useState([])
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedAssignment, setSelectedAssignment] = useState('all')
  const [sentiments, setSentiments] = useState({})

  const fetchSentiments = useCallback(async () => {
    try {
      const res = await fetch('/api/sentiments')
      if (res.ok) {
        const data = await res.json()
        setSentiments(data || {})
      }
    } catch (e) {
      console.error('Error fetching sentiments:', e)
    }
  }, [])

  useEffect(() => {
    fetchSentiments()
    const interval = setInterval(fetchSentiments, 10000)
    return () => clearInterval(interval)
  }, [fetchSentiments])

  const [chatLabels, setChatLabels] = useState({})
  const [showLabelsModal, setShowLabelsModal] = useState(false)
  const [assignLabelsChat, setAssignLabelsChat] = useState(null)
  const [showBusinessProfile, setShowBusinessProfile] = useState(false)
  const [showDirectPhone, setShowDirectPhone] = useState(false)
  const [showBulkSender, setShowBulkSender] = useState(false)
  const [showTenantManager, setShowTenantManager] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showChannelsHub, setShowChannelsHub] = useState(false)
  const [showIvrBuilder, setShowIvrBuilder] = useState(false)
  const [showDocGenerator, setShowDocGenerator] = useState(false)
  const [showBiDashboard, setShowBiDashboard] = useState(false)
  const [showAiAgentsHub, setShowAiAgentsHub] = useState(false)
  const { activeTenant, tenantSettings, fetchCurrentTenant } = useTenantStore()

  useEffect(() => {
    fetchCurrentTenant()
  }, [])

  const fetchChatLabels = useCallback(async () => {
    try {
      const res = await fetch('/api/chat-labels')
      if (res.ok) {
        const data = await res.json()
        setChatLabels(data || {})
      }
    } catch (e) {
      console.error('Error fetching chat labels:', e)
    }
  }, [])

  useEffect(() => {
    fetchChatLabels()
    const interval = setInterval(fetchChatLabels, 10000)
    return () => clearInterval(interval)
  }, [fetchChatLabels])

  const tabsScrollRef = useRef(null)
  const scrollTabs = (dir) => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' })
    }
  }

  const handleTabsWheel = (e) => {
    if (tabsScrollRef.current && e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY
    }
  }

  const fetchLockedChats = useCallback(async () => {
    try {
      const res = await fetch('/api/locked-chats')
      if (res.ok) {
        const ids = await res.json()
        setLockedChatIds(ids)
      }
    } catch (e) {
      console.error('Error fetching locked chats:', e)
    }
  }, [])

  useEffect(() => {
    fetchLockedChats()
  }, [fetchLockedChats])

  const handleLockChat = async (chatId) => {
    try {
      await fetch('/api/locked-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      })
      fetchLockedChats()
    } catch (e) {
      console.error('Error locking chat:', e)
    }
  }

  const handleUnlockChat = async (chatId) => {
    try {
      await fetch(`/api/locked-chats/${chatId}`, { method: 'DELETE' })
      fetchLockedChats()
    } catch (e) {
      console.error('Error unlocking chat:', e)
    }
  }

  const handleOpenSettings = (tab = 'profile') => {
    setSettingsTab(tab)
    setShowSettings(true)
    setShowMenu(false)
  }

  const handleSelectSearchMessage = (msg) => {
    let chat = chats.find(c => c.id === msg.chatId)
    if (!chat) {
      chat = {
        id: msg.chatId,
        type: msg.chatType || 'individual',
        groupName: msg.groupName,
        groupAvatar: msg.groupAvatar,
        contactName: msg.contactName,
        contactAvatar: msg.contactAvatar,
      }
    }
    handleSelectChat(chat)
    setSearchQuery('')
  }

  const filteredChats = useMemo(() => {
    // Hide locked chats from the general chat list
    let list = chats.filter(c => !lockedChatIds.includes(c.id))

    // Channel filter
    if (selectedChannel !== 'all') {
      list = list.filter((c) => (c.channel || 'whatsapp') === selectedChannel)
    }

    // Assignment filter
    if (selectedAssignment === 'mine') {
      list = list.filter((c) => c.assignedAgentId === 'agent-me')
    } else if (selectedAssignment === 'unassigned') {
      list = list.filter((c) => !c.assignedAgentId)
    }

    // Status filter
    if (selectedStatus !== 'all') {
      list = list.filter((c) => (c.status || 'open') === selectedStatus)
    }

    // Apply filter tab
    if (activeFilter === 'unread') list = list.filter((c) => c.unreadCount > 0)
    else if (activeFilter === 'groups') list = list.filter((c) => c.type === 'group')
    else if (activeFilter === 'favorites') list = list.filter((c) => c.isFavorite)
    else if (activeFilter === 'archived') list = list.filter((c) => c.isArchived)
    else list = list.filter((c) => !c.isArchived)

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((c) =>
        (c.groupName || c.contactName || '').toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q) ||
        (c.assignedAgentName || '').toLowerCase().includes(q)
      )
    }

    // Pinned first
    return list.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
  }, [chats, searchQuery, activeFilter, lockedChatIds, selectedChannel, selectedAssignment, selectedStatus])

  const handleSelectChat = async (chat) => {
    setActiveChat(chat)
    markChatRead(chat.id)
    if (!messages[chat.id]) {
      try {
        const data = await fetchMessages(chat.id)
        setMessages(chat.id, data)
      } catch {
        setMessages(chat.id, [])
      }
    }
  }

  return (
    <div
      className={`flex flex-col bg-wa-sidebar border-r border-white/5 sidebar-transition overflow-hidden w-full md:${
        sidebarCollapsed ? 'w-16' : 'w-80'
      } h-full`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-wa-header">
        {!sidebarCollapsed ? (
          <>
            <div
              onClick={() => handleOpenSettings('profile')}
              className="flex items-center gap-2 cursor-pointer group"
              title="Tu perfil y ajustes"
            >
              <div className="w-9 h-9 rounded-full avatar-gradient-3 flex items-center justify-center text-white font-semibold text-sm group-hover:ring-2 group-hover:ring-wa-green transition-all shadow-md">
                Yo
              </div>
              {/* WS connection indicator */}
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-wa-green' : 'bg-yellow-500 animate-pulse'}`} />
                <span className="text-[10px] text-wa-secondary">{isConnected ? 'Conectado' : 'Reconectando...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon"
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06a.996.996 0 0 0 0 1.41c.39.39 1.03.39 1.41 0l1.06-1.06a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0zM7.05 18.36l-1.06 1.06a.996.996 0 0 0 0 1.41c.39.39 1.03.39 1.41 0l1.06-1.06a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={() => setActiveFilter(activeFilter === 'status' ? 'all' : 'status')}
                className={`p-2 rounded-full transition-colors ${
                  activeFilter === 'status'
                    ? 'bg-wa-green/20 text-wa-green'
                    : 'hover:bg-white/10 text-wa-icon hover:text-wa-green'
                }`}
                title="Estados"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" strokeDasharray="5 3" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                </svg>
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon hover:text-emerald-400"
                title="Analíticas de Negocio"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
              <button
                onClick={() => setShowKanban(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon hover:text-emerald-400"
                title="CRM Pipeline Kanban"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
              <button
                onClick={() => setShowNewChat(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon"
                title="Nuevo chat"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
              </button>
              <button
                onClick={() => setLocked(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon hover:text-amber-400"
                title="Bloquear pantalla (PIN de Seguridad)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <circle cx="12" cy="16" r="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </button>

              {/* Offline / Online Network Simulator Pills (visibles en desktop y ocultos en móvil para optimizar espacio) */}
              <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                <button
                  data-testid="sim-offline"
                  onClick={() => window.dispatchEvent(new Event('offline'))}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition font-medium"
                  title="Simular modo desconectado (Offline)"
                >
                  📡 Offline
                </button>
                <button
                  data-testid="sim-online"
                  onClick={() => window.dispatchEvent(new Event('online'))}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition font-medium"
                  title="Simular reconexión (Online)"
                >
                  🟢 Online
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 w-64 max-h-[82vh] overflow-y-auto scrollbar-thin bg-wa-header rounded-xl shadow-2xl z-40 py-1.5 border border-wa-border animate-scale-in">
                    <button
                      onClick={() => { setShowMenu(false); setLocked(true) }}
                      className="w-full text-left px-4 py-2.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-semibold"
                    >
                      <span className="text-base">🔒</span>
                      Bloquear Pantalla
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setActiveFilter('status') }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">⭕</span>
                      Estados
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowNewChat(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <svg className="w-4 h-4 text-wa-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                      </svg>
                      Nuevo chat
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowDirectPhone(true) }}
                      className="w-full text-left px-4 py-2.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-semibold"
                    >
                      <span className="text-base">📞</span>
                      Escribir a un número
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowNewGroup(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <svg className="w-4 h-4 text-wa-green" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                      Nuevo grupo
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowNewBroadcast(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📢</span>
                      Nueva difusión
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowStarred(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">⭐</span>
                      Mensajes destacados
                    </button>
                    <button
                      onClick={() => handleOpenSettings('profile')}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">👤</span>
                      Perfil
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowAnalytics(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📊</span>
                      Analíticas y reportes
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowBiDashboard(true) }}
                      className="w-full text-left px-4 py-2.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-between font-semibold"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">📈</span>
                        Business Intelligence & Funnel BI
                      </span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black border border-emerald-500/30">
                        PRO
                      </span>
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowAiAgentsHub(true) }}
                      className="w-full text-left px-4 py-2.5 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-between font-semibold"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">🤖</span>
                        Especialistas IA & Enrutador
                      </span>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-1.5 py-0.5 rounded font-black border border-cyan-500/30">
                        MULTI-IA
                      </span>
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowKanban(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📋</span>
                      CRM Pipeline Kanban
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowCampaigns(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📢</span>
                      Campañas Masivas
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowBulkSender(true) }}
                      className="w-full text-left px-4 py-2.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-semibold"
                    >
                      <span className="text-base">🚀</span>
                      Envío Masivo (Excel / Pegar)
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowFlowBuilder(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">🤖</span>
                      Constructor de Bots (Flows)
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowLabelsModal(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">🏷️</span>
                      Etiquetas (WhatsApp Business)
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowBusinessProfile(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">🏢</span>
                      Perfil de Empresa Oficial (Meta)
                    </button>
                    <button
                      onClick={() => handleOpenSettings('devices')}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">🔗</span>
                      Dispositivos vinculados
                    </button>
                    <button
                      onClick={() => handleOpenSettings('developer')}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">💻</span>
                      Centro Desarrolladores (API & Webhooks)
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowTenantManager(true) }}
                      className="w-full text-left px-4 py-2.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-bold"
                    >
                      <span className="text-base">🏢</span>
                      Gestión Multi-Tenant & SaaS
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowSubscription(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">💳</span>
                      Suscripción y Licenciamiento
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowChannelsHub(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📡</span>
                      Canales Oficiales (Meta & Telegram)
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowIvrBuilder(true) }}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">📞</span>
                      Centralita IVR & Agente de Voz IA
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowDocGenerator(true) }}
                      className="w-full text-left px-4 py-2.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-semibold"
                    >
                      <span className="text-base">📄</span>
                      Generador de Contratos & Documentos IA
                    </button>
                    <button
                      onClick={() => handleOpenSettings('notifications')}
                      className="w-full text-left px-4 py-2.5 text-wa-text text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2.5 font-medium"
                    >
                      <span className="text-base">⚙️</span>
                      Configuración
                    </button>
                    <div className="border-t border-wa-border my-1" />
                    <button
                      onClick={() => { setShowMenu(false); logout() }}
                      className="w-full text-left px-4 py-2.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2 font-semibold"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon"
                title="Colapsar"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="mx-auto p-2 rounded-full hover:bg-white/10 transition-colors text-wa-icon"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {!sidebarCollapsed && (
        <>
          {/* White-Label Organization Pill & Quick Switcher */}
          {activeTenant && (
            <div
              onClick={() => setShowTenantManager(true)}
              className="mx-3 my-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-wa-border flex items-center justify-between cursor-pointer transition shadow-sm group"
              title="Organización Activa — Haz clic para gestionar inquilinos y planes"
            >
              <div className="flex items-center gap-2 min-w-0">
                {tenantSettings?.logoUrl ? (
                  <img src={tenantSettings.logoUrl} alt="Logo" className="w-5 h-5 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white font-black text-[9px] flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: tenantSettings?.primaryColor || '#00a884' }}
                  >
                    {(tenantSettings?.appName || activeTenant.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-wa-text truncate block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {tenantSettings?.appName || activeTenant.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/15 dark:bg-white/10 text-emerald-800 dark:text-emerald-300 font-mono border border-emerald-500/20">
                      {activeTenant.planName ? activeTenant.planName.replace('Plan ', '') : 'Pro'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-600 dark:text-wa-secondary font-medium block truncate">
                    {activeTenant.status === 'suspended' ? '🔴 Suspendido' : '🟢 Multi-Tenant Activo'} • {activeTenant.slug}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-700 dark:text-wa-secondary hover:text-wa-text px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono border border-wa-border/50">
                Tenants ▾
              </span>
            </div>
          )}

          {/* Suspended Alert if Tenant is Suspended */}
          {activeTenant?.status === 'suspended' && (
            <div
              onClick={() => setShowSubscription(true)}
              className="mx-3 mb-1.5 px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-between cursor-pointer transition shadow-md animate-pulse text-[11px]"
            >
              <div className="flex items-center gap-1.5">
                <span>⚠️</span>
                <span><strong>Suscripción Suspendida</strong>: Renovar plan</span>
              </div>
              <span className="underline font-bold">Ver ➔</span>
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2 bg-wa-sidebar">
            <div className="flex items-center bg-[#f0f2f5] dark:bg-wa-input rounded-lg px-3 gap-2">
              <svg className="w-4 h-4 text-wa-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar o iniciar un chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent flex-1 py-2 text-sm text-wa-text placeholder:text-wa-secondary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-wa-secondary hover:text-wa-text">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Search or Chat List */}
          {searchQuery.trim().length > 0 ? (
            <GlobalSearch
              query={searchQuery}
              chats={chats}
              onSelectChat={handleSelectChat}
              onSelectMessage={handleSelectSearchMessage}
              onClose={() => setSearchQuery('')}
            />
          ) : (
            <>
              {/* Omnichannel Unified Inbox Bar */}
              <UnifiedSidebar
                chats={chats}
                selectedChannel={selectedChannel}
                onSelectChannel={setSelectedChannel}
                selectedStatus={selectedStatus}
                onSelectStatus={setSelectedStatus}
                selectedAssignment={selectedAssignment}
                onSelectAssignment={setSelectedAssignment}
              />

              {/* Filter tabs with Visible Scrollbar and Navigation Arrows */}
              <div className="flex items-center gap-1 px-3 pb-2 pt-1">
                <button
                  type="button"
                  onClick={() => scrollTabs('left')}
                  className="w-5 h-5 rounded-full bg-black/5 dark:bg-wa-input/80 hover:bg-black/10 dark:hover:bg-wa-input text-wa-secondary hover:text-wa-text border border-wa-border/50 text-[9px] flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                  title="Desplazar categorías a la izquierda"
                >
                  ◀
                </button>

                <div
                  ref={tabsScrollRef}
                  onWheel={handleTabsWheel}
                  className="flex gap-1 overflow-x-auto no-scrollbar pb-1.5 flex-1 scroll-smooth"
                >
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        activeFilter === f.key
                          ? 'bg-wa-green text-white shadow-sm'
                          : 'bg-black/5 dark:bg-wa-input text-slate-700 dark:text-wa-secondary hover:text-wa-text'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => scrollTabs('right')}
                  className="w-5 h-5 rounded-full bg-black/5 dark:bg-wa-input/80 hover:bg-black/10 dark:hover:bg-wa-input text-wa-secondary hover:text-wa-text border border-wa-border/50 text-[9px] flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                  title="Desplazar categorías a la derecha"
                >
                  ▶
                </button>
              </div>

              {/* Chat list, Calls List, or Status Sidebar View */}
              {activeFilter === 'calls' ? (
                <CallsList onSelectChat={handleSelectChat} />
              ) : activeFilter === 'status' ? (
                <StatusSidebarView
                  onOpenStatusViewer={(idx) => {
                    setStatusInitialIndex(idx)
                    setStatusShowCreate(false)
                    setShowStatusModal(true)
                  }}
                  onOpenCreateStatus={() => {
                    setStatusShowCreate(true)
                    setShowStatusModal(true)
                  }}
                />
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {/* Locked Chats Secret Folder */}
                  <LockedChats
                    allChats={chats}
                    activeChat={activeChat}
                    onSelectChat={handleSelectChat}
                    onUnlockChat={handleUnlockChat}
                    lockedChatIds={lockedChatIds}
                    onRefreshLocks={fetchLockedChats}
                  />

                  {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-wa-secondary text-sm">
                      <p>Sin resultados</p>
                    </div>
                  ) : (
                    filteredChats.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChat?.id === chat.id}
                        onClick={() => handleSelectChat(chat)}
                        onLockChat={handleLockChat}
                        sentiment={sentiments[chat.id]}
                        labels={chatLabels[chat.id] || []}
                        onAssignLabels={(c) => setAssignLabelsChat(c)}
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Collapsed icon list */}
      {sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {chats.slice(0, 10).map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
              className={`flex justify-center py-2 cursor-pointer hover:bg-white/5 transition-colors ${activeChat?.id === chat.id ? 'bg-wa-input' : ''}`}
            >
              <div className="relative">
                <Avatar name={chat.groupName || chat.contactName} avatar={chat.avatar} size="sm" />
                {chat.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-wa-green rounded-full text-[9px] text-wa-dark font-bold flex items-center justify-center">
                    {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreated={(newChat) => {
            const store = useAppStore.getState()
            if (!store.chats.find(c => c.id === newChat.id)) {
              store.setChats([newChat, ...store.chats])
            }
            handleSelectChat(newChat)
            setShowNewGroup(false)
          }}
        />
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelectChat={handleSelectChat}
        />
      )}

      {/* New Broadcast Modal */}
      {showNewBroadcast && (
        <NewBroadcastModal
          onClose={() => setShowNewBroadcast(false)}
        />
      )}

      {/* Starred Messages Modal */}
      {showStarred && (
        <StarredMessagesModal
          onClose={() => setShowStarred(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          initialTab={settingsTab}
          onClose={() => setShowSettings(false)}
          onLockSession={() => setLocked(true)}
        />
      )}

      {/* Status / Stories Modal */}
      {showStatusModal && (
        <StatusModal
          initialIndex={statusInitialIndex}
          initialShowCreate={statusShowCreate}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {/* Analytics Dashboard */}
      {showAnalytics && (
        <AnalyticsDashboard
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* CRM Pipeline Kanban Board */}
      {showKanban && (
        <KanbanBoard
          onClose={() => setShowKanban(false)}
          onSelectChat={handleSelectChat}
        />
      )}

      {/* Campaigns Manager */}
      {showCampaigns && (
        <CampaignManager
          onClose={() => setShowCampaigns(false)}
        />
      )}

      {/* Flow Builder */}
      {showFlowBuilder && (
        <FlowBuilder
          onClose={() => setShowFlowBuilder(false)}
        />
      )}

      {/* WhatsApp Business Labels Management Modal */}
      {showLabelsModal && (
        <LabelsModal
          onClose={() => {
            setShowLabelsModal(false)
            fetchChatLabels()
          }}
        />
      )}

      {/* WhatsApp Business Assign Labels Modal */}
      {assignLabelsChat && (
        <AssignLabelsModal
          chat={assignLabelsChat}
          onClose={() => setAssignLabelsChat(null)}
          onLabelsChanged={() => fetchChatLabels()}
        />
      )}

      {/* Meta Verified Business Profile Modal */}
      {showBusinessProfile && (
        <BusinessProfileModal
          onClose={() => setShowBusinessProfile(false)}
        />
      )}

      {/* Direct Phone / Contact Creator Modal */}
      {showDirectPhone && (
        <DirectPhoneModal
          onClose={() => setShowDirectPhone(false)}
          onSelectChat={handleSelectChat}
        />
      )}

      {/* Bulk WhatsApp Sender Modal */}
      {showBulkSender && (
        <BulkSenderModal
          onClose={() => setShowBulkSender(false)}
        />
      )}

      {/* SaaS Multi-Tenant Manager Modal */}
      {showTenantManager && (
        <TenantManager
          onClose={() => setShowTenantManager(false)}
        />
      )}

      {/* Subscription & Billing Modal */}
      {showSubscription && (
        <SubscriptionBillingModal
          onClose={() => setShowSubscription(false)}
        />
      )}

      {/* Official Channels Hub Modal (Meta & Telegram) */}
      {showChannelsHub && (
        <ChannelsHub
          onClose={() => setShowChannelsHub(false)}
        />
      )}

      {/* Telephony IVR & AI Voice Agent Modal */}
      {showIvrBuilder && (
        <IvrBuilder
          onClose={() => setShowIvrBuilder(false)}
        />
      )}

      {/* Smart Document & Contract Studio Modal */}
      {showDocGenerator && (
        <DocumentGenerator
          onClose={() => setShowDocGenerator(false)}
        />
      )}

      {/* Business Intelligence & Sales Funnel Analytics Modal */}
      {showBiDashboard && (
        <BusinessIntelligenceDashboard
          onClose={() => setShowBiDashboard(false)}
        />
      )}

      {/* Multi-Agent AI Routing & Specialists Hub Modal */}
      {showAiAgentsHub && (
        <AiAgentsHub
          onClose={() => setShowAiAgentsHub(false)}
        />
      )}
    </div>
  )
}
