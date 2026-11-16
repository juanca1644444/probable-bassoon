'use strict';
/**
 * routes/backup.js — Automated Backup Endpoints for CHASKYAPP
 * ==============================================================
 * Exposes endpoints for running backups, listing backups, and downloading them.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { createBackup, listBackups, getBackupPath } = require('../services/backupService');

/**
 * POST /api/backup/run
 * Generates an immediate full backup snapshot
 */
router.post('/run', async (req, res) => {
  try {
    const result = await createBackup();
    res.json({
      success: true,
      message: 'Respaldo integral generado exitosamente',
      backup: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/list
 * Returns list of all available backups
 */
router.get('/list', (req, res) => {
  try {
    const backups = listBackups();
    res.json({
      success: true,
      total: backups.length,
      backups
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/download/:filename
 * Safely downloads a backup ZIP
 */
router.get('/download/:filename', (req, res) => {
  try {
    const fullPath = getBackupPath(req.params.filename);
    if (!fullPath) {
      return res.status(404).json({ success: false, error: 'Archivo de respaldo no encontrado' });
    }
    res.download(fullPath, path.basename(fullPath));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
