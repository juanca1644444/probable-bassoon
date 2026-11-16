const db = require('better-sqlite3')('./whatsapp_pro.db');
console.log(db.prepare("PRAGMA table_info(contacts)").all());
console.log(db.prepare("SELECT * FROM contacts LIMIT 5").all());
