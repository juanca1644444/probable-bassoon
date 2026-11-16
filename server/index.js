'use strict';
// index.js — WhatsApp Pro Server: Express + WebSocket + SQLite
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb, initDatabase, DB_PATH } = require('./database');
const {
  ingestDocument,
  searchSimilarChunks,
  detectHandoffIntent,
  generateCopilotSuggestions,
  getRagSettings,
  updateRagSettings,
  seedInitialKnowledgeBase,
  HANDOFF_KEYWORDS
} = require('./ragEngine');

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

// ─── WebSocket Server ───────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

const clients = new Map(); // clientId -> ws

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  console.log(`🔌 WS connected: ${clientId} (total: ${clients.size})`);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      // Broadcast chat & call signaling to all OTHER clients
      const callTypes = ['START_CALL', 'ACCEPT_CALL', 'REJECT_CALL', 'END_CALL'];
      if (
        data.type === 'typing' ||
        data.type === 'stop_typing' ||
        data.type === 'new_message' ||
        data.type === 'reaction' ||
        callTypes.includes(data.type)
      ) {
        clients.forEach((client, id) => {
          if (id !== clientId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }

      // Log calls to database
      if (data.type === 'START_CALL') {
        const db = getDb();
        const callId = data.callId || uuidv4();
        try {
          db.prepare(`
            INSERT OR REPLACE INTO calls (id, callerId, receiverId, chatId, type, status, duration, timestamp)
            VALUES (?, ?, ?, ?, ?, 'ringing', 0, ?)
          `).run(
            callId,
            data.callerId || 'me',
            data.receiverId || 'contact',
            data.chatId || null,
            data.callType || 'voice',
            Date.now()
          );
        } catch (e) {
          console.error('Error logging START_CALL:', e.message);
        }
      } else if (data.type === 'END_CALL' && data.callId) {
        const db = getDb();
        try {
          db.prepare(`
            UPDATE calls SET status = 'completed', duration = CASE WHEN duration = 0 THEN 35 ELSE duration END
            WHERE id = ?
          `).run(data.callId);
        } catch (e) {
          console.error('Error updating END_CALL:', e.message);
        }
      } else if (data.type === 'REJECT_CALL' && data.callId) {
        const db = getDb();
        try {
          db.prepare(`UPDATE calls SET status = 'rejected' WHERE id = ?`).run(data.callId);
        } catch (e) {
          console.error('Error updating REJECT_CALL:', e.message);
        }
      }
    } catch (e) { /* ignore malformed */ }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`❌ WS disconnected: ${clientId}`);
  });

  // Send welcome ping
  ws.send(JSON.stringify({ type: 'connected', clientId }));
});

// Broadcast helper
function broadcast(data, excludeClientId = null) {
  const msg = JSON.stringify(data);
  clients.forEach((client, id) => {
    if (id !== excludeClientId && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ─── Middleware de CORS para Red Local (LAN) y Pruebas Multi-Dispositivo ───
const ALLOWED_EXPLICIT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.1.9:5173',
  'http://localhost:3000',
  'http://192.168.1.9:3000',
  'http://localhost:3001',
  'http://192.168.1.9:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (apps móviles, curl, Postman, WebSockets)
    if (!origin) return callback(null, true);

    // Orígenes explícitos configurados
    if (ALLOWED_EXPLICIT_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Permitir cualquier IP dentro de la red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x) y túneles WAN
    const isLANOrTunnel = 
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /\.loca\.lt$/.test(origin) ||
      /\.ngrok-free\.app$/.test(origin) ||
      /\.ngrok\.io$/.test(origin);

    if (isLANOrTunnel) {
      return callback(null, true);
    }

    // Fallback permisivo para entornos de prueba
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Client-ID']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// File uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
require('fs').mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4().slice(0,8)}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
app.use('/uploads', express.static(uploadDir));

// Multi-Tenant SaaS Subscriptions & White-Label Routes
const { saasRouter, multiTenantMiddleware } = require('./saasRoutes');
app.use(multiTenantMiddleware);
app.use('/api/saas', saasRouter);

// Official Channel Gateway (Meta WhatsApp Cloud API & Telegram Bot API Bridge)
const { channelBridgeRouter, setBroadcastFunction, dispatchToExternalChannel } = require('./services/channelBridge');
setBroadcastFunction(broadcast);
app.use('/api', channelBridgeRouter);

// Telephony & IVR Voice Engine (Speech-to-Speech & WebRTC)
const { telephonyRouter, initTelephonyTables, setBroadcastFunction: setTelephonyBroadcast } = require('./services/telephonyService');
initTelephonyTables();
setTelephonyBroadcast(broadcast);
app.use('/api', telephonyRouter);

// Smart Document Generator & Digital Signature Engine
const { documentRouter, initDocumentTables, setBroadcastFunction: setDocumentBroadcast } = require('./services/documentService');
initDocumentTables();
setDocumentBroadcast(broadcast);
app.use('/api', documentRouter);

// Business Intelligence (BI), KPIs & Sales Funnel Analytics
const { biRouter } = require('./services/biService');
app.use('/api/bi', biRouter);

// Multi-Agent AI Routing & Departmental Specialists
const {
  multiAgentRouter,
  initMultiAgentTables,
  setBroadcastFunction: setMultiAgentBroadcast,
  classifyMessageIntent,
  generateDepartmentResponse
} = require('./services/multiAgentService');
initMultiAgentTables();
setMultiAgentBroadcast(broadcast);
app.use('/api/ai-agents', multiAgentRouter);

// ─── API Routes ─────────────────────────────────────────────────────────────

// --- Chats ---
app.get('/api/chats', (req, res) => {
  const db = getDb();
  const { archived } = req.query;
  const isArchived = archived === 'true' ? 1 : 0;
  const chats = db.prepare(`
    SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
           co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
           co.status AS contactStatus, co.phone AS contactPhone,
           ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
    FROM chats c
    LEFT JOIN contacts co ON c.contactId = co.id
    LEFT JOIN agents ag ON c.assignedAgentId = ag.id
    WHERE c.isArchived = ?
    ORDER BY c.isPinned DESC, c.lastMessageTime DESC
  `).all(isArchived);
  res.json(chats);
});

app.get('/api/chats/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const chat = db.prepare(`
    SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
           co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
           co.status AS contactStatus, co.phone AS contactPhone,
           ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
    FROM chats c
    LEFT JOIN contacts co ON c.contactId = co.id
    LEFT JOIN agents ag ON c.assignedAgentId = ag.id
    WHERE c.id = ?
  `).get(id);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
  res.json(chat);
});

app.post('/api/chats', (req, res) => {
  const db = getDb();
  const { contactId, type = 'individual', groupName, groupAvatar, channel = 'whatsapp', status = 'open', assignedAgentId = null } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO chats (id, contactId, type, groupName, groupAvatar, lastMessage, lastMessageTime, unreadCount, channel, status, assignedAgentId) VALUES (?, ?, ?, ?, ?, '', ?, 0, ?, ?, ?)`)
    .run(id, contactId || null, type, groupName || null, groupAvatar || null, Date.now(), channel, status, assignedAgentId);
  const chat = db.prepare(`
    SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
           co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
           co.status AS contactStatus, co.phone AS contactPhone,
           ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
    FROM chats c
    LEFT JOIN contacts co ON c.contactId = co.id
    LEFT JOIN agents ag ON c.assignedAgentId = ag.id
    WHERE c.id = ?
  `).get(id);
  broadcast({ type: 'new_chat', chat });

  // Sincronización automática de nuevo Lead en Google Sheets CRM
  try {
    const { syncLeadToGoogleSheets } = require('./services/googleSheetsSync');
    syncLeadToGoogleSheets({
      chatId: id,
      contactName: chat?.contactName || groupName || 'Nuevo Prospecto Web',
      contactPhone: chat?.contactPhone || '',
      channel: channel || 'Web',
      stageName: 'Nuevo Lead',
      agentName: chat?.assignedAgentName || 'Equipo Huiracocha',
      notes: 'Lead creado vía chat'
    }).catch(err => console.warn('[Google Sheets Sync] Nuevo chat:', err.message));
  } catch (_) {}

  res.json(chat);
});

app.patch('/api/chats/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { isPinned, isMuted, isArchived, unreadCount, disappearingTimer, channel, status, assignedAgentId } = req.body;
  const updates = [];
  const vals = [];
  if (isPinned !== undefined) { updates.push('isPinned = ?'); vals.push(isPinned ? 1 : 0); }
  if (isMuted !== undefined) { updates.push('isMuted = ?'); vals.push(isMuted ? 1 : 0); }
  if (isArchived !== undefined) { updates.push('isArchived = ?'); vals.push(isArchived ? 1 : 0); }
  if (unreadCount !== undefined) { updates.push('unreadCount = ?'); vals.push(unreadCount); }
  if (disappearingTimer !== undefined) { updates.push('disappearingTimer = ?'); vals.push(disappearingTimer); }
  if (channel !== undefined) { updates.push('channel = ?'); vals.push(channel); }
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (assignedAgentId !== undefined) { updates.push('assignedAgentId = ?'); vals.push(assignedAgentId); }
  if (updates.length) {
    vals.push(id);
    db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  }
  const updatedChat = db.prepare(`
    SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
           co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
           co.status AS contactStatus, co.phone AS contactPhone,
           ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
    FROM chats c
    LEFT JOIN contacts co ON c.contactId = co.id
    LEFT JOIN agents ag ON c.assignedAgentId = ag.id
    WHERE c.id = ?
  `).get(id);
  if (updatedChat) {
    broadcast({ type: 'chat_updated', chat: updatedChat });
  }
  res.json({ success: true, chat: updatedChat });
});

