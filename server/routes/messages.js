const express = require('express');
const router = express.Router({ mergeParams: true });
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET /api/messages/:chatId
router.get('/:chatId', (req, res) => {
  try {
    const db = getDb();
    const { chatId } = req.params;
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE chatId = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `).all(chatId, limit, offset);

    // Parse reactions JSON
    const parsed = messages.map(m => ({
      ...m,
      reactions: JSON.parse(m.reactions || '{}'),
    }));

    // Mark as read
    db.prepare(`UPDATE chats SET unreadCount = 0 WHERE id = ?`).run(chatId);

    res.json({ success: true, data: parsed, total: parsed.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/messages/:chatId — Outgoing message
router.post('/:chatId', async (req, res) => {
  try {
    const db = getDb();
    const { chatId } = req.params;
    const {
      senderId = 'me',
      content = '',
      type = 'text',
      replyTo = null,
      reactions = {},
      fileName = null,
      fileSize = null,
      filePath = null,
    } = req.body;

    const id        = uuidv4();
    const timestamp = Date.now();
    const dispatchStatus = 'delivered';

    db.prepare(`
      INSERT INTO messages (id, chatId, senderId, content, type, timestamp, status, replyTo, reactions, fileName, fileSize, filePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, chatId, senderId, content, type, timestamp, dispatchStatus, replyTo, JSON.stringify(reactions), fileName, fileSize, filePath);

    // Update chat's lastMessage
    db.prepare(`
      UPDATE chats SET lastMessage = ?, lastMessageTime = ? WHERE id = ?
    `).run(content || fileName || 'Archivo', timestamp, chatId);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    res.status(201).json({
      success: true,
      data: { ...message, reactions: JSON.parse(message.reactions || '{}') },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/messages/:chatId/:messageId — update status or reactions
router.patch('/:chatId/:messageId', (req, res) => {
  try {
    const db = getDb();
    const { messageId } = req.params;
    const { status, reactions } = req.body;

    if (status) db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, messageId);
    if (reactions) db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), messageId);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    res.json({
      success: true,
      data: { ...message, reactions: JSON.parse(message.reactions || '{}') },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/messages/:chatId/:messageId
router.delete('/:chatId/:messageId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE id = ? AND chatId = ?').run(req.params.messageId, req.params.chatId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
