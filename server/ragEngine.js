'use strict';
// ragEngine.js — CHASKYAPP Enterprise RAG & AI Copilot Engine
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

// Try loading pdf-parse safely
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('⚠️ pdf-parse module not loaded, will use text extraction fallback for PDFs');
}

// ─── 1. Semantic Stop Words & Tokenizer ───────────────────────────────────────
const STOP_WORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
  'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o',
  'este', 'sí', 'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre',
  'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
  'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e',
  'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él',
  'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'sea', 'poco',
  'ella', 'estar', 'haber', 'estas', 'estaba', 'estamos', 'algunas', 'algo', 'nosotros',
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with'
]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  
  return clean.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// ─── 2. Dense Semantic Feature Embedding (128-D Unit Vector) ─────────────────
const VECTOR_DIM = 128;

function computeEmbedding(text) {
  const tokens = tokenize(text);
  const vec = new Float32Array(VECTOR_DIM);
  if (tokens.length === 0) return Array.from(vec);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let h1 = 0;
    for (let c = 0; c < token.length; c++) {
      h1 = ((h1 << 5) - h1 + token.charCodeAt(c)) | 0;
    }
    const idx1 = Math.abs(h1) % VECTOR_DIM;
    vec[idx1] += 1.0;

    if (i < tokens.length - 1) {
      const bigram = token + '_' + tokens[i + 1];
      let h2 = 0;
      for (let c = 0; c < bigram.length; c++) {
        h2 = ((h2 << 5) - h2 + bigram.charCodeAt(c)) | 0;
      }
      const idx2 = Math.abs(h2) % VECTOR_DIM;
      vec[idx2] += 1.5;
    }
  }

  // L2 Normalization
  let norm = 0.0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0;
  let dot = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0.0, Math.min(1.0, dot));
}

