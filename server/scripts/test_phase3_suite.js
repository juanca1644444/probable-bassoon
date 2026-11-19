'use strict';
// test_phase3_suite.js — Suite de Pruebas Automatizadas de Fase 3 para CHASKYAPP
const WebSocket = require('ws');
const http = require('http');
const Database = require('better-sqlite3');
const path = require('path');

const WS_URL = 'ws://localhost:5173/ws';
const HTTP_BASE = 'http://localhost:5173';
const DB_PATH = path.join(__dirname, '..', 'whatsapp_pro.db');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   CHASKYAPP — EJECUCIÓN DE PRUEBAS DE PROTOCOLO (FASE 3)           ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // ─── 1. INTEGRIDAD DE BASE DE DATOS SQLITE (TC-04) ────────────────────────
  console.log('1. Verificando Integridad de Base de Datos SQLite...');
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const integrity = db.pragma('integrity_check');
    assert(integrity[0]?.integrity_check === 'ok', `PRAGMA integrity_check: ${integrity[0]?.integrity_check}`);
    
    const journalMode = db.pragma('journal_mode');
    assert(journalMode[0]?.journal_mode === 'wal', `PRAGMA journal_mode: ${journalMode[0]?.journal_mode}`);

    const contactsCount = db.prepare('SELECT count(*) as count FROM contacts').get()?.count || 0;
    assert(contactsCount > 0, `Tabla 'contacts' contiene ${contactsCount} registros`);

    const chatsCount = db.prepare('SELECT count(*) as count FROM chats').get()?.count || 0;
    assert(chatsCount > 0, `Tabla 'chats' contiene ${chatsCount} registros`);

    const messagesCount = db.prepare('SELECT count(*) as count FROM messages').get()?.count || 0;
    assert(messagesCount > 0, `Tabla 'messages' contiene ${messagesCount} registros`);
    db.close();
  } catch (err) {
    assert(false, `Error abriendo base de datos: ${err.message}`);
  }

  // ─── 2. VERIFICACIÓN PWA (MANIFEST & SERVICE WORKER) (TC-03) ───────────────
  console.log('\n2. Verificando PWA (Web Manifest y Service Worker)...');
  await new Promise((resolve) => {
    http.get(`${HTTP_BASE}/manifest.webmanifest`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const manifest = JSON.parse(data);
          assert(res.statusCode === 200, `HTTP GET /manifest.webmanifest (Status 200)`);
          assert(manifest.name && manifest.name.includes('CHASKYAPP'), `Manifest name: "${manifest.name}"`);
          assert(manifest.display === 'standalone', `Manifest display: "${manifest.display}"`);
          assert(manifest.icons && manifest.icons.length >= 2, `Manifest icons: ${manifest.icons?.length} definidos`);
        } catch (e) {
          assert(false, `Error parseando manifest.webmanifest: ${e.message}`);
        }
        resolve();
      });
    }).on('error', (e) => {
      assert(false, `Error conectando a manifest: ${e.message}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    http.get(`${HTTP_BASE}/sw.js`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        assert(res.statusCode === 200, `HTTP GET /sw.js en servidor de desarrollo (Status 200)`);
        const fs = require('fs');
        const distSwPath = path.join(__dirname, '..', '..', 'client', 'dist', 'sw.js');
        if (fs.existsSync(distSwPath)) {
          const swContent = fs.readFileSync(distSwPath, 'utf8');
          assert(swContent.includes('precache') && swContent.includes('workbox'), `Service Worker de producción (dist/sw.js) verificado con precache Workbox (${swContent.length} bytes)`);
        } else {
          assert(data.includes('pwa') || data.includes('registerDevSW'), 'Service Worker contiene lógica dev-sw de vite-plugin-pwa');
        }
        resolve();
      });
    }).on('error', (e) => {
      assert(false, `Error conectando a sw.js: ${e.message}`);
      resolve();
    });
  });

  // ─── 3. WEBSOCKET MULTI-CLIENTE & MENSAJERÍA EN TIEMPO REAL (TC-01) ────────
  console.log('\n3. Verificando WebSockets en Tiempo Real a través de Vite Proxy (:5173/ws)...');
  const clientA = new WebSocket(WS_URL);
  const clientB = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    let aOpen = false;
    let bOpen = false;
    const checkOpen = () => { if (aOpen && bOpen) resolve(); };
    clientA.on('open', () => { aOpen = true; checkOpen(); });
    clientB.on('open', () => { bOpen = true; checkOpen(); });
    clientA.on('error', (e) => console.error('Error Client A:', e.message));
    clientB.on('error', (e) => console.error('Error Client B:', e.message));
  });
  assert(clientA.readyState === WebSocket.OPEN && clientB.readyState === WebSocket.OPEN, 'Ambos clientes WebSocket conectados a través de :5173/ws');

  // Test Typing Broadcast (Client A -> Client B)
  const typingReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'typing' && msg.chatId === 'test_chat_1') {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({ type: 'typing', chatId: 'test_chat_1', userId: 'clientA' }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await typingReceived, 'Difusión de evento "typing" de Cliente A a Cliente B');

  // Test New Message Broadcast (Client A -> Client B)
  const messageReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'new_message' && msg.content === 'Mensaje de prueba P2P') {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({
      type: 'new_message',
      chatId: 'test_chat_1',
      content: 'Mensaje de prueba P2P',
      senderId: 'clientA',
      timestamp: Date.now()
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await messageReceived, 'Difusión de "new_message" de Cliente A a Cliente B');

  // ─── 4. SEÑALIZACIÓN WEBRTC Y PROTOCOLO DE VIDEOLLAMADAS (TC-02) ───────────
  console.log('\n4. Verificando Protocolo de Señalización WebRTC (Llamadas / Video)...');
  const testCallId = `call_${Date.now()}`;

  // 4.1 START_CALL: A -> B
  const startCallReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'START_CALL' && msg.callId === testCallId) {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({
      type: 'START_CALL',
      callId: testCallId,
      chatId: 'test_chat_1',
      callType: 'video',
      callerName: 'Usuario A'
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await startCallReceived, 'Señal START_CALL recibida en Cliente B (timbrado)');

  // 4.2 ACCEPT_CALL: B -> A
  const acceptCallReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ACCEPT_CALL' && msg.callId === testCallId) {
          clientA.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientA.on('message', handler);
    clientB.send(JSON.stringify({
      type: 'ACCEPT_CALL',
      callId: testCallId,
      chatId: 'test_chat_1'
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await acceptCallReceived, 'Señal ACCEPT_CALL recibida en Cliente A (contestada)');

  // 4.3 WEBRTC_OFFER: A -> B
  const offerReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'WEBRTC_OFFER' && msg.callId === testCallId) {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({
      type: 'WEBRTC_OFFER',
      callId: testCallId,
      offer: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await offerReceived, 'Oferta SDP (WEBRTC_OFFER) entregada a Cliente B');

  // 4.4 WEBRTC_ANSWER: B -> A
  const answerReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'WEBRTC_ANSWER' && msg.callId === testCallId) {
          clientA.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientA.on('message', handler);
    clientB.send(JSON.stringify({
      type: 'WEBRTC_ANSWER',
      callId: testCallId,
      answer: { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await answerReceived, 'Respuesta SDP (WEBRTC_ANSWER) entregada a Cliente A');

  // 4.5 WEBRTC_ICE_CANDIDATE: Intercambio bidireccional
  const candidateReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'WEBRTC_ICE_CANDIDATE' && msg.callId === testCallId) {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({
      type: 'WEBRTC_ICE_CANDIDATE',
      callId: testCallId,
      candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.9 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await candidateReceived, 'Candidato ICE intercambiado con éxito');

  // 4.6 END_CALL: A -> B
  const endCallReceived = new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'END_CALL' && msg.callId === testCallId) {
          clientB.removeListener('message', handler);
          resolve(true);
        }
      } catch {}
    };
    clientB.on('message', handler);
    clientA.send(JSON.stringify({
      type: 'END_CALL',
      callId: testCallId
    }));
    setTimeout(() => resolve(false), 2000);
  });
  assert(await endCallReceived, 'Señal END_CALL finaliza la sesión en Cliente B');

  clientA.close();
  clientB.close();

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`   RESUMEN FINAL DE PRUEBAS: ${passed} PASADAS | ${failed} FALLADAS`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 ¡Todas las pruebas de la Fase 3 concluyeron exitosamente!');
    process.exit(0);
  } else {
    console.error('⚠️ Algunas pruebas fallaron.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal en ejecución de pruebas:', err);
  process.exit(1);
});
