/**
 * Utility to resolve API Base URL dynamically across LAN, Tunnels and Production.
 * By default, returns empty string so that relative paths (e.g. '/api/chats')
 * route through Vite's reverse proxy in dev and Nginx in production without CORS issues.
 */
export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  // Ruta relativa por defecto (aprovecha el proxy unificado en puerto 5173)
  return '';
}

export function buildApiUrl(endpoint) {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
