/**
 * localDb.js — Client-Side IndexedDB Storage & Offline Outbox Queue for CHASKYAPP
 * Provides persistent offline-first capabilities for chats, messages, contacts and outbox.
 */

const DB_NAME = 'chaskyapp_offline_db';
const DB_VERSION = 1;

let _dbPromise = null;

export function getDb() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Chats store
      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('lastMessageTime', 'lastMessageTime', { unique: false });
        chatStore.createIndex('isPinned', 'isPinned', { unique: false });
      }

      // 2. Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('status', 'status', { unique: false });
      }

      // 3. Contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }

      // 4. Outbox Queue (actions waiting to sync with backend)
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        outboxStore.createIndex('actionType', 'actionType', { unique: false });
        outboxStore.createIndex('chatId', 'chatId', { unique: false });
      }

      // 5. Metadata store (sync timestamps, clientId)
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return _dbPromise;
}

// ─── Chats API ───────────────────────────────────────────────────────────────
export async function getLocalChats() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readonly');
    const store = tx.objectStore('chats');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalChats(chats) {
  if (!chats || !chats.length) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');
    for (const chat of chats) {
      if (chat && chat.id) store.put(chat);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Messages API ────────────────────────────────────────────────────────────
export async function getLocalMessages(chatId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const req = index.getAll(chatId);
    req.onsuccess = () => {
      const msgs = req.result || [];
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      resolve(msgs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalMessages(messages) {
  if (!messages || !messages.length) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    for (const msg of messages) {
      if (msg && msg.id) store.put(msg);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateLocalMessageStatus(msgId, status) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const req = store.get(msgId);
    req.onsuccess = () => {
      const msg = req.result;
      if (msg) {
        msg.status = status;
        store.put(msg);
      }
      resolve(true);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Contacts API ────────────────────────────────────────────────────────────
export async function getLocalContacts() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readonly');
    const store = tx.objectStore('contacts');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalContacts(contacts) {
  if (!contacts || !contacts.length) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    for (const contact of contacts) {
      if (contact && contact.id) store.put(contact);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Outbox Queue API (Offline Action Queue) ───────────────────────────────────
export async function queueOutboxAction(action) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const item = {
      id: action.id,
      actionType: action.actionType || 'send_message',
      chatId: action.chatId,
      payload: action.payload,
      timestamp: action.timestamp || Date.now(),
      retryCount: action.retryCount || 0
    };
    store.put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOutboxQueue() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeOutboxAction(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Sync Metadata (lastSyncTimestamp & Client ID) ───────────────────────────
export async function getSyncMeta(key) {
  const db = await getDb();
  return new Promise((resolve) => {
    const tx = db.transaction('sync_meta', 'readonly');
    const store = tx.objectStore('sync_meta');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

export async function setSyncMeta(key, value) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readwrite');
    const store = tx.objectStore('sync_meta');
    store.put({ key, value });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
