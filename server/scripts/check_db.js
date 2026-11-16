const { getDb } = require('../database');
const db = getDb();
console.log('--- RECENT CONTACTS ---');
console.log(db.prepare('SELECT id, name, phone FROM contacts ORDER BY createdAt DESC LIMIT 5').all());
console.log('--- RECENT CHATS ---');
console.log(db.prepare('SELECT id, contactId, lastMessage, lastMessageTime, unreadCount FROM chats ORDER BY lastMessageTime DESC LIMIT 5').all());
console.log('--- RECENT MESSAGES ---');
console.log(db.prepare('SELECT id, chatId, senderId, senderName, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5').all());
