'use strict';
/**
 * whatsappGateway.js — Direct WhatsApp Web Multi-Device Gateway using Baileys
 * ==============================================================================
 * Zero-Cost Architecture ($0.00/mes): Connects directly to WhatsApp via WebSockets
 * without Meta Cloud API fees, templates, or verification restrictions.
 * Handles QR generation, persistent auth session, real-time message receiving,
 * and outbound dispatches directly from CHASKYAPP.
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { syncLeadToGoogleSheets } = require('./googleSheetsSync');

// Directory for storing WhatsApp multi-device authentication credentials
const SESSION_DIR = process.env.WA_SESSION_DIR || path.join(__dirname, '..', 'sessions', 'baileys_auth');
try {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
} catch (_) {}

let sock = null;
let currentQR = null;
let rawQR = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let connectedUser = null;
let broadcastFn = null;
let reconnectTimer = null;
let isInitializing = false;
const autoReplyCooldowns = new Map(); // remoteJid -> timestamp

/**
 * Configure external WebSocket broadcast function
 * @param {Function} fn
 */
function setBroadcast(fn) {
  broadcastFn = fn;
}

/**
 * Broadcast payload to all connected clients in CHASKYAPP
 * @param {Object} payload
 */
function notifyClients(payload) {
  if (typeof broadcastFn === 'function') {
    try {
      broadcastFn(payload);
    } catch (err) {
      console.warn('[WhatsApp Gateway] Error broadcasting to clients:', err.message);
    }
  }
}

/**
 * Initialize or reconnect the Baileys WhatsApp socket
 */
