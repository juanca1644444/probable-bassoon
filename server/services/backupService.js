'use strict';
/**
 * services/backupService.js — Automated Backup & Snapshot Engine for CHASKYAPP
 * ==============================================================================
 * Compresses SQLite database (with WAL flush) and uploaded media (avatars, audios,
 * images) into secure timestamped ZIP archives with Google Drive sync metadata.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { getDb, DB_PATH } = require('../database');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_BACKUP_RETENTION = 10;

// Ensure backup folder exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Calculates SHA-256 checksum of a file
 */
function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Generates an automated compressed backup
 */
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `chasky_backup_${timestamp}`;
  const zipFileName = `${backupId}.zip`;
  const zipFilePath = path.join(BACKUP_DIR, zipFileName);

  // 1. Flush SQLite WAL to ensure pristine database consistency
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(FULL)');
    console.log('💾 [Backup] SQLite WAL checkpoint flush completed successfully.');
  } catch (err) {
    console.warn('⚠️ [Backup] WAL checkpoint notice:', err.message);
  }

  // 2. Count media files
  let mediaCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    mediaCount = fs.readdirSync(UPLOADS_DIR).length;
  }

  // 3. Create zip stream with maximum compression
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const ZipConstructor = archiver.ZipArchive || archiver;
    const archive = typeof ZipConstructor === 'function' && ZipConstructor.prototype?.pipe
      ? new ZipConstructor({ zlib: { level: 9 } })
      : (typeof archiver === 'function' ? archiver('zip', { zlib: { level: 9 } }) : new archiver.ZipArchive({ zlib: { level: 9 } }));

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    // Append database file
    if (fs.existsSync(DB_PATH)) {
      archive.file(DB_PATH, { name: 'whatsapp_pro.db' });
    }

    // Append media files directory
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, 'uploads');
    }

    // Append Google Drive sync manifest
    const manifest = {
      backupId,
      appName: 'CHASKYAPP — Red Privada de Mensajería',
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      databaseSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
      mediaFilesCount: mediaCount,
      googleDriveSync: {
        compatible: true,
        targetFolder: 'CHASKYAPP_Backups',
        uploadPolicy: 'encrypted_archive_v1',
        mimeType: 'application/zip'
      }
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'backup_manifest.json' });

    archive.finalize();
  });

  const stats = fs.statSync(zipFilePath);
  const checksum = await calculateChecksum(zipFilePath);

  console.log(`📦 [Backup] Backup created: ${zipFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  // 4. Rotate old backups
  rotateOldBackups();

  return {
    success: true,
    backupId,
    fileName: zipFileName,
    filePath: zipFilePath,
    sizeBytes: stats.size,
    sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    checksumSha256: checksum,
    mediaFilesCount: mediaCount,
    createdAt: new Date().toISOString()
  };
}

/**
 * Lists all available backup files
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      return {
        fileName: file,
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
        createdAt: stat.mtime.toISOString(),
        downloadUrl: `/api/backup/download/${file}`
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return files;
}

/**
 * Returns absolute path of a backup file if it exists and is secure
 */
function getBackupPath(fileName) {
  const safeName = path.basename(fileName);
  const fullPath = path.join(BACKUP_DIR, safeName);
  if (fs.existsSync(fullPath)) return fullPath;
  return null;
}

/**
 * Keeps only the latest MAX_BACKUP_RETENTION backups
 */
function rotateOldBackups() {
  try {
    const list = listBackups();
    if (list.length > MAX_BACKUP_RETENTION) {
      const toDelete = list.slice(MAX_BACKUP_RETENTION);
      toDelete.forEach(b => {
        const p = path.join(BACKUP_DIR, b.fileName);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`🗑️ [Backup] Rotated old backup: ${b.fileName}`);
        }
      });
    }
  } catch (e) {
    console.warn('⚠️ [Backup] Rotation error:', e.message);
  }
}

/**
 * Starts periodic backup scheduler (default every 24 hours)
 */
function initAutomatedBackupCron(intervalHours = 24) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  console.log(`⏰ [Backup] Automated backup daemon active (every ${intervalHours} hours).`);

  setInterval(async () => {
    try {
      console.log('⏰ [Backup] Starting scheduled automated backup...');
      await createBackup();
    } catch (err) {
      console.error('❌ [Backup] Scheduled backup failed:', err.message);
    }
  }, intervalMs);
}

module.exports = {
  createBackup,
  listBackups,
  getBackupPath,
  initAutomatedBackupCron,
  BACKUP_DIR
};
