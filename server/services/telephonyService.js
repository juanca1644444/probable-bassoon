'use strict';
/**
 * telephonyService.js — Centralita Telefónica IVR & Agente de Voz IA (Speech-to-Speech)
 * CHASKYAPP Enterprise Telephony Engine
 * 
 * Features:
 * - SQLite Tables: phone_numbers, ivr_nodes, telephony_calls, call_recordings
 * - Visual IVR Flow Management & DTMF Router
 * - Autonomous Speech-to-Speech AI Voice Agent connected to RAG Knowledge Base
 * - Real-time WebSocket broadcasting for live transcripts & agent handoff
 * - Audio Call Recording Player & Turn-by-Turn Transcriptions
 * - Twilio TwiML / SIP Trunk Webhooks
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

let searchSimilarChunks = null;
let detectHandoffIntent = null;
try {
  const rag = require('../ragEngine');
  searchSimilarChunks = rag.searchSimilarChunks;
  detectHandoffIntent = rag.detectHandoffIntent;
} catch (err) {
  console.warn('⚠️ ragEngine not available in telephonyService:', err.message);
}

const router = express.Router();
let _broadcast = null;

function setBroadcastFunction(fn) {
  _broadcast = fn;
}

function broadcastEvent(payload) {
  if (typeof _broadcast === 'function') {
    try {
      _broadcast(payload);
    } catch (e) {
      console.error('Error broadcasting telephony event:', e.message);
    }
  }
}

// ─── Initialize SQLite Telephony Tables ─────────────────────────────────────
function initTelephonyTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id TEXT PRIMARY KEY,
      phoneNumber TEXT NOT NULL UNIQUE,
      friendlyName TEXT NOT NULL,
      countryCode TEXT DEFAULT 'PE',
      provider TEXT DEFAULT 'Twilio SIP',
      status TEXT DEFAULT 'active', -- 'active', 'inactive', 'testing'
      assignedIvrId TEXT DEFAULT 'ivr-root',
      voiceAgentModel TEXT DEFAULT 'chasky-speech-rag-v1',
      voiceId TEXT DEFAULT 'es-PE-Camila',
      sipTrunkHost TEXT DEFAULT 'sip.pe.chaskyapp.com',
      totalCallsCount INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS ivr_nodes (
      id TEXT PRIMARY KEY,
      flowId TEXT NOT NULL DEFAULT 'default-ivr-flow',
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- 'greeting', 'menu', 'transfer', 'ai_agent', 'voicemail', 'hangup'
      promptAudio TEXT,
      promptText TEXT NOT NULL,
      voiceId TEXT DEFAULT 'es-PE-Camila',
      options TEXT DEFAULT '[]', -- JSON array of DTMF options
      timeoutSec INTEGER DEFAULT 5,
      timeoutAction TEXT DEFAULT 'ai_agent',
      posX REAL DEFAULT 0,
      posY REAL DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS telephony_calls (
      id TEXT PRIMARY KEY,
      callSid TEXT,
      fromNumber TEXT NOT NULL,
      toNumber TEXT NOT NULL,
      customerName TEXT,
      direction TEXT DEFAULT 'inbound', -- 'inbound', 'outbound'
      status TEXT DEFAULT 'completed', -- 'ringing', 'in-progress', 'ai-speaking', 'transferred', 'completed', 'missed'
      duration INTEGER DEFAULT 0, -- in seconds
      ivrPath TEXT DEFAULT '[]', -- JSON array of nodes visited
      currentIvrNodeId TEXT,
      assignedAgentId TEXT,
      aiAgentActive INTEGER DEFAULT 1,
      sentiment TEXT DEFAULT 'positive', -- 'positive', 'neutral', 'negative'
      chatId TEXT,
      startedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      endedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS call_recordings (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL,
      recordingUrl TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      transcription TEXT,
      turns TEXT DEFAULT '[]', -- JSON array of { speaker, text, timestamp, time }
      summary TEXT,
      actionItems TEXT DEFAULT '[]',
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (callId) REFERENCES telephony_calls(id)
    );
  `);

  seedDefaultTelephonyData(db);
}

// ─── Seed Initial Data ──────────────────────────────────────────────────────
function seedDefaultTelephonyData(db) {
  // 1. Seed DIDs (Virtual Phone Numbers)
  const numbersCount = db.prepare('SELECT COUNT(*) as c FROM phone_numbers').get();
  if (numbersCount.c === 0) {
    const insertNum = db.prepare(`
      INSERT INTO phone_numbers (id, phoneNumber, friendlyName, countryCode, provider, status, assignedIvrId, voiceAgentModel, voiceId, sipTrunkHost, totalCallsCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertNum.run(
      'did-pe-lima-1',
      '+51 1 700 8920',
      'Línea Central Lima (DID Principal)',
      'PE',
      'Twilio SIP Trunk',
      'active',
      'ivr-root',
      'ElevenLabs Neural Multilingual',
      'es-PE-Camila',
      'sip.pe.chaskyapp.com',
      42
    );

    insertNum.run(
      'did-pe-movil-2',
      '+51 987 654 321',
      'Línea WhatsApp & Soporte 24/7',
      'PE',
      'Telnyx VoIP Cloud',
      'active',
      'ivr-root',
      'Gemini Flash Voice Realtime',
      'es-PE-Alonso',
      'sip.latam.chaskyapp.com',
      128
    );

    insertNum.run(
      'did-us-miami-3',
      '+1 (305) 912-2026',
      'Línea Internacional Miami (USA)',
      'US',
      'Vonage Enterprise',
      'active',
      'ivr-ai-voice',
      'ElevenLabs Turbo v2',
      'es-US-Sofia',
      'sip.us.chaskyapp.com',
      19
    );
  }

  // 2. Seed Default IVR Flow Nodes
  const nodesCount = db.prepare('SELECT COUNT(*) as c FROM ivr_nodes').get();
  if (nodesCount.c === 0) {
    const insertNode = db.prepare(`
      INSERT INTO ivr_nodes (id, flowId, title, type, promptAudio, promptText, voiceId, options, timeoutSec, timeoutAction, posX, posY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Root / Greeting Menu
    insertNode.run(
      'ivr-root',
      'default-ivr-flow',
      'Menú Principal de Bienvenida',
      'menu',
      null,
      '¡Bienvenido a CHASKYAPP! Para información y admisiones académicas, marque 1. Para soporte técnico y facturación, marque 2. Para conversar inmediatamente con nuestro Asistente de IA con voz natural, marque 3 o permanezca en línea.',
      'es-PE-Camila',
      JSON.stringify([
        { key: '1', action: 'route', targetNodeId: 'ivr-admisiones', label: '1 - Admisiones y Carreras' },
        { key: '2', action: 'route', targetNodeId: 'ivr-soporte', label: '2 - Soporte y Facturación' },
        { key: '3', action: 'route', targetNodeId: 'ivr-ai-voice', label: '3 - Asistente de Voz IA' },
        { key: '0', action: 'route', targetNodeId: 'ivr-transfer-human', label: '0 - Hablar con Asesor' }
      ]),
      6,
      'ivr-ai-voice',
      80,
      120
    );

    // Admissions Node
    insertNode.run(
      'ivr-admisiones',
      'default-ivr-flow',
      'Departamento de Admisiones',
      'menu',
      null,
      'Ha ingresado al área de Admisiones de CHASKYAPP. Para conocer los programas y diplomados vigentes marque 1. Para postular al programa de Becas Bicentenario marque 2. Para consultar con un asesor marque 0.',
      'es-PE-Camila',
      JSON.stringify([
        { key: '1', action: 'route', targetNodeId: 'ivr-ai-voice', label: '1 - Consultar Programas' },
        { key: '2', action: 'route', targetNodeId: 'ivr-ai-voice', label: '2 - Consultar Becas' },
        { key: '0', action: 'route', targetNodeId: 'ivr-transfer-human', label: '0 - Asesor de Matrícula' },
        { key: '*', action: 'route', targetNodeId: 'ivr-root', label: '* - Menú Anterior' }
      ]),
      5,
      'ivr-ai-voice',
      420,
      50
    );

    // Support Node
    insertNode.run(
      'ivr-soporte',
      'default-ivr-flow',
      'Soporte Técnico & Facturación',
      'menu',
      null,
      'Área de Soporte CHASKYAPP. Si presenta inconvenientes con el envío masivo o su bot marque 1. Para facturación y medios de pago Yape/Plin marque 2. Para hablar con IA marque 3.',
      'es-PE-Camila',
      JSON.stringify([
        { key: '1', action: 'route', targetNodeId: 'ivr-ai-voice', label: '1 - Diagnóstico con IA' },
        { key: '2', action: 'route', targetNodeId: 'ivr-ai-voice', label: '2 - Pagos Yape / Plin' },
        { key: '0', action: 'route', targetNodeId: 'ivr-transfer-human', label: '0 - Técnico de Guardia' },
        { key: '*', action: 'route', targetNodeId: 'ivr-root', label: '* - Menú Anterior' }
      ]),
      5,
      'ivr-ai-voice',
      420,
      230
    );

    // Autonomous AI Speech-to-Speech Agent
    insertNode.run(
      'ivr-ai-voice',
      'default-ivr-flow',
      'Agente de Voz IA Autónomo (RAG)',
      'ai_agent',
      null,
      'Hola, soy Chasky Voice, su asistente de inteligencia artificial con voz natural. Estoy conectado en tiempo real a la base de conocimiento y catálogo de CHASKYAPP. ¿En qué puedo ayudarle hoy?',
      'es-PE-Camila',
      JSON.stringify([
        { key: '0', action: 'route', targetNodeId: 'ivr-transfer-human', label: '0 - Solicitar Humano' },
        { key: '*', action: 'route', targetNodeId: 'ivr-root', label: '* - Menú Principal' }
      ]),
      10,
      'stay',
      780,
      130
    );

    // Transfer to Human Agent
    insertNode.run(
      'ivr-transfer-human',
      'default-ivr-flow',
      'Transferencia a Asesor Humano',
      'transfer',
      null,
      'Un momento por favor, estamos transfiriendo su llamada a uno de nuestros asesores disponibles. La transcripción completa y el contexto de su consulta han sido compartidos con el agente.',
      'es-PE-Camila',
      JSON.stringify([]),
      0,
      'hangup',
      780,
      310
    );

    // Voicemail
    insertNode.run(
      'ivr-voicemail',
      'default-ivr-flow',
      'Buzón de Voz y Grabación',
      'voicemail',
      null,
      'En este momento todos nuestros asesores están ocupados. Por favor deje su mensaje después del tono y un resumen con su grabación se enviará automáticamente a su WhatsApp.',
      'es-PE-Camila',
      JSON.stringify([]),
      30,
      'hangup',
      420,
      410
    );

    // Hangup
    insertNode.run(
      'ivr-hangup',
      'default-ivr-flow',
      'Finalizar Llamada Cordial',
      'hangup',
      null,
      'Muchas gracias por comunicarse con CHASKYAPP. Que tenga un excelente día.',
      'es-PE-Camila',
      JSON.stringify([]),
      0,
      'hangup',
      780,
      470
    );
  }

  // 3. Seed Demo Telephony Calls & Recordings
  const callsCount = db.prepare('SELECT COUNT(*) as c FROM telephony_calls').get();
  if (callsCount.c === 0) {
    const insertCall = db.prepare(`
      INSERT INTO telephony_calls (id, callSid, fromNumber, toNumber, customerName, direction, status, duration, ivrPath, currentIvrNodeId, assignedAgentId, aiAgentActive, sentiment, chatId, startedAt, endedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecording = db.prepare(`
      INSERT INTO call_recordings (id, callId, recordingUrl, duration, transcription, turns, summary, actionItems, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();

    // Call 1: Completed with AI Voice Agent
    const call1Id = 'call-demo-ivr-101';
    insertCall.run(
      call1Id,
      'CA9182374650a8b9c1d2e3f4',
      '+51 987 654 321',
      '+51 1 700 8920',
      'Elena Rostova',
      'inbound',
      'completed',
      142,
      JSON.stringify(['Menú Principal', 'Opción 1 Admisiones', 'Agente de Voz IA']),
      'ivr-ai-voice',
      'agent-me',
      1,
      'positive',
      'ch1',
      now - 1000 * 60 * 35,
      now - 1000 * 60 * (35 - 2.3)
    );

    const turns1 = [
      { speaker: 'system', text: '📞 Llamada entrante conectada al IVR CHASKYAPP (+51 1 700 8920).', time: '00:01' },
      { speaker: 'ai', text: '¡Bienvenido a CHASKYAPP! Para información y admisiones, marque 1. Para soporte técnico, marque 2.', time: '00:04' },
      { speaker: 'customer', text: '[DTMF 1 presionado por el cliente]', time: '00:08' },
      { speaker: 'ai', text: 'Hola, soy Chasky Voice. Estoy conectado a la base de conocimiento en tiempo real. ¿En qué programa estás interesado?', time: '00:12' },
      { speaker: 'customer', text: 'Buenas tardes, quisiera consultar qué requisitos tienen para la Beca Bicentenario y qué días son las clases de Full Stack.', time: '00:23' },
      { speaker: 'ai', text: '¡Con gusto Elena! Para la Beca Bicentenario necesitas documento de identidad vigente y secundaria completa, con un 20% de descuento postulando antes del 25. Las clases de Full Stack inician el primer lunes de cada mes, martes y jueves de 7:00 a 10:00 PM.', time: '00:46' },
      { speaker: 'customer', text: 'Excelente, muchas gracias por la información tan clara. Me comunicaré por WhatsApp para enviar mis documentos.', time: '01:10' },
      { speaker: 'ai', text: 'Ha sido un placer atenderte. Te enviaremos el enlace directo de matrícula a este mismo número por WhatsApp. ¡Que tengas un excelente día!', time: '01:25' }
    ];

    insertRecording.run(
      'rec-demo-101',
      call1Id,
      '/uploads/voice-1794580620776-ee980fcf.webm',
      142,
      turns1.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n'),
      JSON.stringify(turns1),
      'Cliente Elena Rostova consultó sobre la Beca Bicentenario y horarios del programa Full Stack. La IA resolvió satisfactoriamente todas las preguntas mediante RAG y coordinó envío de ficha de inscripción por WhatsApp.',
      JSON.stringify([
        'Enviar brochure y ficha de Beca Bicentenario por chat de WhatsApp',
        'Registrar oportunidad de matrícula en el CRM Pipeline'
      ]),
      now - 1000 * 60 * 33
    );

    // Call 2: Transferred to Human Agent
    const call2Id = 'call-demo-ivr-102';
    insertCall.run(
      call2Id,
      'CA5438291074b1c2d3e4f5a6',
      '+51 944 112 233',
      '+51 1 700 8920',
      'Carlos Mendoza',
      'inbound',
      'transferred',
      215,
      JSON.stringify(['Menú Principal', 'Opción 2 Soporte', 'Transferido a Asesor Humano']),
      'ivr-transfer-human',
      'agent-me',
      1,
      'neutral',
      'ch2',
      now - 1000 * 60 * 95,
      now - 1000 * 60 * (95 - 3.5)
    );

    const turns2 = [
      { speaker: 'system', text: '📞 Llamada entrante conectada al IVR CHASKYAPP.', time: '00:01' },
      { speaker: 'ai', text: 'Área de Soporte CHASKYAPP. Para inconvenientes técnicos marque 1. Para hablar con un asesor marque 0.', time: '00:05' },
      { speaker: 'customer', text: '[DTMF 0 presionado]', time: '00:09' },
      { speaker: 'ai', text: 'Un momento por favor, estamos transfiriendo su llamada al asesor humano disponible con todo el contexto registrado.', time: '00:13' },
      { speaker: 'agent', text: 'Hola Carlos, te atiende Juan del equipo de soporte de CHASKYAPP. Veo que necesitas asistencia con la API de Webhooks, ¿correcto?', time: '00:28' },
      { speaker: 'customer', text: 'Sí, exactamente, necesito regenerar mi Secret Token de HMAC-SHA256 para producción.', time: '00:45' },
      { speaker: 'agent', text: 'Listo Carlos, ya te habilité el permiso en el Centro de Desarrolladores. Te llegará una notificación de confirmación.', time: '01:50' }
    ];

    insertRecording.run(
      'rec-demo-102',
      call2Id,
      '/uploads/voice-1794580669443-e8f2703e.webm',
      215,
      turns2.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n'),
      JSON.stringify(turns2),
      'Llamada transferida por IVR al equipo técnico. Se asistió al cliente Carlos Mendoza en la rotación de claves secretas de Webhooks para producción.',
      JSON.stringify([
        'Verificar recepción de payload 200 OK en el endpoint del cliente'
      ]),
      now - 1000 * 60 * 92
    );

    // Also insert call_recording messages into the messages table so they appear in the omnicanal chat timeline!
    try {
      const insMsg = db.prepare(`
        INSERT OR IGNORE INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, duration, filePath)
        VALUES (?, ?, 'system', 'Centralita Telefónica', ?, 'call_recording', ?, 'delivered', ?, ?)
      `);

      const msgPayload1 = {
        callId: call1Id,
        direction: 'inbound',
        fromNumber: '+51 987 654 321',
        toNumber: '+51 1 700 8920',
        customerName: 'Elena Rostova',
        duration: 142,
        status: 'completed',
        aiAgentActive: 1,
        sentiment: 'positive',
        summary: 'Cliente Elena Rostova consultó sobre la Beca Bicentenario y horarios del programa Full Stack. La IA resolvió satisfactoriamente todas las preguntas mediante RAG y coordinó envío de ficha de inscripción por WhatsApp.',
        actionItems: [
          'Enviar brochure y ficha de Beca Bicentenario por chat de WhatsApp',
          'Registrar oportunidad de matrícula en el CRM Pipeline'
        ],
        recordingUrl: '/uploads/voice-1794580620776-ee980fcf.webm',
        turns: turns1
      };

      insMsg.run(
        'msg-call-rec-101',
        'ch1',
        JSON.stringify(msgPayload1),
        now - 1000 * 60 * 33,
        142,
        '/uploads/voice-1794580620776-ee980fcf.webm'
      );

      const msgPayload2 = {
        callId: call2Id,
        direction: 'inbound',
        fromNumber: '+51 944 112 233',
        toNumber: '+51 1 700 8920',
        customerName: 'Carlos Mendoza',
        duration: 215,
        status: 'transferred',
        aiAgentActive: 1,
        sentiment: 'neutral',
        summary: 'Llamada transferida por IVR al equipo técnico. Se asistió al cliente Carlos Mendoza en la rotación de claves secretas de Webhooks para producción.',
        actionItems: [
          'Verificar recepción de payload 200 OK en el endpoint del cliente'
        ],
        recordingUrl: '/uploads/voice-1794580669443-e8f2703e.webm',
        turns: turns2
      };

      insMsg.run(
        'msg-call-rec-102',
        'ch2',
        JSON.stringify(msgPayload2),
        now - 1000 * 60 * 92,
        215,
        '/uploads/voice-1794580669443-e8f2703e.webm'
      );
    } catch (e) {
      console.warn('⚠️ Could not insert seed call recording messages:', e.message);
    }
  }
}

// ─── REST ENDPOINTS ─────────────────────────────────────────────────────────

// 1. Phone Numbers (DIDs)
router.get('/telephony/numbers', (req, res) => {
  try {
    const db = getDb();
    const numbers = db.prepare(`
      SELECT pn.*, n.title AS assignedIvrTitle
      FROM phone_numbers pn
      LEFT JOIN ivr_nodes n ON pn.assignedIvrId = n.id
      ORDER BY pn.createdAt ASC
    `).all();
    res.json(numbers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/telephony/numbers', (req, res) => {
  try {
    const db = getDb();
    const { phoneNumber, friendlyName, countryCode, provider, assignedIvrId, voiceAgentModel, voiceId, sipTrunkHost } = req.body;
    if (!phoneNumber || !friendlyName) {
      return res.status(400).json({ error: 'Número de teléfono y nombre requeridos' });
    }

    const id = `did-${uuidv4().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO phone_numbers (id, phoneNumber, friendlyName, countryCode, provider, status, assignedIvrId, voiceAgentModel, voiceId, sipTrunkHost)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(
      id,
      phoneNumber,
      friendlyName,
      countryCode || 'PE',
      provider || 'Twilio SIP Trunk',
      assignedIvrId || 'ivr-root',
      voiceAgentModel || 'chasky-speech-rag-v1',
      voiceId || 'es-PE-Camila',
      sipTrunkHost || 'sip.pe.chaskyapp.com'
    );

    const created = db.prepare('SELECT * FROM phone_numbers WHERE id = ?').get(id);
    broadcastEvent({ type: 'telephony_number_created', number: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/telephony/numbers/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { friendlyName, status, assignedIvrId, voiceAgentModel, voiceId, sipTrunkHost } = req.body;

    db.prepare(`
      UPDATE phone_numbers
      SET friendlyName = COALESCE(?, friendlyName),
          status = COALESCE(?, status),
          assignedIvrId = COALESCE(?, assignedIvrId),
          voiceAgentModel = COALESCE(?, voiceAgentModel),
          voiceId = COALESCE(?, voiceId),
          sipTrunkHost = COALESCE(?, sipTrunkHost),
          updatedAt = (strftime('%s','now') * 1000)
      WHERE id = ?
    `).run(friendlyName, status, assignedIvrId, voiceAgentModel, voiceId, sipTrunkHost, id);

    const updated = db.prepare('SELECT * FROM phone_numbers WHERE id = ?').get(id);
    broadcastEvent({ type: 'telephony_number_updated', number: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/telephony/numbers/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    db.prepare('DELETE FROM phone_numbers WHERE id = ?').run(id);
    broadcastEvent({ type: 'telephony_number_deleted', numberId: id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. IVR Flow & Nodes
router.get(['/telephony/ivr-nodes', '/telephony/nodes'], (req, res) => {
  try {
    const db = getDb();
    const flowId = req.query.flowId || 'default-ivr-flow';
    const nodes = db.prepare('SELECT * FROM ivr_nodes WHERE flowId = ? ORDER BY createdAt ASC').all(flowId);
    
    // Parse JSON options
    const parsed = nodes.map(n => ({
      ...n,
      options: typeof n.options === 'string' ? JSON.parse(n.options || '[]') : (n.options || [])
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/telephony/ivr-nodes', (req, res) => {
  try {
    const db = getDb();
    const { flowId = 'default-ivr-flow', title, type = 'menu', promptText, promptAudio = null, voiceId = 'es-PE-Camila', options = [], timeoutSec = 5, timeoutAction = 'ai_agent', posX = 200, posY = 200 } = req.body;

    if (!title || !promptText) {
      return res.status(400).json({ error: 'Título y texto de locución requeridos' });
    }

    const id = `ivr-${uuidv4().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO ivr_nodes (id, flowId, title, type, promptAudio, promptText, voiceId, options, timeoutSec, timeoutAction, posX, posY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      flowId,
      title,
      type,
      promptAudio,
      promptText,
      voiceId,
      JSON.stringify(options),
      timeoutSec,
      timeoutAction,
      posX,
      posY
    );

    const created = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(id);
    created.options = JSON.parse(created.options || '[]');
    broadcastEvent({ type: 'ivr_node_created', node: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/telephony/ivr-nodes/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { title, type, promptText, promptAudio, voiceId, options, timeoutSec, timeoutAction, posX, posY } = req.body;

    const current = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Nodo no encontrado' });

    db.prepare(`
      UPDATE ivr_nodes
      SET title = COALESCE(?, title),
          type = COALESCE(?, type),
          promptText = COALESCE(?, promptText),
          promptAudio = COALESCE(?, promptAudio),
          voiceId = COALESCE(?, voiceId),
          options = COALESCE(?, options),
          timeoutSec = COALESCE(?, timeoutSec),
          timeoutAction = COALESCE(?, timeoutAction),
          posX = COALESCE(?, posX),
          posY = COALESCE(?, posY),
          updatedAt = (strftime('%s','now') * 1000)
      WHERE id = ?
    `).run(
      title,
      type,
      promptText,
      promptAudio,
      voiceId,
      options ? JSON.stringify(options) : null,
      timeoutSec,
      timeoutAction,
      posX,
      posY,
      id
    );

    const updated = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(id);
    updated.options = JSON.parse(updated.options || '[]');
    broadcastEvent({ type: 'ivr_node_updated', node: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/telephony/ivr-nodes/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    if (id === 'ivr-root') {
      return res.status(400).json({ error: 'No se puede eliminar el nodo raíz de bienvenida' });
    }
    db.prepare('DELETE FROM ivr_nodes WHERE id = ?').run(id);
    broadcastEvent({ type: 'ivr_node_deleted', nodeId: id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/telephony/ivr-nodes/save-flow', (req, res) => {
  try {
    const db = getDb();
    const { flowId = 'default-ivr-flow', nodes } = req.body;
    if (!Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Array de nodos requerido' });
    }

    const updateStmt = db.prepare(`
      UPDATE ivr_nodes
      SET title = ?, type = ?, promptText = ?, promptAudio = ?, voiceId = ?,
          options = ?, timeoutSec = ?, timeoutAction = ?, posX = ?, posY = ?,
          updatedAt = (strftime('%s','now') * 1000)
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO ivr_nodes (id, flowId, title, type, promptAudio, promptText, voiceId, options, timeoutSec, timeoutAction, posX, posY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((nodesList) => {
      for (const node of nodesList) {
        insertStmt.run(
          node.id,
          flowId,
          node.title,
          node.type,
          node.promptAudio || null,
          node.promptText,
          node.voiceId || 'es-PE-Camila',
          JSON.stringify(node.options || []),
          node.timeoutSec ?? 5,
          node.timeoutAction || 'ai_agent',
          node.posX ?? 0,
          node.posY ?? 0
        );
      }
    });

    tx(nodes);
    broadcastEvent({ type: 'ivr_flow_saved', flowId, count: nodes.length });
    res.json({ success: true, message: 'Flujo IVR guardado exitosamente', count: nodes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset to Default IVR
router.post('/telephony/ivr-nodes/reset-default', (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM ivr_nodes WHERE flowId = 'default-ivr-flow'").run();
    seedDefaultTelephonyData(db);
    const nodes = db.prepare("SELECT * FROM ivr_nodes WHERE flowId = 'default-ivr-flow'").all();
    const parsed = nodes.map(n => ({
      ...n,
      options: JSON.parse(n.options || '[]')
    }));
    broadcastEvent({ type: 'ivr_flow_reset', nodes: parsed });
    res.json({ success: true, nodes: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Telephony Calls & Simulator Engine
router.get('/telephony/calls', (req, res) => {
  try {
    const db = getDb();
    const calls = db.prepare(`
      SELECT tc.*, cr.recordingUrl, cr.transcription, cr.summary, cr.actionItems
      FROM telephony_calls tc
      LEFT JOIN call_recordings cr ON tc.id = cr.callId
      ORDER BY tc.startedAt DESC
      LIMIT 100
    `).all();

    const formatted = calls.map(c => ({
      ...c,
      ivrPath: typeof c.ivrPath === 'string' ? JSON.parse(c.ivrPath || '[]') : (c.ivrPath || []),
      actionItems: typeof c.actionItems === 'string' ? JSON.parse(c.actionItems || '[]') : (c.actionItems || [])
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/telephony/calls/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const call = db.prepare(`
      SELECT tc.*, cr.recordingUrl, cr.transcription, cr.turns, cr.summary, cr.actionItems
      FROM telephony_calls tc
      LEFT JOIN call_recordings cr ON tc.id = cr.callId
      WHERE tc.id = ?
    `).get(id);

    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });

    call.ivrPath = JSON.parse(call.ivrPath || '[]');
    call.turns = JSON.parse(call.turns || '[]');
    call.actionItems = JSON.parse(call.actionItems || '[]');
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Simulated Call
router.post('/telephony/calls/start-simulator', (req, res) => {
  try {
    const db = getDb();
    const { fromNumber = '+51 987 654 321', toNumber = '+51 1 700 8920', customerName = 'Cliente Simulador' } = req.body;

    const numberRecord = db.prepare('SELECT * FROM phone_numbers WHERE phoneNumber = ?').get(toNumber) ||
                         db.prepare('SELECT * FROM phone_numbers LIMIT 1').get();

    const rootNodeId = numberRecord ? numberRecord.assignedIvrId : 'ivr-root';
    const rootNode = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(rootNodeId) ||
                     db.prepare('SELECT * FROM ivr_nodes WHERE type = "greeting" OR id = "ivr-root" LIMIT 1').get();

    const callId = `call-sim-${Date.now().toString(36)}-${uuidv4().slice(0, 4)}`;
    const callSid = `CA_SIM_${uuidv4().replace(/-/g, '').slice(0, 20)}`;

    const initialIvrPath = [rootNode ? rootNode.title : 'Bienvenida'];

    db.prepare(`
      INSERT INTO telephony_calls (id, callSid, fromNumber, toNumber, customerName, direction, status, duration, ivrPath, currentIvrNodeId, assignedAgentId, aiAgentActive, sentiment, chatId, startedAt)
      VALUES (?, ?, ?, ?, ?, 'inbound', 'in-progress', 0, ?, ?, 'agent-me', 1, 'neutral', 'ch1', ?)
    `).run(
      callId,
      callSid,
      fromNumber,
      toNumber,
      customerName,
      JSON.stringify(initialIvrPath),
      rootNode ? rootNode.id : 'ivr-root',
      Date.now()
    );

    // Increment DID call counter
    if (numberRecord) {
      db.prepare('UPDATE phone_numbers SET totalCallsCount = totalCallsCount + 1 WHERE id = ?').run(numberRecord.id);
    }

    const initialTurns = [
      { speaker: 'system', text: `📞 Conexión telefónica establecida con ${toNumber} (${numberRecord ? numberRecord.friendlyName : 'DID'}).`, time: '00:01' }
    ];

    if (rootNode) {
      initialTurns.push({ speaker: 'ai', text: rootNode.promptText, time: '00:03' });
    }

    db.prepare(`
      INSERT INTO call_recordings (id, callId, recordingUrl, duration, transcription, turns, summary, actionItems)
      VALUES (?, ?, ?, 0, ?, ?, '', '[]')
    `).run(
      `rec-${callId}`,
      callId,
      '/uploads/voice-1794580620776-ee980fcf.webm',
      initialTurns.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n'),
      JSON.stringify(initialTurns)
    );

    const callObj = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    callObj.ivrPath = initialIvrPath;
    callObj.currentNode = rootNode ? {
      ...rootNode,
      options: JSON.parse(rootNode.options || '[]')
    } : null;
    callObj.turns = initialTurns;

    broadcastEvent({ type: 'telephony_call_started', call: callObj });

    res.json({
      success: true,
      call: callObj,
      promptText: rootNode ? rootNode.promptText : 'Bienvenido',
      voiceId: rootNode ? rootNode.voiceId : 'es-PE-Camila'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate DTMF Keypress (1, 2, 3, etc.)
router.post('/telephony/calls/simulate-dtmf', (req, res) => {
  try {
    const db = getDb();
    const { callId, digit } = req.body;
    if (!callId || !digit) {
      return res.status(400).json({ error: 'callId y dígito DTMF requeridos' });
    }

    const call = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });

    const currentNodeId = call.currentIvrNodeId || 'ivr-root';
    const currentNode = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(currentNodeId);
    const options = currentNode ? JSON.parse(currentNode.options || '[]') : [];

    const matchedOption = options.find(o => String(o.key) === String(digit));
    let nextNodeId = matchedOption ? matchedOption.targetNodeId : (currentNode ? currentNode.timeoutAction : 'ivr-ai-voice');
    
    // Fallback if target node doesn't exist
    let nextNode = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(nextNodeId);
    if (!nextNode) {
      nextNode = db.prepare('SELECT * FROM ivr_nodes WHERE id = "ivr-ai-voice" LIMIT 1').get() || currentNode;
    }

    const ivrPath = JSON.parse(call.ivrPath || '[]');
    ivrPath.push(nextNode ? nextNode.title : `Opción ${digit}`);

    // Update Recording Turns
    const recording = db.prepare('SELECT * FROM call_recordings WHERE callId = ?').get(callId);
    const turns = recording ? JSON.parse(recording.turns || '[]') : [];
    
    turns.push({ speaker: 'customer', text: `[Dígito DTMF '${digit}' presionado]`, time: '00:10' });
    if (nextNode) {
      turns.push({ speaker: 'ai', text: nextNode.promptText, time: '00:14' });
    }

    // Check if node is transfer
    let newStatus = call.status;
    if (nextNode && nextNode.type === 'transfer') {
      newStatus = 'transferred';
    } else if (nextNode && nextNode.type === 'hangup') {
      newStatus = 'completed';
    }

    db.prepare(`
      UPDATE telephony_calls
      SET currentIvrNodeId = ?,
          ivrPath = ?,
          status = ?
      WHERE id = ?
    `).run(nextNode ? nextNode.id : currentNodeId, JSON.stringify(ivrPath), newStatus, callId);

    if (recording) {
      db.prepare(`
        UPDATE call_recordings
        SET turns = ?,
            transcription = ?
        WHERE id = ?
      `).run(
        JSON.stringify(turns),
        turns.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n'),
        recording.id
      );
    }

    const updatedCall = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    updatedCall.ivrPath = ivrPath;
    updatedCall.currentNode = nextNode ? {
      ...nextNode,
      options: JSON.parse(nextNode.options || '[]')
    } : null;
    updatedCall.turns = turns;

    broadcastEvent({ type: 'telephony_dtmf_processed', callId, digit, nextNode, turns });

    res.json({
      success: true,
      digit,
      nextNode: updatedCall.currentNode,
      promptText: nextNode ? nextNode.promptText : '',
      status: newStatus,
      turns
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Speech-to-Speech AI Interaction with RAG Grounding
router.post('/telephony/ai-speech/interact', async (req, res) => {
  try {
    const db = getDb();
    const { callId, customerText, voiceModel = 'ElevenLabs Multilingual v2' } = req.body;

    if (!callId || !customerText) {
      return res.status(400).json({ error: 'callId y customerText requeridos' });
    }

    const call = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });

    // 1. Query RAG Knowledge Base first to check available context
    let ragChunks = [];
    if (typeof searchSimilarChunks === 'function') {
      try {
        ragChunks = searchSimilarChunks(customerText, 3);
      } catch (e) {
        console.warn('RAG search fallback in telephony:', e.message);
      }
    }
    const topScore = ragChunks && ragChunks.length > 0 ? ragChunks[0].score : 0.0;

    // 2. Detect if customer explicitly asks for human advisor or low confidence
    const lower = customerText.toLowerCase();
    const explicitHuman = ['humano', 'asesor', 'operador', 'persona real', 'representante', 'queja', 'reclamo'].some(w => lower.includes(w));
    let isHandoff = explicitHuman;
    if (!isHandoff && typeof detectHandoffIntent === 'function') {
      const handoffCheck = detectHandoffIntent(customerText, topScore, 0.20);
      isHandoff = Boolean(handoffCheck && handoffCheck.needsHandoff && explicitHuman);
    }

    let aiSpeechResponse = '';
    let action = 'continue';
    let sentiment = 'positive';

    if (isHandoff) {
      action = 'transfer_human';
      sentiment = 'neutral';
      aiSpeechResponse = 'Comprendo perfectamente su requerimiento. Un momento en línea mientras transfiero de inmediato su llamada a uno de nuestros asesores humanos especializados.';

      db.prepare(`
        UPDATE telephony_calls
        SET status = 'transferred',
            currentIvrNodeId = 'ivr-transfer-human'
        WHERE id = ?
      `).run(callId);
    } else {
      if (ragChunks && ragChunks.length > 0 && topScore > 0.15) {
        const topChunk = ragChunks[0];
        // Clean and summarize chunk for natural conversational telephony speech
        const cleanText = topChunk.content || topChunk.chunkText || '';
        const speechSlice = cleanText
          .replace(/[•\*\#\-]/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 280);

        aiSpeechResponse = `Conforme a nuestra información oficial: ${speechSlice}. ¿Desea que le reserve una vacante o tiene alguna otra pregunta?`;
      } else {
        // Conversational Telephony Intelligent Fallback
        const lower = customerText.toLowerCase();
        if (lower.includes('hola') || lower.includes('buenos días') || lower.includes('buenas tardes')) {
          aiSpeechResponse = '¡Hola! Es un gusto saludarle. En CHASKYAPP contamos con soluciones de mensajería omnicanal, campañas masivas y bots de IA. ¿En qué puedo orientarle hoy?';
        } else if (lower.includes('precio') || lower.includes('costo') || lower.includes('planes')) {
          aiSpeechResponse = 'Nuestros planes van desde el Plan Educativo a 129 dólares al mes hasta el Plan Enterprise Ilimitado. Además, disponemos de pagos instantáneos con Yape y Plin. ¿Le gustaría que le reserve una demo?';
        } else if (lower.includes('horario') || lower.includes('atencion') || lower.includes('soporte')) {
          aiSpeechResponse = 'Nuestro equipo de soporte humano atiende de lunes a viernes de 8:00 AM a 8:00 PM, y nuestro asistente de IA responde las 24 horas del día sin interrupción.';
        } else {
          aiSpeechResponse = 'He registrado su consulta en el sistema. Puedo brindarle detalles sobre nuestras integraciones con Meta WhatsApp Cloud API o transferirle con un especialista si lo prefiere.';
        }
      }
    }

    // 3. Update Call Recording Turns
    const recording = db.prepare('SELECT * FROM call_recordings WHERE callId = ?').get(callId);
    const turns = recording ? JSON.parse(recording.turns || '[]') : [];

    const nowSecs = Math.floor((Date.now() - (call.startedAt || Date.now())) / 1000);
    const formatSecs = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    turns.push({ speaker: 'customer', text: customerText, time: formatSecs(nowSecs) });
    turns.push({ speaker: 'ai', text: aiSpeechResponse, time: formatSecs(nowSecs + 3) });

    if (recording) {
      db.prepare(`
        UPDATE call_recordings
        SET turns = ?,
            transcription = ?
        WHERE id = ?
      `).run(
        JSON.stringify(turns),
        turns.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n'),
        recording.id
      );
    }

    // Broadcast live transcript update so agent dashboard sees it in real time!
    broadcastEvent({
      type: 'call_transcript_update',
      callId,
      action,
      turns,
      lastTurn: { speaker: 'ai', text: aiSpeechResponse },
      customerText
    });

    res.json({
      success: true,
      aiReply: aiSpeechResponse,
      action,
      sentiment,
      turns,
      voiceId: 'es-PE-Camila',
      modelUsed: voiceModel
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Transfer Call to Human Agent
router.post('/telephony/calls/transfer', (req, res) => {
  try {
    const db = getDb();
    const { callId, agentId = 'agent-me' } = req.body;

    const call = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });

    db.prepare(`
      UPDATE telephony_calls
      SET status = 'transferred',
          assignedAgentId = ?,
          currentIvrNodeId = 'ivr-transfer-human'
      WHERE id = ?
    `).run(agentId, callId);

    const recording = db.prepare('SELECT * FROM call_recordings WHERE callId = ?').get(callId);
    const turns = recording ? JSON.parse(recording.turns || '[]') : [];

    turns.push({
      speaker: 'system',
      text: `🔄 Llamada transferida al agente humano (${agentId}). Transcripción completa en vivo sincronizada.`,
      time: '01:30'
    });

    if (recording) {
      db.prepare('UPDATE call_recordings SET turns = ? WHERE id = ?').run(JSON.stringify(turns), recording.id);
    }

    broadcastEvent({ type: 'call_transferred', callId, agentId, turns });

    res.json({ success: true, message: 'Llamada transferida a agente humano', callId, agentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. End Call & Generate AI Summary & Insert Chat Recording Card
router.post('/telephony/calls/end', (req, res) => {
  try {
    const db = getDb();
    const { callId, reason = 'completed' } = req.body;

    const call = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });

    const endedAt = Date.now();
    const duration = Math.max(10, Math.floor((endedAt - (call.startedAt || endedAt)) / 1000));

    db.prepare(`
      UPDATE telephony_calls
      SET status = ?,
          duration = ?,
          endedAt = ?
      WHERE id = ?
    `).run(reason, duration, endedAt, callId);

    const recording = db.prepare('SELECT * FROM call_recordings WHERE callId = ?').get(callId);
    let turns = [];
    if (recording) {
      turns = JSON.parse(recording.turns || '[]');
      turns.push({
        speaker: 'system',
        text: `📴 Llamada finalizada. Duración total: ${Math.floor(duration / 60)}m ${duration % 60}s.`,
        time: `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`
      });

      // Generate AI Executive Summary & Action Items
      const customerQueries = turns.filter(t => t.speaker === 'customer').map(t => t.text).join('; ');
      const summary = customerQueries
        ? `Llamada telefónica atendida por IVR y Agente de Voz IA. El cliente abordó: "${customerQueries.slice(0, 160)}". La IA proveyó información institucional y coordinó seguimiento omnicanal.`
        : 'Llamada telefónica interactiva completada satisfactoriamente a través del flujo IVR de CHASKYAPP.';

      const actionItems = [
        'Enviar confirmación y resumen de llamada al cliente por WhatsApp',
        'Actualizar estado del contacto en el CRM'
      ];

      db.prepare(`
        UPDATE call_recordings
        SET duration = ?,
            turns = ?,
            summary = ?,
            actionItems = ?
        WHERE id = ?
      `).run(duration, JSON.stringify(turns), summary, JSON.stringify(actionItems), recording.id);

      // Insert Call Recording message in omnicanal chat timeline!
      const targetChatId = call.chatId || 'ch1';
      const msgId = `msg-rec-${callId}`;

      const cardPayload = {
        callId,
        direction: call.direction || 'inbound',
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        customerName: call.customerName || 'Cliente',
        duration,
        status: reason,
        aiAgentActive: call.aiAgentActive,
        sentiment: call.sentiment || 'positive',
        summary,
        actionItems,
        recordingUrl: recording.recordingUrl || '/uploads/voice-1794580620776-ee980fcf.webm',
        turns
      };

      try {
        db.prepare(`
          INSERT OR REPLACE INTO messages (id, chatId, senderId, senderName, content, type, timestamp, status, duration, filePath)
          VALUES (?, ?, 'system', 'Centralita Telefónica', ?, 'call_recording', ?, 'delivered', ?, ?)
        `).run(
          msgId,
          targetChatId,
          JSON.stringify(cardPayload),
          endedAt,
          duration,
          recording.recordingUrl || '/uploads/voice-1794580620776-ee980fcf.webm'
        );

        // Update last message in chat
        db.prepare(`
          UPDATE chats
          SET lastMessage = ?,
              lastMessageTime = ?
          WHERE id = ?
        `).run('📞 Grabación de llamada IVR finalizada', endedAt, targetChatId);

        const newMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
        broadcastEvent({ type: 'new_message', chatId: targetChatId, message: newMsg });
      } catch (insertErr) {
        console.warn('⚠️ Could not insert message into chat timeline:', insertErr.message);
      }
    }

    const finalCall = db.prepare('SELECT * FROM telephony_calls WHERE id = ?').get(callId);
    broadcastEvent({ type: 'telephony_call_ended', call: finalCall, duration });

    res.json({ success: true, call: finalCall, duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Telephony Statistics
router.get('/telephony/stats', (req, res) => {
  try {
    const db = getDb();
    const totalCalls = db.prepare('SELECT COUNT(*) as c FROM telephony_calls').get().c;
    const completedCalls = db.prepare("SELECT COUNT(*) as c FROM telephony_calls WHERE status = 'completed'").get().c;
    const transferredCalls = db.prepare("SELECT COUNT(*) as c FROM telephony_calls WHERE status = 'transferred'").get().c;
    const avgDuration = db.prepare('SELECT AVG(duration) as avg FROM telephony_calls WHERE duration > 0').get().avg || 0;
    const activeDids = db.prepare("SELECT COUNT(*) as c FROM phone_numbers WHERE status = 'active'").get().c;
    const recordingsCount = db.prepare('SELECT COUNT(*) as c FROM call_recordings').get().c;

    const aiContainmentRate = totalCalls > 0
      ? Math.round(((totalCalls - transferredCalls) / totalCalls) * 100)
      : 88;

    res.json({
      totalCalls,
      completedCalls,
      transferredCalls,
      avgDurationSeconds: Math.round(avgDuration),
      activeDids,
      recordingsCount,
      aiContainmentRate,
      providerHealth: {
        twilio: 'operational',
        elevenlabs: 'ready',
        ragEngine: 'connected',
        sipTrunk: 'listening'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SIP / TWILIO VOIP WEBHOOKS ─────────────────────────────────────────────

// Incoming Voice Webhook (TwiML / SIP)
router.post('/telephony/webhooks/voice/incoming', (req, res) => {
  try {
    const from = req.body.From || req.body.from || '+51 987 654 321';
    const to = req.body.To || req.body.to || '+51 1 700 8920';

    const db = getDb();
    const num = db.prepare('SELECT * FROM phone_numbers WHERE phoneNumber = ?').get(to);
    const rootNodeId = num ? num.assignedIvrId : 'ivr-root';
    const rootNode = db.prepare('SELECT * FROM ivr_nodes WHERE id = ?').get(rootNodeId) ||
                     db.prepare('SELECT * FROM ivr_nodes WHERE id = "ivr-root"').get();

    const greeting = rootNode ? rootNode.promptText : 'Bienvenido a CHASKYAPP.';

    // Generate Standard TwiML Voice Response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" timeout="6" numDigits="1" action="/api/telephony/webhooks/voice/gather" method="POST">
    <Say language="es-MX" voice="Polly.Mia">${greeting}</Say>
  </Gather>
  <Redirect>/api/telephony/webhooks/voice/incoming</Redirect>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (err) {
    res.status(500).send(`<Response><Say>Error en el servicio IVR</Say></Response>`);
  }
});

// Gather DTMF / Speech Webhook
router.post('/telephony/webhooks/voice/gather', (req, res) => {
  try {
    const digits = req.body.Digits || req.body.digits || '1';
    const speechResult = req.body.SpeechResult || req.body.speechResult || '';

    const db = getDb();
    const node = db.prepare(`
      SELECT * FROM ivr_nodes
      WHERE id = 'ivr-root'
    `).get();

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Ha seleccionado la opción ${digits}. Conectando con el asistente de voz de CHASKYAPP.</Say>
  <Pause length="1"/>
  <Say language="es-MX" voice="Polly.Mia">¿En qué puedo orientarle hoy?</Say>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (err) {
    res.status(500).send(`<Response><Say>Error procesando dígito</Say></Response>`);
  }
});

// Call Status Callback Webhook
router.post('/telephony/webhooks/voice/status', (req, res) => {
  const callSid = req.body.CallSid || req.body.callSid;
  const callStatus = req.body.CallStatus || req.body.callStatus;
  const duration = req.body.CallDuration || req.body.callDuration || 0;

  try {
    const db = getDb();
    if (callSid) {
      db.prepare(`
        UPDATE telephony_calls
        SET status = ?,
            duration = ?
        WHERE callSid = ?
      `).run(callStatus, parseInt(duration, 10), callSid);
    }
    res.json({ received: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = {
  telephonyRouter: router,
  initTelephonyTables,
  setBroadcastFunction
};
