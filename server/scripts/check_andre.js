const { getDb } = require('../database');
const db = getDb();
console.log('All chats with contactId in contacts:', db.prepare(`
  SELECT c.id, c.contactId, co.name
  FROM chats c
  LEFT JOIN contacts co ON c.contactId = co.id
  WHERE co.name LIKE '%Andre%'
`).all());
