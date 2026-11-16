const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB
});

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });

    const id         = uuidv4();
    const uploadedAt = new Date().toISOString();
    const { chatId, messageId } = req.body;

    db.prepare(`
      INSERT INTO files (id, chatId, messageId, fileName, fileSize, filePath, mimeType, uploadedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      chatId    || null,
      messageId || null,
      req.file.originalname,
      req.file.size,
      req.file.filename,
      req.file.mimetype,
      uploadedAt,
    );

    res.status(201).json({
      success: true,
      data: {
        id,
        fileName:   req.file.originalname,
        fileSize:   req.file.size,
        filePath:   req.file.filename,
        mimeType:   req.file.mimetype,
        url:        `/uploads/${req.file.filename}`,
        uploadedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/files/:chatId — list files for a chat
router.get('/:chatId', (req, res) => {
  try {
    const files = db.prepare('SELECT * FROM files WHERE chatId = ? ORDER BY uploadedAt DESC').all(req.params.chatId);
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.upload = upload;
