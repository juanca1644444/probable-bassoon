const db = require('better-sqlite3')('./whatsapp_pro.db');
const result = db.prepare("UPDATE chats SET isPinned = 0 WHERE isPinned = 1").run();
console.log(`Unpinned ${result.changes} chats.`);

const topChats = db.prepare(`
  SELECT c.id, c.isPinned, c.lastMessage, c.lastMessageTime, co.name as contactName, c.groupName
  FROM chats c
  LEFT JOIN contacts co ON c.contactId = co.id
  ORDER BY c.lastMessageTime DESC
  LIMIT 5
`).all();
console.log('NEW TOP CHATS:', topChats);
