'use strict';
/**
 * routes/whatsappGateway.js — WhatsApp Web Gateway Control API
 * ==============================================================
 * Exposes endpoints for managing the Baileys session, checking live status,
 * retrieving QR codes for scanning, and direct message dispatches.
 */

const express = require('express');
const router = express.Router();
const {
  getGatewayStatus,
  logoutGateway,
  initWhatsAppGateway,
  sendTextMessage
} = require('../services/whatsappGateway');

/**
 * GET /api/whatsapp/status
 * Returns connection state ('connected', 'qr_ready', 'connecting', 'disconnected'),
 * user profile information if connected, and the Base64 QR code if pending scan.
 */
router.get('/status', (req, res) => {
  try {
    const data = getGatewayStatus();
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/whatsapp/qr
 * If requested from a browser (Accept: text/html), renders a live auto-updating visual viewer.
 * If requested as JSON, returns the JSON object.
 */
router.get('/qr', (req, res) => {
  try {
    const status = getGatewayStatus();
    const wantsJson = req.query.format === 'json' || (req.headers.accept && req.headers.accept === 'application/json');

    // ── Visual HTML Viewer for Direct Browser Navigation ────────────────────
    if (!wantsJson) {
      const isConnected = status.status === 'connected';
      const phone = status.user?.id ? status.user.id.split(':')[0] : '';
      const name = status.user?.name || 'CHASKYAPP';

      return res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vincular WhatsApp — CHASKYAPP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #111b21;
      color: #e9edef;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background-color: #202c33;
      border: 1px solid #2a3942;
      border-radius: 24px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      font-weight: 700;
      color: #00a884;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 19px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    p.desc {
      font-size: 13px;
      color: #8696a0;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 20px;
      width: 270px;
      height: 270px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .qr-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .instructions {
      text-align: left;
      background: #111b21;
      border: 1px solid #2a3942;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 12px;
      color: #aebac1;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .instructions ol {
      margin-left: 18px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #00a884;
    }
    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00a884;
      box-shadow: 0 0 8px #00a884;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.4; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.1); }
      100% { opacity: 0.4; transform: scale(0.9); }
    }
    .connected-box {
      padding: 30px 10px;
    }
    .connected-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span>💬</span>
      <span>CHASKYAPP</span>
    </div>
    <h1>Vincular WhatsApp Oficial</h1>
    <p class="desc">Conecta tu teléfono para enviar y recibir mensajes directamente a costo cero ($0.00).</p>

    ${isConnected ? `
      <div class="connected-box">
        <div class="connected-icon">🟢</div>
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #00a884;">¡Teléfono Vinculado y Activo!</h2>
        <p style="font-size: 13px; color: #8696a0;">Conectado como: <strong>+${phone}</strong> (${name})</p>
        <a href="http://localhost:5173/" style="display:inline-block; margin-top:16px; padding:10px 20px; background:#00a884; color:#111b21; font-weight:700; border-radius:12px; text-decoration:none; font-size:14px; box-shadow: 0 4px 12px rgba(0, 168, 132, 0.3);">🚀 Abrir CHASKYAPP (localhost:5173)</a>
      </div>
    ` : `
      <div class="qr-container">
        ${status.qr ? `<img id="qr-img" src="${status.qr}" alt="Código QR WhatsApp" />` : '<p style="color:#111b21; font-size:12px;">Generando código QR...</p>'}
      </div>

      <div class="instructions">
        <ol>
          <li>Abre <strong>WhatsApp</strong> en tu celular.</li>
          <li>Toca <strong>Menú (⋮)</strong> o <strong>Ajustes ⚙️</strong>.</li>
          <li>Selecciona <strong>Dispositivos vinculados</strong>.</li>
          <li>Toca <strong>Vincular un dispositivo</strong> y apunta tu cámara hacia este código.</li>
        </ol>
      </div>

      <div class="status-badge">
        <div class="pulse"></div>
        <span>Actualización en vivo activa</span>
      </div>
    `}
  </div>

  <script>
    // Auto-refresh the QR code every 2.5 seconds until connected
    let isConnected = ${isConnected};
    if (!isConnected) {
      setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp/status');
          const data = await res.json();
          if (data.success && data.data) {
            if (data.data.status === 'connected') {
              window.location.reload();
            } else if (data.data.qr) {
              const img = document.getElementById('qr-img');
              if (img && img.src !== data.data.qr) {
                img.src = data.data.qr;
              }
            }
          }
        } catch (_) {}
      }, 2500);
    }
  </script>
</body>
</html>`);
    }

    // ── JSON API Response for AJAX / Client Fetch ────────────────────────────
    if (status.status === 'connected') {
      return res.json({
        success: true,
        connected: true,
        message: 'WhatsApp ya está conectado.',
        user: status.user,
      });
    }

    if (!status.qr) {
      return res.status(202).json({
        success: false,
        status: status.status,
        message: 'Generando código QR. Intenta de nuevo en 2 segundos...',
      });
    }

    res.json({
      success: true,
      status: status.status,
      qr: status.qr,
      rawQR: status.rawQR,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/whatsapp/qr.png
 * Returns the raw binary PNG image of the QR code
 */
router.get('/qr.png', (req, res) => {
  try {
    const status = getGatewayStatus();
    if (!status.qr) {
      return res.status(404).send('QR no disponible aún. Intenta de nuevo en unos segundos.');
    }

    const base64Data = status.qr.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(imgBuffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * POST /api/whatsapp/connect & /api/whatsapp/restart
 * Forces a connection attempt or restarts the gateway if disconnected
 */
router.post('/connect', async (req, res) => {
  try {
    const current = getGatewayStatus();
    if (current.status === 'connected') {
      return res.json({
        success: true,
        message: 'El gateway ya se encuentra conectado.',
        user: current.user,
      });
    }

    initWhatsAppGateway();
    res.json({
      success: true,
      message: 'Inicializando gateway de WhatsApp. El código QR estará disponible en breve.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/restart', async (req, res) => {
  try {
    await initWhatsAppGateway();
    res.json({
      success: true,
      message: 'Reinicio de conexión iniciado.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/logout
 * Closes active session, wipes stored keys, and regenerates a clean QR code
 */
router.post('/logout', async (req, res) => {
  try {
    await logoutGateway();
    res.json({
      success: true,
      message: 'Sesión de WhatsApp cerrada exitosamente. Puedes escanear un nuevo QR.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/send
 * Direct message dispatch endpoint: { to: '51987654321', message: 'Hola' }
 */
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" (número telefónico) y "message" son obligatorios.',
      });
    }

    const result = await sendTextMessage(to, message);
    res.json({
      success: true,
      message: 'Mensaje despachado exitosamente a través de WhatsApp Web Gateway.',
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
