/**
 * CHASKYAPP — Google Sheets CRM Synchronization Service
 * =======================================================
 * Sends CRM leads, stage updates, and parent admissions data to Google Sheets
 * at zero cost using Google Apps Script Webhooks or Google Sheets API.
 */

const https = require('https');
const http = require('http');

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

/**
 * Synchronizes a single lead / deal to Google Sheets via Webhook
 * @param {Object} lead - Lead / Deal details
 * @returns {Promise<Object>}
 */
async function syncLeadToGoogleSheets(lead) {
  const targetUrl = lead.webhookUrl || WEBHOOK_URL;
  if (!targetUrl) {
    // If webhook is not configured, silently skip or return notice
    return { skipped: true, reason: 'GOOGLE_SHEETS_WEBHOOK_URL not configured' };
  }

  const payload = JSON.stringify({
    chatId: lead.chatId || lead.id,
    contactName: lead.contactName || lead.name || 'Contacto Nuevo',
    contactPhone: lead.contactPhone || lead.phone || '',
    channel: lead.channel || 'WhatsApp',
    stageName: lead.stageName || lead.stage || 'Lead Nuevo',
    dealValue: lead.dealValue !== undefined ? Number(lead.dealValue) : 0,
    agentName: lead.agentName || lead.assignedAgentName || 'Equipo Huiracocha',
    notes: lead.notes || lead.lastMessage || '',
    timestamp: new Date().toISOString()
  });

  return new Promise((resolve, reject) => {
    try {
      const url = new URL(targetUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        // Handle Google Apps Script 302 redirects automatically
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location);
          const redirectOptions = {
            hostname: redirectUrl.hostname,
            path: redirectUrl.pathname + redirectUrl.search,
            method: 'GET', // Apps script redirects POST to GET confirmation
            timeout: 10000
          };
          const redirectReq = (redirectUrl.protocol === 'https:' ? https : http).request(redirectOptions, (redirectRes) => {
            let data = '';
            redirectRes.on('data', (chunk) => { data += chunk; });
            redirectRes.on('end', () => {
              try {
                resolve({ success: true, response: JSON.parse(data) });
              } catch (_) {
                resolve({ success: true, raw: data });
              }
            });
          });
          redirectReq.on('error', (err) => resolve({ success: true, redirected: true }));
          redirectReq.end();
          return;
        }

        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({ success: true, response: JSON.parse(body) });
          } catch (_) {
            resolve({ success: true, raw: body });
          }
        });
      });

      req.on('error', (err) => {
        console.warn(`[Google Sheets Sync] Non-blocking warning: ${err.message}`);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(payload);
      req.end();

    } catch (err) {
      console.warn(`[Google Sheets Sync] Error preparing request: ${err.message}`);
      resolve({ success: false, error: err.message });
    }
  });
}

module.exports = {
  syncLeadToGoogleSheets
};
