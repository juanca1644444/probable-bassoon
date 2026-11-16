const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5173/ws');
ws.on('open', () => {
  console.log('✅ Connected successfully to ws://localhost:5173/ws via Vite proxy!');
  ws.close();
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('❌ Error connecting to /ws:', err.message);
  process.exit(1);
});
