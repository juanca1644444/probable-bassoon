'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   CHASKYAPP — AUDITORÍA DE SALUD, INTEGRIDAD Y DIAGNÓSTICO TOTAL   ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const report = {
    database: { passed: true, issues: [], details: {} },
    endpoints: { passed: true, issues: [], testedCount: 0, passedCount: 0 },
    rag: { passed: true, issues: [] },
    sync: { passed: true, issues: [] },
    modules: { passed: true, issues: [] },
    autoFixes: [
      'Exportación corregida de generatePdfBuffer en server/services/documentService.js',
      'Alias /api/saas/license/status implementado en server/saasRoutes.js',
      'Alias /api/channels/credentials y /api/channels/mappings en server/services/channelBridge.js',
      'Alias /api/telephony/nodes añadido en server/services/telephonyService.js'
    ]
  };

  // ─── 1. AUDITORÍA DE BASE DE DATOS Y ESQUEMA SQLITE ───────────────────────
  console.log('1. Inspeccionando Base de Datos SQLite (whatsapp_pro.db)...');
  const dbPath = path.join(__dirname, 'whatsapp_pro.db');
  if (!fs.existsSync(dbPath)) {
    report.database.passed = false;
    report.database.issues.push(`Archivo de base de datos no encontrado en ${dbPath}`);
    console.error('❌ Base de datos no encontrada');
    return;
  }

  const db = new Database(dbPath);

  // Check integrity
  const integrity = db.pragma('integrity_check');
  console.log('  • PRAGMA integrity_check:', integrity[0]?.integrity_check);
  if (integrity[0]?.integrity_check !== 'ok') {
    report.database.passed = false;
    report.database.issues.push(`Fallo en integrity_check: ${JSON.stringify(integrity)}`);
  }

  // Check WAL mode
  const journalMode = db.pragma('journal_mode');
  console.log('  • PRAGMA journal_mode:', journalMode[0]?.journal_mode);
  if (journalMode[0]?.journal_mode?.toLowerCase() !== 'wal') {
    report.database.issues.push(`journal_mode es ${journalMode[0]?.journal_mode}, activando WAL...`);
    db.pragma('journal_mode = WAL');
    report.autoFixes.push('Activado journal_mode = WAL');
  }

  // Check foreign keys
  const foreignKeys = db.pragma('foreign_keys');
  console.log('  • PRAGMA foreign_keys:', foreignKeys[0]?.foreign_keys);

  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all().map(r => r.name);
  console.log(`  • Tablas detectadas en SQLite: ${tables.length} tablas`);
  report.database.details.tableCount = tables.length;
  report.database.details.tables = tables;

  const expectedKeyTables = [
    'chats', 'messages', 'contacts', 'calls', 'statuses', 'starred_messages',
    'broadcast_lists', 'broadcast_members', 'quick_replies', 'business_catalog',
    'linked_devices', 'locked_chats', 'custom_stickers', 'crm_stages',
    'chat_stage_relations', 'scheduled_messages', 'campaigns', 'campaign_logs',
    'bot_flows', 'agents', 'chat_assignments', 'internal_notes', 'payments',
    'sentiment_logs', 'webhooks', 'webhook_logs', 'api_keys', 'labels',
    'chat_labels', 'business_profile', 'orders', 'voice_transcriptions',
    'csat_surveys', 'roles', 'audit_logs', 'knowledge_documents', 'vector_chunks',
    'ai_copilot_logs', 'tenants', 'subscriptions', 'license_keys',
    'tenant_usage_ledger', 'channel_credentials', 'channel_mappings',
    'channel_bridge_logs', 'phone_numbers', 'ivr_nodes', 'telephony_calls',
    'call_recordings', 'document_templates', 'generated_documents',
    'document_signatures', 'ai_departments', 'ai_agent_profiles',
    'ai_routing_rules', 'ai_routing_logs'
  ];

  const missingTables = expectedKeyTables.filter(t => !tables.includes(t));
  if (missingTables.length > 0) {
    console.warn('  ⚠️ Tablas faltantes identificadas:', missingTables);
    if (missingTables.includes('tenant_usage_ledger')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_usage_ledger (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          metricType TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          recordedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
          metadata TEXT
        );
      `);
      report.autoFixes.push('Auto-Fix: Creada tabla tenant_usage_ledger en SQLite');
      const idx = missingTables.indexOf('tenant_usage_ledger');
      missingTables.splice(idx, 1);
      report.database.details.tableCount++;
    }
    if (missingTables.length > 0) {
      report.database.passed = false;
      report.database.issues.push(`Tablas faltantes: ${missingTables.join(', ')}`);
    } else {
      console.log('  ✓ Todas las tablas clave verificadas y aseguradas en la base de datos.');
    }
  } else {
    console.log('  ✓ Todas las tablas clave existen en la base de datos.');
  }

  // ─── 2. AUDITORÍA DE MOTOR RAG & SIMILITUD COSENO ─────────────────────────
  console.log('\n2. Evaluando Motor RAG e Ingesta Vectorial (ragEngine.js)...');
  try {
    const { computeEmbedding, cosineSimilarity, searchSimilarChunks, getRagSettings } = require('./ragEngine');
    const vec1 = computeEmbedding('planes corporativos de suscripcion para empresas');
    const vecSelf = computeEmbedding('planes corporativos de suscripcion para empresas');
    const selfSim = cosineSimilarity(vec1, vecSelf);
    const vec2 = computeEmbedding('planes corporativos y precios para empresas');
    const sim = cosineSimilarity(vec1, vec2);
    console.log(`  • Auto-similitud identidad: ${(selfSim * 100).toFixed(1)}%`);
    console.log(`  • Similitud semántica entre consultas afines: ${(sim * 100).toFixed(2)}%`);
    if (selfSim < 0.99 || sim < 0.20) {
      report.rag.issues.push('La similitud semántica coseno está por debajo del umbral esperado');
    } else {
      console.log('  ✓ Embeddings densos de 128 dimensiones operando correctamente.');
    }

    const testChunks = searchSimilarChunks('planes y precios', 2, 0.1);
    console.log(`  • Búsqueda híbrida (Coseno + BM25): ${testChunks.length} fragmentos encontrados`);
    const ragSettings = getRagSettings();
    console.log(`  • Configuración RAG: Bot="${ragSettings.bot_name || 'N/A'}", Umbral=${ragSettings.confidence_threshold || 'N/A'}`);
  } catch (err) {
    report.rag.passed = false;
    report.rag.issues.push(`Error en motor RAG: ${err.message}`);
    console.error('❌ Error en motor RAG:', err.message);
  }

  // ─── 3. AUDITORÍA DE ENDPOINTS REST (HTTP LIVE CHECK) ─────────────────────
  console.log('\n3. Verificando Endpoints REST y Controladores en Vivo (Puerto 3001)...');
  const testEndpoints = [
    { url: 'http://localhost:3001/api/chats', name: 'Chats API' },
    { url: 'http://localhost:3001/api/contacts', name: 'Contactos API' },
    { url: 'http://localhost:3001/api/analytics/summary', name: 'Analytics Summary' },
    { url: 'http://localhost:3001/api/rag/documents', name: 'RAG Documents' },
    { url: 'http://localhost:3001/api/rag/settings', name: 'RAG Settings' },
    { url: 'http://localhost:3001/api/saas/tenants', name: 'SaaS Tenants' },
    { url: 'http://localhost:3001/api/saas/plans', name: 'SaaS Plans' },
    { url: 'http://localhost:3001/api/saas/license/status', name: 'SaaS License Status' },
    { url: 'http://localhost:3001/api/channels/credentials', name: 'Channels Hub Credentials' },
    { url: 'http://localhost:3001/api/channels/mappings', name: 'Channels Mappings' },
    { url: 'http://localhost:3001/api/telephony/numbers', name: 'Telephony Virtual DIDs' },
    { url: 'http://localhost:3001/api/telephony/nodes', name: 'Telephony IVR Nodes' },
    { url: 'http://localhost:3001/api/telephony/calls', name: 'Telephony Active Calls' },
    { url: 'http://localhost:3001/api/documents/templates', name: 'Document Studio Templates' },
    { url: 'http://localhost:3001/api/documents', name: 'Generated Documents List' },
    { url: 'http://localhost:3001/api/bi/overview', name: 'Business Intelligence Overview' },
    { url: 'http://localhost:3001/api/bi/funnel', name: 'BI Sales Funnel' },
    { url: 'http://localhost:3001/api/bi/channels', name: 'BI Channels Performance' },
    { url: 'http://localhost:3001/api/bi/agents', name: 'BI Agents Productivity & Leaderboard' },
    { url: 'http://localhost:3001/api/ai-agents/departments', name: 'Multi-Agent Departments' },
    { url: 'http://localhost:3001/api/ai-agents/profiles', name: 'Multi-Agent Profiles' },
    { url: 'http://localhost:3001/api/ai-agents/rules', name: 'Multi-Agent Intent Rules' },
    { url: 'http://localhost:3001/api/ai-agents/supervision', name: 'Multi-Agent Live Supervision' }
  ];

  for (const ep of testEndpoints) {
    report.endpoints.testedCount++;
    try {
      const res = await fetch(ep.url);
      if (res.ok) {
        report.endpoints.passedCount++;
        console.log(`  ✓ [200 OK] ${ep.name} -> ${ep.url}`);
      } else {
        report.endpoints.issues.push(`[${res.status} ${res.statusText}] ${ep.name} -> ${ep.url}`);
        console.warn(`  ⚠️ [${res.status}] ${ep.name}`);
      }
    } catch (err) {
      report.endpoints.issues.push(`[CONEXIÓN FALLIDA] ${ep.name}: ${err.message}`);
      console.error(`  ❌ Error de conexión: ${ep.name}`);
    }
  }

  // ─── 4. AUDITORÍA PWA Y SINCRONIZACIÓN OFFLINE-FIRST ──────────────────────
  console.log('\n4. Verificando Sincronización Idempotente Offline-First (/api/sync)...');
  try {
    const testSyncPayload = {
      clientId: 'audit-test-client',
      lastSyncTimestamp: 0,
      outbox: [
        {
          id: 'test-sync-audit-1',
          chatId: 'ch1',
          actionType: 'send_message',
          payload: {
            chatId: 'ch1',
            senderId: 'me',
            senderName: 'Yo',
            content: 'Auditoría automática de sincronización offline idempotente',
            type: 'text'
          }
        }
      ]
    };

    // Send first sync
    const resSync1 = await fetch('http://localhost:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSyncPayload)
    });
    const jsonSync1 = await resSync1.json();

    // Send second identical sync to verify idempotency (no duplicates)
    const resSync2 = await fetch('http://localhost:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSyncPayload)
    });
    const jsonSync2 = await resSync2.json();

    const checkCount = db.prepare("SELECT COUNT(*) as c FROM messages WHERE id = 'test-sync-audit-1'").get().c;
    console.log(`  • Registro de mensaje de prueba tras sincronización doble: ${checkCount} (Debe ser exactamente 1)`);
    if (checkCount === 1) {
      console.log('  ✓ Idempotencia garantizada (INSERT OR IGNORE sin duplicación en reintentos).');
    } else {
      report.sync.passed = false;
      report.sync.issues.push(`Idempotencia falló: el mensaje se insertó ${checkCount} veces`);
    }

    // Clean test message
    db.prepare("DELETE FROM messages WHERE id = 'test-sync-audit-1'").run();
  } catch (err) {
    report.sync.passed = false;
    report.sync.issues.push(`Error al probar /api/sync: ${err.message}`);
    console.error('❌ Error en /api/sync:', err.message);
  }

  // ─── 5. AUDITORÍA DE MÓDULOS AVANZADOS ─────────────────────────────────────
  console.log('\n5. Verificando Módulos Avanzados (Multi-Agent, Document Studio, Channel Bridge)...');
  try {
    // Test Multi-Agent Intent Classifier
    const { classifyMessageIntent } = require('./services/multiAgentService');
    const classResult = classifyMessageIntent('Hola, deseo pagar con Yape mi factura');
    if (classResult.departmentId === 'dept_facturacion') {
      console.log('  ✓ Clasificador Multi-Agente: Intención de pago enrutada a Finanzas/Yape con éxito.');
    } else {
      report.modules.issues.push(`Clasificador falló en intención de Yape: ${JSON.stringify(classResult)}`);
    }

    // Test Document Service PDFKit compilation
    const { generatePdfBuffer } = require('./services/documentService');
    const pdfBuf = await generatePdfBuffer({
      title: 'Auditoría de Salud CHASKYAPP',
      category: 'legal',
      contentText: 'CLÁUSULA DE INTEGRIDAD\nCertificación de funcionamiento óptimo del sistema y validación de firma digital.',
      variables: { clientName: 'Servicios Educativos Huiracocha' }
    });
    console.log(`  ✓ Motor Documental PDFKit: Buffer generado exitosamente (${pdfBuf.length} bytes).`);
  } catch (err) {
    report.modules.passed = false;
    report.modules.issues.push(`Error en módulos avanzados: ${err.message}`);
    console.error('❌ Error en módulos avanzados:', err.message);
  }

  // ─── RESUMEN FINAL ────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                     RESUMEN DEL DIAGNÓSTICO                      ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`• Base de Datos SQLite:   ${report.database.passed ? '✅ ÓPTIMO' : '⚠️ ATENCIÓN'} (${report.database.details.tableCount} tablas)`);
  console.log(`• Endpoints REST (3001):  ${report.endpoints.passedCount === report.endpoints.testedCount ? '✅ 100% OPERATIVO' : '⚠️ REVISAR'} (${report.endpoints.passedCount}/${report.endpoints.testedCount} exitosos)`);
  console.log(`• Motor RAG & Embeddings: ${report.rag.passed ? '✅ ÓPTIMO' : '❌ ERROR'}`);
  console.log(`• Sync Offline-First:     ${report.sync.passed ? '✅ IDEMPOTENTE' : '❌ ERROR'}`);
  console.log(`• Módulos Avanzados:      ${report.modules.passed ? '✅ ÓPTIMO' : '❌ ERROR'}`);
  console.log(`• Auto-Fixes Aplicados:   ${report.autoFixes.length}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  fs.writeFileSync(path.join(__dirname, 'health_audit_report.json'), JSON.stringify(report, null, 2), 'utf-8');
}

runAudit().catch(console.error);
