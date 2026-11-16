// Script temporal para inyectar mensaje WS y disparar toast
const WebSocket = require('ws')
const ws = new WebSocket('ws://localhost:3001')

ws.on('open', () => {
  const msg = {
    type: 'new_message',
    chatId: 'ch2',
    message: {
      id: 'test-' + Date.now(),
      chatId: 'ch2',
      senderId: 'contact2',
      senderName: 'Carlos Rodríguez',
      content: '¡Hola! ¿Cómo estás? ¿Tienes la reunión hoy? 👋',
      type: 'text',
      timestamp: Date.now(),
      status: 'sent',
      reactions: '{}'
    }
  }
  ws.send(JSON.stringify(msg))
  console.log('✅ Mensaje WS enviado → chatId: ch2')
  setTimeout(() => { ws.close(); process.exit(0) }, 500)
})

ws.on('error', (err) => {
  console.error('❌ Error WS:', err.message)
  process.exit(1)
})
