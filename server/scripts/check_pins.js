const db = require('better-sqlite3')('./whatsapp_pro.db');
const chats = db.prepare(`
  SELECT c.id, c.isPinned, c.lastMessage, c.lastMessageTime, co.name as contactName, c.groupName
  FROM chats c
  LEFT JOIN contacts co ON c.contactId = co.id
  WHERE c.isPinned = 1
`).all();
console.log('PINNED CHATS:', chats);
