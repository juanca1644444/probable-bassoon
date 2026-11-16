/**
 * syncManager.js — Offline-First Synchronization & Outbox Queue Engine for CHASKYAPP
 * Handles network connectivity detection, local database persistence, background batch sync,
 * and optimistic UI updates with automatic conflict resolution.
 */

import {
  getLocalChats, saveLocalChats,
  getLocalMessages, saveLocalMessages, updateLocalMessageStatus,
  getLocalContacts, saveLocalContacts,
  queueOutboxAction, getOutboxQueue, removeOutboxAction,
  getSyncMeta, setSyncMeta
} from './localDb';

let _syncInterval = null;
let _isSyncing = false;
let _isOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set();

export function setOnlineState(online) {
  _isOnlineState = Boolean(online);
}

export function getIsOnline() {
  return _isOnlineState;
}

function emitSyncState(state) {
  listeners.forEach(cb => {
    try { cb(state); } catch (e) { console.error('Sync listener error:', e); }
  });
}

export function subscribeSyncState(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ── Client ID generation / retrieval ─────────────────────────────────────────
export async function getClientId() {
  let id = await getSyncMeta('client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    await setSyncMeta('client_id', id);
  }
  return id;
}

// ── Core Sync Processor ──────────────────────────────────────────────────────
export async function processOutboxSync(useAppStore) {
  if (_isSyncing) return;
  const isOnline = _isOnlineState && (typeof navigator !== 'undefined' ? navigator.onLine : true);
  if (!isOnline) {
    emitSyncState({ isOnline: false, isSyncing: false, pendingCount: (await getOutboxQueue()).length });
    return;
  }

  const outbox = await getOutboxQueue();
  const lastSyncTimestamp = (await getSyncMeta('last_sync_timestamp')) || 0;

  // Even if outbox is empty, we still query /api/sync if we need server updates
  _isSyncing = true;
  emitSyncState({ isOnline: true, isSyncing: true, pendingCount: outbox.length });

  try {
    const clientId = await getClientId();
    const payload = {
      clientId,
      lastSyncTimestamp,
      outbox: outbox.map(item => ({
        id: item.id,
        actionType: item.actionType,
        chatId: item.chatId,
        payload: item.payload,
        timestamp: item.timestamp
      }))
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();

      // 1. Clear successfully processed outbox items
      if (data.processedOutboxIds && data.processedOutboxIds.length > 0) {
        for (const processedId of data.processedOutboxIds) {
          await removeOutboxAction(processedId);
          await updateLocalMessageStatus(processedId, 'sent');

          // Update Zustand store optimistically
          if (useAppStore) {
            const store = useAppStore.getState();
            // Loop through chats and update message status
            for (const cId of Object.keys(store.messages || {})) {
              const msgs = store.messages[cId];
              const target = msgs?.find(m => m.id === processedId);
              if (target) {
                target.status = 'sent';
                store.setMessages(cId, [...msgs]);
              }
            }
          }
        }
      }

      // 2. Ingest new server messages received while offline
      if (data.newMessages && data.newMessages.length > 0) {
        await saveLocalMessages(data.newMessages);
        if (useAppStore) {
          const store = useAppStore.getState();
          data.newMessages.forEach(msg => {
            if (msg.chatId) {
              store.addMessage(msg.chatId, msg);
              store.updateChatLastMessage(msg.chatId, msg.content || 'Nuevo mensaje', msg.timestamp);
            }
          });
        }
      }

      // 3. Update chats
      if (data.updatedChats && data.updatedChats.length > 0) {
        await saveLocalChats(data.updatedChats);
        if (useAppStore) {
          const store = useAppStore.getState();
          data.updatedChats.forEach(chat => store.addOrUpdateChat(chat));
        }
      }

      // 4. Update sync timestamp
      if (data.serverTimestamp) {
        await setSyncMeta('last_sync_timestamp', data.serverTimestamp);
      }

      const remainingOutbox = await getOutboxQueue();
      emitSyncState({
        isOnline: true,
        isSyncing: false,
        pendingCount: remainingOutbox.length,
        syncedCount: data.processedOutboxIds?.length || 0
      });
    }
  } catch (err) {
    console.warn('Sync attempt failed (network unstable):', err.message);
  } finally {
    _isSyncing = false;
    const remaining = await getOutboxQueue();
    const isOnline = _isOnlineState && (typeof navigator !== 'undefined' ? navigator.onLine : true);
    emitSyncState({
      isOnline,
      isSyncing: false,
      pendingCount: remaining.length
    });
  }
}

// ── Offline-First Message Dispatcher ──────────────────────────────────────────
export async function sendOfflineFirstMessage({ chatId, content, type = 'text', replyTo = null, fileName = null, fileSize = null, filePath = null }, useAppStore) {
  const msgId = 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
  const timestamp = Date.now();
  const isOnline = _isOnlineState && (typeof navigator !== 'undefined' ? navigator.onLine : true);

  const optimisticMessage = {
    id: msgId,
    chatId,
    senderId: 'me',
    senderName: 'Yo',
    content,
    type,
    timestamp,
    status: isOnline ? 'sent' : 'pending_sync', // Clock icon 🕒 if offline!
    replyTo: replyTo || null,
    fileName: fileName || null,
    fileSize: fileSize || null,
    filePath: filePath || null,
    reactions: '{}'
  };

  // 1. Immediately save to IndexedDB
  await saveLocalMessages([optimisticMessage]);

  // 2. Queue in Outbox
  await queueOutboxAction({
    id: msgId,
    actionType: 'send_message',
    chatId,
    payload: optimisticMessage,
    timestamp
  });

  // 3. Optimistically render in UI
  if (useAppStore) {
    const store = useAppStore.getState();
    store.addMessage(chatId, optimisticMessage);
    const previewSummary = type === 'sticker' ? '💟 Sticker' : (content || fileName || 'Archivo');
    store.updateChatLastMessage(chatId, previewSummary, timestamp);
  }

  // 4. If online, trigger immediate sync
  if (isOnline) {
    processOutboxSync(useAppStore);
  } else {
    emitSyncState({
      isOnline: false,
      isSyncing: false,
      pendingCount: (await getOutboxQueue()).length
    });
  }

  return optimisticMessage;
}

// ── Initialize Background Sync Listeners ──────────────────────────────────────
export function initOfflineSync(useAppStore) {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    _isOnlineState = true;
    console.log('🌐 Conexión a internet restablecida. Iniciando sincronización Outbox...');
    emitSyncState({ isOnline: true, isSyncing: true, pendingCount: 0 });
    processOutboxSync(useAppStore);
  };

  const handleOffline = async () => {
    _isOnlineState = false;
    console.log('🔴 Conexión a internet perdida. Modo Offline-First activado.');
    const count = (await getOutboxQueue()).length;
    emitSyncState({ isOnline: false, isSyncing: false, pendingCount: count });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial sync attempt
  processOutboxSync(useAppStore);

  // Periodic heartbeat sync every 25 seconds
  if (!_syncInterval) {
    _syncInterval = setInterval(() => {
      const isOnline = _isOnlineState && (typeof navigator !== 'undefined' ? navigator.onLine : true);
      if (isOnline) {
        processOutboxSync(useAppStore);
      }
    }, 25000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = null;
  };
}
