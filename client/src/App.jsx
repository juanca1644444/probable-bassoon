// src/App.jsx — CHASKYAPP Main App Shell
import React, { useEffect } from 'react';
import useAppStore from './store/useAppStore';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import RightPanel from './components/RightPanel';
import EmptyState from './components/EmptyState';
import AIAssistant from './components/AIAssistant';
import ToastNotification, { playNotificationSound } from './components/Notifications/ToastNotification';
import LoginQR from './components/Auth/LoginQR';
import CallModal from './components/Call/CallModal';
import IncomingCallNotification from './components/Call/IncomingCallNotification';
import SessionLockOverlay from './components/Auth/SessionLockOverlay';
import OfflineSyncBanner from './components/Common/OfflineSyncBanner';
import useTenantStore from './store/useTenantStore';
import { initOfflineSync } from './services/syncManager';
import { getLocalChats, saveLocalChats, getLocalContacts, saveLocalContacts } from './services/localDb';
import { fetchChats, fetchContacts, fetchSettings } from './utils/api';
import { getWsUrl } from './utils/wsUrl';

// ── Shell autenticado ──────────────────────────────────────────────────────
function AppShell() {
  const {
    theme, activeChat, rightPanelOpen, isLocked, setLocked,
    setChats, setContacts, setTheme, setWs, setConnected
  } = useAppStore();

  // Inactivity Auto-Lock timer
  useEffect(() => {
    let timeoutMs = 15 * 60 * 1000; // default 15 minutes
    let autoLockEnabled = true;
    let timer = null;

    // Fetch settings from server
    fetch('/api/auth/security-settings')
      .then((r) => r.json())
      .then((sec) => {
        if (sec) {
          autoLockEnabled = sec.autoLockEnabled !== false;
          timeoutMs = (sec.autoLockTimeoutMinutes || 15) * 60 * 1000;
        }
      })
      .catch(() => {});

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      if (autoLockEnabled && !isLocked) {
        timer = setTimeout(() => {
          setLocked(true);
        }, timeoutMs);
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isLocked, setLocked]);

  // Initialize SaaS Multi-Tenant & White-Label context
  const { fetchCurrentTenant } = useTenantStore();
  useEffect(() => {
    fetchCurrentTenant();
  }, []);

  // Initialize Offline-First sync engine & network listeners
  useEffect(() => {
    const cleanup = initOfflineSync(useAppStore);
    return () => cleanup && cleanup();
  }, []);

  // Load initial data (IndexedDB cache first for offline capability, then network)
  useEffect(() => {
    (async () => {
      // 1. Instant offline hydration from local IndexedDB
      try {
        const [cachedChats, cachedContacts] = await Promise.all([
          getLocalChats(), getLocalContacts()
        ]);
        if (cachedChats && cachedChats.length > 0) setChats(cachedChats);
        if (cachedContacts && cachedContacts.length > 0) setContacts(cachedContacts);
      } catch (e) {
        console.warn('Local DB hydration skipped:', e);
      }

      // 2. Fetch fresh data from network when available
      try {
        const [chatsData, contactsData, settingsData] = await Promise.all([
          fetchChats(), fetchContacts(), fetchSettings()
        ]);
        setChats(chatsData);
        setContacts(contactsData);
        if (settingsData.theme) setTheme(settingsData.theme);

        // Persist to local IndexedDB for future offline sessions
        saveLocalChats(chatsData).catch(() => {});
        saveLocalContacts(contactsData).catch(() => {});
      } catch (err) {
        console.warn('Offline mode or server unreachable, working with cached data:', err.message);
      }
    })();
  }, []);

  // WebSocket — reconnecting client
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        setConnected(true);
        setWs(ws);
        console.log('🔌 WS connected');
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const store = useAppStore.getState();

          if (data.type === 'new_message') {
            const currentMsgs = store.messages[data.chatId] || [];
            // Si este cliente/tab ya tiene este mensaje exacto por ID, actualizamos su estado y no lo duplicamos
            if (data.message?.id && currentMsgs.some(m => m.id === data.message.id)) {
              store.updateMessage(data.chatId, data.message);
              return;
            }

            // Agregamos el mensaje en tiempo real (se actualiza automáticamente en móvil y PC)
            store.addMessage(data.chatId, data.message);
            const previewText = data.message.type === 'sticker'
              ? '💟 Sticker'
              : (data.message.type === 'audio' ? '🎤 Nota de voz' : (data.message.content || data.message.fileName || 'Archivo'));
            store.updateChatLastMessage(data.chatId, previewText, data.message.timestamp);

            const currentActive = store.activeChat;
            if (data.chatId !== currentActive?.id) {
              const chat = store.chats.find(c => c.id === data.chatId);
              if (chat) {
                const msgText =
                  data.message.type === 'audio' ? '🎤 Nota de voz'
                  : data.message.type === 'image' ? '📷 Imagen'
                  : data.message.type === 'sticker' ? '💟 Sticker'
                  : data.message.type === 'file' ? `📎 ${data.message.fileName || 'Archivo'}`
                  : data.message.content || '';

                const chatName   = chat.type === 'group' ? chat.groupName   : chat.contactName;
                const chatAvatar = chat.type === 'group' ? chat.groupAvatar : chat.contactAvatar;

                store.addToast({
                  id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  chatId: data.chatId, name: chatName, avatar: chatAvatar,
                  message: msgText.slice(0, 80),
                });
                playNotificationSound();
              }
            }
          } else if (data.type === 'typing') {
            store.setTyping(data.chatId, data.userId, true);
          } else if (data.type === 'stop_typing') {
            store.setTyping(data.chatId, data.userId, false);
          } else if (data.type === 'reaction') {
            store.updateMessageReactions(data.messageId, data.reactions);
          } else if (data.type === 'message_deleted') {
            store.markMessageDeleted(data.messageId);
          } else if (data.type === 'message_updated') {
            if (data.chatId && data.message) {
              store.updateMessage(data.chatId, data.message);
            }
          } else if (data.type === 'new_group') {
            // Add new group chat to sidebar if not already present
            if (data.chat && !store.chats.find(c => c.id === data.chat.id)) {
              store.setChats([data.chat, ...store.chats]);
            }
          } else if (data.type === 'member_added' || data.type === 'member_removed') {
            // Trigger re-fetch of members in RightPanel handled by component
            // Also add system message if chat is loaded
            if (data.type === 'member_added' && data.chatId && store.messages[data.chatId]) {
              store.addMessage(data.chatId, {
                id: data.messageId || `sys-${Date.now()}`,
                chatId: data.chatId,
                senderId: 'system',
                content: `➕ Nuevo miembro añadido`,
                type: 'text',
                timestamp: Date.now(),
                status: 'read',
                reactions: '{}'
              });
            }
          } else if (data.type === 'START_CALL') {
            if (data.callerId !== 'me') {
              store.receiveCall(data);
            }
          } else if (data.type === 'ACCEPT_CALL') {
            store.setCallStatus('connected');
          } else if (data.type === 'REJECT_CALL') {
            store.endCall();
            store.addToast({
              id: `toast-${Date.now()}`,
              chatId: data.chatId,
              name: 'Llamada',
              message: 'Llamada rechazada',
              avatar: '',
            });
          } else if (data.type === 'END_CALL') {
            store.endCall();
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        setWs(null);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, []);

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-wa-dark text-wa-text antialiased select-none">
      <OfflineSyncBanner />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar: En móvil ocupa 100% cuando no hay activeChat, y se oculta automáticamente cuando se abre un chat */}
        <div className={`h-full flex-shrink-0 transition-all duration-200 ${
          activeChat ? 'hidden md:flex' : 'flex w-full md:w-auto'
        }`}>
          <Sidebar />
        </div>

        {/* Panel Principal: En móvil ocupa 100% cuando hay activeChat, y se oculta cuando no hay chat seleccionado */}
        <div className={`flex-1 flex overflow-hidden relative ${
          !activeChat ? 'hidden md:flex' : 'flex w-full'
        }`}>
          {activeChat ? (
            <>
              <div className="flex-1 flex flex-col overflow-hidden relative w-full h-full">
                <ChatArea />
                <AIAssistant />
              </div>
              {rightPanelOpen && (
                <div className="fixed inset-0 z-40 md:static md:w-96 flex-shrink-0 overflow-y-auto border-l border-gray-700/40 bg-wa-sidebar animate-slide-in-right">
                  <RightPanel />
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
      <ToastNotification />
      <CallModal />
      <IncomingCallNotification />
      {isLocked && <SessionLockOverlay onUnlock={() => setLocked(false)} />}
    </div>
  );
}

// ── Root — guard de autenticación ──────────────────────────────────────────
export default function App() {
  const { isAuthenticated, theme } = useAppStore();

  // Apply theme class on mount + change (always, incluso en login)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  if (!isAuthenticated) return <LoginQR />;
  return <AppShell />;
}
