const Database = require('better-sqlite3');
const db = new Database('./whatsapp_pro.db');

console.log('--- TABLES ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));

console.log('\n--- SETTINGS ---');
try {
  console.log(db.prepare('SELECT * FROM settings').all());
} catch (e) {
  console.log('Error reading settings:', e.message);
}
