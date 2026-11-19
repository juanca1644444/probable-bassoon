'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'whatsapp_pro.db');
let _db = null;

function getDb() {
  if (!_db) {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    } catch (_) {}
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'Hey there! I am using WhatsApp Pro.',
      lastSeen INTEGER,
      isOnline INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      contactId TEXT,
      type TEXT DEFAULT 'individual',
      groupName TEXT,
      groupAvatar TEXT,
      lastMessage TEXT,
      lastMessageTime INTEGER,
      unreadCount INTEGER DEFAULT 0,
      isPinned INTEGER DEFAULT 0,
      isMuted INTEGER DEFAULT 0,
      isArchived INTEGER DEFAULT 0,
      channel TEXT DEFAULT 'whatsapp',
      status TEXT DEFAULT 'open',
      assignedAgentId TEXT DEFAULT NULL,
      ragBotActive INTEGER DEFAULT 0,
      disappearingTimer INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (contactId) REFERENCES contacts(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      senderId TEXT,
      senderName TEXT,
      content TEXT,
      type TEXT DEFAULT 'text',
      timestamp INTEGER DEFAULT (strftime('%s','now') * 1000),
      status TEXT DEFAULT 'sent',
      replyTo TEXT,
      reactions TEXT DEFAULT '{}',
      fileName TEXT,
      fileSize INTEGER,
      filePath TEXT,
      isDeleted INTEGER DEFAULT 0,
      duration  INTEGER DEFAULT 0,
      waveform  TEXT DEFAULT '[]',
      FOREIGN KEY (chatId) REFERENCES chats(id)
    );
    CREATE TABLE IF NOT EXISTS pinned_messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      pinnedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(chatId, messageId),
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (messageId) REFERENCES messages(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      contactId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(chatId, contactId),
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (contactId) REFERENCES contacts(id)
    );
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
    CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL,
      text TEXT,
      mediaUrl TEXT,
      background TEXT,
      timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS starred_messages (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      chatId TEXT NOT NULL,
      starredAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(chatId, messageId),
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (messageId) REFERENCES messages(id)
    );
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
    CREATE TABLE IF NOT EXISTS quick_replies (
      id TEXT PRIMARY KEY,
      shortcut TEXT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
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
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      fileName TEXT,
      fileType TEXT DEFAULT 'text',
      fileSize INTEGER DEFAULT 0,
      filePath TEXT,
      category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'indexed',
      totalChunks INTEGER DEFAULT 0,
      tokenCount INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS vector_chunks (
      id TEXT PRIMARY KEY,
      documentId TEXT NOT NULL,
      chunkIndex INTEGER DEFAULT 0,
      content TEXT NOT NULL,
      tokenCount INTEGER DEFAULT 0,
      embedding TEXT,
      metadata TEXT,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (documentId) REFERENCES knowledge_documents(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_copilot_logs (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      query TEXT NOT NULL,
      matchedChunks TEXT,
      generatedResponse TEXT NOT NULL,
      confidenceScore REAL DEFAULT 0.0,
      mode TEXT DEFAULT 'copilot',
      handoffTriggered INTEGER DEFAULT 0,
      status TEXT DEFAULT 'sent',
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as c FROM contacts').get();
  if (count.c > 0) {
    ensurePrivateNetworkContacts(db);
    return;
  }

  console.log('🌱 Seeding database...');
  const now = Date.now();
  const H = 3600000, D = 86400000;

  const contacts = [
    { id:'c1', name:'María García',      phone:'+34 612 345 678', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria&backgroundColor=b6e3f4',   status:'🌟 Siempre positiva',       isOnline:1, lastSeen:now-300000 },
    { id:'c2', name:'Carlos Rodríguez',  phone:'+34 698 765 432', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos&backgroundColor=d1d4f9',  status:'💻 Desarrollando el futuro', isOnline:0, lastSeen:now-H*2 },
    { id:'c3', name:'Ana Martínez',      phone:'+34 677 234 567', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana&backgroundColor=c0aede',     status:'☕ Café y código',          isOnline:1, lastSeen:now },
    { id:'c4', name:'Luis Fernández',    phone:'+34 655 876 543', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Luis&backgroundColor=ffdfbf',    status:'🎸 Música y tecnología',    isOnline:0, lastSeen:now-D },
    { id:'c5', name:'Sofía López',       phone:'+34 633 123 456', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia&backgroundColor=ffd5dc',   status:'✈️ Explorando el mundo',   isOnline:0, lastSeen:now-H*5 },
    { id:'me', name:'Tú',               phone:'+34 611 000 001', avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed=Me&backgroundColor=aaffaa',      status:'Usando WhatsApp Pro 🚀',   isOnline:1, lastSeen:now },
  ];
  const ic = db.prepare('INSERT INTO contacts (id,name,phone,avatar,status,isOnline,lastSeen) VALUES (?,?,?,?,?,?,?)');
  contacts.forEach(c => ic.run(c.id,c.name,c.phone,c.avatar,c.status,c.isOnline,c.lastSeen));

  const chats = [
    { id:'ch1', cid:'c1',  type:'individual', gn:null, ga:null,                                                                                                       lm:'¿Viste el partido de anoche? 🏆',         lt:now-300000, uc:2, pin:1, arch:0 },
    { id:'ch2', cid:'c2',  type:'individual', gn:null, ga:null,                                                                                                       lm:'El PR ya está listo para review',          lt:now-H,      uc:0, pin:0, arch:0 },
    { id:'ch3', cid:'c3',  type:'individual', gn:null, ga:null,                                                                                                       lm:'¡Perfecto! Nos vemos mañana ☀️',          lt:now-H*2,    uc:1, pin:0, arch:0 },
    { id:'ch4', cid:null,  type:'group',      gn:'🚀 Equipo Dev Pro',    ga:'https://api.dicebear.com/7.x/identicon/svg?seed=DevPro&backgroundColor=00a884',   lm:'Carlos: Deploy en producción exitoso!',    lt:now-H*3,    uc:5, pin:1, arch:0 },
    { id:'ch5', cid:null,  type:'group',      gn:'👨‍👩‍👧‍👦 Familia García', ga:'https://api.dicebear.com/7.x/identicon/svg?seed=Familia&backgroundColor=ff9966',  lm:'Sofía: Os mando las fotos luego',          lt:now-D,      uc:0, pin:0, arch:0 },
    { id:'ch6', cid:'c4',  type:'individual', gn:null, ga:null,                                                                                                       lm:'El concierto estuvo brutal 🎸',           lt:now-D*2,    uc:0, pin:0, arch:1 },
  ];
  const ich = db.prepare('INSERT INTO chats (id,contactId,type,groupName,groupAvatar,lastMessage,lastMessageTime,unreadCount,isPinned,isMuted,isArchived) VALUES (?,?,?,?,?,?,?,?,?,0,?)');
  chats.forEach(c => ich.run(c.id,c.cid,c.type,c.gn,c.ga,c.lm,c.lt,c.uc,c.pin,c.arch));

  const im = db.prepare('INSERT INTO group_members (id,chatId,contactId,role) VALUES (?,?,?,?)');
  ['c1','c2','c3','me'].forEach((id,i) => im.run(uuidv4(),'ch4',id,i===0?'admin':'member'));
  ['c1','c4','c5','me'].forEach((id,i) => im.run(uuidv4(),'ch5',id,i===0?'admin':'member'));

  const insMsg = db.prepare('INSERT INTO messages (id,chatId,senderId,senderName,content,type,timestamp,status,reactions) VALUES (?,?,?,?,?,?,?,?,?)');

  const seed = (chatId, msgs) => msgs.forEach(m =>
    insMsg.run(uuidv4(), chatId, m.s, m.n||null, m.c, 'text', m.t, m.st||'read', '{}')
  );

  seed('ch1', [
    {s:'c1', c:'¡Hola! ¿Cómo estás? 😊', t:now-D-H*3},
    {s:'me', c:'¡Muy bien gracias! ¿Y tú? 🙌', t:now-D-H*2.9},
    {s:'c1', c:'Genial, estuve revisando el nuevo proyecto. Tiene muy buena pinta 🎉', t:now-D-H*2.5},
    {s:'me', c:'Sí, hemos trabajado mucho. La arquitectura es:\n```\nFrontend: React + Tailwind\nBackend: Node.js + SQLite\nWS: Real-time\n```', t:now-D-H*2},
    {s:'c1', c:'¡Impresionante! ¿Cuándo lo lanzamos?', t:now-D-H},
    {s:'me', c:'Esta semana si todo va bien 🚀', t:now-D-H*0.5},
    {s:'c1', c:'¿Viste el partido de anoche? 🏆', t:now-300000, st:'delivered'},
    {s:'c1', c:'¡Fue increíble el gol en el último minuto!', t:now-250000, st:'delivered'},
  ]);
  seed('ch2', [
    {s:'me', c:'Carlos, ¿pudiste revisar el bug de autenticación?', t:now-D*2},
    {s:'c2', c:'Sí, era un problema con el token JWT. Ya lo arreglé ✅', t:now-D*2+H},
    {s:'me', c:'Perfecto! ¿Lo pusiste en la rama de desarrollo?', t:now-D*2+H*2},
    {s:'c2', c:'Sí, ya está en `feature/fix-auth`. Hice también los tests unitarios.', t:now-D},
    {s:'me', c:'Genial, lo reviso ahora mismo 👀', t:now-D+H},
    {s:'c2', c:'El PR ya está listo para review', t:now-H},
  ]);
  seed('ch3', [
    {s:'c3', c:'¿Quedamos para comer mañana? 🍕', t:now-D},
    {s:'me', c:'Claro! ¿A las 2pm te va bien?', t:now-D+H},
    {s:'c3', c:'Perfecto! En el restaurante de siempre 🏠', t:now-D+H*2},
    {s:'me', c:'Genial, yo me encargo de reservar', t:now-H*3},
    {s:'c3', c:'¡Perfecto! Nos vemos mañana ☀️', t:now-H*2, st:'delivered'},
  ]);
  seed('ch4', [
    {s:'c1', n:'María',  c:'Buenos días equipo! Hoy tenemos sprint review 📋', t:now-D-H*5},
    {s:'c2', n:'Carlos', c:'Perfecto. Tengo todas las tareas completadas ✅', t:now-D-H*4},
    {s:'c3', n:'Ana',    c:'Yo también. El módulo de pagos está listo 💳', t:now-D-H*3.5},
    {s:'me',             c:'Excelente trabajo equipo! La demo va a salir muy bien 🎯', t:now-D-H*3},
    {s:'c1', n:'María',  c:'He preparado las diapositivas. Las comparto ahora', t:now-D-H*2},
    {s:'c2', n:'Carlos', c:'¿Alguien puede revisar el merge de la rama principal?', t:now-H*6},
    {s:'me',             c:'Ya lo veo. Parece que hay un conflicto en `src/api/routes.js`', t:now-H*5},
    {s:'c3', n:'Ana',    c:'Lo resuelvo yo, es mi código 👍', t:now-H*4.5},
    {s:'c3', n:'Ana',    c:'Listo! Conflicto resuelto y merge aprobado ✅', t:now-H*4},
    {s:'c2', n:'Carlos', c:'Deploy en producción exitoso! 🚀🎉', t:now-H*3, st:'delivered'},
    {s:'c1', n:'María',  c:'¡Brutal! Gran trabajo a todos 🏆', t:now-H*2.5, st:'delivered'},
    {s:'me',             c:'¡Celebramos esta semana! 🍾', t:now-H*2, st:'delivered'},
  ]);
  seed('ch5', [
    {s:'c1', n:'María', c:'Familia, ¿quedan para cenar el sábado?', t:now-D*2},
    {s:'c5', n:'Sofía', c:'¡Sí! Yo traigo el postre 🍰', t:now-D*2+H},
    {s:'c4', n:'Luis',  c:'Yo pongo la música 🎸', t:now-D*2+H*2},
    {s:'me',            c:'Genial! En casa de mamá a las 9pm', t:now-D*2+H*3},
    {s:'c5', n:'Sofía', c:'Os mando las fotos luego', t:now-D, st:'delivered'},
  ]);

  const isetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  [['theme','dark'],['notifications','true'],['enterToSend','true'],['fontSize','14'],['language','es'],['aiSummaryEnabled','true']]
    .forEach(([k,v]) => isetting.run(k,v));

  ensurePrivateNetworkContacts(db);
  console.log('✅ Database seeded!');
}

function ensurePrivateNetworkContacts(db) {
  try {
    const now = Date.now();
    const contacts = [
      { id: 'c_andre', name: 'Andre', phone: '+51 987 654 321', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andre&backgroundColor=d1d4f9', status: 'Disponible · Red Móvil CHASKY', chatId: 'chat_andre' },
      { id: 'c_daniella', name: 'Daniella Rivera', phone: '+51 991 223 344', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniella&backgroundColor=ffd5dc', status: 'En reunión · Ventas', chatId: 'chat_daniella' },
      { id: 'c_carolina', name: 'Carolina', phone: '+51 992 334 455', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carolina&backgroundColor=b6e3f4', status: 'En ruta · Logística', chatId: 'chat_carolina' },
      { id: 'c_hilda', name: 'Hilda', phone: '+51 993 445 566', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hilda&backgroundColor=c0aede', status: 'Facturación y Finanzas', chatId: 'chat_hilda' },
      { id: 'c_uchy', name: 'Uchy', phone: '+51 994 556 677', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Uchy&backgroundColor=aaffaa', status: 'Operaciones activas', chatId: 'chat_uchy' }
    ];

    const insContact = db.prepare(`
      INSERT OR IGNORE INTO contacts (id, name, phone, avatar, status, isOnline, lastSeen, createdAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insChat = db.prepare(`
      INSERT OR IGNORE INTO chats (id, contactId, type, groupName, groupAvatar, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, createdAt)
      VALUES (?, ?, 'individual', null, null, 'Conectado a la Red Privada CHASKYAPP 🌐', ?, 0, 0, 0, 0, ?)
    `);

    contacts.forEach(c => {
      insContact.run(c.id, c.name, c.phone, c.avatar, c.status, now, now);
      insChat.run(c.chatId, c.id, now, now);
    });
  } catch (err) {
    console.warn('ensurePrivateNetworkContacts error:', err.message);
  }
}

module.exports = { getDb, initDatabase, DB_PATH };
