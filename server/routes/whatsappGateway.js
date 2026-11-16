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
 * Convenient shortcut to get just the QR image/string
 */
router.get('/qr', (req, res) => {
  try {
    const status = getGatewayStatus();
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
 * POST /api/whatsapp/connect
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