// ─── 3. Intelligent Document Chunking ─────────────────────────────────────────
function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || 500;
  const overlap = options.overlap || 80;
  
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length <= chunkSize) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      if (para.length > chunkSize) {
        const sentences = para.match(/[^.!?]+[.!?]+|\s*$/g) || [para];
        currentChunk = '';
        for (const s of sentences) {
          const sent = s.trim();
          if (!sent) continue;
          if ((currentChunk + ' ' + sent).length <= chunkSize) {
            currentChunk = currentChunk ? currentChunk + ' ' + sent : sent;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sent;
          }
        }
      } else {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = (overlapText ? '...' + overlapText + ' ' : '') + para;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ─── 4. Document Ingestion & Vector Indexing ──────────────────────────────────
async function ingestDocument({ id = null, title, fileName, fileType = 'text', content = '', fileSize = 0, filePath = null, category = 'general' }) {
  const db = getDb();
  const docId = id || uuidv4();

  let rawText = content || '';
  if (!rawText && filePath && fs.existsSync(filePath)) {
    if (fileName?.toLowerCase().endsWith('.pdf') && pdfParse) {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        rawText = pdfData.text || '';
      } catch (err) {
        console.error('Error parsing PDF:', err.message);
        rawText = fs.readFileSync(filePath, 'utf-8');
      }
    } else {
      rawText = fs.readFileSync(filePath, 'utf-8');
    }
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('El documento no contiene texto legible.');
  }

  const chunkTexts = chunkText(rawText);
  const totalChunks = chunkTexts.length;
  const tokenCount = tokenize(rawText).length;

  const insertDoc = db.prepare(`
    INSERT OR REPLACE INTO knowledge_documents 
      (id, title, fileName, fileType, fileSize, filePath, category, status, totalChunks, tokenCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'indexed', ?, ?, ?, ?)
  `);

  const deleteOldChunks = db.prepare(`DELETE FROM vector_chunks WHERE documentId = ?`);
  const insertChunk = db.prepare(`
    INSERT INTO vector_chunks (id, documentId, chunkIndex, content, tokenCount, embedding, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();

  const transaction = db.transaction(() => {
    insertDoc.run(docId, title, fileName || title, fileType, fileSize, filePath, category, totalChunks, tokenCount, now, now);
    deleteOldChunks.run(docId);

    chunkTexts.forEach((chunkStr, index) => {
      const chunkId = uuidv4();
      const chunkTokens = tokenize(chunkStr).length;
      const embedding = computeEmbedding(chunkStr);
      const metadata = JSON.stringify({
        title,
        fileName: fileName || title,
        category,
        chunkIndex: index,
        totalChunks
      });

      insertChunk.run(
        chunkId,
        docId,
        index,
        chunkStr,
        chunkTokens,
        JSON.stringify(embedding),
        metadata,
        now
      );
    });
  });

  transaction();
  console.log(`📚 Indexed document "${title}" into ${totalChunks} vector chunks.`);
  return { id: docId, title, totalChunks, tokenCount };
}

// ─── 5. Hybrid Vector + Lexical Search (Cosine + BM25-style Overlap) ──────────
function searchSimilarChunks(query, topK = 3, minScore = 0.20) {
  const db = getDb();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryVec = computeEmbedding(query);

  const chunks = db.prepare(`
    SELECT vc.id, vc.documentId, vc.chunkIndex, vc.content, vc.tokenCount, vc.embedding, vc.metadata,
           kd.title as docTitle, kd.fileType, kd.category
    FROM vector_chunks vc
    JOIN knowledge_documents kd ON vc.documentId = kd.id
    WHERE kd.status = 'indexed'
  `).all();

  const scored = [];
  for (const chunk of chunks) {
    let embedding = [];
    try {
      embedding = JSON.parse(chunk.embedding);
    } catch (_) {
      continue;
    }

    const cos = cosineSimilarity(queryVec, embedding);
    const chunkTokens = tokenize(chunk.content);
    
    let matches = 0;
    for (const qt of queryTokens) {
      if (chunkTokens.includes(qt)) {
        matches++;
      }
    }
    const lexical = queryTokens.length > 0 ? matches / queryTokens.length : 0;
    
    // Balanced hybrid score: 40% dense semantic embedding + 60% exact lexical term match
    const finalScore = (cos * 0.4) + (lexical * 0.6);

    if (finalScore >= minScore) {
      scored.push({
        id: chunk.id,
        documentId: chunk.documentId,
        docTitle: chunk.docTitle,
        fileType: chunk.fileType,
        category: chunk.category,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: parseFloat(finalScore.toFixed(4)),
        cosine: parseFloat(cos.toFixed(4)),
        lexical: parseFloat(lexical.toFixed(4)),
        metadata: chunk.metadata ? JSON.parse(chunk.metadata) : {}
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ─── 6. Handoff & Escalation Intent Detector ──────────────────────────────────
const HANDOFF_KEYWORDS = [
  'asesor', 'humano', 'operador', 'persona', 'representante', 'agente',
  'hablar con alguien', 'queja', 'reclamo', 'persona real', 'no me ayudas',
  'ayuda humana', 'atencion al cliente', 'quiero una persona', 'supervisor',
  'gerente', 'hablar con asesor', 'contactar asesor', 'pásame con alguien',
  'humano por favor', 'hablar con humano', 'atencion personalizada'
];

function detectHandoffIntent(text, topChunkScore = 0.0, minConfidence = 0.35) {
  if (!text || typeof text !== 'string') return { needsHandoff: false };

  const lower = text.toLowerCase();

  // 1. Direct intent detection
  for (const kw of HANDOFF_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        needsHandoff: true,
        reason: 'user_requested',
        detail: `El usuario solicitó asistencia humana explícita ("${kw}").`
      };
    }
  }

  // 2. High uncertainty check on questions
  const isQuestion = lower.includes('?') || lower.includes('cómo') || lower.includes('como') ||
                     lower.includes('cuánto') || lower.includes('cuanto') || lower.includes('dónde') ||
                     lower.includes('precio') || lower.includes('costo') || lower.includes('horario');

  if (isQuestion && topChunkScore < minConfidence) {
    return {
      needsHandoff: true,
      reason: 'low_confidence',
      detail: `Incertidumbre alta en la base de conocimientos (score ${topChunkScore.toFixed(2)} < ${minConfidence}).`
    };
  }

  return { needsHandoff: false };
}

// ─── 7. Copilot Smart Suggestions Generator ───────────────────────────────────
function generateCopilotSuggestions(chatId, latestMessage, chatHistory = []) {
  if (!latestMessage || !latestMessage.trim()) return [];

  const matchedChunks = searchSimilarChunks(latestMessage, 3, 0.20);
  const handoff = detectHandoffIntent(latestMessage, matchedChunks[0]?.score || 0);

  const suggestions = [];

  // Escalation suggestion if user mentioned human
  if (handoff.needsHandoff && handoff.reason === 'user_requested') {
    suggestions.push({
      id: uuidv4(),
      type: 'handoff',
      title: '🤝 Conectar con Asesor Humano',
      text: '¡Hola! Con mucho gusto te comunico de inmediato con uno de nuestros asesores especializados para atender tu consulta en detalle. Un momento por favor 👨‍💼',
      confidence: 0.99,
      source: 'Protocolo de Handoff CHASKYAPP',
      icon: '👨‍💼',
      actionLabel: 'Escalar y Enviar'
    });
  }

  if (matchedChunks.length > 0) {
    const primary = matchedChunks[0];
    const excerpt = primary.content.replace(/\n+/g, ' ').slice(0, 260);

    // 1. Direct Factual Answer
    suggestions.push({
      id: uuidv4(),
      type: 'factual',
      title: `📄 Respuesta según ${primary.docTitle}`,
      text: `De acuerdo con nuestra información oficial: ${excerpt}... ¿Deseas más información sobre este tema?`,
      confidence: primary.score,
      source: `${primary.docTitle} (Coincidencia: ${Math.round(primary.score * 100)}%)`,
      icon: '🧠',
      actionLabel: 'Usar Respuesta'
    });

    // 2. Actionable Commercial / Service Answer
    suggestions.push({
      id: uuidv4(),
      type: 'commercial',
      title: '💼 Respuesta Comercial y Asistida',
      text: `¡Hola! Con respecto a tu consulta: ${excerpt}. Estamos listos para ayudarte a coordinar. ¿Te gustaría que gestionemos esto hoy mismo?`,
      confidence: Math.max(0.70, primary.score - 0.05),
      source: `${primary.docTitle} (Sugerencia Copilot)`,
      icon: '⚡',
      actionLabel: 'Usar Respuesta'
    });

    // 3. Proactive Question / Closing
    suggestions.push({
      id: uuidv4(),
      type: 'support',
      title: '💬 Pregunta de Seguimiento / Cierre',
      text: `Entiendo perfectamente tu consulta. Basado en nuestras políticas de ${primary.docTitle}, podemos ayudarte de inmediato. ¿Deseas que te comparta el enlace o prefieres coordinar por llamada?`,
      confidence: Math.max(0.65, primary.score - 0.10),
      source: 'Asistente Proactivo CHASKYAPP',
      icon: '🎯',
      actionLabel: 'Usar Respuesta'
    });
  } else {
    suggestions.push({
      id: uuidv4(),
      type: 'polite_fallback',
      title: '👋 Saludo y Consulta de Requerimiento',
      text: '¡Hola! Gracias por comunicarte con nosotros. ¿En qué producto, servicio o trámite podemos ayudarte el día de hoy?',
      confidence: 0.85,
      source: 'Plantilla de Cortesía',
      icon: '👋',
      actionLabel: 'Usar Saludo'
    });
    suggestions.push({
      id: uuidv4(),
      type: 'offer_human',
      title: '👨‍💼 Derivación a Asesor Especializado',
      text: 'Para brindarte la información más exacta y personalizada sobre tu requerimiento, permíteme conectarte con un asesor de nuestro equipo comercial.',
      confidence: 0.80,
      source: 'Protocolo de Derivación',
      icon: '🤝',
      actionLabel: 'Ofrecer Asesor'
    });
  }

  return suggestions;
}

// ─── 8. Settings Helpers ──────────────────────────────────────────────────────
const DEFAULT_RAG_SETTINGS = {
  autonomous_enabled: 'false',
  confidence_threshold: '0.35',
  handoff_keywords: HANDOFF_KEYWORDS.join(','),
  bot_name: 'Chasky Copilot (IA RAG)',
  handoff_message: 'Te estoy transfiriendo de inmediato con un asesor humano para darte una atención personalizada. Un momento por favor... 👨‍💼',
  fallback_message: 'Lo siento, no encontré esa información en nuestra base de conocimientos oficial. ¿Deseas que te comunique con un asesor humano?',
  system_prompt: 'Eres Chasky Copilot, el asistente autónomo de CHASKYAPP. Responde con precisión, cortesía y profesionalismo basándote estrictamente en el contexto provisto.'
};

function getRagSettings() {
  const db = getDb();
  const settings = { ...DEFAULT_RAG_SETTINGS };
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'rag_%'`).all();
  for (const r of rows) {
    const cleanKey = r.key.replace('rag_', '');
    settings[cleanKey] = r.value;
  }
  return settings;
}

