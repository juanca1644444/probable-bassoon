import { create } from 'zustand'

// Persist auth state in localStorage
const getInitialAuth = () => {
  try { return localStorage.getItem('wa_pro_auth') === 'true' } catch { return false }
}

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('chasky_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark'
  } catch {
    return 'dark'
  }
}

const useAppStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────
  isAuthenticated: getInitialAuth(),

  login: () => {
    try { localStorage.setItem('wa_pro_auth', 'true') } catch {}
    set({ isAuthenticated: true })
  },
  logout: () => {
    try { localStorage.removeItem('wa_pro_auth') } catch {}
    set({ isAuthenticated: false, activeChat: null, chats: [], messages: {}, contacts: [] })
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  chats: [],
  activeChat: null,
  messages: {},        // { chatId: Message[] }
  contacts: [],
  ws: null,

  // ── UI State ──────────────────────────────────────────────────────────────
  theme: getInitialTheme(),
  sidebarCollapsed: false,
  rightPanelOpen: false,
  typingUsers: {},       // { chatId: { userId: true } }
  searchQuery: '',
  activeFilter: 'all',   // 'all' | 'unread' | 'groups' | 'favorites' | 'archived'
  replyTo: null,
  isConnected: false,
  isLocked: false,
  setLocked: (isLocked) => set({ isLocked }),
  chatInputDraft: '',
  setChatInputDraft: (text) => set({ chatInputDraft: text }),

  // ── Chat / Message Actions ────────────────────────────────────────────────
  setChats:      (chats) => set({ chats }),
  setContacts:   (contacts) => set({ contacts }),
  setWs:         (ws) => set({ ws }),
  setConnected:  (v) => set({ isConnected: v }),

  setActiveChat: (chat) => set({ activeChat: chat, rightPanelOpen: false, replyTo: null }),

  addOrUpdateChat: (chat) =>
    set((s) => {
      if (!chat || !chat.id) return s
      const index = s.chats.findIndex((c) => c.id === chat.id)
      if (index >= 0) {
        const updated = [...s.chats]
        updated[index] = { ...updated[index], ...chat }
        // Re-sort: pinned first, then lastMessageTime desc
        updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
        return { chats: updated }
      }
      const newChats = [chat, ...s.chats]
      newChats.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
      return { chats: newChats }
    }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messages: { ...s.messages, [chatId]: messages } })),

  addMessage: (chatId, message) =>
    set((s) => {
      const existing = s.messages[chatId] || [];
      const updatedMessages = message?.id && existing.some((m) => m.id === message.id)
        ? existing.map((m) => (m.id === message.id ? { ...m, ...message } : m))
        : [...existing, message];

      return {
        messages: {
          ...s.messages,
          [chatId]: updatedMessages,
        },
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                lastMessage: message.type === 'sticker' ? '💟 Sticker' : (message.content || message.fileName || 'Archivo'),
                lastMessageTime: message.timestamp,
                unreadCount: c.id === s.activeChat?.id ? 0 : (c.unreadCount || 0) + 1,
              }
            : c
        ),
      };
    }),

  updateChatLastMessage: (chatId, content, timestamp) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: content, lastMessageTime: timestamp } : c
      ),
    })),

  updateMessageReactions: (messageId, reactions) =>
    set((s) => {
      const msgs = { ...s.messages }
      for (const chatId in msgs) {
        const idx = msgs[chatId].findIndex((m) => m.id === messageId)
        if (idx >= 0) {
          msgs[chatId] = msgs[chatId].map((m) =>
            m.id === messageId ? { ...m, reactions: JSON.stringify(reactions) } : m
          )
        }
      }
      return { messages: msgs }
    }),

  updateMessage: (chatId, message) =>
    set((s) => {
      const msgs = { ...s.messages }
      if (msgs[chatId]) {
        msgs[chatId] = msgs[chatId].map((m) => (m.id === message.id ? message : m))
      }
      return { messages: msgs }
    }),

  markMessageDeleted: (messageId) =>
    set((s) => {
      const msgs = { ...s.messages }
      for (const chatId in msgs) {
        msgs[chatId] = msgs[chatId].map((m) =>
          m.id === messageId ? { ...m, isDeleted: 1, content: 'Este mensaje fue eliminado' } : m
        )
      }
      return { messages: msgs }
    }),

  updateChat: (chatId, patch) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, ...patch } : c)),
      activeChat: s.activeChat?.id === chatId ? { ...s.activeChat, ...patch } : s.activeChat,
    })),

  markChatRead: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    })),

  // ── UI Actions ────────────────────────────────────────────────────────────
  setTheme: (theme) => {
    try { localStorage.setItem('chasky_theme', theme) } catch {}
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('chasky_theme', next) } catch {}
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.documentElement.classList.toggle('light', next === 'light')
    set({ theme: next })
  },
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleRightPanel:    () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setSearchQuery:      (q) => set({ searchQuery: q }),
  setActiveFilter:     (f) => set({ activeFilter: f }),
  setReplyTo:          (msg) => set({ replyTo: msg }),
  inChatSearchOpen:    false,
  setInChatSearchOpen: (v) => set({ inChatSearchOpen: v }),

  // ── Toast Notifications ───────────────────────────────────────────────────
  toasts: [],  // { id, chatId, name, avatar, message }

  addToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] })),  // max 3 toasts

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setTyping: (chatId, userId, isTyping) =>
    set((s) => {
      const chatTyping = { ...(s.typingUsers[chatId] || {}) }
      if (isTyping) chatTyping[userId] = true
      else delete chatTyping[userId]
      return { typingUsers: { ...s.typingUsers, [chatId]: chatTyping } }
    }),

  // ── VoIP / Calls ─────────────────────────────────────────────────────────
  activeCall: null,      // { callId, chat, type: 'voice'|'video', status: 'ringing'|'connecting'|'connected', isIncoming: boolean }
  incomingCall: null,    // { callId, callerId, callerName, callerAvatar, type: 'voice'|'video', chatId }

  startCall: (chat, type = 'voice') => {
    if (!chat) return
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ws = get().ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'START_CALL',
        callId,
        chatId: chat.id,
        callType: type,
        callerId: 'me',
        callerName: 'Yo',
        callerAvatar: '',
        receiverId: chat.contactId || chat.id,
      }))
    }
    set({
      activeCall: {
        callId,
        chat,
        type,
        status: 'ringing',
        isIncoming: false,
      }
    })

    // Simulate auto-connection after 3s if not answered by remote peer
    setTimeout(() => {
      const current = get().activeCall
      if (current && current.callId === callId && current.status === 'ringing') {
        set({ activeCall: { ...current, status: 'connected' } })
      }
    }, 3000)
  },

  receiveCall: (data) => {
    set({
      incomingCall: {
        callId: data.callId,
        callerId: data.callerId,
        callerName: data.callerName || 'Contacto',
        callerAvatar: data.callerAvatar || '',
        type: data.callType || 'voice',
        chatId: data.chatId,
      }
    })
  },

  acceptCall: () => {
    const inc = get().incomingCall
    if (!inc) return
    const chat = get().chats.find(c => c.id === inc.chatId) || {
      id: inc.chatId,
      contactName: inc.callerName,
      contactAvatar: inc.callerAvatar,
      type: 'individual'
    }
    const ws = get().ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ACCEPT_CALL',
        callId: inc.callId,
        chatId: inc.chatId,
      }))
    }
    set({
      incomingCall: null,
      activeCall: {
        callId: inc.callId,
        chat,
        type: inc.type,
        status: 'connected',
        isIncoming: true,
      }
    })
  },

  rejectCall: () => {
    const inc = get().incomingCall
    if (inc) {
      const ws = get().ws
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'REJECT_CALL',
          callId: inc.callId,
        }))
      }
    }
    set({ incomingCall: null })
  },

  endCall: () => {
    const current = get().activeCall
    if (current) {
      const ws = get().ws
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'END_CALL',
          callId: current.callId,
          chatId: current.chat?.id,
        }))
      }
    }
    set({ activeCall: null, incomingCall: null })
  },

  upgradeToVideo: () => {
    const current = get().activeCall
    if (current) {
      set({ activeCall: { ...current, type: 'video' } })
    }
  },

  setCallStatus: (status) => {
    const current = get().activeCall
    if (current) {
      set({ activeCall: { ...current, status } })
    }
  },
}))

export default useAppStore
