const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET /api/chats
router.get('/', (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT
        c.*,
        co.name     AS contactName,
        co.avatar   AS contactAvatar,
        co.isOnline AS contactIsOnline,
        co.lastSeen AS contactLastSeen,
        co.status   AS contactStatus,
        co.phone    AS contactPhone
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE c.isArchived = 0
      ORDER BY c.isPinned DESC, c.lastMessageTime DESC
    `).all();

    res.json({ success: true, data: chats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chats/archived
router.get('/archived', (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE c.isArchived = 1
      ORDER BY c.lastMessageTime DESC
    `).all();
    res.json({ success: true, data: chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chats/:id
router.get('/:id', (req, res) => {
  try {
    const chat = db.prepare(`
      SELECT c.*, co.name AS contactName, co.avatar AS contactAvatar,
             co.isOnline AS contactIsOnline, co.status AS contactStatus,
             co.phone AS contactPhone, co.lastSeen AS contactLastSeen
      FROM chats c
      LEFT JOIN contacts co ON c.contactId = co.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chats
router.post('/', (req, res) => {
  try {
    const { contactId, type = 'individual', groupName, groupAvatar } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chats (id, contactId, lastMessage, lastMessageTime, unreadCount, isPinned, isMuted, isArchived, type, groupName, groupAvatar)
      VALUES (?, ?, '', ?, 0, 0, 0, 0, ?, ?, ?)
    `).run(id, contactId || null, now, type, groupName || null, groupAvatar || null);

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/chats/:id — update pinned/muted/archived/unreadCount
router.patch('/:id', (req, res) => {
  try {
    const fields = ['isPinned', 'isMuted', 'isArchived', 'unreadCount'];
    const updates = [];
    const values = [];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });

    values.push(req.params.id);
    db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/chats/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM messages WHERE chatId = ?').run(req.params.id);
    db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