async function initWhatsAppGateway() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Clean up any existing socket and listeners before re-initializing
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.ws?.close();
      } catch (_) {}
      sock = null;
    }

    connectionStatus = 'connecting';
    notifyClients({ type: 'whatsapp_status', status: connectionStatus });

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (_) {
      // Fallback to default version if offline
    }

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['CHASKYAPP Enterprise', 'Chrome', '124.0.0'],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    // Save auth credentials whenever updated
    sock.ev.on('creds.update', saveCreds);

    // Monitor connection events & QR code generation
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        rawQR = qr;
        connectionStatus = 'qr_ready';
        try {
          currentQR = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          console.log('📲 [WhatsApp Gateway] Nuevo código QR generado. Listo para escanear.');
        } catch (e) {
          console.error('[WhatsApp Gateway] Error al generar DataURL para QR:', e.message);
        }

        notifyClients({
          type: 'whatsapp_qr',
          qr: currentQR,
          rawQR,
          status: connectionStatus,
        });
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        rawQR = null;
        connectedUser = sock.user;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Desconocido';
        console.log(`✅ [WhatsApp Gateway] Conectado exitosamente como: +${phone} (${sock.user?.name || 'CHASKYAPP'})`);

        notifyClients({
          type: 'whatsapp_status',
          status: 'connected',
          user: sock.user,
        });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`⚠️ [WhatsApp Gateway] Conexión cerrada. Status: ${statusCode}. Reconectar: ${shouldReconnect}`);
        connectionStatus = 'disconnected';
        currentQR = null;
        rawQR = null;
        connectedUser = null;

        notifyClients({
          type: 'whatsapp_status',
          status: 'disconnected',
        });

        if (shouldReconnect) {
          reconnectTimer = setTimeout(() => {
            initWhatsAppGateway().catch(e => console.warn('[WhatsApp Gateway] Reconnect error:', e.message));
          }, 6000);
        } else {
          // If logged out from phone, wipe old credentials to allow a clean QR scan
          console.log('🚪 [WhatsApp Gateway] Sesión cerrada desde el celular. Limpiando credenciales locales...');
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          } catch (_) {}
          reconnectTimer = setTimeout(() => {
            initWhatsAppGateway().catch(e => console.warn('[WhatsApp Gateway] Reset error:', e.message));
          }, 3000);
        }
      }
    });

    // ── Smart Auto-Reply Generator ──────────────────────────────────────────
    function getAutoReplyText(userMessage, pushName) {
      const lower = (userMessage || '').toLowerCase();
      if (lower.includes('hola') || lower.includes('buenas') || lower.includes('saludos') || lower.includes('hey') || lower.includes('buenos')) {
        return `¡Hola${pushName ? ' ' + pushName : ''}! 👋 Gracias por comunicarte con CHASKYAPP / Servicios Educativos Huiracocha. Soy el asistente virtual inteligente. ¿En qué podemos orientarte el día de hoy?`;
      }
      if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('costo') || lower.includes('plan') || lower.includes('tarifa') || lower.includes('matricula')) {
        return '💼 Con gusto te brindamos información de costos y planes. Un asesor comercial especializado se pondrá en contacto contigo en breve para brindarte una cotización personalizada.';
      }
      if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto') || lower.includes('atencion')) {
        return '🕘 Nuestro horario de atención es de Lunes a Sábado de 8:00 AM a 8:00 PM. Nuestro bot de IA y canales digitales están activos 24/7.';
      }
      return `¡Hola${pushName ? ' ' + pushName : ''}! 👋 Gracias por comunicarte con CHASKYAPP / Servicios Educativos Huiracocha. Hemos recibido tu mensaje: "${(userMessage || '').slice(0, 45)}...". En breve un asesor te responderá.`;
    }

    // ── Real-time Incoming Messages Listener ─────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      const db = getDb();

      for (const m of messages) {
        if (!m.message) continue;
        if (m.key.fromMe) continue; // Ignore messages sent by ourselves

        const remoteJid = m.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.includes('status@broadcast')) {
          continue;
        }

        const isGroup = remoteJid.endsWith('@g.us');
        let cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
        let pushName = m.pushName || '';

        if (!pushName) {
          if (cleanPhone.length >= 9 && !cleanPhone.includes('@')) {
            pushName = `+${cleanPhone}`;
          } else if (isGroup) {
            pushName = 'Grupo de WhatsApp';
          } else {
            pushName = 'Contacto WhatsApp';
          }
        }

        // Extract message text content
        const messageText =
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          (m.message?.imageMessage ? '📷 Imagen' : '') ||
          (m.message?.documentMessage ? `📄 Documento: ${m.message.documentMessage.fileName || 'archivo'}` : '') ||
          (m.message?.audioMessage ? '🎵 Nota de voz' : '') ||
          (m.message?.videoMessage ? '🎥 Video' : '') ||
          (m.message?.stickerMessage ? '💟 Sticker' : '') ||
          'Mensaje multimedia';

        // 1. Get or create contact in SQLite
        let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(cleanPhone);
        if (!contact) {
          const contactId = 'c_' + uuidv4().slice(0, 8);
          db.prepare(`
            INSERT INTO contacts (id, name, phone, avatar, status, isOnline, createdAt)
            VALUES (?, ?, ?, ?, ?, 1, ?)
          `).run(
            contactId,
            pushName,
            cleanPhone,
            `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanPhone}`,
            'Cliente WhatsApp',
            Date.now()
          );
          contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
        } else if (m.pushName && (!contact.name || contact.name.startsWith('Contacto +') || contact.name.startsWith('+'))) {
          db.prepare('UPDATE contacts SET name = ? WHERE id = ?').run(m.pushName, contact.id);
          contact.name = m.pushName;
        }

        // 2. Get or create chat in SQLite
        let chat = db.prepare('SELECT * FROM chats WHERE contactId = ?').get(contact.id);
        const now = Date.now();
        if (!chat) {
          const chatId = 'chat_' + uuidv4().slice(0, 8);
          db.prepare(`
            INSERT INTO chats (id, contactId, type, groupName, lastMessage, lastMessageTime, unreadCount, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
          `).run(chatId, contact.id, isGroup ? 'group' : 'individual', isGroup ? pushName : null, messageText, now, now);
          chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
        } else {
          db.prepare(`
            UPDATE chats
            SET lastMessage = ?, lastMessageTime = ?, unreadCount = unreadCount + 1
            WHERE id = ?
          `).run(messageText, now, chat.id);
        }

        // 3. Save incoming message in SQLite
        const msgId = m.key.id || uuidv4();
        db.prepare(`
          INSERT OR REPLACE INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
          VALUES (?, ?, ?, ?, ?, 'text', ?, 'delivered')
        `).run(msgId, chat.id, contact.id, pushName, messageText, now);

        const savedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);

        // Enriched chat row joining contact details for the frontend
        const fullChat = db.prepare(`
          SELECT c.*,
                 co.name AS contactName,
                 co.avatar AS contactAvatar,
                 co.isOnline AS contactIsOnline,
                 co.lastSeen AS contactLastSeen,
                 co.status AS contactStatus,
                 co.phone AS contactPhone
          FROM chats c
          LEFT JOIN contacts co ON c.contactId = co.id
          WHERE c.id = ?
        `).get(chat.id);

        // 4. Emit live update through WebSocket to CHASKYAPP Web Client
        notifyClients({
          type: 'chat_updated',
          chat: fullChat,
        });

        notifyClients({
          type: 'new_message',
          chatId: chat.id,
          message: savedMsg,
          chat: fullChat,
        });

        // 5. Automatic CRM Lead Sync to Google Sheets (Zero-Cost)
        syncLeadToGoogleSheets({
          chatId: chat.id,
          name: pushName,
          phone: cleanPhone,
          message: messageText,
          channel: 'WhatsApp (Gateway)',
          stage: 'Lead Nuevo',
        }).catch((crmErr) => {
          console.warn('[WhatsApp Gateway] Error al sincronizar con Google Sheets CRM:', crmErr.message);
        });

        // 6. Automated Auto-Responder / Bot Response for 1-to-1 chats
        if (!isGroup && !m.key.fromMe) {
          try {
            const autoSetting = db.prepare("SELECT value FROM settings WHERE key = 'autoResponderEnabled'").get();
            const isAutoEnabled = !autoSetting || autoSetting.value === 'true';

            if (isAutoEnabled) {
              const lastReply = autoReplyCooldowns.get(remoteJid) || 0;
              // 3-minute cooldown per user to prevent loops or multiple greetings
              if (now - lastReply > 3 * 60 * 1000) {
                autoReplyCooldowns.set(remoteJid, now);

                const botReply = getAutoReplyText(messageText, pushName);

                setTimeout(async () => {
                  try {
                    await sock.sendMessage(remoteJid, { text: botReply });
                    const autoMsgId = 'bot_' + uuidv4().slice(0, 8);
                    const autoTime = Date.now();

                    db.prepare(`
                      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
                      VALUES (?, ?, 'me', 'Chasky Bot', ?, 'text', ?, 'delivered')
                    `).run(autoMsgId, chat.id, botReply, autoTime);

                    db.prepare(`
                      UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?
                    `).run(botReply, autoTime, chat.id);

                    const savedBotMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(autoMsgId);
                    const updatedChatAfterBot = db.prepare(`
                      SELECT c.*,
                             co.name AS contactName,
                             co.avatar AS contactAvatar,
                             co.isOnline AS contactIsOnline,
                             co.lastSeen AS contactLastSeen,
                             co.status AS contactStatus,
                             co.phone AS contactPhone
                      FROM chats c
                      LEFT JOIN contacts co ON c.contactId = co.id
                      WHERE c.id = ?
                    `).get(chat.id);

                    notifyClients({
                      type: 'chat_updated',
                      chat: updatedChatAfterBot,
                    });

                    notifyClients({
                      type: 'new_message',
                      chatId: chat.id,
                      message: savedBotMsg,
                      chat: updatedChatAfterBot,
                    });

                    console.log(`🤖 [Auto-Responder] Respuesta enviada exitosamente a ${remoteJid}`);
                  } catch (autoErr) {
                    console.warn('⚠️ [Auto-Responder] Error al enviar respuesta automática:', autoErr.message);
                  }
                }, 1000);
              }
            }
          } catch (botCheckErr) {
            console.warn('[Auto-Responder] Error verificando ajustes:', botCheckErr.message);
          }
        }
      }
    });

  } catch (err) {
    console.error('❌ [WhatsApp Gateway] Error fatal en inicialización:', err);
    connectionStatus = 'disconnected';
  } finally {
    isInitializing = false;
  }
}

