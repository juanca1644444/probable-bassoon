const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET /api/contacts
router.get('/', (req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY name ASC').all();
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/contacts
router.post('/', (req, res) => {
  try {
    const { name, phone, avatar, status = '' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO contacts (id, name, avatar, phone, status, lastSeen, isOnline)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, name, avatar || null, phone || null, status, new Date().toISOString());

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  try {
    const { name, phone, avatar, status, isOnline } = req.body;
    const fields = [];
    const values = [];

    if (name     !== undefined) { fields.push('name = ?');     values.push(name); }
    if (phone    !== undefined) { fields.push('phone = ?');    values.push(phone); }
    if (avatar   !== undefined) { fields.push('avatar = ?');   values.push(avatar); }
    if (status   !== undefined) { fields.push('status = ?');   values.push(status); }
    if (isOnline !== undefined) { fields.push('isOnline = ?'); values.push(isOnline); }

    if (fields.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });

    values.push(req.params.id);
    db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