function updateRagSettings(newSettings = {}) {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const transaction = db.transaction(() => {
    for (const [k, v] of Object.entries(newSettings)) {
      stmt.run(`rag_${k}`, String(v));
    }
  });
  transaction();
  return getRagSettings();
}

// ─── 9. Seed Initial Enterprise Knowledge Base ────────────────────────────────
function seedInitialKnowledgeBase() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM knowledge_documents').get();
  if (count.c > 0) return;

  console.log('🌱 Seeding initial CHASKYAPP RAG Knowledge Base...');

  const docs = [
    {
      title: 'Manual de Políticas, Pagos y Garantías CHASKYAPP 2026',
      fileName: 'politicas_garantias_2026.pdf',
      fileType: 'pdf',
      category: 'politicas',
      content: `MANUAL OFICIAL DE POLÍTICAS, PAGOS Y GARANTÍAS CHASKYAPP 2026
1. MÉTODOS DE PAGO ACEPTADOS:
Aceptamos pagos directos mediante transferencias inmediatas Yape y Plin (al número corporativo oficial), transferencias bancarias BCP, BBVA, Interbank y pagos seguros con tarjeta de crédito o débito Visa y Mastercard a través de links de pago integrados.

2. POLÍTICA DE GARANTÍAS Y REEMBOLSOS:
Todos los planes y productos adquiridos a través de CHASKYAPP cuentan con garantía de satisfacción total de 30 días calendario. Si el cliente no está satisfecho con el rendimiento del sistema, puede solicitar un reembolso del 100% de su inversión sin penalidades.

3. HORARIOS DE ATENCIÓN Y SOPORTE:
Nuestros canales de mensajería omnicanal operan 24/7 mediante el Bot Autónomo Chasky Copilot. El equipo de asesores humanos está disponible de Lunes a Sábado de 8:00 AM a 8:00 PM y Domingos de 9:00 AM a 2:00 PM (hora de Perú y Colombia).

4. TIEMPOS DE RESPUESTA:
El tiempo de respuesta del Bot de IA RAG es menor a 2 segundos. Las solicitudes escaladas a asesores humanos tienen un tiempo promedio de atención de menos de 5 minutos en horario comercial.`
    },
    {
      title: 'Catálogo de Planes y Precios CHASKYAPP Pro & Enterprise',
      fileName: 'catalogo_planes_precios_2026.pdf',
      fileType: 'catalog',
      category: 'ventas',
      content: `CATÁLOGO OFICIAL DE PLANES Y TARIFAS CHASKYAPP
1. PLAN STARTER ($19 USD / mes o S/. 75 PEN):
- Ideal para emprendedores y pequeños negocios.
- Incluye 1 número de WhatsApp conectado y hasta 3 agentes simultáneos.
- Envío de mensajes masivos hasta 1,000 contactos por mes con motor anti-ban.
- Bandeja omnicanal unificada y respuestas rápidas.

2. PLAN PRO BUSINESS ($39 USD / mes o S/. 149 PEN):
- Para empresas en crecimiento y equipos comerciales.
- Hasta 5 números de WhatsApp y 10 agentes simultáneos.
- Asistente de IA Copilot para sugerencias inteligentes en tiempo real.
- Cobros integrados con Yape, Plin y Stripe con comprobantes automáticos.
- Campañas masivas ilimitadas con calentamiento de chip.

3. PLAN ENTERPRISE VIP ($89 USD / mes o S/. 329 PEN):
- Diseñado para corporaciones, clínicas e instituciones educativas.
- Todo lo del Plan Pro más Agentes Autónomos con Base de Conocimiento RAG ilimitada.
- Acceso a la API REST v1 para integración con ERP, CRM o Zapier.
- Auditoría de seguridad avanzada, RBAC multinivel y respaldos cifrados diarios.
- Soporte prioritario 24/7 y Account Manager dedicado.`
    },
    {
      title: 'Guía Curricular y Admisiones Academia Digital CHASKY',
      fileName: 'guia_curricular_admisiones.pdf',
      fileType: 'manual',
      category: 'educacion',
      content: `GUÍA CURRICULAR Y PROCESO DE ADMISIÓN ACADEMIA CHASKY
1. PROGRAMAS DISPONIBLES:
- Especialización Full Stack con Node.js, React e IA Generativa (Duración: 6 meses).
- Diplomado en Marketing y Ventas Automatizadas por WhatsApp (Duración: 3 meses).
- Certificación Profesional en Ciberseguridad y DevOps (Duración: 4 meses).

2. INICIO DE CLASES Y HORARIOS:
Nuevas cohortes inician el primer lunes de cada mes. Las clases se imparten en modalidad 100% online en vivo (con grabaciones en alta definición disponibles las 24 horas) los días Martes y Jueves de 7:00 PM a 10:00 PM.

3. REQUISITOS Y BECAS:
Para postular se requiere documento de identidad vigente y secundaria completa. Contamos con el Programa Beca Bicentenario con 20% de descuento para postulantes que completen su matrícula antes del día 25 de cada mes.`
    }
  ];

  for (const doc of docs) {
    try {
      ingestDocument(doc);
    } catch (e) {
      console.error('Error seeding doc:', e.message);
    }
  }
}

module.exports = {
  tokenize,
  computeEmbedding,
  cosineSimilarity,
  chunkText,
  ingestDocument,
  searchSimilarChunks,
  detectHandoffIntent,
  generateCopilotSuggestions,
  getRagSettings,
  updateRagSettings,
  seedInitialKnowledgeBase,
  HANDOFF_KEYWORDS
};