/**
 * Send an outbound text message directly through the local WhatsApp session
 * @param {string} toPhone - Target phone number (e.g. "51987654321" or "+51 987 654 321")
 * @param {string} text - Message body
 * @returns {Promise<Object>} Baileys dispatch response
 */
async function sendTextMessage(toPhone, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('El gateway de WhatsApp no está conectado. Por favor escanea el código QR en Ajustes.');
  }

  let jid;
  const str = String(toPhone).trim();
  if (str.includes('@')) {
    jid = str;
  } else {
    const cleanNumber = str.replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber.length < 8) {
      throw new Error(`Número de teléfono no válido: ${toPhone}`);
    }
    jid = `${cleanNumber}@s.whatsapp.net`;
  }

  const result = await sock.sendMessage(jid, { text });
  return result;
}

/**
 * Send outbound media (image, document, audio)
 * @param {string} toPhone
 * @param {Buffer|string} mediaBufferOrUrl
 * @param {string} mimeType
 * @param {string} caption
 */
async function sendMediaMessage(toPhone, mediaBufferOrUrl, mimeType, caption = '') {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('El gateway de WhatsApp no está conectado. Escanea el código QR.');
  }

  const cleanNumber = String(toPhone).replace(/[^0-9]/g, '');
  const jid = `${cleanNumber}@s.whatsapp.net`;

  let messagePayload = {};
  if (mimeType.startsWith('image/')) {
    messagePayload = { image: mediaBufferOrUrl, caption };
  } else if (mimeType.startsWith('audio/')) {
    messagePayload = { audio: mediaBufferOrUrl, mimetype: mimeType };
  } else {
    messagePayload = { document: mediaBufferOrUrl, mimetype: mimeType, fileName: caption || 'archivo' };
  }

  return await sock.sendMessage(jid, messagePayload);
}

/**
 * Log out and remove active WhatsApp credentials
 */
async function logoutGateway() {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (_) {}

  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  } catch (_) {}

  connectionStatus = 'disconnected';
  currentQR = null;
  rawQR = null;
  connectedUser = null;

  notifyClients({ type: 'whatsapp_status', status: 'disconnected' });
  console.log('🗑️ [WhatsApp Gateway] Credenciales eliminadas. Listo para nuevo emparejamiento.');

  // Reboot socket to generate a fresh QR
  setTimeout(() => {
    initWhatsAppGateway();
  }, 1000);
}

/**
 * Returns current gateway status and QR code
 */
function getGatewayStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
    rawQR,
    user: connectedUser,
  };
}

module.exports = {
  initWhatsAppGateway,
  sendTextMessage,
  sendMediaMessage,
  logoutGateway,
  getGatewayStatus,
  setBroadcast,
};
