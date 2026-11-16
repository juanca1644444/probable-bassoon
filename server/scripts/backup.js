'use strict';
/**
 * scripts/backup.js — CLI Executable Backup Runner for CHASKYAPP
 * ================================================================
 * Usage: node scripts/backup.js
 */

const { createBackup, listBackups } = require('../services/backupService');

async function main() {
  console.log('====================================================');
  console.log('📦 CHASKYAPP — Generando Respaldo Integral Automatizado');
  console.log('====================================================');

  try {
    const startTime = Date.now();
    const result = await createBackup();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Respaldo completado con éxito:');
    console.log(`- Archivo:     ${result.fileName}`);
    console.log(`- Tamaño:      ${result.sizeFormatted}`);
    console.log(`- Archivos:    ${result.mediaFilesCount} adjuntos multimedia + SQLite`);
    console.log(`- SHA-256:     ${result.checksumSha256}`);
    console.log(`- Duración:    ${duration}s`);
    console.log(`- Destino:     ${result.filePath}`);
    console.log(`- Listo para:  Google Drive / Sincronización Segura\n`);

    console.log('Historial de respaldos disponibles:');
    const all = listBackups();
    all.forEach((b, i) => {
      console.log(`  [${i + 1}] ${b.fileName} (${b.sizeFormatted}) — ${b.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error al generar respaldo:', err.message);
    process.exit(1);
  }
}

main();
