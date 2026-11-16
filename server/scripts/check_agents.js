const db = require('better-sqlite3')('./whatsapp_pro.db');
console.log('--- AGENTS ---');
try {
  console.log(db.prepare('SELECT * FROM agents').all());
} catch(e) {
  console.log(e.message);
}
console.log('--- CONTACTS COUNT ---');
try {
  console.log(db.prepare('SELECT COUNT(*) as c FROM contacts').get());
} catch(e) {
  console.log(e.message);
}
