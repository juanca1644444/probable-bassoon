// Script para insertar endpoint /api/chats/:chatId/media en el servidor
const fs = require('fs')
const path = require('path')

const serverFile = path.join(__dirname, 'server', 'index.js')
let content = fs.readFileSync(serverFile, 'utf8')

const newEndpoint = `
// --- Media Gallery ---
app.get('/api/chats/:chatId/media', (req, res) => {
  const db = getDb();
  const { chatId } = req.params;
  const { type } = req.query; // 'image' | 'file' | 'audio' | 'link'

  let query, params = [chatId];

  if (type === 'image') {
    query = \`SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type = 'image' OR filePath LIKE '%.png' OR filePath LIKE '%.jpg'
                   OR filePath LIKE '%.jpeg' OR filePath LIKE '%.gif' OR filePath LIKE '%.webp')
              ORDER BY timestamp DESC LIMIT 100\`;
  } else if (type === 'file') {
    query = \`SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0 AND type = 'file'
              ORDER BY timestamp DESC LIMIT 100\`;
  } else if (type === 'audio') {
    query = \`SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, duration, waveform, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0 AND type = 'audio'
              ORDER BY timestamp DESC LIMIT 100\`;
  } else if (type === 'link') {
    query = \`SELECT id, chatId, senderId, content, type, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type = 'link' OR (type = 'text' AND content LIKE '%http%'))
              ORDER BY timestamp DESC LIMIT 50\`;
  } else {
    query = \`SELECT id, chatId, senderId, content, type, fileName, fileSize, filePath, timestamp
              FROM messages WHERE chatId = ? AND isDeleted = 0
              AND (type IN ('image','file','audio','link')
                   OR filePath LIKE '%.png' OR filePath LIKE '%.jpg' OR filePath LIKE '%.jpeg'
                   OR filePath LIKE '%.gif' OR filePath LIKE '%.webp')
              ORDER BY timestamp DESC LIMIT 150\`;
  }

  try {
    res.json(db.prepare(query).all(...params));
  } catch (e) {
    console.error('/api/media error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

`

const marker = '// --- Group Members ---'
if (content.includes(marker) && !content.includes('/api/chats/:chatId/media')) {
  content = content.replace(marker, newEndpoint + marker)
  fs.writeFileSync(serverFile, content, 'utf8')
  console.log('✅ Endpoint /api/chats/:chatId/media añadido')
} else if (content.includes('/api/chats/:chatId/media')) {
  console.log('⚠️  Endpoint ya existe, no se duplica')
} else {
  console.error('❌ Marker no encontrado')
  process.exit(1)
}