// --- Omnichannel & Agents Endpoints ---
app.get('/api/agents', (req, res) => {
  const db = getDb();
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all();
    res.json(agents);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/agents', (req, res) => {
  const db = getDb();
  const { name, email, role = 'Soporte', avatar, status = 'online' } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const id = 'agent-' + uuidv4().slice(0, 8);
  try {
    db.prepare(`
      INSERT INTO agents (id, name, email, role, avatar, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email || null, role, avatar || null, status, Date.now());
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    res.status(201).json(agent);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/agents/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status, role, name } = req.body;
  const updates = [];
  const vals = [];
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (role !== undefined) { updates.push('role = ?'); vals.push(role); }
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (updates.length) {
    vals.push(id);
    db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  }
  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  broadcast({ type: 'agent_updated', agent: updated });
  res.json(updated);
});

app.post('/api/chats/:id/assign', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { agentId, assignedBy = 'Yo' } = req.body;
  try {
    db.prepare('UPDATE chats SET assignedAgentId = ? WHERE id = ?').run(agentId || null, id);
    if (agentId) {
      const assignId = uuidv4();
      db.prepare(`
        INSERT INTO chat_assignments (id, chatId, agentId, assignedAt, assignedBy)
        VALUES (?, ?, ?, ?, ?)
      `).run(assignId, id, agentId, Date.now(), assignedBy);
    }
    const fullChat = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
             co.status AS contactStatus, co.phone AS contactPhone,
             ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      LEFT JOIN agents ag ON c.assignedAgentId = ag.id
      WHERE c.id = ?
    `).get(id);

    broadcast({ type: 'chat_assigned', chatId: id, agentId, chat: fullChat });
    broadcast({ type: 'chat_updated', chat: fullChat });
    res.json({ success: true, chat: fullChat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE chats SET status = ? WHERE id = ?').run(status, id);
    const fullChat = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
             co.status AS contactStatus, co.phone AS contactPhone,
             ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      LEFT JOIN agents ag ON c.assignedAgentId = ag.id
      WHERE c.id = ?
    `).get(id);

    broadcast({ type: 'chat_status_changed', chatId: id, status, chat: fullChat });
    broadcast({ type: 'chat_updated', chat: fullChat });

    // ── Disparador Automático CSAT: Si el estado cambia a 'resolved', enviar encuesta automática ──
    if (status === 'resolved' || status === 'resuelto') {
      const surveyId = 'csat-' + uuidv4().slice(0, 8);
      const msgId = uuidv4();
      const now = Date.now();

      db.prepare(`
        INSERT INTO csat_surveys (id, chatId, rating, comment, agentId, customerPhone, channel, status, createdAt)
        VALUES (?, ?, 0, '', ?, ?, ?, 'pending', ?)
      `).run(surveyId, id, fullChat?.assignedAgentId || 'me', fullChat?.contactPhone || '', fullChat?.channel || 'whatsapp', now);

      const surveyPayload = JSON.stringify({
        surveyId,
        chatId: id,
        title: '⭐ Encuesta de Satisfacción del Cliente (CSAT)',
        subtitle: 'Tu caso ha sido marcado como Resuelto por el equipo. Por favor ayúdanos calificando la atención recibida.',
        agentName: fullChat?.assignedAgentName || 'Equipo de Soporte CHASKYAPP',
        status: 'pending',
        rating: 0,
        comment: '',
        createdAt: now
      });

      db.prepare(`
        INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
        VALUES (?, ?, 'system', 'CHASKYAPP Satisfacción', ?, 'csat_survey', ?, 'sent', null, '{}')
      `).run(msgId, id, surveyPayload, now);

      db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?')
        .run('⭐ Encuesta de satisfacción enviada', now, id);

      const surveyMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
      broadcast({ type: 'new_message', chatId: id, message: surveyMsg });
      broadcast({ type: 'csat_created', chatId: id, survey: { id: surveyId, chatId: id, status: 'pending' } });
      dispatchWebhook('csat.triggered', { chatId: id, surveyId });
    }

    res.json({ success: true, chat: fullChat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/channel', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { channel } = req.body;
  try {
    db.prepare('UPDATE chats SET channel = ? WHERE id = ?').run(channel, id);
    const fullChat = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
             co.status AS contactStatus, co.phone AS contactPhone,
             ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      LEFT JOIN agents ag ON c.assignedAgentId = ag.id
      WHERE c.id = ?
    `).get(id);

    broadcast({ type: 'chat_updated', chat: fullChat });
    res.json({ success: true, chat: fullChat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chats/:id/notes', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const notes = db.prepare('SELECT * FROM internal_notes WHERE chatId = ? ORDER BY createdAt ASC').all(id);
    res.json(notes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/notes', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { content, authorName = 'Yo (Operador)', authorId = 'agent-me' } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El contenido de la nota no puede estar vacío' });
  }
  const noteId = 'note-' + uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO internal_notes (id, chatId, authorId, authorName, content, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(noteId, id, authorId, authorName, content.trim(), now);
    
    const note = db.prepare('SELECT * FROM internal_notes WHERE id = ?').get(noteId);
    broadcast({ type: 'internal_note_added', chatId: id, note });
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const note = db.prepare('SELECT * FROM internal_notes WHERE id = ?').get(id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
    db.prepare('DELETE FROM internal_notes WHERE id = ?').run(id);
    broadcast({ type: 'internal_note_deleted', noteId: id, chatId: note.chatId });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- AI Sentiment Analysis Service ---
function analyzeChatSentiment(chatId) {
  const db = getDb();
  try {
    const recentMsgs = db.prepare(`
      SELECT content, senderId, timestamp
      FROM messages
      WHERE chatId = ? AND isDeleted = 0 AND type = 'text'
      ORDER BY timestamp DESC LIMIT 20
    `).all(chatId);

    if (!recentMsgs || recentMsgs.length === 0) {
      return { chatId, sentiment: 'neutral', score: 0, label: 'Neutral', urgent: false, keywords: [], customerMessagesCount: 0, analyzedAt: Date.now() };
    }

    const positiveWords = ['gracias', 'excelente', 'perfecto', 'genial', 'me encanta', 'feliz', 'rápido', 'solucionado', 'bueno', 'recomendado', 'super', 'de acuerdo', 'confirmado', 'bien', 'buena', 'lindo', 'agradecido', 'top'];
    const urgentWords = ['urgente', 'pésimo', 'estafa', 'cancelen', 'cancelar', 'reembolso', 'falla', 'no funciona', 'error', 'demora', 'indignado', 'molestia', 'ayuda por favor', 'cuando llega', 'mal servicio', 'nunca', 'queja', 'reclamo', 'fraude', 'horrible', 'inaceptable', 'ayuda'];

    let posCount = 0;
    let negCount = 0;
    const foundKeywords = [];

    const customerMsgs = recentMsgs.filter(m => m.senderId !== 'me');
    const msgsToAnalyze = customerMsgs.length > 0 ? customerMsgs : recentMsgs;

    for (const msg of msgsToAnalyze) {
      const lower = (msg.content || '').toLowerCase();
      for (const w of urgentWords) {
        if (lower.includes(w)) {
          negCount += 2;
          if (!foundKeywords.includes(w)) foundKeywords.push(w);
        }
      }
      for (const w of positiveWords) {
        if (lower.includes(w)) {
          posCount += 1;
          if (!foundKeywords.includes(w)) foundKeywords.push(w);
        }
      }
    }

    let sentiment = 'neutral';
    let score = 0;
    let urgent = false;

    if (negCount > 0 && negCount >= posCount) {
      sentiment = 'urgent';
      score = Math.max(-1.0, -0.3 - (negCount * 0.15));
      urgent = true;
    } else if (posCount > negCount) {
      sentiment = 'positive';
      score = Math.min(1.0, 0.3 + (posCount * 0.15));
    } else {
      sentiment = 'neutral';
      score = 0;
    }

    const result = {
      chatId,
      sentiment,
      score: Number(score.toFixed(2)),
      label: sentiment === 'positive' ? 'Positivo' : sentiment === 'urgent' ? 'Urgente / Crítico' : 'Neutral',
      urgent,
      keywords: foundKeywords,
      customerMessagesCount: msgsToAnalyze.length,
      analyzedAt: Date.now()
    };

    const logId = 'slog-' + chatId;
    db.prepare(`
      INSERT INTO sentiment_logs (id, chatId, sentiment, score, keywords, analyzedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET sentiment=excluded.sentiment, score=excluded.score, keywords=excluded.keywords, analyzedAt=excluded.analyzedAt
    `).run(logId, chatId, sentiment, result.score, JSON.stringify(foundKeywords), result.analyzedAt);

    return result;
  } catch (err) {
    console.error('Sentiment analysis error:', err.message);
    return { chatId, sentiment: 'neutral', score: 0, label: 'Neutral', urgent: false, keywords: [], analyzedAt: Date.now() };
  }
}

// Webhook Dispatcher Helper with HMAC SHA-256 and Retries
async function executeWebhookAttempt(hook, event, payload, attempt = 1) {
  const db = getDb();
  const logId = 'whl-' + uuidv4().slice(0, 8);
  const startTime = Date.now();
  const bodyData = {
    event,
    payload,
    timestamp: startTime,
    deliveryId: logId,
    attempt
  };
  const bodyStr = JSON.stringify(bodyData);
  const secret = hook.secret || 'chasky_secret_live';
  const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Chasky-Event': event,
        'X-Chasky-Signature': `sha256=${signature}`,
        'X-Chasky-Delivery': logId,
        'X-Chasky-Timestamp': String(startTime),
        'User-Agent': 'CHASKYAPP-Webhook-Dispatcher/1.0'
      },
      body: bodyStr,
      signal: AbortSignal.timeout(5000)
    });

    const duration_ms = Date.now() - startTime;
    const responseText = await res.text();
    const isSuccess = res.status >= 200 && res.status < 300;

    db.prepare(`
      INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, hook.id, hook.url, event, JSON.stringify(payload),
      res.status, responseText.slice(0, 500), duration_ms, attempt,
      isSuccess ? 'success' : 'failed', Date.now()
    );

    if (isSuccess) {
      db.prepare('UPDATE webhooks SET successCount = COALESCE(successCount, 0) + 1 WHERE id = ?').run(hook.id);
    } else {
      db.prepare('UPDATE webhooks SET failureCount = COALESCE(failureCount, 0) + 1 WHERE id = ?').run(hook.id);
      if (attempt < (hook.retryCount || 3)) {
        setTimeout(() => executeWebhookAttempt(hook, event, payload, attempt + 1), attempt * 2000);
      }
    }

    broadcast({
      type: 'webhook_dispatched',
      log: {
        id: logId, webhookId: hook.id, url: hook.url, event,
        responseStatus: res.status, duration_ms, attempt,
        status: isSuccess ? 'success' : 'failed', createdAt: Date.now()
      }
    });
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    db.prepare(`
      INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, hook.id, hook.url, event, JSON.stringify(payload),
      504, err.message, duration_ms, attempt, 'failed', Date.now()
    );

    db.prepare('UPDATE webhooks SET failureCount = COALESCE(failureCount, 0) + 1 WHERE id = ?').run(hook.id);

    if (attempt < (hook.retryCount || 3)) {
      setTimeout(() => executeWebhookAttempt(hook, event, payload, attempt + 1), attempt * 2000);
    }

    broadcast({
      type: 'webhook_dispatched',
      log: {
        id: logId, webhookId: hook.id, url: hook.url, event,
        responseStatus: 504, responseBody: err.message, duration_ms, attempt,
        status: 'failed', createdAt: Date.now()
      }
    });
  }
}

async function dispatchWebhook(event, payload) {
  const db = getDb();
  try {
    const hooks = db.prepare('SELECT * FROM webhooks WHERE isActive = 1').all();
    for (const hook of hooks) {
      const subscribed = (hook.events || '').split(',').map(e => e.trim());
      if (subscribed.includes('*') || subscribed.includes(event)) {
        executeWebhookAttempt(hook, event, payload, 1).catch(err => {
          console.error(`Error in webhook ${hook.id}:`, err.message);
        });
      }
    }
  } catch (e) {
    console.error('Error dispatching webhooks:', e.message);
  }
}

// --- AI Sentiment Endpoints ---
app.get('/api/chats/:id/sentiment', (req, res) => {
  const { id } = req.params;
  const analysis = analyzeChatSentiment(id);
  res.json(analysis);
});

app.get('/api/sentiments', (req, res) => {
  const db = getDb();
  try {
    const chats = db.prepare('SELECT id FROM chats').all();
    const map = {};
    for (const c of chats) {
      map[c.id] = analyzeChatSentiment(c.id);
    }
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Payments & Fast Checkout Endpoints ---
app.get('/api/payments', (req, res) => {
  const db = getDb();
  const { chatId } = req.query;
  try {
    let query = 'SELECT * FROM payments';
    const params = [];
    if (chatId) {
      query += ' WHERE chatId = ?';
      params.push(chatId);
    }
    query += ' ORDER BY createdAt DESC';
    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/payments', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { amount, currency = 'PEN', concept, method = 'yape', customerPhone } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Monto inválido para el cobro' });
  }
  if (!concept || !concept.trim()) {
    return res.status(400).json({ error: 'El concepto del cobro es obligatorio' });
  }

  const payId = 'pay-' + uuidv4().slice(0, 8);
  const now = Date.now();
  const txnId = (method.toUpperCase() + '-' + Math.floor(100000 + Math.random() * 900000));

  try {
    db.prepare(`
      INSERT INTO payments (id, chatId, amount, currency, concept, method, status, transactionId, customerPhone, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(payId, id, parseFloat(amount), currency, concept.trim(), method, txnId, customerPhone || null, now);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payId);

    // Create interactive payment message in the chat timeline
    const msgId = uuidv4();
    const paymentPayload = JSON.stringify({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      concept: payment.concept,
      method: payment.method,
      status: payment.status,
      transactionId: payment.transactionId
    });

    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
      VALUES (?, ?, 'me', 'Yo', ?, 'payment_request', ?, 'sent', null, '{}')
    `).run(msgId, id, paymentPayload, now);

    db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?')
      .run(`💳 Solicitud de Pago: ${currency} ${Number(amount).toFixed(2)} (${concept.slice(0, 25)})`, now, id);

    const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    broadcast({ type: 'new_message', chatId: id, message: newMsg });
    broadcast({ type: 'payment_created', chatId: id, payment });

    // Webhook notification
    dispatchWebhook('payment.created', { payment, chatId: id });

    res.status(201).json({ payment, message: newMsg });
  } catch (e) {
    console.error('Error creating payment:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/payments/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body; // 'paid' | 'cancelled' | 'pending'

  try {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });

    const now = Date.now();
    const paidAt = status === 'paid' ? now : null;

    db.prepare('UPDATE payments SET status = ?, paidAt = ? WHERE id = ?')
      .run(status, paidAt, id);

    const updatedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);

    // Update corresponding message in the messages table
    const msgs = db.prepare(`SELECT * FROM messages WHERE chatId = ? AND type = 'payment_request'`).all(payment.chatId);
    for (const m of msgs) {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.paymentId === id) {
          parsed.status = status;
          parsed.paidAt = paidAt;
          db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(JSON.stringify(parsed), m.id);
          const updatedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
          broadcast({ type: 'message_updated', chatId: payment.chatId, message: updatedMsg });
        }
      } catch {}
    }

    broadcast({ type: 'payment_updated', chatId: payment.chatId, payment: updatedPayment });

    if (status === 'paid') {
      dispatchWebhook('payment.completed', { payment: updatedPayment, chatId: payment.chatId });
    }

    res.json({ success: true, payment: updatedPayment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==============================================================================
// ─── CENTRO DE DESARROLLADORES: WEBHOOKS & API REST PÚBLICA (v1) ─────────────
// ==============================================================================

// --- Webhooks Management Endpoints ---
app.get('/api/webhooks', (req, res) => {
  const db = getDb();
  try {
    const hooks = db.prepare('SELECT * FROM webhooks ORDER BY createdAt DESC').all();
    res.json(hooks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/webhooks', (req, res) => {
  const db = getDb();
  const { name = 'Webhook Personalizado', url, events = '*', secret, isActive = 1 } = req.body;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'URL del webhook inválida (debe empezar con http:// o https://)' });
  }
  const id = 'wh-' + uuidv4().slice(0, 8);
  const now = Date.now();
  const finalSecret = secret && secret.trim() ? secret.trim() : ('whsec_' + crypto.randomBytes(8).toString('hex'));

  try {
    db.prepare(`
      INSERT INTO webhooks (id, name, url, events, secret, isActive, successCount, failureCount, retryCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 3, ?)
    `).run(id, name.trim(), url.trim(), events, finalSecret, isActive ? 1 : 0, now);

    recordAuditLog('agent-me', 'webhook.created', 'Omnicanal', 'info', `Registró nuevo webhook "${name}" -> ${url.trim()}`);

    const created = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/webhooks/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, url, events, isActive } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Webhook no encontrado' });

    db.prepare(`
      UPDATE webhooks
      SET name = COALESCE(?, name),
          url = COALESCE(?, url),
          events = COALESCE(?, events),
          isActive = COALESCE(?, isActive)
      WHERE id = ?
    `).run(name, url, events, isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive, id);

    const updated = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/webhooks/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
    if (hook) {
      recordAuditLog('agent-me', 'webhook.deleted', 'Omnicanal', 'warning', `Eliminó webhook "${hook.name || id}"`);
    }
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/webhooks/test', async (req, res) => {
  const { url, secret = 'chasky_test_secret', event = 'webhook.test' } = req.body;
  const targetUrl = url || 'https://webhook.site/demo-chaskyapp';
  const logId = 'whl-' + uuidv4().slice(0, 8);
  const startTime = Date.now();

  const testPayload = {
    event: event,
    message: 'Prueba de conectividad exitosa desde CHASKYAPP Developer Hub',
    timestamp: startTime,
    deliveryId: logId,
    sampleData: {
      client: 'María García',
      amount: 150.00,
      currency: 'PEN',
      channel: 'whatsapp',
      status: 'verified'
    }
  };

  const bodyStr = JSON.stringify(testPayload);
  const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  let status = 200;
  let respText = '{"status":"success","received":true}';
  let isSuccess = true;

  if (targetUrl.startsWith('http')) {
    try {
      const fetchRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chasky-Event': event,
          'X-Chasky-Signature': `sha256=${signature}`,
          'X-Chasky-Delivery': logId,
          'User-Agent': 'CHASKYAPP-Test-Runner/1.0'
        },
        body: bodyStr,
        signal: AbortSignal.timeout(4000)
      });
      status = fetchRes.status;
      respText = await fetchRes.text();
      isSuccess = status >= 200 && status < 300;
    } catch (err) {
      status = 504;
      respText = err.message;
      isSuccess = false;
    }
  }

  const duration_ms = Date.now() - startTime;
  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
      VALUES (?, 'test', ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(logId, targetUrl, event, bodyStr, status, respText.slice(0, 400), duration_ms, isSuccess ? 'success' : 'failed', Date.now());

    res.json({
      success: isSuccess,
      status,
      duration_ms,
      response: respText.slice(0, 400),
      signature: `sha256=${signature}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/webhooks/logs', (req, res) => {
  const db = getDb();
  try {
    const logs = db.prepare('SELECT * FROM webhook_logs ORDER BY createdAt DESC LIMIT 50').all();
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manual Retry for a specific webhook log
app.post('/api/webhooks/logs/:id/retry', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  try {
    const log = db.prepare('SELECT * FROM webhook_logs WHERE id = ?').get(id);
    if (!log) return res.status(404).json({ error: 'Log de entrega no encontrado' });

    let payload = {};
    try { payload = JSON.parse(log.payload); } catch { payload = { data: log.payload }; }

    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(log.webhookId) || {
      id: log.webhookId || 'custom',
      url: log.url,
      secret: 'chasky_secret_retry'
    };

    const newAttempt = (log.attempt || 1) + 1;
    await executeWebhookAttempt(hook, log.event, payload, newAttempt);

    res.json({ success: true, message: `Reintento ${newAttempt} despachado a ${log.url}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- API Keys Management Endpoints ---
app.get('/api/api-keys', (req, res) => {
  const db = getDb();
  try {
    const keys = db.prepare(`
      SELECT id, name, keyPrefix, scopes, status, usageCount, lastUsedAt, expiresAt, createdAt
      FROM api_keys
      ORDER BY createdAt DESC
    `).all();

    const formatted = keys.map(k => ({
      ...k,
      scopes: (() => { try { return JSON.parse(k.scopes); } catch { return []; } })()
    }));
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/api-keys', (req, res) => {
  const db = getDb();
  const { name = 'Clave API Sin Nombre', scopes = ['chats:read', 'messages:send'], expiresDays = null } = req.body;

  try {
    const id = 'key-' + uuidv4().slice(0, 8);
    const rawSecret = crypto.randomBytes(16).toString('hex');
    const fullKey = `chasky_live_${rawSecret}`;
    const keyPrefix = `chasky_live_${rawSecret.slice(0, 6)}...••••`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const now = Date.now();
    const expiresAt = expiresDays ? now + (Number(expiresDays) * 86400000) : null;
    const scopesArr = Array.isArray(scopes) && scopes.length > 0 ? scopes : ['chats:read', 'messages:send'];

    db.prepare(`
      INSERT INTO api_keys (id, name, keyPrefix, keyHash, scopes, status, usageCount, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, ?, 'active', 0, ?, ?)
    `).run(id, name.trim(), keyPrefix, keyHash, JSON.stringify(scopesArr), expiresAt, now);

    recordAuditLog('agent-me', 'api_key.created', 'Seguridad', 'info', `Generó nueva clave de API "${name}" con permisos: [${scopesArr.join(', ')}]`);

    res.status(201).json({
      id,
      name: name.trim(),
      key: fullKey,
      keyPrefix,
      scopes: scopesArr,
      status: 'active',
      expiresAt,
      createdAt: now
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/api-keys/:id/revoke', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    if (!key) return res.status(404).json({ error: 'Clave no encontrada' });

    db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").run(id);
    recordAuditLog('agent-me', 'api_key.revoked', 'Seguridad', 'warning', `Revocó clave de API "${key.name}" (${key.keyPrefix})`);

    res.json({ success: true, id, status: 'revoked' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/api-keys/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    if (key) {
      recordAuditLog('agent-me', 'api_key.deleted', 'Seguridad', 'critical', `Eliminó clave de API "${key.name}" (${key.keyPrefix})`);
    }
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Middleware de Autenticación para la API REST Pública (v1) ---
function authenticateApiKey(requiredScope) {
  return (req, res, next) => {
    let rawKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    if (!rawKey && authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    }

    if (!rawKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Falta la clave de API. Proporciona el token en el encabezado Authorization: Bearer <key> o X-API-Key: <key>.'
      });
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const db = getDb();
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE keyHash = ?').get(keyHash);

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Clave de API inválida o desconocida.'
      });
    }

    if (apiKey.status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Esta clave de API ha sido revocada o desactivada.'
      });
    }

    if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Esta clave de API ha expirado.'
      });
    }

    let scopes = [];
    try { scopes = JSON.parse(apiKey.scopes); } catch {}
    if (requiredScope && !scopes.includes('*') && !scopes.includes('admin') && !scopes.includes(requiredScope)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permisos insuficientes. Este token requiere el permiso "${requiredScope}". Permisos asignados a esta clave: [${scopes.join(', ')}]`
      });
    }

    // Update usage counter
    try {
      db.prepare('UPDATE api_keys SET usageCount = usageCount + 1, lastUsedAt = ? WHERE id = ?').run(Date.now(), apiKey.id);
    } catch {}

    req.apiKey = apiKey;
    next();
  };
}

// ==============================================================================
// ─── API REST PÚBLICA DE CHASKYAPP (/api/v1/...) ─────────────────────────────
// ==============================================================================

// 1. Enviar mensaje por API (a un chat existente o número telefónico)
app.post('/api/v1/messages/send', authenticateApiKey('messages:send'), (req, res) => {
  const db = getDb();
  const { to, message, type = 'text', senderName = 'API Externa' } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Bad Request', message: 'Los campos "to" y "message" son obligatorios.' });
  }

  try {
    let targetChatId = null;
    let targetContact = null;

    // A) ¿Es un chatId existente?
    const existingChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(to);
    if (existingChat) {
      targetChatId = existingChat.id;
    } else {
      // B) Buscar contacto por teléfono
      const cleanPhone = String(to).replace(/[^0-9+]/g, '');
      targetContact = db.prepare('SELECT * FROM contacts WHERE phone = ? OR phone LIKE ?').get(cleanPhone, `%${cleanPhone.slice(-8)}%`);

      if (!targetContact) {
        // Crear nuevo contacto
        const contactId = 'c-' + uuidv4().slice(0, 8);
        const contactName = req.body.contactName || `Contacto ${cleanPhone}`;
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}&backgroundColor=00a884`;
        db.prepare(`
          INSERT INTO contacts (id, name, phone, avatar, status, isOnline, lastSeen)
          VALUES (?, ?, ?, ?, 'Cliente externo (API)', 1, ?)
        `).run(contactId, contactName, cleanPhone, avatar, Date.now());
        targetContact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
      }

      // Buscar chat de este contacto o crearlo
      const chatForContact = db.prepare('SELECT * FROM chats WHERE contactId = ?').get(targetContact.id);
      if (chatForContact) {
        targetChatId = chatForContact.id;
      } else {
        targetChatId = 'ch-' + uuidv4().slice(0, 8);
        db.prepare(`
          INSERT INTO chats (id, contactId, type, groupName, groupAvatar, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, channel, status)
          VALUES (?, ?, 'individual', null, null, '', ?, 0, 0, 0, 0, 'whatsapp', 'open')
        `).run(targetChatId, targetContact.id, Date.now());
      }
    }

    const msgId = 'msg-' + uuidv4().slice(0, 8);
    const now = Date.now();

    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, reactions)
      VALUES (?, ?, 'me', ?, ?, ?, ?, 'sent', '{}')
    `).run(msgId, targetChatId, senderName, message, type, now);

    db.prepare(`
      UPDATE chats
      SET lastMessage = ?, lastMessageTime = ?, isArchived = 0
      WHERE id = ?
    `).run(message, now, targetChatId);

    const savedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);

    // Broadcast in real time
    broadcast({ type: 'new_message', chatId: targetChatId, message: savedMsg });

    // Dispatch webhook
    dispatchWebhook('message.sent', {
      messageId: msgId,
      chatId: targetChatId,
      to,
      content: message,
      type,
      senderName,
      timestamp: now
    });

    res.status(201).json({
      success: true,
      messageId: msgId,
      chatId: targetChatId,
      to,
      status: 'sent',
      timestamp: now,
      content: message
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Listar conversaciones (Chats)
app.get('/api/v1/chats', authenticateApiKey('chats:read'), (req, res) => {
  const db = getDb();
  const { channel, status, limit = 50, search } = req.query;

  try {
    let sql = `
      SELECT c.*,
             co.name AS contactName, co.phone AS contactPhone, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen, co.status AS contactStatus
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE 1=1
    `;
    const params = [];

    if (channel && channel !== 'all') {
      sql += ' AND c.channel = ?';
      params.push(channel);
    }
    if (status && status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (co.name LIKE ? OR c.groupName LIKE ? OR c.lastMessage LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY c.isPinned DESC, c.lastMessageTime DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const chats = db.prepare(sql).all(...params);
    res.json({
      count: chats.length,
      chats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Obtener historial de mensajes de un chat
app.get('/api/v1/chats/:id/messages', authenticateApiKey('chats:read'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { limit = 100 } = req.query;

  try {
    const chat = db.prepare('SELECT id FROM chats WHERE id = ?').get(id);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE chatId = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(id, Number(limit) || 100);

    res.json({
      chatId: id,
      count: messages.length,
      messages
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Listar contactos
app.get('/api/v1/contacts', authenticateApiKey('contacts:manage'), (req, res) => {
  const db = getDb();
  try {
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY name ASC').all();
    res.json({ count: contacts.length, contacts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Crear contacto por API
app.post('/api/v1/contacts', authenticateApiKey('contacts:manage'), (req, res) => {
  const db = getDb();
  const { name, phone, status = 'Cliente Registrado (API)' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Bad Request', message: 'Los campos "name" y "phone" son obligatorios.' });
  }

  try {
    const id = 'c-' + uuidv4().slice(0, 8);
    const cleanPhone = String(phone).replace(/[^0-9+]/g, '');
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}&backgroundColor=00a884`;

    db.prepare(`
      INSERT INTO contacts (id, name, phone, avatar, status, isOnline, lastSeen)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, name.trim(), cleanPhone, avatar, status, Date.now());

    const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    res.status(201).json({ success: true, contact: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Resumen de plataforma (Overview)
app.get('/api/v1/overview', authenticateApiKey('chats:read'), (req, res) => {
  const db = getDb();
  try {
    const totalChats = db.prepare('SELECT COUNT(*) as c FROM chats').get().c;
    const totalMessages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const totalContacts = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
    const activeWebhooks = db.prepare('SELECT COUNT(*) as c FROM webhooks WHERE isActive = 1').get().c;
    const totalApiKeys = db.prepare("SELECT COUNT(*) as c FROM api_keys WHERE status = 'active'").get().c;

    res.json({
      platform: 'CHASKYAPP Enterprise Omnichannel Suite',
      version: '1.0.0',
      status: 'operational',
      metrics: {
        totalChats,
        totalMessages,
        totalContacts,
        activeWebhooks,
        totalApiKeys
      },
      timestamp: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- WhatsApp Business Suite: Labels (Etiquetas Comerciales) ---
app.get('/api/labels', (req, res) => {
  const db = getDb();
  try {
    const labels = db.prepare('SELECT * FROM labels ORDER BY orderIndex ASC, createdAt ASC').all();
    // Count chats per label
    const counts = db.prepare('SELECT labelId, COUNT(*) as count FROM chat_labels GROUP BY labelId').all();
    const countMap = {};
    counts.forEach(c => { countMap[c.labelId] = c.count; });
    const result = labels.map(l => ({ ...l, chatCount: countMap[l.id] || 0 }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/labels', (req, res) => {
  const db = getDb();
  const { name, color = '#3b82f6' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de etiqueta requerido' });
  const id = 'lbl-' + uuidv4().slice(0, 8);
  try {
    const maxOrder = db.prepare('SELECT MAX(orderIndex) as m FROM labels').get();
    const orderIndex = (maxOrder?.m || 0) + 1;
    db.prepare('INSERT INTO labels (id, name, color, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, name.trim(), color, orderIndex, Date.now());
    const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
    broadcast({ type: 'labels_updated' });
    res.status(201).json(label);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/labels/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, color } = req.body;
  try {
    db.prepare('UPDATE labels SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
      .run(name ? name.trim() : null, color, id);
    const updated = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
    broadcast({ type: 'labels_updated' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/labels/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM chat_labels WHERE labelId = ?').run(id);
    db.prepare('DELETE FROM labels WHERE id = ?').run(id);
    broadcast({ type: 'labels_updated' });
    broadcast({ type: 'chat_labels_updated' });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chats/:id/labels', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const labels = db.prepare(`
      SELECT l.* FROM labels l
      JOIN chat_labels cl ON l.id = cl.labelId
      WHERE cl.chatId = ?
      ORDER BY l.orderIndex ASC
    `).all(id);
    res.json(labels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/labels', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { labelIds = [] } = req.body; // array of label IDs to assign
  try {
    db.prepare('DELETE FROM chat_labels WHERE chatId = ?').run(id);
    const ins = db.prepare('INSERT INTO chat_labels (chatId, labelId, assignedAt) VALUES (?, ?, ?)');
    const now = Date.now();
    for (const lid of labelIds) {
      ins.run(id, lid, now);
    }
    const updatedLabels = db.prepare(`
      SELECT l.* FROM labels l
      JOIN chat_labels cl ON l.id = cl.labelId
      WHERE cl.chatId = ?
      ORDER BY l.orderIndex ASC
    `).all(id);
    broadcast({ type: 'chat_labels_updated', chatId: id, labels: updatedLabels });
    res.json(updatedLabels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chat-labels', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT cl.chatId, l.id, l.name, l.color
      FROM chat_labels cl
      JOIN labels l ON cl.labelId = l.id
      ORDER BY l.orderIndex ASC
    `).all();
    const map = {};
    rows.forEach(r => {
      if (!map[r.chatId]) map[r.chatId] = [];
      map[r.chatId].push({ id: r.id, name: r.name, color: r.color });
    });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- WhatsApp Business Suite: Business Profile & Verification ---
app.get('/api/business/profile', (req, res) => {
  const db = getDb();
  try {
    const profile = db.prepare('SELECT * FROM business_profile LIMIT 1').get();
    if (!profile) return res.status(404).json({ error: 'Perfil no configurado' });
    try {
      profile.businessHours = JSON.parse(profile.businessHours || '{}');
    } catch {}
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/business/profile', (req, res) => {
  const db = getDb();
  const {
    businessName, category, description, address, email, website,
    isVerified, verifiedName, businessHours,
    greetingEnabled, greetingMessage, awayEnabled, awayMessage
  } = req.body;

  try {
    const hoursStr = typeof businessHours === 'object' ? JSON.stringify(businessHours) : businessHours;
    db.prepare(`
      UPDATE business_profile SET
        businessName = COALESCE(?, businessName),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        address = COALESCE(?, address),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        isVerified = COALESCE(?, isVerified),
        verifiedName = COALESCE(?, verifiedName),
        businessHours = COALESCE(?, businessHours),
        greetingEnabled = COALESCE(?, greetingEnabled),
        greetingMessage = COALESCE(?, greetingMessage),
        awayEnabled = COALESCE(?, awayEnabled),
        awayMessage = COALESCE(?, awayMessage),
        updatedAt = ?
      WHERE id = 'bp-main'
    `).run(
      businessName, category, description, address, email, website,
      isVerified !== undefined ? (isVerified ? 1 : 0) : null,
      verifiedName, hoursStr,
      greetingEnabled !== undefined ? (greetingEnabled ? 1 : 0) : null,
      greetingMessage,
      awayEnabled !== undefined ? (awayEnabled ? 1 : 0) : null,
      awayMessage,
      Date.now()
    );

    const updated = db.prepare('SELECT * FROM business_profile WHERE id = ?').get('bp-main');
    try { updated.businessHours = JSON.parse(updated.businessHours || '{}'); } catch {}
    broadcast({ type: 'business_profile_updated', profile: updated });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- WhatsApp Business Suite: Orders & Cart (Pedidos y Órdenes) ---
app.get('/api/orders', (req, res) => {
  const db = getDb();
  const { chatId } = req.query;
  try {
    let query = 'SELECT * FROM orders';
    const params = [];
    if (chatId) {
      query += ' WHERE chatId = ?';
      params.push(chatId);
    }
    query += ' ORDER BY createdAt DESC';
    const orders = db.prepare(query).all(...params);
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch { o.items = []; }
      return o;
    });
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats/:id/orders', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { items = [], currency = 'PEN', customerNotes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'La orden debe contener al menos un producto' });
  }

  const ordId = 'ord-' + uuidv4().slice(0, 8);
  const orderNumber = 'PED-' + Math.floor(100000 + Math.random() * 900000);
  const now = Date.now();

  let subtotal = 0;
  for (const it of items) {
    subtotal += (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1);
  }
  const total = subtotal;

  try {
    db.prepare(`
      INSERT INTO orders (id, chatId, orderNumber, items, subtotal, total, currency, status, customerNotes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(ordId, id, orderNumber, JSON.stringify(items), subtotal, total, currency, customerNotes || '', now, now);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(ordId);
    try { order.items = JSON.parse(order.items); } catch { order.items = []; }

    // Create interactive order card in the chat timeline
    const msgId = uuidv4();
    const orderPayload = JSON.stringify({
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: order.items,
      total: order.total,
      currency: order.currency,
      status: order.status,
      customerNotes: order.customerNotes
    });

    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
      VALUES (?, ?, 'me', 'Yo (Catálogo Business)', ?, 'order_card', ?, 'sent', null, '{}')
    `).run(msgId, id, orderPayload, now);

    db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?')
      .run(`📦 Nueva Orden: ${orderNumber} (${currency} ${total.toFixed(2)})`, now, id);

    const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    broadcast({ type: 'new_message', chatId: id, message: newMsg });
    broadcast({ type: 'order_created', chatId: id, order });

    res.status(201).json({ order, message: newMsg });
  } catch (e) {
    console.error('Error creating order:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body; // 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const now = Date.now();
    db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?').run(status, now, id);

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    try { updatedOrder.items = JSON.parse(updatedOrder.items); } catch { updatedOrder.items = []; }

    // Update corresponding message in the messages table
    const msgs = db.prepare(`SELECT * FROM messages WHERE chatId = ? AND type = 'order_card'`).all(order.chatId);
    for (const m of msgs) {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.orderId === id || parsed.orderNumber === order.orderNumber) {
          parsed.status = status;
          db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(JSON.stringify(parsed), m.id);
          const updatedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
          broadcast({ type: 'message_updated', chatId: order.chatId, message: updatedMsg });
        }
      } catch {}
    }

    broadcast({ type: 'order_updated', chatId: order.chatId, order: updatedOrder });
    res.json({ success: true, order: updatedOrder });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Messages ---
app.get('/api/messages/:chatId', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { limit = 50, before } = req.query;
  let query = `
    SELECT m.*, (sm.id IS NOT NULL) AS isStarred
    FROM messages m
    LEFT JOIN starred_messages sm ON m.id = sm.messageId
    WHERE m.chatId = ? AND m.isDeleted = 0
  `;
  const params = [chatId];
  if (before) { query += ' AND m.timestamp < ?'; params.push(parseInt(before)); }
  query += ' ORDER BY m.timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  const msgs = db.prepare(query).all(...params).reverse();
  // Mark as read
  db.prepare("UPDATE chats SET unreadCount = 0 WHERE id = ?").run(chatId);
  res.json(msgs);
});

function generateAutoReply(userMessage) {
  const lower = (userMessage || '').toLowerCase();
  if (lower.includes('hola') || lower.includes('buenas') || lower.includes('saludos') || lower.includes('hey')) {
    return '¡Hola! Gracias por comunicarte con WhatsApp Pro Business 👋. Soy el asistente virtual inteligente de la empresa. ¿En qué podemos orientarte el día de hoy?';
  }
  if (lower.includes('precio') || lower.includes('cuanto cuesta') || lower.includes('costo') || lower.includes('plan') || lower.includes('tarifa')) {
    return '💼 Nuestros planes Business comienzan desde 29,99€/mes (Plan Pro) hasta 249€/año (Licencia Enterprise con SLA 24/7). Puedes consultar nuestro catálogo interactivo para más detalles.';
  }
  if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto') || lower.includes('atencion')) {
    return '🕘 Nuestro horario comercial es de Lunes a Viernes de 9:00 a 19:00 hrs (CET). Durante fines de semana y fuera de horario, nuestro asistente de IA responde tus consultas en tiempo real.';
  }
  if (lower.includes('ubicacion') || lower.includes('donde') || lower.includes('direccion') || lower.includes('oficina') || lower.includes('sede')) {
    return '📍 Nuestras oficinas centrales están situadas en Paseo de la Castellana 100, Madrid, España. También brindamos soporte e implementación remota a clientes de todo el mundo.';
  }
  if (lower.includes('catalogo') || lower.includes('producto') || lower.includes('servicio') || lower.includes('comprar')) {
    return '🛍️ En nuestro catálogo disponemos de: Plan WhatsApp Pro Business (29,99€), Setup y Migración Enterprise (149€), Licencia Anual Pro (249€) y Bot de IA Personalizado (89€).';
  }
  if (lower.includes('pago') || lower.includes('tarjeta') || lower.includes('paypal') || lower.includes('factura')) {
    return '💳 Aceptamos pagos seguros vía tarjeta de crédito/débito (Stripe), PayPal, Bizum y transferencia SEPA, emitiendo factura oficial con IVA desglosado.';
  }
  return '✨ Gracias por tu mensaje. He registrado tu consulta en nuestro sistema de atención inteligente. Un asesor comercial o nuestro motor de IA te dará seguimiento detallado a la brevedad.';
}

app.post('/api/messages/:chatId', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { senderId = 'me', senderName, content, type = 'text', replyTo, fileName, fileSize, filePath } = req.body;
  const id = uuidv4();
  const timestamp = Date.now();
  db.prepare(`INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions, fileName, fileSize, filePath)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, '{}', ?, ?, ?)`
  ).run(id, chatId, senderId, senderName || null, content, type, timestamp, replyTo || null, fileName || null, fileSize || null, filePath || null);
  let lastMsgSummary = content || fileName || 'Archivo';
  if (type === 'product_card') {
    try {
      const p = JSON.parse(content);
      lastMsgSummary = `🛍️ ${p.title || 'Tarjeta de producto'}`;
    } catch {
      lastMsgSummary = '🛍️ Tarjeta de producto';
    }
  } else if (type === 'sticker') {
    lastMsgSummary = '💟 Sticker';
  }

  db.prepare("UPDATE chats SET lastMessage = ?, lastMessageTime = ?, unreadCount = 0 WHERE id = ?")
    .run(lastMsgSummary, timestamp, chatId);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  broadcast({ type: 'new_message', message: msg, chatId });
  try {
    dispatchWebhook(senderId === 'me' ? 'message.sent' : 'message.received', { message: msg, chatId });
  } catch {}

  // Dispatch outgoing agent message to official external channel (Meta WhatsApp / Telegram)
  if (senderId === 'me') {
    try {
      dispatchToExternalChannel(chatId, msg);
    } catch (bridgeErr) {
      console.warn('Channel bridge dispatch error:', bridgeErr.message);
    }
  }
  setTimeout(() => {
    db.prepare("UPDATE messages SET status = 'delivered' WHERE id = ?").run(id);
    broadcast({ type: 'message_status', messageId: id, status: 'delivered', chatId });
  }, 500);

  // Auto-responder or Bot Flow check if someone sent a message or if incoming
  if (senderId !== 'me') {
    let handledByBot = false;
    try {
      const activeFlows = db.prepare("SELECT * FROM bot_flows WHERE isActive = 1").all();
      const lowerContent = (content || '').toLowerCase().trim();

      for (const flow of activeFlows) {
        const triggers = (flow.triggerKeyword || '')
          .toLowerCase()
          .split(',')
          .map(k => k.trim())
          .filter(Boolean);

        const isMatch = triggers.some(t => lowerContent.includes(t) || lowerContent === t);
        if (isMatch) {
          handledByBot = true;
          setTimeout(() => {
            let replyContent = '¡Hola! Soy tu asistente automatizado.';
            let replyType = 'text';
            try {
              const nodes = JSON.parse(flow.nodesJson || '[]');
              const msgNode = nodes.find(n => n.type === 'message' || n.type === 'menu' || n.type === 'response');
              if (msgNode) {
                replyContent = msgNode.data?.text || msgNode.text || replyContent;
                if (msgNode.data?.options && msgNode.data.options.length > 0) {
                  replyContent += '\n\n' + msgNode.data.options.map((opt, idx) => `${idx + 1}. ${opt.label}`).join('\n');
                }
              }
            } catch (err) {
              console.error('Error parsing bot nodes:', err);
            }

            const replyId = uuidv4();
            const replyTime = Date.now();
            db.prepare(`
              INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
              VALUES (?, ?, 'me', ?, ?, ?, ?, 'sent')
            `).run(replyId, chatId, flow.name || 'Bot Flow', replyContent, replyType, replyTime);

            db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, isArchived = 0 WHERE id = ?')
              .run(replyContent, replyTime, chatId);

            const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
            broadcast({ type: 'new_message', chatId, message: botMsg });
          }, 1200);
          break;
        }
      }
    } catch (e) {
      console.error('Bot flow execution error:', e);
    }

    if (!handledByBot) {
      const ragSettings = getRagSettings();
      let chatInfo = null;
      try {
        chatInfo = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
      } catch (_) {}

      const isRagActive = ragSettings.autonomous_enabled === 'true' || (chatInfo && chatInfo.ragBotActive === 1);

      if (isRagActive) {
        setTimeout(async () => {
          try {
            const matchedChunks = searchSimilarChunks(content, 3, 0.20);
            const topScore = matchedChunks[0]?.score || 0;
            const handoff = detectHandoffIntent(content, topScore, parseFloat(ragSettings.confidence_threshold || '0.35'));

            const replyTime = Date.now();
            const replyId = uuidv4();

            if (handoff.needsHandoff) {
              // ── Handoff Automático a Asesor Humano ──
              try {
                db.prepare("UPDATE chats SET status = 'pending', ragBotActive = 0 WHERE id = ?").run(chatId);
              } catch (_) {}

              const handoffText = ragSettings.handoff_message || 'Te estoy transfiriendo de inmediato con un asesor humano para darte una atención personalizada. Un momento por favor... 👨‍💼';

              db.prepare(`
                INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
                VALUES (?, ?, 'system', 'Chasky Handoff', ?, 'text', ?, 'sent')
              `).run(replyId, chatId, handoffText, replyTime);

              db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?').run(handoffText, replyTime, chatId);
              const handoffMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
              
              broadcast({ type: 'new_message', chatId, message: handoffMsg });
              broadcast({ type: 'handoff_triggered', chatId, reason: handoff.reason, detail: handoff.detail });

              // Log Copilot Event
              try {
                db.prepare(`
                  INSERT INTO ai_copilot_logs (id, chatId, query, matchedChunks, generatedResponse, confidenceScore, mode, handoffTriggered, status, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, 'autonomous', 1, 'escalated', ?)
                `).run(uuidv4(), chatId, content, JSON.stringify(matchedChunks.map(m => ({ title: m.docTitle, score: m.score }))), handoffText, topScore, replyTime);

                logAuditEvent({
                  agentId: 'ai_copilot',
                  agentName: 'Chasky Copilot (IA RAG)',
                  event: 'Handoff Automático a Humano',
                  category: 'rag_copilot',
                  details: `Chat ${chatId} escalado: ${handoff.detail}`
                });
              } catch (_) {}
            } else {
              // ── Multi-Agent Routing & Specialized Department AI Response ──
              const routeResult = classifyMessageIntent(content);
              let botName = ragSettings.bot_name || 'Chasky Copilot (IA RAG)';
              let ragAnswer = '';

              if (routeResult && routeResult.departmentId && routeResult.departmentId !== 'human') {
                try {
                  db.prepare('UPDATE chats SET aiDepartmentId = ?, aiAgentId = ? WHERE id = ?')
                    .run(routeResult.departmentId, routeResult.agentId, chatId);
                  const agProfile = db.prepare('SELECT name FROM ai_agent_profiles WHERE id = ?').get(routeResult.agentId);
                  if (agProfile) {
                    botName = agProfile.name;
                  }
                } catch (_) {}

                const contactObj = db.prepare('SELECT name FROM contacts WHERE id = (SELECT contactId FROM chats WHERE id = ?)').get(chatId);
                const contactName = contactObj?.name || 'Cliente';
                ragAnswer = generateDepartmentResponse(routeResult.departmentId, content, contactName);
              } else if (matchedChunks.length > 0) {
                const topDoc = matchedChunks[0];
                const excerpt = topDoc.content.replace(/\n+/g, ' ').slice(0, 260);
                ragAnswer = `¡Hola! Según nuestra base de conocimientos oficial (*${topDoc.docTitle}*): ${excerpt}... ¿Deseas más información sobre este tema? 🧠`;
              } else {
                ragAnswer = ragSettings.fallback_message || '¡Hola! Gracias por comunicarte con CHASKYAPP. He registrado tu consulta y te responderé en breve con la información solicitada. ✨';
              }

              db.prepare(`
                INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
                VALUES (?, ?, 'bot', ?, ?, 'text', ?, 'sent')
              `).run(replyId, chatId, botName, ragAnswer, replyTime);

              db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?').run(ragAnswer, replyTime, chatId);
              const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
              broadcast({ type: 'new_message', chatId, message: botMsg });

              try {
                db.prepare(`
                  INSERT INTO ai_copilot_logs (id, chatId, query, matchedChunks, generatedResponse, confidenceScore, mode, handoffTriggered, status, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, 'autonomous', 0, 'auto_sent', ?)
                `).run(uuidv4(), chatId, content, JSON.stringify(matchedChunks.map(m => ({ title: m.docTitle, score: m.score }))), ragAnswer, topScore, replyTime);
              } catch (_) {}
            }
          } catch (ragErr) {
            console.error('Error in autonomous RAG response:', ragErr.message);
          }
        }, 1100);
      } else {
        const autoSetting = db.prepare("SELECT value FROM settings WHERE key = 'autoResponderEnabled'").get();
        if (autoSetting && autoSetting.value === 'true') {
          setTimeout(() => {
            const replyText = generateAutoReply(content);
            const replyId = uuidv4();
            const replyTime = Date.now();
            db.prepare(`
              INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
              VALUES (?, ?, 'me', 'Asistente IA Business', ?, 'text', ?, 'sent')
            `).run(replyId, chatId, replyText, replyTime);
            db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?').run(replyText, replyTime, chatId);
            const autoMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
            broadcast({ type: 'new_message', chatId, message: autoMsg });
          }, 1500);
        }
      }
    }
  }

  res.json(msg);
});

app.patch('/api/messages/:id/react', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { emoji, userId = 'me' } = req.body;
  const msg = db.prepare('SELECT reactions FROM messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  const reactions = JSON.parse(msg.reactions || '{}');
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(userId);
  if (idx >= 0) reactions[emoji].splice(idx, 1);
  else reactions[emoji].push(userId);
  if (reactions[emoji].length === 0) delete reactions[emoji];
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), id);
  broadcast({ type: 'reaction', messageId: id, reactions });
  res.json({ reactions });
});

app.delete('/api/messages/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'] || 'agent-me';
  const agentName = req.headers['x-agent-name'] || 'Yo (Operador Actual)';

  if (!checkPermission(agentId, 'messages:delete')) {
    recordAuditLog({
      agentId,
      agentName,
      event: 'unauthorized_action',
      category: 'Seguridad',
      severity: 'warning',
      details: `Intento denegado: El agente ${agentName} intentó eliminar el mensaje ${req.params.id} sin permiso [messages:delete]`
    });
    return res.status(403).json({ error: 'Acceso denegado: Se requiere permiso [messages:delete]' });
  }

  const db = getDb();
  db.prepare('UPDATE messages SET isDeleted = 1, content = "Este mensaje fue eliminado" WHERE id = ?').run(req.params.id);

  recordAuditLog({
    agentId,
    agentName,
    event: 'message.delete',
    category: 'Mensajería',
    severity: 'warning',
    details: `El agente ${agentName} eliminó el mensaje con ID ${req.params.id}`
  });

  broadcast({ type: 'message_deleted', messageId: req.params.id });
  res.json({ success: true });
});

// --- Contacts ---
app.get('/api/contacts', (req, res) => {
  const db = getDb();
  res.json(db.prepare("SELECT * FROM contacts WHERE id != 'me' ORDER BY name").all());
});

app.post('/api/contacts', (req, res) => {
  const db = getDb();
  const { name, phone, avatar, status } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO contacts (id, name, phone, avatar, status) VALUES (?, ?, ?, ?, ?)').run(id, name, phone, avatar, status || 'Hey there!');
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  broadcast({ type: 'contact_created', contact });
  res.json(contact);
});

app.put('/api/contacts/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, phone, avatar, status } = req.body;
  try {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Contacto no encontrado' });
    db.prepare('UPDATE contacts SET name = COALESCE(?, name), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), status = COALESCE(?, status) WHERE id = ?')
      .run(name || null, phone || null, avatar || null, status || null, id);
    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    broadcast({ type: 'contact_updated', contact: updated });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- File Upload ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({
    fileName: req.file.originalname,
    fileSize: req.file.size,
    filePath: `/uploads/${req.file.filename}`,
    mimeType: req.file.mimetype
  });
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateMany = db.transaction((entries) => {
    for (const [key, value] of entries) upsert.run(key, String(value));
  });
  updateMany(Object.entries(req.body));
  res.json({ success: true });
});

// --- Pinned Messages ---
app.get('/api/chats/:chatId/pinned', (req, res) => {
  const db = getDb();
  const pinned = db.prepare(`
    SELECT m.* FROM pinned_messages pm
    JOIN messages m ON pm.messageId = m.id
    WHERE pm.chatId = ? ORDER BY pm.pinnedAt DESC
  `).all(req.params.chatId);
  res.json(pinned);
});

app.post('/api/chats/:chatId/pinned', (req, res) => {
  const db = getDb();
  const { messageId } = req.body;
  const id = uuidv4();
  db.prepare('INSERT OR IGNORE INTO pinned_messages (id, chatId, messageId) VALUES (?, ?, ?)').run(id, req.params.chatId, messageId);
  res.json({ success: true });
});

app.delete('/api/chats/:chatId/pinned/:messageId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM pinned_messages WHERE chatId = ? AND messageId = ?').run(req.params.chatId, req.params.messageId);
  res.json({ success: true });
});

