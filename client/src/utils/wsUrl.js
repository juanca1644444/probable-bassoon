/**
 * Utility to resolve WebSocket URL dynamically across LAN, Tunnels (Ngrok/LocalTunnel),
 * Vite Dev Server and Production Nginx environments.
 */
export function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:3001';

  // 1. Variable de entorno explícita para WebSocket
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 2. Variable de entorno explícita para Backend URL
  if (import.meta.env.VITE_BACKEND_URL) {
    const base = import.meta.env.VITE_BACKEND_URL.replace(/^http/, 'ws');
    return base.endsWith('/ws') ? base : `${base}/ws`;
  }

  // 3. Entorno de desarrollo local / LAN móvil
  const hostname = window.location.hostname || 'localhost';
  const isDevPort = window.location.port === '5173' || window.location.port === '3000';
  if (isDevPort) {
    const isHttps = window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';
    return `${wsProtocol}//${hostname}:3001`;
  }

  // 4. Producción en Vercel -> Conexión directa al backend en Render
  return 'wss://probable-bassoon-wk5u.onrender.com/ws';
}
