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

  // 3. Resolución dinámica universal:
  const isHttps = window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const hostname = window.location.hostname || 'localhost';
  const isDevPort = window.location.port === '5173' || window.location.port === '3000';

  // Si estamos en desarrollo en red local (ej: celular en 192.168.1.9:5173 o PC en localhost:5173),
  // conectamos directamente al puerto 3001 del backend para máxima fiabilidad y evitar drops de proxy
  if (isDevPort) {
    return `${wsProtocol}//${hostname}:3001`;
  }

  // En producción (Nginx o túnel seguro de puerto único 80/443), usar el proxy unificado /ws
  return `${wsProtocol}//${window.location.host}/ws`;
}