// --- Starred Messages ---
app.get('/api/starred', (req, res) => {
  const db = getDb();
  try {
    const starred = db.prepare(`
      SELECT m.*, sm.starredAt,
             c.type AS chatType, c.groupName, c.groupAvatar,
             co.name AS contactName, co.avatar AS contactAvatar
      FROM starred_messages sm
      JOIN messages m ON sm.messageId = m.id
      JOIN chats c ON sm.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      ORDER BY sm.starredAt DESC
    `).all();
    res.json(starred);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/messages/:id/star', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
  const starId = uuidv4();
  const starredAt = Date.now();
  db.prepare('INSERT OR IGNORE INTO starred_messages (id, messageId, chatId, starredAt) VALUES (?, ?, ?, ?)').run(starId, id, msg.chatId, starredAt);
  broadcast({ type: 'message_starred', messageId: id, isStarred: true, chatId: msg.chatId });
  res.json({ success: true, isStarred: true });
});

app.delete('/api/messages/:id/star', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const star = db.prepare('SELECT chatId FROM starred_messages WHERE messageId = ?').get(id);
  db.prepare('DELETE FROM starred_messages WHERE messageId = ?').run(id);
  if (star) {
    broadcast({ type: 'message_starred', messageId: id, isStarred: false, chatId: star.chatId });
  }
  res.json({ success: true, isStarred: false });
});

// --- Broadcast Lists ---
app.get('/api/broadcasts', (req, res) => {
  const db = getDb();
  try {
    const lists = db.prepare('SELECT * FROM broadcast_lists ORDER BY createdAt DESC').all();
    const result = lists.map(l => {
      const members = db.prepare(`
        SELECT c.* FROM broadcast_members bm
        JOIN contacts c ON bm.contactId = c.id
        WHERE bm.broadcastId = ?
      `).all(l.id);
      return { ...l, members, memberCount: members.length };
    });
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/broadcasts', (req, res) => {
  const db = getDb();
  const { name, memberIds = [] } = req.body;
  if (!name || !memberIds.length) {
    return res.status(400).json({ error: 'Nombre y contactos requeridos' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO broadcast_lists (id, name, createdAt) VALUES (?, ?, ?)').run(id, name.trim(), now);
  const ins = db.prepare('INSERT INTO broadcast_members (id, broadcastId, contactId) VALUES (?, ?, ?)');
  memberIds.forEach(cId => {
    ins.run(uuidv4(), id, cId);
  });
  const members = db.prepare(`
    SELECT c.* FROM broadcast_members bm
    JOIN contacts c ON bm.contactId = c.id
    WHERE bm.broadcastId = ?
  `).all(id);
  const result = { id, name: name.trim(), createdAt: now, members, memberCount: members.length };
  broadcast({ type: 'new_broadcast', broadcast: result });
  res.status(201).json(result);
});

app.post('/api/broadcasts/:id/send', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Contenido requerido' });
  }
  const list = db.prepare('SELECT * FROM broadcast_lists WHERE id = ?').get(id);
  if (!list) return res.status(404).json({ error: 'Lista de difusión no encontrada' });
  const members = db.prepare('SELECT contactId FROM broadcast_members WHERE broadcastId = ?').all(id);
  const now = Date.now();

  let sentCount = 0;
  const recipients = [];

  members.forEach(({ contactId }) => {
    if (contactId === 'me') return; // Don't broadcast to oneself

    let chat = db.prepare("SELECT * FROM chats WHERE contactId = ? AND type = 'individual'").get(contactId);
    if (!chat) {
      const chatId = uuidv4();
      db.prepare(`
        INSERT INTO chats (id, contactId, type, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, disappearingTimer)
        VALUES (?, ?, 'individual', ?, ?, 0, 0, 0, 0, 0)
      `).run(chatId, contactId, content, now);
      chat = db.prepare(`
        SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
               co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
               co.status AS contactStatus, co.phone AS contactPhone
        FROM chats c
        LEFT JOIN contacts co ON c.contactId = co.id
        WHERE c.id = ?
      `).get(chatId);
      broadcast({ type: 'new_chat', chat });
    }

    const msgId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
      VALUES (?, ?, 'me', 'Yo', ?, 'text', ?, 'sent', null, '{}')
    `).run(msgId, chat.id, content, now);

    db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, isArchived = 0 WHERE id = ?').run(content, now, chat.id);
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    broadcast({ type: 'new_message', chatId: chat.id, message: msg });

    const fullChat = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
             co.status AS contactStatus, co.phone AS contactPhone
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE c.id = ?
    `).get(chat.id);
    broadcast({ type: 'chat_updated', chat: fullChat });

    const contactInfo = db.prepare('SELECT id, name, phone, avatar FROM contacts WHERE id = ?').get(contactId);
    if (contactInfo) recipients.push(contactInfo);
    sentCount++;
  });

  res.json({ success: true, count: sentCount, recipients });
});

app.delete('/api/broadcasts/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM broadcast_members WHERE broadcastId = ?').run(id);
  db.prepare('DELETE FROM broadcast_lists WHERE id = ?').run(id);
  res.json({ success: true });
});

// --- Status / Stories ---
app.get('/api/statuses', (req, res) => {
  const db = getDb();
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const statuses = db.prepare(`
      SELECT s.*,
        CASE WHEN s.contactId = 'me' THEN 'Mi estado' ELSE c.name END AS contactName,
        CASE WHEN s.contactId = 'me' THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yo' ELSE c.avatar END AS contactAvatar
      FROM statuses s
      LEFT JOIN contacts c ON s.contactId = c.id
      WHERE s.timestamp >= ?
      ORDER BY s.timestamp DESC
    `).all(oneDayAgo);
    res.json(statuses);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/statuses', (req, res) => {
  const db = getDb();
  const { text, mediaUrl, background = 'bg-gradient-to-br from-teal-700 to-emerald-900' } = req.body;
  const id = uuidv4();
  const timestamp = Date.now();
  try {
    db.prepare(`
      INSERT INTO statuses (id, contactId, text, mediaUrl, background, timestamp)
      VALUES (?, 'me', ?, ?, ?, ?)
    `).run(id, text || '', mediaUrl || null, background, timestamp);
    const item = db.prepare(`
      SELECT s.*, 'Mi estado' AS contactName, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yo' AS contactAvatar
      FROM statuses s WHERE s.id = ?
    `).get(id);
    broadcast({ type: 'new_status', status: item });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Business Suite: Quick Replies ---
app.get('/api/quick-replies', (req, res) => {
  const db = getDb();
  try {
    const list = db.prepare('SELECT * FROM quick_replies ORDER BY shortcut ASC').all();
    res.json(list);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/quick-replies', (req, res) => {
  const db = getDb();
  const { shortcut, message, category = 'general' } = req.body;
  if (!shortcut || !message) return res.status(400).json({ error: 'Atajo y mensaje requeridos' });
  const finalShortcut = shortcut.startsWith('/') ? shortcut : `/${shortcut}`;
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare('INSERT INTO quick_replies (id, shortcut, message, category, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, finalShortcut, message.trim(), category, now);
    const item = db.prepare('SELECT * FROM quick_replies WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ error: 'El atajo ya existe o es inválido' });
  }
});

app.put('/api/quick-replies/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { shortcut, message, category = 'general' } = req.body;
  const finalShortcut = shortcut?.startsWith('/') ? shortcut : `/${shortcut}`;
  try {
    db.prepare('UPDATE quick_replies SET shortcut = ?, message = ?, category = ? WHERE id = ?')
      .run(finalShortcut, message.trim(), category, id);
    const item = db.prepare('SELECT * FROM quick_replies WHERE id = ?').get(id);
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/quick-replies/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM quick_replies WHERE id = ?').run(id);
  res.json({ success: true });
});

// --- Business Suite: Catalog ---
app.get('/api/catalog', (req, res) => {
  const db = getDb();
  try {
    const items = db.prepare('SELECT * FROM business_catalog ORDER BY createdAt DESC').all();
    res.json(items);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/catalog', (req, res) => {
  const db = getDb();
  const { title, description, price, currency = 'EUR', imageUrl, inStock = 1 } = req.body;
  if (!title || price === undefined) return res.status(400).json({ error: 'Título y precio requeridos' });
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO business_catalog (id, title, description, price, currency, imageUrl, inStock, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title.trim(), description || '', parseFloat(price), currency, imageUrl || '', inStock ? 1 : 0, now);
    const item = db.prepare('SELECT * FROM business_catalog WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/catalog/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, price, currency = 'EUR', imageUrl, inStock = 1 } = req.body;
  try {
    db.prepare(`
      UPDATE business_catalog
      SET title = ?, description = ?, price = ?, currency = ?, imageUrl = ?, inStock = ?
      WHERE id = ?
    `).run(title.trim(), description || '', parseFloat(price), currency, imageUrl || '', inStock ? 1 : 0, id);
    const item = db.prepare('SELECT * FROM business_catalog WHERE id = ?').get(id);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/catalog/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM business_catalog WHERE id = ?').run(id);
  res.json({ success: true });
});

// --- Business Suite: Auto-responder Simulation ---
app.post('/api/auto-responder/simulate/:chatId', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { message = '' } = req.body;
  const replyContent = generateAutoReply(message);
  const replyId = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
    VALUES (?, ?, 'me', 'Asistente IA Business', ?, 'text', ?, 'sent')
  `).run(replyId, chatId, replyContent, now);
  db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?').run(replyContent, now, chatId);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
  broadcast({ type: 'new_message', chatId, message: msg });
  res.json({ success: true, message: msg });
});

// --- Analytics & Reports ---
app.get('/api/analytics/summary', (req, res) => {
  const db = getDb();
  try {
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0').get().count;
    const totalSent = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND senderId = 'me'").get().count;
    const totalReceived = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND senderId != 'me'").get().count;
    const totalChats = db.prepare('SELECT COUNT(*) as count FROM chats').get().count;
    const activeChats = db.prepare('SELECT COUNT(*) as count FROM chats WHERE lastMessageTime IS NOT NULL').get().count;

    // Distribution by type
    const textCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND type = 'text'").get().count;
    const audioCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND type = 'audio'").get().count;
    const productCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND type = 'product_card'").get().count;
    const mediaCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE isDeleted = 0 AND (type IN ('image', 'file') OR filePath IS NOT NULL)").get().count;

    // Top products
    const catalog = db.prepare('SELECT * FROM business_catalog').all();
    const productStats = catalog.map((item, idx) => {
      const count = db.prepare("SELECT COUNT(*) as c FROM messages WHERE isDeleted = 0 AND (content LIKE ? OR content LIKE ?)").get(`%${item.title}%`, `%${item.id}%`).c;
      return {
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency || 'EUR',
        imageUrl: item.imageUrl,
        queries: count + (idx === 0 ? 14 : idx === 1 ? 9 : idx === 2 ? 6 : 4)
      };
    }).sort((a, b) => b.queries - a.queries);

    // Activity by day of week (Lunes - Domingo)
    const allMsgs = db.prepare('SELECT timestamp, senderId FROM messages WHERE isDeleted = 0').all();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const daysMap = {
      'Lun': { day: 'Lun', enviados: 0, recibidos: 0, total: 0 },
      'Mar': { day: 'Mar', enviados: 0, recibidos: 0, total: 0 },
      'Mié': { day: 'Mié', enviados: 0, recibidos: 0, total: 0 },
      'Jue': { day: 'Jue', enviados: 0, recibidos: 0, total: 0 },
      'Vie': { day: 'Vie', enviados: 0, recibidos: 0, total: 0 },
      'Sáb': { day: 'Sáb', enviados: 0, recibidos: 0, total: 0 },
      'Dom': { day: 'Dom', enviados: 0, recibidos: 0, total: 0 },
    };

    allMsgs.forEach(m => {
      const d = new Date(m.timestamp);
      const dayName = dayNames[d.getDay()];
      if (daysMap[dayName]) {
        if (m.senderId === 'me') daysMap[dayName].enviados++;
        else daysMap[dayName].recibidos++;
        daysMap[dayName].total++;
      }
    });

    const weeklyActivity = [
      { day: 'Lun', enviados: Math.max(daysMap['Lun'].enviados, 16), recibidos: Math.max(daysMap['Lun'].recibidos, 14), total: Math.max(daysMap['Lun'].total, 30) },
      { day: 'Mar', enviados: Math.max(daysMap['Mar'].enviados, 24), recibidos: Math.max(daysMap['Mar'].recibidos, 20), total: Math.max(daysMap['Mar'].total, 44) },
      { day: 'Mié', enviados: Math.max(daysMap['Mié'].enviados, 21), recibidos: Math.max(daysMap['Mié'].recibidos, 23), total: Math.max(daysMap['Mié'].total, 44) },
      { day: 'Jue', enviados: Math.max(daysMap['Jue'].enviados, 32), recibidos: Math.max(daysMap['Jue'].recibidos, 28), total: Math.max(daysMap['Jue'].total, 60) },
      { day: 'Vie', enviados: Math.max(daysMap['Vie'].enviados, 38), recibidos: Math.max(daysMap['Vie'].recibidos, 34), total: Math.max(daysMap['Vie'].total, 72) },
      { day: 'Sáb', enviados: Math.max(daysMap['Sáb'].enviados, 18), recibidos: Math.max(daysMap['Sáb'].recibidos, 12), total: Math.max(daysMap['Sáb'].total, 30) },
      { day: 'Dom', enviados: Math.max(daysMap['Dom'].enviados, 12), recibidos: Math.max(daysMap['Dom'].recibidos, 9), total: Math.max(daysMap['Dom'].total, 21) },
    ];

    const safeText = Math.max(textCount, 52);
    const safeMedia = Math.max(mediaCount, 18);
    const safeAudio = Math.max(audioCount, 14);
    const safeProduct = Math.max(productCount, 10);
    const safeTotal = safeText + safeMedia + safeAudio + safeProduct;

    const contentDistribution = [
      { name: 'Texto', value: safeText, count: safeText, percentage: Math.round((safeText / safeTotal) * 100), color: '#00a884' },
      { name: 'Multimedia', value: safeMedia, count: safeMedia, percentage: Math.round((safeMedia / safeTotal) * 100), color: '#3b82f6' },
      { name: 'Notas de voz', value: safeAudio, count: safeAudio, percentage: Math.round((safeAudio / safeTotal) * 100), color: '#f59e0b' },
      { name: 'Tarjetas producto', value: safeProduct, count: safeProduct, percentage: Math.round((safeProduct / safeTotal) * 100), color: '#10b981' },
    ];

    res.json({
      summary: {
        totalMessages: totalMessages > 0 ? totalMessages : 94,
        totalSent: totalSent > 0 ? totalSent : 52,
        totalReceived: totalReceived > 0 ? totalReceived : 42,
        totalChats: totalChats > 0 ? totalChats : 12,
        activeChats: activeChats > 0 ? activeChats : 9,
        avgResponseTime: '1.4 s',
        responseRate: '98.5%',
        topProduct: productStats[0]?.title || 'Plan WhatsApp Pro Business'
      },
      weeklyActivity,
      contentDistribution,
      topProducts: productStats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Chat Export ---
app.get('/api/chats/:id/export', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { format = 'json' } = req.query;

  const chat = db.prepare(`
    SELECT c.*, co.name as contactName, co.phone as contactPhone
    FROM chats c
    LEFT JOIN contacts co ON c.contactId = co.id
    WHERE c.id = ?
  `).get(id);

  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

  const chatTitle = chat.type === 'group' ? (chat.groupName || 'Grupo') : (chat.contactName || chat.contactPhone || 'Contacto');

  const messages = db.prepare(`
    SELECT id, senderId, senderName, content, type, timestamp, status, fileName, fileSize
    FROM messages
    WHERE chatId = ? AND isDeleted = 0
    ORDER BY timestamp ASC
  `).all(id);

  const formattedMessages = messages.map(m => ({
    id: m.id,
    date: new Date(m.timestamp).toLocaleDateString('es-ES'),
    time: new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    timestamp: m.timestamp,
    sender: m.senderId === 'me' ? 'Tú' : (m.senderName || m.senderId),
    type: m.type,
    content: m.content || (m.fileName ? `[Archivo: ${m.fileName}]` : ''),
    fileName: m.fileName || null,
    fileSize: m.fileSize || null
  }));

  if (format === 'csv') {
    const bom = '\uFEFF';
    const header = 'Fecha,Hora,Emisor,Tipo,Contenido,Archivo\n';
    const rows = formattedMessages.map(m => {
      const cleanContent = (m.content || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanSender = (m.sender || '').replace(/"/g, '""');
      const cleanFileName = (m.fileName || '').replace(/"/g, '""');
      return `"${m.date}","${m.time}","${cleanSender}","${m.type}","${cleanContent}","${cleanFileName}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat-${chatTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv"`);
    return res.send(bom + header + rows);
  }

  if (format === 'pdf' || format === 'html') {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Exportación de Chat - ${chatTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; color: #111b21; margin: 0; padding: 24px; }
    .header { background: #008069; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .header h1 { margin: 0; font-size: 20px; }
    .meta { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .actions-bar { display: flex; gap: 8px; align-items: center; }
    .btn { border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: transform 0.1s, opacity 0.2s; }
    .btn:hover { opacity: 0.9; transform: scale(1.02); }
    .back-btn { background: #128c7e; color: white; border: 1px solid rgba(255,255,255,0.3); }
    .print-btn { background: #25d366; color: #075e54; font-weight: 700; }
    .close-btn { background: #ef4444; color: white; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
    .chat-box { padding: 24px; background: #efeae2; display: flex; flex-direction: column; gap: 10px; min-height: 400px; }
    .msg { max-width: 70%; padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.4; word-break: break-word; box-shadow: 0 1px 1px rgba(0,0,0,0.1); }
    .msg.me { align-self: flex-end; background: #d9fdd3; }
    .msg.them { align-self: flex-start; background: white; }
    .msg-sender { font-weight: bold; font-size: 11px; color: #008069; margin-bottom: 2px; }
    .msg-time { font-size: 10px; color: #667781; text-align: right; margin-top: 4px; }
    .footer { padding: 16px 24px; text-align: center; font-size: 12px; color: #667781; background: #f0f2f5; border-top: 1px solid #e9edef; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
      .actions-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>💬 ${chatTitle}</h1>
        <div class="meta">Exportado el ${new Date().toLocaleDateString('es-ES')} · ${formattedMessages.length} mensajes</div>
      </div>
      <div class="actions-bar">
        <a href="http://localhost:5173" class="btn back-btn" onclick="if(window.opener){window.close();return false;}">⬅️ Volver al Chat</a>
        <button class="btn print-btn" onclick="window.print()">🖨️ Guardar PDF</button>
        <button class="btn close-btn" onclick="window.close()">✕ Cerrar</button>
      </div>
    </div>
    <div class="chat-box">
      ${formattedMessages.map(m => `
        <div class="msg ${m.sender === 'Tú' ? 'me' : 'them'}">
          ${m.sender !== 'Tú' ? `<div class="msg-sender">${m.sender}</div>` : ''}
          <div>${m.content}</div>
          <div class="msg-time">${m.date} ${m.time}</div>
        </div>
      `).join('')}
    </div>
    <div class="footer">
      Generado por WhatsApp Pro Business Analytics Suite
    </div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chat-${chatTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.json"`);
  res.json({
    chat: {
      id: chat.id,
      title: chatTitle,
      type: chat.type,
      exportedAt: new Date().toISOString(),
      totalMessages: formattedMessages.length
    },
    messages: formattedMessages
  });
});

// --- Linked Devices ---
app.get('/api/devices', (req, res) => {
  const db = getDb();
  try {
    const devices = db.prepare('SELECT * FROM linked_devices ORDER BY isCurrent DESC, lastActive DESC').all();
    res.json(devices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/devices', (req, res) => {
  const db = getDb();
  const { deviceName, browser, os, ip, location } = req.body;
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO linked_devices (id, deviceName, browser, os, ip, location, lastActive, isCurrent, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      deviceName || 'Dispositivo Web',
      browser || 'Navegador Web',
      os || 'Desconocido',
      ip || '192.168.1.' + Math.floor(Math.random() * 200 + 10),
      location || 'Madrid, España',
      now,
      now
    );
    const device = db.prepare('SELECT * FROM linked_devices WHERE id = ?').get(id);
    broadcast({ type: 'device_linked', device });
    res.status(201).json(device);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/devices/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM linked_devices WHERE id = ? AND isCurrent = 0').run(id);
    broadcast({ type: 'device_removed', deviceId: id });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Locked Chats & PIN ---
app.get('/api/locked-chats', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT chatId, lockedAt FROM locked_chats ORDER BY lockedAt DESC').all();
    res.json(rows.map(r => r.chatId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/locked-chats', (req, res) => {
  const db = getDb();
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId requerido' });
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare('INSERT OR IGNORE INTO locked_chats (id, chatId, lockedAt) VALUES (?, ?, ?)').run(id, chatId, now);
    broadcast({ type: 'chat_locked', chatId });
    res.status(201).json({ success: true, chatId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/locked-chats/:chatId', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  try {
    db.prepare('DELETE FROM locked_chats WHERE chatId = ?').run(chatId);
    broadcast({ type: 'chat_unlocked', chatId });
    res.json({ success: true, chatId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/locked-chats/verify-pin', (req, res) => {
  const db = getDb();
  const { pin } = req.body;
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'chatLockPin'").get();
    const correctPin = setting ? setting.value : '1234';
    const valid = String(pin) === String(correctPin);
    res.json({ valid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/locked-chats/set-pin', (req, res) => {
  const db = getDb();
  const { currentPin, newPin } = req.body;
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'chatLockPin'").get();
    const correctPin = setting ? setting.value : '1234';
    if (String(currentPin) !== String(correctPin)) {
      return res.status(403).json({ error: 'El PIN actual es incorrecto' });
    }
    if (!newPin || String(newPin).length < 4) {
      return res.status(400).json({ error: 'El PIN debe tener al menos 4 dígitos' });
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('chatLockPin', ?)").run(String(newPin));
    res.json({ success: true, message: 'PIN actualizado correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Stickers ---
app.get('/api/stickers', (req, res) => {
  const db = getDb();
  try {
    const stickers = db.prepare('SELECT * FROM custom_stickers ORDER BY createdAt DESC').all();
    res.json(stickers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stickers', (req, res) => {
  const db = getDb();
  const { name, imageUrl, category = 'custom' } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'URL o imagen del sticker requerida' });
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO custom_stickers (id, name, imageUrl, category, isFavorite, createdAt)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(id, name || 'Mi Sticker', imageUrl, category, now);
    const sticker = db.prepare('SELECT * FROM custom_stickers WHERE id = ?').get(id);
    broadcast({ type: 'new_sticker', sticker });
    res.status(201).json(sticker);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stickers/upload', upload.single('sticker'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();
  const name = req.body.name || req.file.originalname.replace(/\.[^/.]+$/, '');
  const imageUrl = `/uploads/${req.file.filename}`;
  try {
    db.prepare(`
      INSERT INTO custom_stickers (id, name, imageUrl, category, isFavorite, createdAt)
      VALUES (?, ?, ?, 'custom', 1, ?)
    `).run(id, name, imageUrl, now);
    const sticker = db.prepare('SELECT * FROM custom_stickers WHERE id = ?').get(id);
    broadcast({ type: 'new_sticker', sticker });
    res.status(201).json(sticker);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/stickers/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM custom_stickers WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- CRM Pipeline Endpoints ---
app.get('/api/crm/stages', (req, res) => {
  const db = getDb();
  try {
    const stages = db.prepare('SELECT * FROM crm_stages ORDER BY order_index ASC').all();
    res.json(stages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/crm/stages', (req, res) => {
  const db = getDb();
  const { name, color = '#10b981' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre de etapa requerido' });
  const id = uuidv4();
  const now = Date.now();
  try {
    const maxOrder = db.prepare('SELECT MAX(order_index) as m FROM crm_stages').get();
    const order_index = (maxOrder.m ?? -1) + 1;
    db.prepare('INSERT INTO crm_stages (id, name, color, order_index, createdAt) VALUES (?, ?, ?, ?, ?)').run(id, name.trim(), color, order_index, now);
    const stage = db.prepare('SELECT * FROM crm_stages WHERE id = ?').get(id);
    broadcast({ type: 'crm_stage_created', stage });
    res.status(201).json(stage);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/crm/stages/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, color, order_index } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (name !== undefined) { updates.push('name = ?'); vals.push(name.trim()); }
    if (color !== undefined) { updates.push('color = ?'); vals.push(color); }
    if (order_index !== undefined) { updates.push('order_index = ?'); vals.push(order_index); }
    if (updates.length > 0) {
      vals.push(id);
      db.prepare(`UPDATE crm_stages SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    }
    const stage = db.prepare('SELECT * FROM crm_stages WHERE id = ?').get(id);
    broadcast({ type: 'crm_stage_updated', stage });
    res.json(stage);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/crm/stages/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM chat_stage_relations WHERE stageId = ?').run(id);
    db.prepare('DELETE FROM crm_stages WHERE id = ?').run(id);
    broadcast({ type: 'crm_stage_deleted', stageId: id });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/crm/pipeline', (req, res) => {
  const db = getDb();
  try {
    const stages = db.prepare('SELECT * FROM crm_stages ORDER BY order_index ASC').all();
    const chats = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.phone AS contactPhone,
             csr.stageId, csr.dealValue, csr.notes, csr.updatedAt AS stageUpdatedAt
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      LEFT JOIN chat_stage_relations csr ON c.id = csr.chatId
      WHERE c.isArchived = 0
      ORDER BY c.lastMessageTime DESC
    `).all();

    const firstStageId = stages[0]?.id || 'stage-1';
    const result = stages.map(st => {
      const stageChats = chats.filter(c => (c.stageId === st.id) || (!c.stageId && st.id === firstStageId));
      const totalValue = stageChats.reduce((sum, c) => sum + (c.dealValue || 0), 0);
      return {
        ...st,
        chats: stageChats,
        chatCount: stageChats.length,
        totalValue
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/crm/chats/:chatId/stage', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { stageId, dealValue = 0, notes = '' } = req.body;
  if (!stageId) return res.status(400).json({ error: 'stageId requerido' });
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO chat_stage_relations (chatId, stageId, dealValue, notes, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(chatId) DO UPDATE SET
        stageId = excluded.stageId,
        dealValue = CASE WHEN excluded.dealValue IS NOT NULL THEN excluded.dealValue ELSE dealValue END,
        notes = CASE WHEN excluded.notes IS NOT NULL THEN excluded.notes ELSE notes END,
        updatedAt = excluded.updatedAt
    `).run(chatId, stageId, Number(dealValue) || 0, notes || '', now);

    const relation = db.prepare('SELECT * FROM chat_stage_relations WHERE chatId = ?').get(chatId);
    broadcast({ type: 'crm_chat_stage_updated', chatId, relation });

    // Sincronización asíncrona opcional con Google Sheets CRM (sin bloquear respuesta)
    try {
      const stage = db.prepare('SELECT * FROM crm_stages WHERE id = ?').get(stageId);
      const chat = db.prepare(`
        SELECT c.*, co.name AS contactName, co.phone AS contactPhone
        FROM chats c
        LEFT JOIN contacts co ON c.contactId = co.id
        WHERE c.id = ?
      `).get(chatId);

      if (chat) {
        const { syncLeadToGoogleSheets } = require('./services/googleSheetsSync');
        syncLeadToGoogleSheets({
          chatId,
          contactName: chat.contactName || chat.name,
          contactPhone: chat.contactPhone,
          stageName: stage?.name || 'Etapa Actualizada',
          dealValue: Number(dealValue) || 0,
          agentName: chat.assignedAgentName || 'Equipo Huiracocha',
          notes: notes || chat.lastMessage
        }).catch(err => console.warn('[CRM Sheets Sync] Error en background:', err.message));
      }
    } catch (_) {}

    res.json({ success: true, relation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para disparar sincronización masiva hacia Google Sheets
app.post('/api/crm/sync-google-sheets', async (req, res) => {
  const db = getDb();
  try {
    const { syncLeadToGoogleSheets } = require('./services/googleSheetsSync');
    const stages = db.prepare('SELECT * FROM crm_stages').all();
    const stageMap = new Map(stages.map(s => [s.id, s.name]));

    const chats = db.prepare(`
      SELECT c.*, co.name AS contactName, co.phone AS contactPhone,
             csr.stageId, csr.dealValue, csr.notes
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      JOIN chat_stage_relations csr ON c.id = csr.chatId
      WHERE c.isArchived = 0
    `).all();

    let syncedCount = 0;
    for (const chat of chats) {
      await syncLeadToGoogleSheets({
        chatId: chat.id,
        contactName: chat.contactName || chat.name,
        contactPhone: chat.contactPhone,
        stageName: stageMap.get(chat.stageId) || 'Lead',
        dealValue: chat.dealValue || 0,
        agentName: chat.assignedAgentName || 'Equipo Huiracocha',
        notes: chat.notes || chat.lastMessage
      });
      syncedCount++;
    }

    res.json({ success: true, count: syncedCount, message: `Se sincronizaron ${syncedCount} leads con Google Sheets.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Scheduled Messages Endpoints ---
app.get('/api/scheduled-messages', (req, res) => {
  const db = getDb();
  const { chatId, status } = req.query;
  try {
    let sql = `
      SELECT sm.*, c.groupName, co.name AS contactName, co.avatar AS contactAvatar
      FROM scheduled_messages sm
      JOIN chats c ON sm.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE 1=1
    `;
    const params = [];
    if (chatId) { sql += ' AND sm.chatId = ?'; params.push(chatId); }
    if (status) { sql += ' AND sm.status = ?'; params.push(status); }
    sql += ' ORDER BY sm.scheduledTime ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/scheduled-messages', (req, res) => {
  const db = getDb();
  const { chatId, content, scheduledTime, type = 'text' } = req.body;
  if (!chatId || !content?.trim() || !scheduledTime) {
    return res.status(400).json({ error: 'chatId, content y scheduledTime son requeridos' });
  }
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO scheduled_messages (id, chatId, senderId, content, type, scheduledTime, status, createdAt)
      VALUES (?, ?, 'me', ?, ?, ?, 'pending', ?)
    `).run(id, chatId, content.trim(), type, Number(scheduledTime), now);

    const scheduled = db.prepare(`
      SELECT sm.*, c.groupName, co.name AS contactName, co.avatar AS contactAvatar
      FROM scheduled_messages sm
      JOIN chats c ON sm.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE sm.id = ?
    `).get(id);

    broadcast({ type: 'scheduled_message_created', scheduled });
    res.status(201).json(scheduled);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/scheduled-messages/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare("UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ?").run(id);
    broadcast({ type: 'scheduled_message_cancelled', id });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Campaigns Endpoints ---
app.get('/api/campaigns', (req, res) => {
  const db = getDb();
  try {
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY createdAt DESC').all();
    res.json(campaigns);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  const db = getDb();
  const { name, template, mediaUrl = '', targetAudience = 'all', scheduledAt = null } = req.body;
  if (!name?.trim() || !template?.trim()) {
    return res.status(400).json({ error: 'Nombre y plantilla requeridos' });
  }
  const id = uuidv4();
  const now = Date.now();
  const status = scheduledAt && Number(scheduledAt) > now ? 'scheduled' : 'draft';
  try {
    db.prepare(`
      INSERT INTO campaigns (id, name, template, mediaUrl, status, targetAudience, scheduledAt, sentCount, deliveredCount, readCount, replyCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
    `).run(id, name.trim(), template.trim(), mediaUrl, status, targetAudience, scheduledAt ? Number(scheduledAt) : null, now);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    broadcast({ type: 'campaign_created', campaign });
    res.status(201).json(campaign);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/campaigns/:id/launch', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

  let recipients = [];
  if (campaign.targetAudience?.startsWith('broadcast:')) {
    const broadcastId = campaign.targetAudience.replace('broadcast:', '');
    recipients = db.prepare(`
      SELECT c.* FROM broadcast_members bm
      JOIN contacts c ON bm.contactId = c.id
      WHERE bm.broadcastId = ? AND c.id != 'me'
    `).all(broadcastId);
  } else {
    recipients = db.prepare("SELECT * FROM contacts WHERE id != 'me'").all();
  }

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No hay destinatarios en el segmento seleccionado' });
  }

  db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(id);
  broadcast({ type: 'campaign_started', campaignId: id, total: recipients.length });

  let sent = 0;
  let delivered = 0;

  recipients.forEach((contact, idx) => {
    setTimeout(() => {
      try {
        const curDb = getDb();
        const now = Date.now();
        let personalizedMsg = campaign.template
          .replace(/\{\{nombre\}\}/gi, contact.name || 'Cliente')
          .replace(/\{\{telefono\}\}/gi, contact.phone || '')
          .replace(/\{\{empresa\}\}/gi, 'WhatsApp Pro');

        let chat = curDb.prepare("SELECT * FROM chats WHERE contactId = ? AND type = 'individual'").get(contact.id);
        if (!chat) {
          const chatId = uuidv4();
          curDb.prepare(`
            INSERT INTO chats (id, contactId, type, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, disappearingTimer)
            VALUES (?, ?, 'individual', ?, ?, 0, 0, 0, 0, 0)
          `).run(chatId, contact.id, personalizedMsg, now);
          chat = curDb.prepare(`
            SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
                   co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
                   co.status AS contactStatus, co.phone AS contactPhone
            FROM chats c
            LEFT JOIN contacts co ON c.contactId = co.id
            WHERE c.id = ?
          `).get(chatId);
          broadcast({ type: 'new_chat', chat });
        }

        const msgId = uuidv4();
        curDb.prepare(`
          INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
          VALUES (?, ?, 'me', 'Yo (Campaña)', ?, 'text', ?, 'sent', null, '{}')
        `).run(msgId, chat.id, personalizedMsg, now);

        curDb.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, isArchived = 0 WHERE id = ?').run(personalizedMsg, now, chat.id);

        const newMsg = curDb.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
        broadcast({ type: 'new_message', chatId: chat.id, message: newMsg });

        curDb.prepare(`
          INSERT INTO campaign_logs (id, campaignId, contactId, chatId, status, sentAt)
          VALUES (?, ?, ?, ?, 'delivered', ?)
        `).run(uuidv4(), id, contact.id, chat.id, now);

        sent++;
        delivered++;

        curDb.prepare('UPDATE campaigns SET sentCount = ?, deliveredCount = ? WHERE id = ?').run(sent, delivered, id);
        broadcast({ type: 'campaign_progress', campaignId: id, sentCount: sent, totalCount: recipients.length });

        if (idx === recipients.length - 1) {
          curDb.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(id);
          broadcast({ type: 'campaign_completed', campaignId: id, sentCount: sent });
        }
      } catch (err) {
        console.error('Error sending campaign message:', err);
      }
    }, (idx + 1) * 350);
  });

  res.json({ success: true, message: 'Campaña iniciada', totalRecipients: recipients.length });
});

app.delete('/api/campaigns/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM campaign_logs WHERE campaignId = ?').run(id);
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    broadcast({ type: 'campaign_deleted', id });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Bulk Messaging Engine (Spintax + Anti-Ban + File & Direct Numbers) ---
const bulkSessions = new Map();

function resolveSpintax(text) {
  if (!text) return '';
  const spintaxRegex = /\{([^{}]+)\}/g;
  let result = text;
  let iterations = 0;
  while (spintaxRegex.test(result) && iterations < 10) {
    result = result.replace(spintaxRegex, (match, choices) => {
      const options = choices.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
    iterations++;
  }
  return result;
}

app.post('/api/bulk/send', async (req, res) => {
  const {
    recipients = [],
    template = '',
    mediaUrl = '',
    campaignName = 'Envío Masivo Directo',
    antiBan = { minDelay: 2, maxDelay: 5, batchSize: 20, batchPause: 10 }
  } = req.body;

  if (!recipients.length || !template.trim()) {
    return res.status(400).json({ error: 'Se requieren destinatarios y plantilla de mensaje' });
  }

  const batchId = 'bulk-' + uuidv4().slice(0, 8);
  const total = recipients.length;
  const session = {
    batchId,
    campaignName,
    paused: false,
    stopped: false,
    progress: { current: 0, total, sent: 0, failed: 0, logs: [] }
  };
  bulkSessions.set(batchId, session);

  res.status(202).json({
    success: true,
    batchId,
    totalRecipients: total,
    message: 'Proceso de envío masivo iniciado con motor anti-bloqueo'
  });

  (async () => {
    const minDelay = Math.max(1, Number(antiBan.minDelay) || 2);
    const maxDelay = Math.max(minDelay, Number(antiBan.maxDelay) || 5);
    const batchSize = Math.max(5, Number(antiBan.batchSize) || 20);
    const batchPause = Math.max(2, Number(antiBan.batchPause) || 10);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      if (session.stopped) {
        broadcast({
          type: 'bulk_stopped',
          batchId,
          sent,
          failed,
          total,
          message: 'Envío detenido por el usuario'
        });
        break;
      }

      while (session.paused && !session.stopped) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (session.stopped) break;

      const recipient = recipients[i];
      const rawPhone = (recipient.phone || '').trim();
      const name = (recipient.name || '').trim() || rawPhone;

      try {
        const db = getDb();
        const now = Date.now();

        let personalizedMsg = resolveSpintax(template)
          .replace(/\{\{nombre\}\}/gi, name)
          .replace(/\{\{name\}\}/gi, name)
          .replace(/\{\{telefono\}\}/gi, rawPhone)
          .replace(/\{\{phone\}\}/gi, rawPhone)
          .replace(/\{\{var1\}\}/gi, recipient.var1 || '')
          .replace(/\{\{var2\}\}/gi, recipient.var2 || '')
          .replace(/\{\{monto\}\}/gi, recipient.var1 || recipient.monto || '');

        let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(rawPhone);
        if (!contact) {
          const contactId = uuidv4();
          db.prepare('INSERT INTO contacts (id, name, phone, avatar, status) VALUES (?, ?, ?, ?, ?)')
            .run(contactId, name, rawPhone, `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`, 'Cliente Importado');
          contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
          broadcast({ type: 'contact_created', contact });
        }

        let chat = db.prepare("SELECT * FROM chats WHERE contactId = ? AND type = 'individual'").get(contact.id);
        if (!chat) {
          const chatId = uuidv4();
          db.prepare(`
            INSERT INTO chats (id, contactId, type, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, disappearingTimer, channel, status)
            VALUES (?, ?, 'individual', ?, ?, 0, 0, 0, 0, 0, 'whatsapp', 'open')
          `).run(chatId, contact.id, personalizedMsg, now);
          chat = db.prepare(`
            SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
                   co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
                   co.status AS contactStatus, co.phone AS contactPhone
            FROM chats c
            LEFT JOIN contacts co ON c.contactId = co.id
            WHERE c.id = ?
          `).get(chatId);
          broadcast({ type: 'new_chat', chat });
        }

        const msgId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions, filePath)
          VALUES (?, ?, 'me', 'Yo', ?, ?, ?, 'sent', null, '{}', ?)
        `).run(msgId, chat.id, personalizedMsg, mediaUrl ? 'image' : 'text', now, mediaUrl || null);

        db.prepare("UPDATE chats SET lastMessage = ?, lastMessageTime = ?, unreadCount = 0 WHERE id = ?")
          .run(personalizedMsg, now, chat.id);

        const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
        broadcast({ type: 'new_message', chatId: chat.id, message: newMsg });

        sent++;
        const logEntry = {
          phone: rawPhone,
          name,
          status: 'success',
          text: personalizedMsg.slice(0, 80),
          time: new Date().toLocaleTimeString('es-ES')
        };
        session.progress.logs.push(logEntry);

        const percent = Math.round(((i + 1) / total) * 100);
        broadcast({
          type: 'bulk_progress',
          batchId,
          index: i + 1,
          total,
          percent,
          sent,
          failed,
          currentRecipient: { phone: rawPhone, name },
          log: logEntry
        });
      } catch (err) {
        failed++;
        console.error('Error sending bulk message to', rawPhone, err.message);
        const logEntry = {
          phone: rawPhone,
          name,
          status: 'error',
          error: err.message,
          time: new Date().toLocaleTimeString('es-ES')
        };
        session.progress.logs.push(logEntry);
        broadcast({
          type: 'bulk_progress',
          batchId,
          index: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          sent,
          failed,
          log: logEntry
        });
      }

      if ((i + 1) % batchSize === 0 && i + 1 < total) {
        broadcast({
          type: 'bulk_throttled',
          batchId,
          pauseSeconds: batchPause,
          message: `Pausa de seguridad anti-bloqueo (${batchPause}s) por lote de ${batchSize} mensajes...`
        });
        await new Promise((r) => setTimeout(r, batchPause * 1000));
      } else if (i + 1 < total) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        await new Promise((r) => setTimeout(r, delay * 1000));
      }
    }

    broadcast({
      type: 'bulk_completed',
      batchId,
      total,
      sent,
      failed,
      completedAt: Date.now()
    });
  })();
});

app.post('/api/bulk/pause/:batchId', (req, res) => {
  const session = bulkSessions.get(req.params.batchId);
  if (!session) return res.status(404).json({ error: 'Lote no encontrado' });
  session.paused = true;
  broadcast({ type: 'bulk_paused', batchId: req.params.batchId });
  res.json({ success: true, status: 'paused' });
});

app.post('/api/bulk/resume/:batchId', (req, res) => {
  const session = bulkSessions.get(req.params.batchId);
  if (!session) return res.status(404).json({ error: 'Lote no encontrado' });
  session.paused = false;
  broadcast({ type: 'bulk_resumed', batchId: req.params.batchId });
  res.json({ success: true, status: 'running' });
});

app.post('/api/bulk/stop/:batchId', (req, res) => {
  const session = bulkSessions.get(req.params.batchId);
  if (!session) return res.status(404).json({ error: 'Lote no encontrado' });
  session.stopped = true;
  broadcast({ type: 'bulk_stopped', batchId: req.params.batchId });
  res.json({ success: true, status: 'stopped' });
});

app.get('/api/bulk/status/:batchId', (req, res) => {
  const session = bulkSessions.get(req.params.batchId);
  if (!session) return res.status(404).json({ error: 'Lote no encontrado' });
  res.json(session.progress);
});

// ── Multi-language Translation Engine ─────────────────────────────────────────
const LANG_NAMES = {
  es: 'Español 🇪🇸',
  en: 'English 🇺🇸',
  qu: 'Quechua (Runasimi) 🇵🇪',
  pt: 'Português 🇧🇷',
  fr: 'Français 🇫🇷',
  it: 'Italiano 🇮🇹',
  de: 'Deutsch 🇩🇪'
};

const TRANSLATION_DICTIONARY = {
  en: {
    "hola": "Hello",
    "¡hola!": "Hello!",
    "buenos días": "Good morning",
    "buenas tardes": "Good afternoon",
    "buenas noches": "Good evening",
    "gracias": "Thank you",
    "muchas gracias": "Thank you very much",
    "por favor": "Please",
    "¿cómo estás?": "How are you?",
    "¿cómo está?": "How are you?",
    "¿en qué podemos asesorarte hoy?": "How can we assist you today?",
    "bienvenido": "Welcome",
    "pedido": "Order",
    "pago": "Payment",
    "pagado": "Paid",
    "pendiente": "Pending",
    "excelente": "Excellent",
    "perfecto": "Perfect",
    "equipo": "Team",
    "¿viste el partido de anoche?": "Did you see last night's game?",
    "el pr ya está listo para review": "The PR is ready for review",
    "¡perfecto! nos vemos mañana": "Perfect! See you tomorrow",
    "deploy en producción exitoso!": "Production deployment successful! 🚀",
    "os mando las fotos luego": "I'll send you the photos later",
    "el concierto estuvo brutal": "The concert was awesome 🎸",
    "sí, todo conforme por aquí, gracias": "Yes, everything looks good on this end, thank you",
    "yo aplico": "I apply",
    "abierto": "Open",
    "en espera": "Pending",
    "resuelto": "Resolved",
    "¿cómo calificarías la atención recibida en chaskyapp?": "How would you rate the service received at CHASKYAPP?",
    "excelente servicio": "Excellent service",
    "buena atención": "Good service"
  },
  qu: {
    "hola": "Allillanchu",
    "¡hola!": "Allillanchu!",
    "buenos días": "Allin p'unchay",
    "buenas tardes": "Allin suka",
    "buenas noches": "Allin tuta",
    "gracias": "Añay",
    "muchas gracias": "Ancha añaykikim",
    "por favor": "Allichu",
    "¿cómo estás?": "¿Allillanchu kashanki?",
    "¿cómo está?": "¿Allillanchu kashanki?",
    "¿en qué podemos asesorarte hoy?": "¿Imapitaq yanapasunkiku kunan?",
    "bienvenido": "Allin chayamuy",
    "pedido": "Mañakuy",
    "pago": "Qullqi chaskiy",
    "pagado": "Qullqisqa",
    "pendiente": "Suyakusqa",
    "excelente": "Ancha allin",
    "perfecto": "Kusa",
    "equipo": "Ayllu llamk'aqkuna",
    "¿viste el partido de anoche?": "¿Qhawarqankichu ch'isi pukllayta?",
    "el pr ya está listo para review": "PR qhawanapaq kashanña",
    "¡perfecto! nos vemos mañana": "¡Kusa! Paqarin rikurikusunchik",
    "deploy en producción exitoso!": "Llamk'ana churasqa kusa llank'asqa! 🚀",
    "os mando las fotos luego": "Qhipaman fotokunata kachamusaykichik",
    "el concierto estuvo brutal": "Taki kusikuy ancha sumaq karqan 🎸",
    "sí, todo conforme por aquí, gracias": "Arí, tukuy allin kaypi, añay",
    "yo aplico": "Ñuqa churakuni",
    "abierto": "Kichasqa",
    "en espera": "Suyakusqa",
    "resuelto": "Allichasqa",
    "¿cómo calificarías la atención recibida en chaskyapp?": "¿Imaynatan CHASKYAPPpi chaskisqaykita chaninchawaq?",
    "excelente servicio": "Ancha sumaq yanapay",
    "buena atención": "Allin chaskiy"
  },
  pt: {
    "hola": "Olá",
    "¡hola!": "Olá!",
    "buenos días": "Bom dia",
    "buenas tardes": "Boa tarde",
    "buenas noches": "Boa noite",
    "gracias": "Obrigado",
    "muchas gracias": "Muito obrigado",
    "por favor": "Por favor",
    "¿cómo estás?": "Como você está?",
    "¿cómo está?": "Como vai você?",
    "¿en qué podemos asesorarte hoy?": "Como podemos ajudar você hoje?",
    "bienvenido": "Bem-vindo",
    "pedido": "Pedido",
    "pago": "Pagamento",
    "pagado": "Pago",
    "pendiente": "Pendente",
    "excelente": "Excelente",
    "perfecto": "Perfeito",
    "equipo": "Equipe",
    "¿viste el partido de anoche?": "Viu o jogo de ontem à noite?",
    "el pr ya está listo para review": "O PR já está pronto para revisão",
    "¡perfecto! nos vemos mañana": "Perfeito! Nos vemos amanhã",
    "deploy en producción exitoso!": "Deploy em produção com sucesso! 🚀",
    "os mando las fotos luego": "Envio as fotos mais tarde",
    "el concierto estuvo brutal": "O show foi sensacional 🎸",
    "sí, todo conforme por aquí, gracias": "Sim, tudo certo por aqui, obrigado",
    "yo aplico": "Eu aplico",
    "abierto": "Aberto",
    "en espera": "Em espera",
    "resuelto": "Resolvido",
    "excelente servicio": "Excelente atendimento",
    "buena atención": "Bom atendimento"
  },
  fr: {
    "hola": "Bonjour",
    "¡hola!": "Bonjour!",
    "buenos días": "Bonjour",
    "buenas tardes": "Bon après-midi",
    "buenas noches": "Bonsoir",
    "gracias": "Merci",
    "muchas gracias": "Merci beaucoup",
    "por favor": "S'il vous plaît",
    "¿cómo estás?": "Comment allez-vous ?",
    "¿cómo está?": "Comment allez-vous ?",
    "¿en qué podemos asesorarte hoy?": "Comment pouvons-nous vous aider aujourd'hui ?",
    "bienvenido": "Bienvenue",
    "pedido": "Commande",
    "pago": "Paiement",
    "pagado": "Payé",
    "pendiente": "En attente",
    "excelente": "Excellent",
    "perfecto": "Parfait",
    "equipo": "Équipe",
    "¿viste el partido de anoche?": "As-tu vu le match d'hier soir ?",
    "el pr ya está listo para review": "La PR est prête pour relecture",
    "¡perfecto! nos vemos mañana": "Parfait ! À demain",
    "deploy en producción exitoso!": "Déploiement en production réussi ! 🚀",
    "os mando las fotos luego": "Je vous envoie les photos plus tard",
    "el concierto estuvo brutal": "Le concert était génial 🎸",
    "sí, todo conforme por aquí, gracias": "Oui, tout est conforme ici, merci",
    "yo aplico": "J'applique",
    "abierto": "Ouvert",
    "en espera": "En attente",
    "resuelto": "Résolu",
    "excelente servicio": "Excellent service",
    "buena atención": "Bon accueil"
  },
  es: {
    "hello": "Hola",
    "allillanchu": "Hola",
    "olá": "Hola",
    "bonjour": "Hola",
    "thank you": "Gracias",
    "añay": "Gracias",
    "obrigado": "Gracias",
    "merci": "Gracias"
  }
};

function translateEngine(text, targetLang = 'en') {
  if (!text || !text.trim()) return { translatedText: '', targetLang, targetLangName: LANG_NAMES[targetLang] || targetLang };
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const targetDict = TRANSLATION_DICTIONARY[targetLang] || TRANSLATION_DICTIONARY.en;

  if (targetDict[lower]) {
    return {
      translatedText: targetDict[lower],
      targetLang,
      targetLangName: LANG_NAMES[targetLang] || targetLang
    };
  }

  let result = trimmed;
  let hasReplaced = false;
  const sortedKeys = Object.keys(targetDict).sort((a, b) => b.length - a.length);

  for (const k of sortedKeys) {
    const reg = new RegExp('(^|\\s|[.,!?;:])(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')($|\\s|[.,!?;:])', 'gi');
    if (reg.test(result)) {
      result = result.replace(reg, (match, p1, p2, p3) => `${p1}${targetDict[k]}${p3}`);
      hasReplaced = true;
    }
  }

  if (!hasReplaced) {
    if (targetLang === 'en') {
      result = trimmed
        .replace(/hola/gi, 'hello')
        .replace(/gracias/gi, 'thank you')
        .replace(/buenos días/gi, 'good morning')
        .replace(/amigo/gi, 'friend');
    } else if (targetLang === 'qu') {
      result = `Allillanchu, ${trimmed}`;
    } else if (targetLang === 'pt') {
      result = trimmed.replace(/hola/gi, 'olá').replace(/gracias/gi, 'obrigado');
    } else if (targetLang === 'fr') {
      result = trimmed.replace(/hola/gi, 'bonjour').replace(/gracias/gi, 'merci');
    }
  }

  return {
    translatedText: result,
    targetLang,
    targetLangName: LANG_NAMES[targetLang] || targetLang
  };
}

// ── Translation REST Endpoint ────────────────────────────────────────────────
app.post('/api/translate', (req, res) => {
  const { text, targetLang = 'en', sourceLang = 'auto' } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Texto requerido para traducción' });
  }

  const result = translateEngine(text, targetLang, sourceLang);
  res.json({
    success: true,
    originalText: text,
    translatedText: result.translatedText,
    targetLang: result.targetLang,
    targetLangName: result.targetLangName,
    detectedSourceLang: 'es'
  });
});

// ── Voice Transcription REST Endpoints (AI Speech-to-Text) ────────────────────
app.post('/api/audio/transcribe', async (req, res) => {
  const db = getDb();
  const { messageId, audioUrl, duration } = req.body;

  try {
    // 1. Check if existing transcription is in DB
    if (messageId) {
      const existing = db.prepare('SELECT * FROM voice_transcriptions WHERE messageId = ?').get(messageId);
      if (existing) {
        return res.json({ success: true, transcription: existing });
      }
    }

    // 2. Intelligent AI Speech-to-Text Engine (Gemini Flash / Whisper transcription simulation)
    const transcriptionsPool = [
      "Hola equipo, estuve revisando los números y la propuesta técnica de CHASKYAPP. Todo se ve excelente para iniciar el despliegue en producción.",
      "Estimado cliente, le confirmamos que el link de pago ya fue generado exitosamente por Yape y Plin. Quedamos atentos a su comprobante.",
      "Buenos días, quería consultar sobre los planes para empresas y si incluye el módulo de envío masivo con protección anti-baneo.",
      "Confirmado el pedido, ya estamos procesando la entrega con el equipo de soporte. Muchas gracias por su preferencia.",
      "Hola, te dejo este audio para coordinar la reunión de las dos de la tarde. Por favor avísame si te conectas por Google Meet o por llamada."
    ];

    let chosenText = transcriptionsPool[0];
    if (duration && duration > 25) {
      chosenText = "Hola, buenas tardes. Les envío esta nota de voz para coordinar la entrega del pedido y validar los detalles de facturación. Por favor confírmenme cuando tengan un momento disponible para revisar el estado del ticket. Muchas gracias.";
    } else if (duration && duration < 5) {
      chosenText = "¡Hola! Sí, todo conforme por aquí, gracias.";
    } else if (messageId) {
      const hash = messageId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      chosenText = transcriptionsPool[hash % transcriptionsPool.length];
    }

    const id = 'vt-' + uuidv4().slice(0, 8);
    const now = Date.now();
    const record = {
      id,
      messageId: messageId || 'msg-' + uuidv4().slice(0, 8),
      audioUrl: audioUrl || '',
      transcription: chosenText,
      language: 'es',
      languageName: 'Español (Perú / Latinoamérica)',
      confidence: 0.985,
      duration: Number(duration) || 8.0,
      createdAt: now
    };

    db.prepare(`
      INSERT OR REPLACE INTO voice_transcriptions (id, messageId, audioUrl, transcription, language, languageName, confidence, duration, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.messageId, record.audioUrl, record.transcription, record.language, record.languageName, record.confidence, record.duration, record.createdAt);

    // Broadcast transcription via WebSocket
    broadcast({
      type: 'voice_transcription',
      messageId: record.messageId,
      transcription: record
    });

    res.json({ success: true, transcription: record });
  } catch (err) {
    console.error('Error in audio transcribe endpoint:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audio/transcription/:messageId', (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM voice_transcriptions WHERE messageId = ?').get(req.params.messageId);
    if (!row) return res.status(404).json({ error: 'No transcription found' });
    res.json({ success: true, transcription: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSAT Surveys REST Endpoints ───────────────────────────────────────────────
app.post('/api/csat', (req, res) => {
  const db = getDb();
  const { surveyId, chatId, rating, comment } = req.body;
  if (!surveyId || !rating) {
    return res.status(400).json({ error: 'ID de encuesta y calificación requeridos' });
  }

  try {
    const numRating = Math.max(1, Math.min(5, Number(rating)));
    const cleanComment = (comment || '').trim();

    // 1. Update csat_surveys table
    db.prepare(`
      UPDATE csat_surveys
      SET rating = ?, comment = ?, status = 'submitted'
      WHERE id = ?
    `).run(numRating, cleanComment, surveyId);

    // 2. Update message payload in messages table
    const msg = db.prepare(`
      SELECT * FROM messages WHERE chatId = ? AND type = 'csat_survey' AND content LIKE ?
    `).get(chatId, `%${surveyId}%`);

    if (msg) {
      try {
        const payload = JSON.parse(msg.content);
        payload.status = 'submitted';
        payload.rating = numRating;
        payload.comment = cleanComment;
        payload.submittedAt = Date.now();
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(JSON.stringify(payload), msg.id);
        const updatedMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id);
        broadcast({ type: 'message_updated', chatId, message: updatedMsg });
      } catch (e) {
        console.error('Error updating csat message content:', e.message);
      }
    }

    const updatedSurvey = db.prepare('SELECT * FROM csat_surveys WHERE id = ?').get(surveyId);
    broadcast({ type: 'csat_submitted', chatId, survey: updatedSurvey });
    dispatchWebhook('csat.submitted', { survey: updatedSurvey, chatId });

    res.json({ success: true, survey: updatedSurvey });
  } catch (e) {
    console.error('Error submitting CSAT survey:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/csat/stats', (req, res) => {
  const db = getDb();
  try {
    const surveys = db.prepare(`
      SELECT cs.*, c.groupName, co.name AS contactName
      FROM csat_surveys cs
      LEFT JOIN chats c ON cs.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE cs.status = 'submitted'
      ORDER BY cs.createdAt DESC
    `).all();

    const total = surveys.length;
    if (total === 0) {
      return res.json({
        total: 0,
        averageRating: 0,
        csatScore: 0,
        npsScore: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        recentSurveys: []
      });
    }

    const sum = surveys.reduce((acc, s) => acc + s.rating, 0);
    const avg = Number((sum / total).toFixed(1));

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    surveys.forEach(s => {
      if (dist[s.rating] !== undefined) dist[s.rating]++;
    });

    const satisfied = dist[5] + dist[4];
    const csatScore = Math.round((satisfied / total) * 100);

    const promoters = dist[5];
    const detractors = dist[1] + dist[2];
    const npsScore = Math.round(((promoters - detractors) / total) * 100);

    res.json({
      total,
      averageRating: avg,
      csatScore,
      npsScore,
      distribution: dist,
      recentSurveys: surveys.slice(0, 10)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/csat/chat/:chatId', (req, res) => {
  const db = getDb();
  try {
    const survey = db.prepare('SELECT * FROM csat_surveys WHERE chatId = ? ORDER BY createdAt DESC LIMIT 1').get(req.params.chatId);
    res.json(survey || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── RBAC & Security Audit Helpers & Middleware ────────────────────────────────
function recordAuditLog({
  agentId = 'agent-me',
  agentName = 'Yo (Operador Actual)',
  event,
  category = 'General',
  severity = 'info',
  details,
  ipAddress = '127.0.0.1',
  deviceInfo = 'Desktop Web'
}) {
  try {
    const db = getDb();
    const id = 'log-' + uuidv4().slice(0, 8);
    const now = Date.now();
    db.prepare(`
      INSERT INTO audit_logs (id, agentId, agentName, event, category, severity, details, ipAddress, deviceInfo, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, agentId, agentName, event, category, severity, details, ipAddress, deviceInfo, now);

    const logEntry = { id, agentId, agentName, event, category, severity, details, ipAddress, deviceInfo, createdAt: now };
    broadcast({ type: 'audit_logged', log: logEntry });
    return logEntry;
  } catch (err) {
    console.error('Error recording audit log:', err.message);
  }
}

function checkPermission(agentId, requiredPermission) {
  const db = getDb();
  const user = db.prepare(`
    SELECT r.permissions FROM user_roles ur
    JOIN roles r ON ur.roleId = r.id
    WHERE ur.userId = ?
  `).get(agentId || 'agent-me');

  if (!user) return true;
  try {
    const perms = JSON.parse(user.permissions);
    return perms.includes('*') || perms.includes(requiredPermission);
  } catch (e) {
    return false;
  }
}

// ── RBAC Endpoints ────────────────────────────────────────────────────────────
app.get('/api/rbac/roles', (req, res) => {
  const db = getDb();
  try {
    const roles = db.prepare('SELECT * FROM roles ORDER BY isSystem DESC, createdAt ASC').all();
    const rolesWithCounts = roles.map(r => {
      let perms = [];
      try { perms = JSON.parse(r.permissions); } catch {}
      const userCount = db.prepare('SELECT COUNT(*) as c FROM user_roles WHERE roleId = ?').get(r.id).c;
      return { ...r, permissions: perms, userCount };
    });
    res.json(rolesWithCounts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/rbac/roles/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  try {
    const permsStr = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || []);
    db.prepare(`
      UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description), permissions = ?
      WHERE id = ?
    `).run(name, description, permsStr, id);

    const updated = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
    let parsedPerms = [];
    try { parsedPerms = JSON.parse(updated.permissions); } catch {}

    recordAuditLog({
      agentId: req.headers['x-agent-id'] || 'agent-me',
      agentName: req.headers['x-agent-name'] || 'Yo (Operador Actual)',
      event: 'roles.updated',
      category: 'Seguridad',
      severity: 'warning',
      details: `Se actualizaron los permisos para el rol "${updated.name}" (${parsedPerms.length} permisos asignados)`
    });

    broadcast({ type: 'role_updated', role: { ...updated, permissions: parsedPerms } });
    res.json({ success: true, role: { ...updated, permissions: parsedPerms } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/rbac/permissions', (req, res) => {
  const db = getDb();
  try {
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY category ASC, id ASC').all();
    res.json(permissions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/rbac/users', (req, res) => {
  const db = getDb();
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all();
    const users = agents.map(ag => {
      const ur = db.prepare('SELECT ur.roleId, r.name as roleName, r.permissions FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE ur.userId = ?').get(ag.id);
      let perms = [];
      if (ur) {
        try { perms = JSON.parse(ur.permissions); } catch {}
      }
      return {
        ...ag,
        roleId: ur?.roleId || 'support',
        roleName: ur?.roleName || ag.role || 'Soporte Técnico',
        permissions: perms
      };
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/rbac/users/:id/role', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'roleId es requerido' });

  try {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

    db.prepare(`
      INSERT INTO user_roles (userId, roleId, assignedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, roleId) DO UPDATE SET assignedAt = excluded.assignedAt
    `).run(id, roleId, Date.now());

    db.prepare('DELETE FROM user_roles WHERE userId = ? AND roleId != ?').run(id, roleId);
    db.prepare('UPDATE agents SET role = ? WHERE id = ?').run(role.name, id);

    const updatedUser = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);

    recordAuditLog({
      agentId: req.headers['x-agent-id'] || 'agent-me',
      agentName: req.headers['x-agent-name'] || 'Yo (Operador Actual)',
      event: 'user.role_changed',
      category: 'Seguridad',
      severity: 'warning',
      details: `Se asignó el rol "${role.name}" al usuario ${updatedUser.name} (${updatedUser.email})`
    });

    broadcast({ type: 'user_role_updated', userId: id, roleId, roleName: role.name });
    res.json({ success: true, user: updatedUser, roleId, roleName: role.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Audit Logs Endpoints ──────────────────────────────────────────────────────
app.get('/api/audit/logs', (req, res) => {
  const db = getDb();
  const { agentId, category, severity, search, limit = 100 } = req.query;
  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (agentId && agentId !== 'all') {
      query += ' AND agentId = ?';
      params.push(agentId);
    }
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (severity && severity !== 'all') {
      query += ' AND severity = ?';
      params.push(severity);
    }
    if (search) {
      query += ' AND (details LIKE ? OR agentName LIKE ? OR event LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY createdAt DESC LIMIT ?';
    params.push(Number(limit) || 100);

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/audit/logs', (req, res) => {
  const { event, category, severity, details, agentId, agentName } = req.body;
  if (!event || !details) return res.status(400).json({ error: 'event y details requeridos' });

  const log = recordAuditLog({
    agentId: agentId || req.headers['x-agent-id'] || 'agent-me',
    agentName: agentName || req.headers['x-agent-name'] || 'Yo (Operador Actual)',
    event,
    category: category || 'General',
    severity: severity || 'info',
    details,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ success: true, log });
});

// ── Security & Session Lock Endpoints ─────────────────────────────────────────
app.post('/api/auth/verify-pin', (req, res) => {
  const db = getDb();
  const { pin, agentId, agentName } = req.body;
  try {
    const pinRow = db.prepare("SELECT value FROM settings WHERE key = 'security_pin'").get();
    const storedPin = pinRow ? pinRow.value : '1234';

    if (pin === storedPin) {
      recordAuditLog({
        agentId: agentId || 'agent-me',
        agentName: agentName || 'Yo (Operador Actual)',
        event: 'security.unlock',
        category: 'Seguridad',
        severity: 'info',
        details: 'Desbloqueo de sesión verificado con PIN de seguridad exitosamente'
      });
      res.json({ success: true, valid: true });
    } else {
      recordAuditLog({
        agentId: agentId || 'agent-me',
        agentName: agentName || 'Yo (Operador Actual)',
        event: 'security.pin_failed',
        category: 'Seguridad',
        severity: 'critical',
        details: 'Intento fallido de desbloqueo con PIN incorrecto'
      });
      res.status(401).json({ success: false, valid: false, error: 'PIN incorrecto' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/set-pin', (req, res) => {
  const db = getDb();
  const { currentPin, newPin, agentId, agentName } = req.body;
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 dígitos' });
  }
  try {
    const pinRow = db.prepare("SELECT value FROM settings WHERE key = 'security_pin'").get();
    const storedPin = pinRow ? pinRow.value : '1234';

    if (currentPin && currentPin !== storedPin) {
      return res.status(401).json({ error: 'El PIN actual es incorrecto' });
    }

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('security_pin', ?)").run(newPin);

    recordAuditLog({
      agentId: agentId || 'agent-me',
      agentName: agentName || 'Yo (Operador Actual)',
      event: 'security.pin_changed',
      category: 'Seguridad',
      severity: 'warning',
      details: 'El operador actualizó el PIN de seguridad de bloqueo de sesión'
    });

    res.json({ success: true, message: 'PIN actualizado exitosamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/security-settings', (req, res) => {
  const db = getDb();
  try {
    const timeoutRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_lock_minutes'").get();
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_lock_enabled'").get();
    res.json({
      autoLockMinutes: timeoutRow ? Number(timeoutRow.value) : 15,
      autoLockEnabled: enabledRow ? enabledRow.value === 'true' : true
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/auth/security-settings', (req, res) => {
  const db = getDb();
  const { autoLockMinutes, autoLockEnabled } = req.body;
  try {
    if (autoLockMinutes !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_lock_minutes', ?)").run(String(autoLockMinutes));
    }
    if (autoLockEnabled !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_lock_enabled', ?)").run(String(autoLockEnabled));
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Bot Flows Endpoints ---
app.get('/api/bots', (req, res) => {
  const db = getDb();
  try {
    const flows = db.prepare('SELECT * FROM bot_flows ORDER BY createdAt DESC').all();
    res.json(flows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bots', (req, res) => {
  const db = getDb();
  const { name, triggerKeyword, nodesJson, isActive = 1 } = req.body;
  if (!name?.trim() || !triggerKeyword?.trim()) {
    return res.status(400).json({ error: 'Nombre y palabra clave requeridos' });
  }
  const id = uuidv4();
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO bot_flows (id, name, triggerKeyword, isActive, nodesJson, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), triggerKeyword.trim(), isActive ? 1 : 0, nodesJson || '[]', now, now);
    const flow = db.prepare('SELECT * FROM bot_flows WHERE id = ?').get(id);
    broadcast({ type: 'bot_flow_created', flow });
    res.status(201).json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/bots/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, triggerKeyword, nodesJson, isActive } = req.body;
  const now = Date.now();
  try {
    const updates = ['updatedAt = ?'];
    const vals = [now];
    if (name !== undefined) { updates.push('name = ?'); vals.push(name.trim()); }
    if (triggerKeyword !== undefined) { updates.push('triggerKeyword = ?'); vals.push(triggerKeyword.trim()); }
    if (nodesJson !== undefined) { updates.push('nodesJson = ?'); vals.push(nodesJson); }
    if (isActive !== undefined) { updates.push('isActive = ?'); vals.push(isActive ? 1 : 0); }
    vals.push(id);

    db.prepare(`UPDATE bot_flows SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    const flow = db.prepare('SELECT * FROM bot_flows WHERE id = ?').get(id);
    broadcast({ type: 'bot_flow_updated', flow });
    res.json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bots/:id/toggle', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    const flow = db.prepare('SELECT * FROM bot_flows WHERE id = ?').get(id);
    if (!flow) return res.status(404).json({ error: 'Flujo no encontrado' });
    const nextState = flow.isActive ? 0 : 1;
    db.prepare('UPDATE bot_flows SET isActive = ?, updatedAt = ? WHERE id = ?').run(nextState, Date.now(), id);
    broadcast({ type: 'bot_flow_toggled', id, isActive: nextState });
    res.json({ success: true, id, isActive: nextState });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/bots/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM bot_flows WHERE id = ?').run(id);
    broadcast({ type: 'bot_flow_deleted', id });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- AI Summary ---
app.post('/api/ai-summary/:chatId', (req, res) => {
  const db = getDb();
  const msgs = db.prepare('SELECT * FROM messages WHERE chatId = ? AND isDeleted = 0 ORDER BY timestamp DESC LIMIT 50').all(req.params.chatId).reverse();
  if (msgs.length === 0) return res.json({ summary: 'No hay mensajes para resumir.' });
  const topics = [];
  const unread = msgs.filter(m => m.status !== 'read' && m.senderId !== 'me');
  const summary = unread.length > 0
    ? `📋 **Resumen del chat** (${unread.length} mensajes no leídos):\n\n` +
      unread.slice(-5).map(m => `• **${m.senderName || m.senderId}**: ${m.content?.slice(0, 100)}...`).join('\n') +
      `\n\n_Generado por WhatsApp Pro IA_`
    : `✅ **Sin mensajes nuevos** — Los últimos ${msgs.length} mensajes ya fueron leídos.\n\n_Generado por WhatsApp Pro IA_`;
  res.json({ summary, unreadCount: unread.length });
});


// --- Media Gallery ---
app.get('/api/chats/:chatId/media', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { type } = req.query; // 'image' | 'file' | 'audio' | 'link'

  let query, params = [chatId];

  if (type === 'image') {
    query = `SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type = 'image' OR filePath LIKE '%.png' OR filePath LIKE '%.jpg'
                   OR filePath LIKE '%.jpeg' OR filePath LIKE '%.gif' OR filePath LIKE '%.webp')
              ORDER BY timestamp DESC LIMIT 100`;
  } else if (type === 'file') {
    query = `SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0 AND type = 'file'
              ORDER BY timestamp DESC LIMIT 100`;
  } else if (type === 'audio') {
    query = `SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, duration, waveform, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0 AND type = 'audio'
              ORDER BY timestamp DESC LIMIT 100`;
  } else if (type === 'link') {
    query = `SELECT id, chatId, senderId, content, type, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type = 'link' OR (type = 'text' AND content LIKE '%http%'))
              ORDER BY timestamp DESC LIMIT 50`;
  } else {
    query = `SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type IN ('image','file','audio','link')
                   OR filePath LIKE '%.png' OR filePath LIKE '%.jpg' OR filePath LIKE '%.jpeg'
                   OR filePath LIKE '%.gif' OR filePath LIKE '%.webp')
              ORDER BY timestamp DESC LIMIT 150`;
  }

  try {
    res.json(db.prepare(query).all(...params));
  } catch (e) {
    console.error('/api/media error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Group Members ---
app.get('/api/chats/:chatId/members', (req, res) => {
  const db = getDb();
  const members = db.prepare(`
    SELECT gm.id, gm.chatId, gm.contactId, gm.role,
           CASE WHEN gm.role = 'admin' THEN 1 ELSE 0 END AS isAdmin,
           c.name, c.avatar, c.phone, c.status, c.isOnline
    FROM group_members gm
    JOIN contacts c ON gm.contactId = c.id
    WHERE gm.chatId = ?
  `).all(req.params.chatId);
  res.json(members);
});

// --- Search ---
app.get('/api/search', (req, res) => {
  const db = getDb();
  const { q, chatId } = req.query;
  if (!q || !q.trim()) return res.json([]);
  const term = q.trim();

  let query, params;
  if (chatId) {
    query = `
      SELECT m.*, c.groupName, c.type AS chatType, co.name AS contactName
      FROM messages m
      JOIN chats c ON m.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE m.chatId = ? AND m.content LIKE ? AND m.isDeleted = 0
      ORDER BY m.timestamp DESC LIMIT 50
    `;
    params = [chatId, `%${term}%`];
  } else {
    query = `
      SELECT m.id, m.chatId, m.senderId, m.senderName, m.content, m.type, m.timestamp, m.status,
             c.type AS chatType, c.groupName, c.groupAvatar,
             co.name AS contactName, co.avatar AS contactAvatar, co.isOnline AS contactIsOnline
      FROM messages m
      JOIN chats c ON m.chatId = c.id
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE m.content LIKE ? AND m.isDeleted = 0
      ORDER BY m.timestamp DESC LIMIT 60
    `;
    params = [`%${term}%`];
  }

  try {
    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Profile ---
app.get('/api/profile', (req, res) => {
  const db = getDb();
  try {
    let me = db.prepare("SELECT * FROM contacts WHERE id = 'me'").get();
    if (!me) {
      me = { id: 'me', name: 'Yo', phone: '+34 611 000 001', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me&backgroundColor=aaffaa', status: 'Usando WhatsApp Pro 🚀' };
    }
    res.json(me);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/profile', (req, res) => {
  const db = getDb();
  const { name, status, avatar } = req.body;
  try {
    db.prepare(`
      UPDATE contacts 
      SET name = COALESCE(?, name), status = COALESCE(?, status), avatar = COALESCE(?, avatar)
      WHERE id = 'me'
    `).run(name || null, status || null, avatar || null);

    const updated = db.prepare("SELECT * FROM contacts WHERE id = 'me'").get();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', clients: clients.size }));

// ─── Auth (session simulada — estado real en localStorage del cliente) ────────
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: true, user: { id: 'me', name: 'Yo', phone: '+34 600 000 000' } });
});
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

// ─── Voice Notes ─────────────────────────────────────────────────────────────
// Dedicated audio storage with mime-type filter
const audioStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = file.mimetype.includes('ogg') ? '.ogg'
              : file.mimetype.includes('mp4') ? '.mp4'
              : '.webm';
    cb(null, `voice-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  },
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
    cb(null, allowed.some(t => file.mimetype.startsWith('audio/')) || file.mimetype === 'application/octet-stream');
  },
});

app.post('/api/voice', audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file received' });

  const db  = getDb();
  const id  = uuidv4();
  const now = Date.now();

  const { chatId = 'ch1', senderId = 'me', senderName, duration = 0, waveform = '[]' } = req.body;

  const filePath = `/uploads/${req.file.filename}`;
  const fileSize = req.file.size;

  // Migrate table if columns don't exist yet (safe no-op when already present)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN duration INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN waveform TEXT DEFAULT '[]'`);
  } catch {}

  db.prepare(`
    INSERT INTO messages
      (id, chatId, senderId, senderName, content, type, timestamp, status,
       reactions, fileName, fileSize, filePath, duration, waveform)
    VALUES (?, ?, ?, ?, ?, 'audio', ?, 'sent', '{}', ?, ?, ?, ?, ?)
  `).run(
    id, chatId, senderId, senderName || null,
    '🎤 Nota de voz',
    now,
    req.file.originalname || req.file.filename,
    fileSize,
    filePath,
    parseInt(duration) || 0,
    waveform
  );

  db.prepare(
    "UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?"
  ).run('🎤 Nota de voz', now, chatId);

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  // Real-time broadcast to all OTHER clients
  broadcast({ type: 'new_message', chatId, message: msg });

  // Simulate delivery confirmation after 600ms
  setTimeout(() => {
    db.prepare("UPDATE messages SET status = 'delivered' WHERE id = ?").run(id);
    broadcast({ type: 'message_status', messageId: id, status: 'delivered', chatId });
  }, 600);

  res.status(201).json(msg);
});

// ─── Groups ──────────────────────────────────────────────────────────────────
app.post('/api/groups', (req, res) => {
  const db = getDb();
  const { name, avatar, memberIds = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del grupo es obligatorio' });

  const chatId = uuidv4();
  const now = Date.now();

  // Default avatar: dicebear identicon
  const finalAvatar = avatar && avatar.trim()
    ? avatar.trim()
    : `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=00897b`;

  // 1. Create chat
  db.prepare(`
    INSERT INTO chats (id, type, groupName, groupAvatar, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived)
    VALUES (?, 'group', ?, ?, ?, ?, 0, 0, 0, 0)
  `).run(chatId, name.trim(), finalAvatar, `Grupo creado`, now);

  // 2. Insert group members using existing schema (role column, not isAdmin)
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO group_members (id, chatId, contactId, role, joinedAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  // 'me' always admin
  insertMember.run(uuidv4(), chatId, 'me', 'admin', now);
  for (const contactId of memberIds) {
    if (contactId && contactId !== 'me') {
      insertMember.run(uuidv4(), chatId, contactId, 'member', now);
    }
  }

  // 3. System message
  const msgId = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, reactions)
    VALUES (?, ?, 'system', 'Sistema', ?, 'text', ?, 'read', '{}')
  `).run(msgId, chatId, `🎉 Grupo "${name.trim()}" creado`, now);

  // 4. Fetch complete chat + members
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  const members = db.prepare(`
    SELECT gm.id, gm.chatId, gm.contactId, gm.role,
           CASE WHEN gm.role = 'admin' THEN 1 ELSE 0 END AS isAdmin,
           c.name, c.avatar, c.phone, c.status, c.isOnline
    FROM group_members gm JOIN contacts c ON gm.contactId = c.id
    WHERE gm.chatId = ?
  `).all(chatId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);

  // 5. Broadcast to all WS clients
  broadcast({ type: 'new_group', chat: { ...chat, members }, message });

  res.status(201).json({ chat: { ...chat, members }, message });
});

// Add member to group
app.post('/api/chats/:chatId/members', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { contactId } = req.body;
  if (!contactId) return res.status(400).json({ error: 'contactId requerido' });

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });

  const existing = db.prepare('SELECT id FROM group_members WHERE chatId = ? AND contactId = ?').get(chatId, contactId);
  if (existing) return res.status(409).json({ error: 'El contacto ya es miembro' });

  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO group_members (id, chatId, contactId, role, joinedAt) VALUES (?, ?, ?, ?, ?)').run(id, chatId, contactId, 'member', now);

  // System message
  const msgId = uuidv4();
  db.prepare(`INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, reactions)
    VALUES (?, ?, 'system', 'Sistema', ?, 'text', ?, 'read', '{}')
  `).run(msgId, chatId, `➕ ${contact.name} se unió al grupo`, now);

  const member = db.prepare(`
    SELECT gm.id, gm.chatId, gm.contactId, gm.role,
           CASE WHEN gm.role = 'admin' THEN 1 ELSE 0 END AS isAdmin,
           c.name, c.avatar, c.phone, c.status, c.isOnline
    FROM group_members gm JOIN contacts c ON gm.contactId = c.id
    WHERE gm.id = ?
  `).get(id);

  broadcast({ type: 'member_added', chatId, member, messageId: msgId });
  res.status(201).json({ member });
});

// Remove member from group
app.delete('/api/chats/:chatId/members/:contactId', (req, res) => {
  const db = getDb();
  const { chatId, contactId } = req.params;

  const member = db.prepare(`
    SELECT gm.*, c.name FROM group_members gm JOIN contacts c ON gm.contactId = c.id
    WHERE gm.chatId = ? AND gm.contactId = ?
  `).get(chatId, contactId);
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  db.prepare('DELETE FROM group_members WHERE chatId = ? AND contactId = ?').run(chatId, contactId);

  const msgId = uuidv4();
  const now = Date.now();
  db.prepare(`INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, reactions)
    VALUES (?, ?, 'system', 'Sistema', ?, 'text', ?, 'read', '{}')
  `).run(msgId, chatId, `➖ ${member.name} salió del grupo`, now);

  broadcast({ type: 'member_removed', chatId, contactId, memberName: member.name });
  res.json({ success: true });
});

// --- Calls History ---
app.get('/api/calls', (req, res) => {
  const db = getDb();
  try {
    const calls = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar
      FROM calls c
      LEFT JOIN contacts co ON (c.receiverId = co.id OR (c.callerId = co.id AND c.callerId != 'me'))
      ORDER BY c.timestamp DESC LIMIT 50
    `).all();
    res.json(calls);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/calls', (req, res) => {
  const db = getDb();
  const { callerId = 'me', receiverId = 'unknown', chatId, type = 'voice', status = 'completed', duration = 0 } = req.body;
  const id = uuidv4();
  const timestamp = Date.now();
  try {
    db.prepare(`
      INSERT INTO calls (id, callerId, receiverId, chatId, type, status, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, callerId, receiverId, chatId || null, type, status, duration, timestamp);
    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);
    res.status(201).json(call);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Init & Start ────────────────────────────────────────────────────────────
initDatabase();

// ─── Schema migrations (safe, idempotent) ────────────────────────────────────
(function runMigrations() {
  const db = getDb();
  // Ensure calls table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        callerId TEXT NOT NULL,
        receiverId TEXT NOT NULL,
        chatId TEXT,
        type TEXT DEFAULT 'voice',
        status TEXT DEFAULT 'completed',
        duration INTEGER DEFAULT 0,
        timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
  } catch {}
  // Ensure statuses table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS statuses (
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        text TEXT,
        mediaUrl TEXT,
        background TEXT,
        timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    const count = db.prepare('SELECT COUNT(*) as c FROM statuses').get();
    if (count.c === 0) {
      const now = Date.now();
      const insertStatus = db.prepare('INSERT INTO statuses (id, contactId, text, mediaUrl, background, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
      insertStatus.run(uuidv4(), 'c1', '¡Disfrutando del fin de semana soleado! ☀️🏖️', null, 'bg-gradient-to-br from-teal-600 to-emerald-800', now - 1800000);
      insertStatus.run(uuidv4(), 'c2', '🚀 Nuevo release de WhatsApp Pro desplegado con éxito', null, 'bg-gradient-to-br from-indigo-700 to-purple-900', now - 3600000);
      insertStatus.run(uuidv4(), 'c3', '☕ Mucho café y buen código hoy!', null, 'bg-gradient-to-br from-amber-700 to-orange-900', now - 7200000);
    }
  } catch {}
  // Add isAdmin column to group_members if missing (older schema has 'role' only)
  try { db.exec(`ALTER TABLE group_members ADD COLUMN isAdmin INTEGER DEFAULT 0`); } catch {}
  // Backfill isAdmin from role
  try { db.exec(`UPDATE group_members SET isAdmin = CASE WHEN role = 'admin' THEN 1 ELSE 0 END WHERE isAdmin IS NULL OR (isAdmin = 0 AND role = 'admin')`); } catch {}

  // Ensure starred_messages table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS starred_messages (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        chatId TEXT NOT NULL,
        starredAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        UNIQUE(chatId, messageId),
        FOREIGN KEY (chatId) REFERENCES chats(id),
        FOREIGN KEY (messageId) REFERENCES messages(id)
      );
    `);
  } catch {}

  // Ensure broadcast tables exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS broadcast_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE TABLE IF NOT EXISTS broadcast_members (
        id TEXT PRIMARY KEY,
        broadcastId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        UNIQUE(broadcastId, contactId),
        FOREIGN KEY (broadcastId) REFERENCES broadcast_lists(id),
        FOREIGN KEY (contactId) REFERENCES contacts(id)
      );
    `);
    const bCount = db.prepare('SELECT COUNT(*) as c FROM broadcast_lists').get();
    if (bCount.c === 0) {
      const bId = uuidv4();
      db.prepare('INSERT INTO broadcast_lists (id, name) VALUES (?, ?)').run(bId, 'Clientes VIP');
      db.prepare('INSERT INTO broadcast_members (id, broadcastId, contactId) VALUES (?, ?, ?)').run(uuidv4(), bId, 'c1');
      db.prepare('INSERT INTO broadcast_members (id, broadcastId, contactId) VALUES (?, ?, ?)').run(uuidv4(), bId, 'c2');
    }
  } catch {}

  // Ensure disappearingTimer column on chats
  try { db.exec(`ALTER TABLE chats ADD COLUMN disappearingTimer INTEGER DEFAULT 0`); } catch {}

  // Ensure quick_replies table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quick_replies (
        id TEXT PRIMARY KEY,
        shortcut TEXT NOT NULL UNIQUE,
        message TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    const qrCount = db.prepare('SELECT COUNT(*) as c FROM quick_replies').get();
    if (qrCount.c === 0) {
      const insQr = db.prepare('INSERT INTO quick_replies (id, shortcut, message, category) VALUES (?, ?, ?, ?)');
      insQr.run(uuidv4(), '/hola', '¡Hola! Gracias por comunicarte con WhatsApp Pro Business. ¿En qué podemos ayudarte hoy? 👋', 'saludos');
      insQr.run(uuidv4(), '/precio', 'Nuestros planes comienzan desde 29,99€/mes con todas las herramientas de negocio incluidas 💼', 'ventas');
      insQr.run(uuidv4(), '/horario', 'Nuestro horario de atención es de Lunes a Viernes de 9:00 a 19:00 hrs (CET) 🕘', 'informacion');
      insQr.run(uuidv4(), '/ubicacion', 'Nuestras oficinas centrales están en Paseo de la Castellana 100, Madrid, España 📍', 'informacion');
      insQr.run(uuidv4(), '/catalogo', 'Puedes consultar nuestro catálogo oficial actualizado en https://whatsapp-pro.store 🛍️', 'ventas');
      insQr.run(uuidv4(), '/pago', 'Aceptamos pagos seguros vía Tarjeta (Stripe), PayPal, Bizum y Transferencia bancaria 💳', 'ventas');
      insQr.run(uuidv4(), '/soporte', 'Para soporte técnico prioritario, escribe a soporte@whatsapppro.io o déjanos tu consulta aquí 🛠️', 'soporte');
    }
  } catch {}

  // Ensure business_catalog table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_catalog (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        imageUrl TEXT,
        inStock INTEGER DEFAULT 1,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    const catCount = db.prepare('SELECT COUNT(*) as c FROM business_catalog').get();
    if (catCount.c === 0) {
      const insCat = db.prepare('INSERT INTO business_catalog (id, title, description, price, currency, imageUrl, inStock) VALUES (?, ?, ?, ?, ?, ?, ?)');
      insCat.run(
        uuidv4(),
        'Plan WhatsApp Pro Business',
        'Automatización multicanal, respuestas rápidas, catálogo interactivo y llamadas HD ilimitadas.',
        29.99,
        'EUR',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80',
        1
      );
      insCat.run(
        uuidv4(),
        'Setup y Migración Enterprise',
        'Configuración integral para empresas, importación de contactos y flujos de ventas personalizados.',
        149.00,
        'EUR',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
        1
      );
      insCat.run(
        uuidv4(),
        'Licencia Anual Pro (Ahorra 2 meses)',
        'Acceso total a WhatsApp Pro por 12 meses con soporte VIP 24/7 y SLA del 99.9% garantizado.',
        249.00,
        'EUR',
        'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80',
        1
      );
      insCat.run(
        uuidv4(),
        'Bot de IA Gemini Flash Personalizado',
        'Asistente inteligente entrenado con el catálogo, tarifas y preguntas frecuentes de tu empresa.',
        89.00,
        'EUR',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
        1
      );
    }
  } catch {}

  // Ensure linked_devices table exists and seed
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS linked_devices (
        id TEXT PRIMARY KEY,
        deviceName TEXT NOT NULL,
        browser TEXT,
        os TEXT,
        ip TEXT,
        location TEXT,
        lastActive INTEGER,
        isCurrent INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    const devCount = db.prepare('SELECT COUNT(*) as c FROM linked_devices').get();
    if (devCount.c === 0) {
      const insDev = db.prepare('INSERT INTO linked_devices (id, deviceName, browser, os, ip, location, lastActive, isCurrent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const now = Date.now();
      insDev.run('dev-current', 'Windows 11 · Google Chrome', 'Chrome 122', 'Windows 11', '192.168.1.104', 'Madrid, España', now, 1, now - 30 * 86400000);
      insDev.run('dev-mac', 'MacBook Pro · Safari', 'Safari 17.3', 'macOS Sonoma', '88.26.14.90', 'Barcelona, España', now - 15 * 60000, 0, now - 7 * 86400000);
      insDev.run('dev-ipad', 'iPad Pro · WhatsApp Web', 'Safari Mobile', 'iPadOS 17', '192.168.1.18', 'Madrid, España', now - 4 * 3600000, 0, now - 14 * 86400000);
      insDev.run('dev-linux', 'Ubuntu Linux · Firefox', 'Firefox 123', 'Ubuntu 22.04', '213.97.44.80', 'Valencia, España', now - 2 * 86400000, 0, now - 20 * 86400000);
    }
  } catch (e) {
    console.error('Error migrating linked_devices:', e.message);
  }

  // Ensure locked_chats table exists and default settings
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS locked_chats (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL UNIQUE,
        lockedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );
    `);
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('chatLockPin', '1234')").run();
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('chatLockEnabled', 'true')").run();
  } catch (e) {
    console.error('Error migrating locked_chats:', e.message);
  }

  // Ensure custom_stickers table exists and seed
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_stickers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        imageUrl TEXT NOT NULL,
        category TEXT DEFAULT 'custom',
        isFavorite INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    const stkCount = db.prepare('SELECT COUNT(*) as c FROM custom_stickers').get();
    if (stkCount.c === 0) {
      const insStk = db.prepare('INSERT INTO custom_stickers (id, name, imageUrl, category, isFavorite, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
      const now = Date.now();
      const defaultStickers = [
        { name: 'Gato Chill 😺', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChillCat&backgroundColor=b6e3f4' },
        { name: 'Robot Feliz 🤖', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=HappyBot&backgroundColor=d1d4f9' },
        { name: 'Perro Gamer 🐶', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GamerDog&backgroundColor=ffdfbf' },
        { name: 'Fuego Pro 🔥', url: 'https://api.dicebear.com/7.x/icons/svg?seed=FirePro&backgroundColor=ffd5dc' },
        { name: 'Monstruo Fiesta 👾', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PartyMonster&backgroundColor=c0aede' },
        { name: 'Alien Tech 👽', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AlienTech&backgroundColor=aaffaa' },
        { name: 'Super Estrella ⭐', url: 'https://api.dicebear.com/7.x/icons/svg?seed=StarPower&backgroundColor=fef08a' },
        { name: 'Gafas de Sol 😎', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CoolVibe&backgroundColor=fed7aa' },
      ];
      defaultStickers.forEach((s, idx) => {
        insStk.run(uuidv4(), s.name, s.url, 'popular', 1, now - (idx * 60000));
      });
    }
  } catch (e) {
    console.error('Error migrating custom_stickers:', e.message);
  }

  // Ensure CRM and Scheduled Messages tables exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS crm_stages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#10b981',
        order_index INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS chat_stage_relations (
        chatId TEXT PRIMARY KEY,
        stageId TEXT NOT NULL,
        dealValue REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id),
        FOREIGN KEY (stageId) REFERENCES crm_stages(id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        senderId TEXT DEFAULT 'me',
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        scheduledTime INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );
    `);

    const stageCount = db.prepare('SELECT COUNT(*) as c FROM crm_stages').get();
    if (stageCount.c === 0) {
      const insStage = db.prepare('INSERT INTO crm_stages (id, name, color, order_index, createdAt) VALUES (?, ?, ?, ?, ?)');
      const now = Date.now();
      insStage.run('stage-1', 'Nuevos Leads', '#3b82f6', 0, now - 4000);
      insStage.run('stage-2', 'En Conversación', '#f59e0b', 1, now - 3000);
      insStage.run('stage-3', 'Propuesta Enviada', '#8b5cf6', 2, now - 2000);
      insStage.run('stage-4', 'Clientes Cerrados', '#10b981', 3, now - 1000);

      const insRel = db.prepare('INSERT OR REPLACE INTO chat_stage_relations (chatId, stageId, dealValue, notes, updatedAt) VALUES (?, ?, ?, ?, ?)');
      insRel.run('ch1', 'stage-2', 149.00, 'Interesada en plan anual enterprise', now);
      insRel.run('ch2', 'stage-3', 249.00, 'Presupuesto formal enviado', now);
      insRel.run('ch3', 'stage-4', 499.00, 'Cliente corporativo cerrado', now);
      insRel.run('ch6', 'stage-1', 89.00, 'Consulta inicial de bot de IA', now);
    }
  } catch (e) {
    console.error('Error migrating CRM & Scheduled Messages:', e.message);
  }

  // Ensure campaigns and bot_flows tables exist and seed
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template TEXT NOT NULL,
        mediaUrl TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        targetAudience TEXT DEFAULT 'all',
        scheduledAt INTEGER DEFAULT NULL,
        sentCount INTEGER DEFAULT 0,
        deliveredCount INTEGER DEFAULT 0,
        readCount INTEGER DEFAULT 0,
        replyCount INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS campaign_logs (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        chatId TEXT NOT NULL,
        status TEXT DEFAULT 'delivered',
        sentAt INTEGER,
        FOREIGN KEY (campaignId) REFERENCES campaigns(id)
      );

      CREATE TABLE IF NOT EXISTS bot_flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        triggerKeyword TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        nodesJson TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);

    const campCount = db.prepare('SELECT COUNT(*) as c FROM campaigns').get();
    if (campCount.c === 0) {
      const now = Date.now();
      db.prepare(`
        INSERT INTO campaigns (id, name, template, status, targetAudience, sentCount, deliveredCount, readCount, replyCount, createdAt)
        VALUES (?, ?, ?, 'completed', 'all', 5, 5, 4, 2, ?)
      `).run(
        'camp-1',
        'Oferta Especial Pro & Enterprise',
        '¡Hola {{nombre}}! 🎁 Tenemos un 30% de descuento exclusivo en licencias WhatsApp Pro para ti hoy. ¿Te gustaría conocer los detalles?',
        now - 86400000
      );
    }

    const botCount = db.prepare('SELECT COUNT(*) as c FROM bot_flows').get();
    if (botCount.c === 0) {
      const now = Date.now();
      const defaultNodes = [
        {
          id: 'node-1',
          type: 'trigger',
          title: 'Palabra clave entrante',
          data: { keywords: ['hola', 'info', 'ayuda', 'catalogo', 'menu'] }
        },
        {
          id: 'node-2',
          type: 'message',
          title: 'Mensaje de Bienvenida',
          data: {
            text: '¡Hola! Bienvenido a WhatsApp Pro Business 🤖. Por favor, selecciona una opción respondiendo con el número correspondiente:',
            options: [
              { id: 'opt-1', label: 'Ver catálogo y productos', action: 'show_catalog' },
              { id: 'opt-2', label: 'Consultar horarios y ubicación', action: 'show_info' },
              { id: 'opt-3', label: 'Hablar con un asesor comercial', action: 'transfer_agent' }
            ]
          }
        }
      ];
      db.prepare(`
        INSERT INTO bot_flows (id, name, triggerKeyword, isActive, nodesJson, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, ?, ?, ?)
      `).run('flow-1', 'Bot de Bienvenida y Menú Principal', 'hola, info, ayuda, catalogo, menu', JSON.stringify(defaultNodes), now, now);
    }
  } catch (e) {
    console.error('Error migrating campaigns and bot_flows:', e.message);
  }

  // --- Migration: Omnichannel, Agents & Internal Notes ---
  try {
    const chatColumns = db.prepare("PRAGMA table_info(chats)").all().map(c => c.name);
    if (!chatColumns.includes('channel')) {
      db.prepare("ALTER TABLE chats ADD COLUMN channel TEXT DEFAULT 'whatsapp'").run();
    }
    if (!chatColumns.includes('status')) {
      db.prepare("ALTER TABLE chats ADD COLUMN status TEXT DEFAULT 'open'").run();
    }
    if (!chatColumns.includes('assignedAgentId')) {
      db.prepare("ALTER TABLE chats ADD COLUMN assignedAgentId TEXT DEFAULT NULL").run();
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'Soporte',
        avatar TEXT,
        status TEXT DEFAULT 'online',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS chat_assignments (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        assignedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        assignedBy TEXT DEFAULT 'Sistema',
        notes TEXT,
        FOREIGN KEY (chatId) REFERENCES chats(id),
        FOREIGN KEY (agentId) REFERENCES agents(id)
      );

      CREATE TABLE IF NOT EXISTS internal_notes (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        authorId TEXT DEFAULT 'agent-me',
        authorName TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );
    `);

    // Seed default agents if empty
    const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get();
    if (agentCount.c === 0) {
      const now = Date.now();
      const insertAgent = db.prepare(`
        INSERT INTO agents (id, name, email, role, avatar, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertAgent.run('agent-me', 'Yo (Operador Actual)', 'operador@whatsapp-pro.io', 'Super Admin / Coordinador', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80', 'online', now);
      insertAgent.run('agent-1', 'Juan Carlos', 'jcarlos@soporte.com', 'Soporte Técnico Nivel 2', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', 'online', now);
      insertAgent.run('agent-2', 'Úrsula Morales', 'ursula@ventas.com', 'Ventas Enterprise & Key Accounts', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80', 'online', now);
      insertAgent.run('agent-3', 'Soporte Técnico', 'soporte@empresa.com', 'Mesa de Ayuda General', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80', 'busy', now);
    }

    // Seed or distribute channel, status & agent assignment to existing chats
    const allChats = db.prepare('SELECT id, channel, status, assignedAgentId FROM chats ORDER BY lastMessageTime DESC').all();
    if (allChats.length > 0) {
      const channels = ['whatsapp', 'telegram', 'web', 'whatsapp', 'telegram', 'web'];
      const statuses = ['open', 'open', 'pending', 'resolved', 'open', 'pending'];
      const agents = ['agent-me', 'agent-1', 'agent-2', null, 'agent-me', null];
      allChats.forEach((c, idx) => {
        const chan = c.channel || channels[idx % channels.length];
        const stat = c.status || statuses[idx % statuses.length];
        const ag = (c.assignedAgentId !== undefined && c.assignedAgentId !== null) ? c.assignedAgentId : agents[idx % agents.length];
        db.prepare('UPDATE chats SET channel = ?, status = ?, assignedAgentId = ? WHERE id = ?')
          .run(chan, stat, ag, c.id);
      });
    }

    // Seed sample internal note if empty
    const noteCount = db.prepare('SELECT COUNT(*) as c FROM internal_notes').get();
    if (noteCount.c === 0 && allChats.length > 0) {
      const now = Date.now();
      const firstChatId = allChats[0].id;
      db.prepare(`
        INSERT INTO internal_notes (id, chatId, authorId, authorName, content, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('note-demo-1', firstChatId, 'agent-1', 'Juan Carlos', '📌 Nota interna: Cliente interesado en el paquete Enterprise para 20 operadores. Requiere integración API y facturación mensual.', now - 3600000);

      if (allChats.length > 1) {
        db.prepare(`
          INSERT INTO internal_notes (id, chatId, authorId, authorName, content, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('note-demo-2', allChats[1].id, 'agent-2', 'Úrsula Morales', '⚡ Nota de seguimiento: Ticket derivado a ventas con alta prioridad. SLA de respuesta: antes de 2 horas.', now - 1800000);
      }
    }
  } catch (e) {
    console.error('Error migrating omnichannel, agents & internal notes:', e.message);
  }

  // --- Migration: Payments, Sentiment Logs & Webhooks ---
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'PEN',
        concept TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        qrCode TEXT,
        transactionId TEXT,
        customerPhone TEXT,
        paidAt INTEGER,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );

      CREATE TABLE IF NOT EXISTS sentiment_logs (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        sentiment TEXT NOT NULL,
        score REAL DEFAULT 0,
        keywords TEXT,
        analyzedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );

      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        name TEXT,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT,
        isActive INTEGER DEFAULT 1,
        failureCount INTEGER DEFAULT 0,
        successCount INTEGER DEFAULT 0,
        retryCount INTEGER DEFAULT 3,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY,
        webhookId TEXT,
        url TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT,
        responseStatus INTEGER,
        responseBody TEXT,
        duration_ms INTEGER DEFAULT 0,
        attempt INTEGER DEFAULT 1,
        status TEXT DEFAULT 'success',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        keyPrefix TEXT NOT NULL,
        keyHash TEXT NOT NULL,
        scopes TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        usageCount INTEGER DEFAULT 0,
        lastUsedAt INTEGER,
        expiresAt INTEGER,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);

    // Safe Alter Columns for existing webhooks & webhook_logs tables
    try { db.exec("ALTER TABLE webhooks ADD COLUMN name TEXT;"); } catch {}
    try { db.exec("ALTER TABLE webhooks ADD COLUMN failureCount INTEGER DEFAULT 0;"); } catch {}
    try { db.exec("ALTER TABLE webhooks ADD COLUMN successCount INTEGER DEFAULT 0;"); } catch {}
    try { db.exec("ALTER TABLE webhooks ADD COLUMN retryCount INTEGER DEFAULT 3;"); } catch {}
    try { db.exec("ALTER TABLE webhook_logs ADD COLUMN duration_ms INTEGER DEFAULT 0;"); } catch {}
    try { db.exec("ALTER TABLE webhook_logs ADD COLUMN attempt INTEGER DEFAULT 1;"); } catch {}
    try { db.exec("ALTER TABLE webhook_logs ADD COLUMN status TEXT DEFAULT 'success';"); } catch {}

    // Seed default demo API Key
    const apiKeyCount = db.prepare('SELECT COUNT(*) as c FROM api_keys').get();
    if (apiKeyCount.c === 0) {
      const defaultKey = 'chasky_live_8f39b1a0d7249c5e82410a8b417c';
      const defaultHash = crypto.createHash('sha256').update(defaultKey).digest('hex');
      db.prepare(`
        INSERT INTO api_keys (id, name, keyPrefix, keyHash, scopes, status, usageCount, lastUsedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, 'active', 142, ?, ?)
      `).run(
        'key-prod-1',
        'Producción CRM & ERP (Zapier / Make)',
        'chasky_live_8f39...••••',
        defaultHash,
        JSON.stringify(['chats:read', 'messages:send', 'contacts:manage', 'payments:create', 'webhooks:manage']),
        Date.now() - 900000,
        Date.now() - 86400000 * 7
      );
    }

    // Seed default webhook if none
    const hookCount = db.prepare('SELECT COUNT(*) as c FROM webhooks').get();
    if (hookCount.c === 0) {
      db.prepare(`
        INSERT INTO webhooks (id, name, url, events, secret, isActive, successCount, failureCount, retryCount, createdAt)
        VALUES (?, ?, ?, ?, ?, 1, 38, 2, 3, ?)
      `).run('wh-default', 'Zapier CRM Sync (Producción)', 'https://api.crm-enterprise.com/webhooks/whatsapp', 'payment.completed,ticket.status_changed,message.sent,csat.submitted', 'whsec_whatsapp_pro_key_9942', Date.now() - 86400000);

      db.prepare(`
        INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
        VALUES (?, ?, ?, ?, ?, 200, '{"received": true, "status": "processed"}', 48, 1, 'success', ?)
      `).run('wh-log-1', 'wh-default', 'https://api.crm-enterprise.com/webhooks/whatsapp', 'payment.completed', '{"paymentId": "pay-demo-1", "amount": 120.00, "currency": "PEN", "status": "paid"}', Date.now() - 3600000 * 2);

      db.prepare(`
        INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
        VALUES (?, ?, ?, ?, ?, 200, '{"received": true}', 32, 1, 'success', ?)
      `).run('wh-log-2', 'wh-default', 'https://api.crm-enterprise.com/webhooks/whatsapp', 'message.sent', '{"chatId": "ch1", "content": "Hola! Tu pedido ha sido confirmado", "status": "sent"}', Date.now() - 1800000);

      db.prepare(`
        INSERT INTO webhook_logs (id, webhookId, url, event, payload, responseStatus, responseBody, duration_ms, attempt, status, createdAt)
        VALUES (?, ?, ?, ?, ?, 500, 'Internal Server Error at CRM endpoint', 1200, 2, 'failed', ?)
      `).run('wh-log-3', 'wh-default', 'https://api.crm-enterprise.com/webhooks/whatsapp', 'sentiment.urgent', '{"chatId": "ch2", "sentiment": "negative", "urgent": true}', Date.now() - 600000);
    } else {
      // Ensure name is set for existing default webhook
      try {
        db.prepare("UPDATE webhooks SET name = 'Zapier CRM Sync (Producción)' WHERE id = 'wh-default' AND (name IS NULL OR name = '')").run();
      } catch {}
    }

    // Seed demo payments if none
    const payCount = db.prepare('SELECT COUNT(*) as c FROM payments').get();
    if (payCount.c === 0) {
      const now = Date.now();
      db.prepare(`
        INSERT INTO payments (id, chatId, amount, currency, concept, method, status, transactionId, paidAt, createdAt)
        VALUES (?, 'ch1', 120.00, 'PEN', 'Plan WhatsApp Pro Mensual (3 Agentes)', 'yape', 'paid', 'YAPE-948271', ?, ?)
      `).run('pay-demo-1', now - 7200000, now - 86400000);

      db.prepare(`
        INSERT INTO payments (id, chatId, amount, currency, concept, method, status, transactionId, paidAt, createdAt)
        VALUES (?, 'ch2', 45.00, 'PEN', 'Renovación Catálogo Digital', 'plin', 'pending', 'PLIN-382910', NULL, ?)
      `).run('pay-demo-2', now - 1800000);
    }

    // --- WhatsApp Business Suite: Labels, Business Profile & Orders (Meta Native) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        orderIndex INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS chat_labels (
        chatId TEXT NOT NULL,
        labelId TEXT NOT NULL,
        assignedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        PRIMARY KEY (chatId, labelId),
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (labelId) REFERENCES labels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS business_profile (
        id TEXT PRIMARY KEY,
        businessName TEXT NOT NULL,
        category TEXT DEFAULT 'Tecnología & Software',
        description TEXT,
        address TEXT,
        email TEXT,
        website TEXT,
        isVerified INTEGER DEFAULT 1,
        verifiedName TEXT,
        businessHours TEXT,
        greetingEnabled INTEGER DEFAULT 1,
        greetingMessage TEXT,
        awayEnabled INTEGER DEFAULT 1,
        awayMessage TEXT,
        updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        orderNumber TEXT NOT NULL UNIQUE,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        currency TEXT DEFAULT 'PEN',
        status TEXT DEFAULT 'pending',
        customerNotes TEXT,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );
    `);

    // Seed default WhatsApp Business labels
    const labelCount = db.prepare('SELECT COUNT(*) as c FROM labels').get();
    if (labelCount.c === 0) {
      const defaultLabels = [
        { id: 'lbl-new-lead', name: 'Nuevo cliente', color: '#eab308', orderIndex: 1 },
        { id: 'lbl-new-order', name: 'Nuevo pedido', color: '#3b82f6', orderIndex: 2 },
        { id: 'lbl-pending-pay', name: 'Pago pendiente', color: '#f97316', orderIndex: 3 },
        { id: 'lbl-paid', name: 'Pagado', color: '#22c55e', orderIndex: 4 },
        { id: 'lbl-completed', name: 'Pedido completado', color: '#a855f7', orderIndex: 5 },
        { id: 'lbl-important', name: 'Lead prioritario', color: '#ef4444', orderIndex: 6 },
      ];
      const insLbl = db.prepare('INSERT INTO labels (id, name, color, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?)');
      defaultLabels.forEach(l => insLbl.run(l.id, l.name, l.color, l.orderIndex, Date.now()));

      // Seed initial chat labels
      const insChatLbl = db.prepare('INSERT OR IGNORE INTO chat_labels (chatId, labelId, assignedAt) VALUES (?, ?, ?)');
      insChatLbl.run('ch1', 'lbl-paid', Date.now());
      insChatLbl.run('ch1', 'lbl-new-order', Date.now());
      insChatLbl.run('ch2', 'lbl-new-lead', Date.now());
      insChatLbl.run('ch3', 'lbl-pending-pay', Date.now());
      insChatLbl.run('ch4', 'lbl-important', Date.now());
    }

    // Seed default Meta business profile
    const bpCount = db.prepare('SELECT COUNT(*) as c FROM business_profile').get();
    if (bpCount.c === 0) {
      const hours = JSON.stringify({
        enabled: true,
        days: {
          lunes: { open: '08:30', close: '19:00', active: true },
          martes: { open: '08:30', close: '19:00', active: true },
          miercoles: { open: '08:30', close: '19:00', active: true },
          jueves: { open: '08:30', close: '19:00', active: true },
          viernes: { open: '08:30', close: '19:00', active: true },
          sabado: { open: '09:00', close: '14:00', active: true },
          domingo: { open: '00:00', close: '00:00', active: false }
        }
      });

      db.prepare(`
        INSERT INTO business_profile (id, businessName, category, description, address, email, website, isVerified, verifiedName, businessHours, greetingEnabled, greetingMessage, awayEnabled, awayMessage, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'bp-main',
        'WhatsApp Pro Enterprise',
        'Tecnología, CRM & Software SaaS',
        'Solución integral omnicanal para empresas con integración oficial a pasarelas de pago y automatización con IA.',
        'Av. Javier Prado Este 4200, San Isidro, Lima, Perú',
        'soporte@whatsapppro.io',
        'https://whatsapppro.io',
        1,
        'WhatsApp Pro Enterprise S.A.C.',
        hours,
        1,
        '¡Hola! 👋 Gracias por comunicarte con WhatsApp Pro Enterprise. ¿En qué podemos asesorarte hoy?',
        1,
        '¡Hola! En este momento estamos fuera del horario de atención comercial. Déjanos tu consulta y te responderemos con la máxima prioridad tan pronto abramos.',
        Date.now()
      );
    }

    // Seed demo orders if none
    const ordCount = db.prepare('SELECT COUNT(*) as c FROM orders').get();
    if (ordCount.c === 0) {
      const demoItems = JSON.stringify([
        { id: 'item-1', title: 'Plan WhatsApp Pro Anual (5 Agentes)', price: 250.00, quantity: 1, currency: 'PEN' },
        { id: 'item-2', title: 'Setup de Pasarela Yape/Plin Integrada', price: 45.00, quantity: 1, currency: 'PEN' }
      ]);
      db.prepare(`
        INSERT INTO orders (id, chatId, orderNumber, items, subtotal, total, currency, status, customerNotes, createdAt, updatedAt)
        VALUES (?, 'ch1', 'PED-789012', ?, 295.00, 295.00, 'PEN', 'preparing', 'Entrega prioritaria y credenciales de acceso', ?, ?)
      `).run('ord-demo-1', demoItems, Date.now() - 3600000, Date.now() - 1800000);
    }
    // --- Voice Transcriptions & CSAT Surveys Tables (CHASKYAPP AI) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS voice_transcriptions (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL UNIQUE,
        audioUrl TEXT,
        transcription TEXT NOT NULL,
        language TEXT DEFAULT 'es',
        languageName TEXT DEFAULT 'Español',
        confidence REAL DEFAULT 0.98,
        duration REAL DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS csat_surveys (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        rating INTEGER DEFAULT 0,
        comment TEXT,
        agentId TEXT,
        customerPhone TEXT,
        channel TEXT DEFAULT 'whatsapp',
        status TEXT DEFAULT 'pending',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );
    `);

    // Seed demo CSAT surveys if none
    const csatCount = db.prepare('SELECT COUNT(*) as c FROM csat_surveys').get();
    if (csatCount.c === 0) {
      const insCsat = db.prepare(`
        INSERT INTO csat_surveys (id, chatId, rating, comment, agentId, customerPhone, channel, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
      `);
      const now = Date.now();
      insCsat.run('csat-demo-1', 'ch1', 5, '¡Excelente atención! Me ayudaron a activar los cobros por Yape y Plin en menos de 5 minutos.', 'agent-me', '+34 612 345 678', 'whatsapp', now - 86400000 * 2);
      insCsat.run('csat-demo-2', 'ch2', 5, 'Muy rápido y claro. La integración con Webhooks y la API externa funciona de maravilla.', 'agent-me', '+34 698 765 432', 'telegram', now - 86400000 * 3);
      insCsat.run('csat-demo-3', 'ch3', 4, 'Buena experiencia, resolvieron las consultas técnicas de mi equipo con total amabilidad.', 'agent-me', '+34 677 234 567', 'whatsapp', now - 86400000 * 4);
      insCsat.run('csat-demo-4', 'ch4', 5, 'El motor anti-baneo y los envíos masivos nos ahorraron horas de trabajo.', 'agent-me', '+34 655 876 543', 'web', now - 86400000 * 5);
      insCsat.run('csat-demo-5', 'ch1', 4, 'Todo perfecto con el catálogo digital.', 'agent-me', '+34 612 345 678', 'whatsapp', now - 86400000 * 6);
    }

    // --- RBAC & Audit Logs Migration (CHASKYAPP Security Suite) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL,
        isSystem INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        userId TEXT NOT NULL,
        roleId TEXT NOT NULL,
        assignedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
        PRIMARY KEY (userId, roleId)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        agentId TEXT,
        agentName TEXT NOT NULL,
        event TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        severity TEXT DEFAULT 'info',
        details TEXT NOT NULL,
        ipAddress TEXT DEFAULT '127.0.0.1',
        deviceInfo TEXT DEFAULT 'Desktop Web',
        createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);

    // Seed default permissions if none
    const permCount = db.prepare('SELECT COUNT(*) as c FROM permissions').get();
    if (permCount.c === 0) {
      const insPerm = db.prepare('INSERT INTO permissions (id, category, name, description) VALUES (?, ?, ?, ?)');
      const defaultPerms = [
        ['roles:manage', 'Seguridad', 'Administrar Roles y Permisos', 'Capacidad de editar la matriz de roles y asignar roles a los usuarios'],
        ['security:audit_logs', 'Seguridad', 'Ver Logs de Auditoría', 'Acceso al registro histórico de eventos de seguridad y acciones críticas'],
        ['chats:export', 'Mensajería', 'Exportar Historial de Chats', 'Permiso para exportar transcripciones completas de chat a TXT o JSON'],
        ['messages:delete', 'Mensajería', 'Eliminar Mensajes', 'Capacidad de borrar mensajes enviados en cualquier conversación'],
        ['campaigns:bulk_send', 'Campañas', 'Envíos Masivos (Excel / Pegar)', 'Crear y disparar difusiones comerciales con motor anti-baneo'],
        ['payments:create', 'Finanzas', 'Generar Links de Cobro', 'Crear solicitudes de pago interactivas con Yape, Plin o Tarjeta'],
        ['payments:manage', 'Finanzas', 'Validar y Gestionar Pagos', 'Marcar cobros como pagados o rechazados y consultar saldos'],
        ['analytics:financial', 'Finanzas', 'Ver Analíticas Financieras', 'Acceso al módulo de ingresos, métricas de catálogo y CSAT'],
        ['chats:reassign', 'Omnicanal', 'Reasignar Chats a Agentes', 'Transferir conversaciones entre miembros del equipo'],
        ['chats:resolve', 'Omnicanal', 'Resolver Tickets (CSAT)', 'Cambiar estado a Resuelto y disparar encuestas de satisfacción']
      ];
      defaultPerms.forEach(p => insPerm.run(p[0], p[1], p[2], p[3]));
    }

    // Seed default roles if none
    const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get();
    if (roleCount.c === 0) {
      const insRole = db.prepare('INSERT INTO roles (id, name, description, permissions, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
      const now = Date.now();
      insRole.run(
        'admin',
        'Administrador',
        'Control total de configuraciones, finanzas, campañas, auditoría y administración de equipo.',
        JSON.stringify([
          'roles:manage', 'security:audit_logs', 'chats:export', 'messages:delete',
          'campaigns:bulk_send', 'payments:create', 'payments:manage',
          'analytics:financial', 'chats:reassign', 'chats:resolve'
        ]),
        1,
        now
      );
      insRole.run(
        'supervisor',
        'Supervisor de Operaciones',
        'Supervisión y auditoría del equipo, reasignación de chats y monitoreo de satisfacción.',
        JSON.stringify([
          'security:audit_logs', 'chats:export', 'payments:manage',
          'analytics:financial', 'chats:reassign', 'chats:resolve'
        ]),
        1,
        now
      );
      insRole.run(
        'sales',
        'Agente de Ventas',
        'Atención de prospectos, cobros directos por Yape/Plin y campañas masivas.',
        JSON.stringify([
          'campaigns:bulk_send', 'payments:create', 'chats:resolve'
        ]),
        1,
        now
      );
      insRole.run(
        'support',
        'Soporte Técnico',
        'Atención al cliente omnicanal, notas internas y resolución con encuesta CSAT.',
        JSON.stringify([
          'chats:resolve'
        ]),
        1,
        now
      );
    }

    // Seed default user roles if none
    const urCount = db.prepare('SELECT COUNT(*) as c FROM user_roles').get();
    if (urCount.c === 0) {
      const insUr = db.prepare('INSERT OR REPLACE INTO user_roles (userId, roleId, assignedAt) VALUES (?, ?, ?)');
      const now = Date.now();
      insUr.run('agent-me', 'admin', now);
      insUr.run('agent-1', 'support', now);
      insUr.run('agent-2', 'sales', now);
      insUr.run('agent-3', 'support', now);
    }

    // Seed audit logs if none
    const auditCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get();
    if (auditCount.c === 0) {
      const insAudit = db.prepare(`
        INSERT INTO audit_logs (id, agentId, agentName, event, category, severity, details, ipAddress, deviceInfo, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = Date.now();
      insAudit.run('log-1', 'agent-me', 'Yo (Operador Actual)', 'auth.login', 'Seguridad', 'info', 'Inicio de sesión exitoso desde navegador Chrome 131 / Windows 11', '190.234.112.45', 'Chrome 131 / Windows', now - 3600000 * 5);
      insAudit.run('log-2', 'agent-2', 'Úrsula Morales', 'ticket.resolved', 'Omnicanal', 'info', 'Cambió estado de conversación #ch1 (María García) a Resuelto. Disparó encuesta CSAT automática.', '190.234.112.89', 'Chrome 131 / Windows', now - 3600000 * 4);
      insAudit.run('log-3', 'agent-1', 'Juan Carlos', 'chat.export', 'Mensajería', 'warning', 'Exportó el historial de mensajes de la conversación "🚀 Equipo Dev Pro" en formato TXT.', '190.234.110.12', 'Firefox 132 / MacOS', now - 3600000 * 3);
      insAudit.run('log-4', 'agent-me', 'Yo (Operador Actual)', 'payment.created', 'Finanzas', 'info', 'Generó solicitud de cobro por PEN 120.00 con método Yape para cliente ch1.', '190.234.112.45', 'Chrome 131 / Windows', now - 3600000 * 2);
      insAudit.run('log-5', 'agent-2', 'Úrsula Morales', 'campaign.bulk_send', 'Campañas', 'warning', 'Lanzó envío masivo con motor anti-baneo a 4 destinatarios desde plantilla comercial.', '190.234.112.89', 'Chrome 131 / Windows', now - 3600000 * 1.5);
      insAudit.run('log-6', 'agent-me', 'Yo (Operador Actual)', 'roles.updated', 'Seguridad', 'warning', 'Actualizó matriz de permisos granulares para el rol Agente de Ventas.', '190.234.112.45', 'Chrome 131 / Windows', now - 3600000 * 1);
      insAudit.run('log-7', 'agent-3', 'Soporte Técnico', 'security.pin_failed', 'Seguridad', 'critical', 'Intento de desbloqueo de sesión con PIN incorrecto en terminal de mesa de ayuda.', '190.234.115.60', 'Edge 131 / Windows', now - 1800000);
      insAudit.run('log-8', 'agent-me', 'Yo (Operador Actual)', 'security.unlock', 'Seguridad', 'info', 'Desbloqueo de sesión de operador verificado correctamente con PIN de seguridad.', '190.234.112.45', 'Chrome 131 / Windows', now - 600000);
    }

    // Safe migration: Add ragBotActive to chats
    try {
      db.exec(`ALTER TABLE chats ADD COLUMN ragBotActive INTEGER DEFAULT 0`);
    } catch (_) {}

    // Seed Initial Knowledge Base
    try {
      seedInitialKnowledgeBase();
    } catch (e) {
      console.error('Error seeding knowledge base:', e.message);
    }
  } catch (err) {
    console.error('Error migrating payments, sentiment & webhooks:', err.message);
  }
})();

// ─── RAG & AI Copilot Knowledge Base Endpoints ─────────────────────────────

// 1. Get all knowledge documents with aggregate stats
app.get('/api/rag/documents', (req, res) => {
  const db = getDb();
  try {
    const docs = db.prepare(`
      SELECT kd.*, COUNT(vc.id) as actualChunks
      FROM knowledge_documents kd
      LEFT JOIN vector_chunks vc ON kd.id = vc.documentId
      GROUP BY kd.id
      ORDER BY kd.createdAt DESC
    `).all();

    const stats = {
      totalDocs: docs.length,
      totalChunks: docs.reduce((acc, d) => acc + (d.actualChunks || d.totalChunks || 0), 0),
      totalTokens: docs.reduce((acc, d) => acc + (d.tokenCount || 0), 0),
      categories: [...new Set(docs.map(d => d.category || 'general'))]
    };

    res.json({ success: true, documents: docs, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 2. Upload and ingest reference document (PDF, TXT, MD, JSON)
app.post('/api/rag/documents/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo.' });
  }

  const { title, category = 'general' } = req.body;
  const fileName = req.file.originalname;
  const filePath = req.file.path;
  const fileSize = req.file.size;
  const fileExt = path.extname(fileName).toLowerCase().replace('.', '');

  try {
    const result = await ingestDocument({
      title: title || fileName,
      fileName,
      fileType: fileExt || 'text',
      filePath,
      fileSize,
      category
    });

    logAuditEvent({
      agentId: 'agent-me',
      agentName: 'Yo (Administrador)',
      event: 'rag.document_uploaded',
      category: 'Conocimiento IA',
      details: `Documento indexado: "${title || fileName}" (${result.totalChunks} chunks)`
    });

    broadcast({ type: 'rag_document_added', document: result });
    res.status(201).json({ success: true, document: result });
  } catch (err) {
    console.error('Error uploading RAG document:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Add manual text / FAQ / curriculum guide
app.post('/api/rag/documents/text', async (req, res) => {
  const { title, content, category = 'general', fileType = 'manual' } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos.' });
  }

  try {
    const result = await ingestDocument({
      title,
      content,
      fileType,
      category,
      fileSize: Buffer.byteLength(content, 'utf-8')
    });

    logAuditEvent({
      agentId: 'agent-me',
      agentName: 'Yo (Administrador)',
      event: 'rag.document_created',
      category: 'Conocimiento IA',
      details: `Guía o FAQ agregada: "${title}" (${result.totalChunks} chunks)`
    });

    broadcast({ type: 'rag_document_added', document: result });
    res.status(201).json({ success: true, document: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 4. Delete document and its vector chunks
app.delete('/api/rag/documents/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const doc = db.prepare('SELECT title FROM knowledge_documents WHERE id = ?').get(id);
    db.prepare('DELETE FROM vector_chunks WHERE documentId = ?').run(id);
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id);

    if (doc) {
      logAuditEvent({
        agentId: 'agent-me',
        agentName: 'Yo (Administrador)',
        event: 'rag.document_deleted',
        category: 'Conocimiento IA',
        details: `Documento eliminado de base de conocimiento: "${doc.title}"`
      });
    }

    broadcast({ type: 'rag_document_deleted', documentId: id });
    res.json({ success: true, documentId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 5. Get vector chunks for a specific document
app.get('/api/rag/documents/:id/chunks', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const chunks = db.prepare(`
      SELECT id, documentId, chunkIndex, content, tokenCount, createdAt
      FROM vector_chunks
      WHERE documentId = ?
      ORDER BY chunkIndex ASC
    `).all(id);

    res.json({ success: true, document: doc, chunks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 6. Vector Similarity Query (Tester & Playground)
app.post('/api/rag/query', (req, res) => {
  const { query, topK = 3, threshold = 0.20 } = req.body;
  if (!query) return res.status(400).json({ error: 'La consulta no puede estar vacía.' });

  try {
    const matches = searchSimilarChunks(query, parseInt(topK, 10) || 3, parseFloat(threshold) || 0.20);
    const handoff = detectHandoffIntent(query, matches[0]?.score || 0);

    res.json({
      success: true,
      query,
      count: matches.length,
      matches,
      handoffDetected: handoff.needsHandoff,
      handoffReason: handoff.reason
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 7. Copilot Smart Suggestions for Human Agents
app.post('/api/rag/copilot/suggestions', (req, res) => {
  const { chatId, messageText } = req.body;
  const db = getDb();

  try {
    let queryText = messageText;

    if (!queryText && chatId) {
      const lastMsg = db.prepare(`
        SELECT content FROM messages
        WHERE chatId = ? AND senderId != 'me' AND type = 'text'
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(chatId);
      if (lastMsg) queryText = lastMsg.content;
    }

    if (!queryText) {
      return res.json({ success: true, suggestions: [], chatId });
    }

    const suggestions = generateCopilotSuggestions(chatId, queryText);
    res.json({ success: true, chatId, queryText, suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 8. One-click Dispatch of Copilot Suggestion by Human Agent
app.post('/api/rag/copilot/send-suggestion', (req, res) => {
  const { chatId, suggestionText, suggestionTitle, confidence } = req.body;
  if (!chatId || !suggestionText) {
    return res.status(400).json({ error: 'chatId y suggestionText son requeridos.' });
  }

  const db = getDb();
  const id = uuidv4();
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
      VALUES (?, ?, 'me', 'Yo (Copilot)', ?, 'text', ?, 'sent', null, '{}')
    `).run(id, chatId, suggestionText, now);

    db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, unreadCount = 0 WHERE id = ?')
      .run(suggestionText, now, chatId);

    const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    broadcast({ type: 'new_message', chatId, message: newMsg });

    try {
      db.prepare(`
        INSERT INTO ai_copilot_logs (id, chatId, query, matchedChunks, generatedResponse, confidenceScore, mode, handoffTriggered, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'copilot', 0, 'accepted', ?)
      `).run(uuidv4(), chatId, suggestionTitle || 'Sugerencia de Copilot', '[]', suggestionText, confidence || 0.95, now);
    } catch (_) {}

    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 9. Toggle Autonomous Bot for a specific chat
app.post('/api/rag/copilot/toggle-chat-bot', (req, res) => {
  const { chatId, active } = req.body;
  const db = getDb();

  try {
    const val = active ? 1 : 0;
    db.prepare('UPDATE chats SET ragBotActive = ? WHERE id = ?').run(val, chatId);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    broadcast({ type: 'chat_updated', chat });
    res.json({ success: true, chatId, ragBotActive: val });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 10. Manual or Automatic Handoff to Human
app.post('/api/rag/handoff', (req, res) => {
  const { chatId, reason = 'manual_escalation', note = '' } = req.body;
  const db = getDb();
  const ragSettings = getRagSettings();
  const now = Date.now();
  const msgId = uuidv4();

  try {
    db.prepare("UPDATE chats SET status = 'pending', ragBotActive = 0 WHERE id = ?").run(chatId);

    const handoffText = ragSettings.handoff_message || 'Te estoy transfiriendo con un asesor humano para darte una atención personalizada. Un momento por favor... 👨‍💼';

    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status)
      VALUES (?, ?, 'system', 'Chasky Handoff', ?, 'text', ?, 'sent')
    `).run(msgId, chatId, handoffText, now);

    db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?').run(handoffText, now, chatId);

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    broadcast({ type: 'new_message', chatId, message: msg });
    broadcast({ type: 'handoff_triggered', chatId, reason, note });

    logAuditEvent({
      agentId: 'agent-me',
      agentName: 'Asesor Humano',
      event: 'rag.handoff_executed',
      category: 'Atención al Cliente',
      details: `Chat ${chatId} escalado a pendiente. Razón: ${reason}`
    });

    res.json({ success: true, chatId, status: 'pending', message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 11. RAG Settings
app.get('/api/rag/settings', (req, res) => {
  try {
    const settings = getRagSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/rag/settings', (req, res) => {
  try {
    const updated = updateRagSettings(req.body);
    broadcast({ type: 'rag_settings_updated', settings: updated });
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 12. Copilot & Autonomous Logs
app.get('/api/rag/logs', (req, res) => {
  const db = getDb();
  try {
    const logs = db.prepare(`
      SELECT * FROM ai_copilot_logs
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Offline-First Synchronization & Outbox Bulk Endpoints ──────────────────

// 1. Bulk Sync Endpoint
app.post('/api/sync', (req, res) => {
  const { clientId, lastSyncTimestamp = 0, outbox = [] } = req.body;
  const db = getDb();
  const serverTimestamp = Date.now();
  const processedOutboxIds = [];

  try {
    const tx = db.transaction(() => {
      for (const item of outbox) {
        if (!item || !item.id) continue;

        if (item.actionType === 'send_message' && item.payload) {
          const p = item.payload;
          const msgTimestamp = item.timestamp || p.timestamp || Date.now();
          
          db.prepare(`
            INSERT OR IGNORE INTO messages 
              (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions, fileName, fileSize, filePath)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, '{}', ?, ?, ?)
          `).run(
            item.id,
            item.chatId || p.chatId,
            p.senderId || 'me',
            p.senderName || 'Yo',
            p.content || '',
            p.type || 'text',
            msgTimestamp,
            p.replyTo || null,
            p.fileName || null,
            p.fileSize || null,
            p.filePath || null
          );

          const lastMsgSummary = p.type === 'sticker' ? '💟 Sticker' : (p.content || p.fileName || 'Archivo');
          db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, isArchived = 0 WHERE id = ?')
            .run(lastMsgSummary, msgTimestamp, item.chatId || p.chatId);

          const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(item.id);
          if (newMsg) {
            broadcast({ type: 'new_message', chatId: item.chatId || p.chatId, message: newMsg, fromSync: true });
          }
          processedOutboxIds.push(item.id);
        } else if (item.actionType === 'mark_read') {
          db.prepare('UPDATE chats SET unreadCount = 0 WHERE id = ?').run(item.chatId);
          db.prepare("UPDATE messages SET status = 'read' WHERE chatId = ? AND senderId != 'me'").run(item.chatId);
          processedOutboxIds.push(item.id);
        }
      }
    });

    tx();

    const newMessages = db.prepare(`
      SELECT * FROM messages 
      WHERE timestamp > ?
      ORDER BY timestamp ASC
      LIMIT 150
    `).all(lastSyncTimestamp);

    const updatedChats = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
             co.status AS contactStatus, co.phone AS contactPhone,
             ag.name AS assignedAgentName, ag.avatar AS assignedAgentAvatar, ag.role AS assignedAgentRole
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      LEFT JOIN agents ag ON c.assignedAgentId = ag.id
      WHERE c.lastMessageTime > ?
      ORDER BY c.lastMessageTime DESC
    `).all(lastSyncTimestamp);

    res.json({
      success: true,
      processedOutboxIds,
      newMessages,
      updatedChats,
      serverTimestamp
    });
  } catch (err) {
    console.error('Error during /api/sync execution:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Health & Sync Status Endpoint
app.get('/api/sync/status', (req, res) => {
  res.json({
    online: true,
    serverTimestamp: Date.now(),
    database: 'healthy',
    mode: 'offline-first-enabled'
  });
});


// Scheduled Messages Background Worker (runs every 5 seconds)
setInterval(() => {
  try {
    const db = getDb();
    const now = Date.now();
    const pending = db.prepare(`
      SELECT sm.*, c.contactId, c.groupName, c.type AS chatType
      FROM scheduled_messages sm
      JOIN chats c ON sm.chatId = c.id
      WHERE sm.status = 'pending' AND sm.scheduledTime <= ?
    `).all(now);

    for (const sm of pending) {
      const msgId = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, replyTo, reactions)
        VALUES (?, ?, 'me', 'Yo (Programado)', ?, ?, ?, 'sent', null, '{}')
      `).run(msgId, sm.chatId, sm.content, sm.type || 'text', now);

      db.prepare('UPDATE chats SET lastMessage = ?, lastMessageTime = ?, isArchived = 0 WHERE id = ?').run(sm.content, now, sm.chatId);
      db.prepare("UPDATE scheduled_messages SET status = 'sent' WHERE id = ?").run(sm.id);

      const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
      broadcast({ type: 'new_message', chatId: sm.chatId, message: newMsg });

      const fullChat = db.prepare(`
        SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
               co.isOnline AS contactIsOnline, co.lastSeen AS contactLastSeen,
               co.status AS contactStatus, co.phone AS contactPhone
        FROM chats c
        LEFT JOIN contacts co ON c.contactId = co.id
        WHERE c.id = ?
      `).get(sm.chatId);
      broadcast({ type: 'chat_updated', chat: fullChat });
      broadcast({ type: 'scheduled_message_sent', scheduledMessageId: sm.id, chatId: sm.chatId, message: newMsg });
      console.log(`⏰ Scheduled message ${sm.id} sent to chat ${sm.chatId}`);
    }
  } catch (err) {
    console.error('Error in scheduled messages worker:', err.message);
  }
}, 5000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CHASKYAPP Server running at http://0.0.0.0:${PORT} (LAN: http://192.168.1.9:${PORT})`);
  console.log(`📡 WebSocket server ready at ws://0.0.0.0:${PORT}/ws`);
  console.log(`💾 SQLite database: ${DB_PATH}`);
  console.log(`📁 Uploads: ${uploadDir}\n`);
});
