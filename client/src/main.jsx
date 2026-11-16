import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ─── Dynamic API & Network Interceptor for Multi-Device & Mobile LAN ──────────
// Ensures that Axios/Fetch requests dynamically use window.location.hostname
// so that testing from mobile (e.g. http://192.168.1.9:5173) connects seamlessly
// to http://192.168.1.9:3001 instead of failing on static localhost:3001.
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  const currentHost = window.location.hostname || 'localhost';
  const isDevPort = window.location.port === '5173' || window.location.port === '3000';
  const envBackend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://probable-bassoon-wk5u.onrender.com' : null);

  window.fetch = function (resource, init) {
    if (typeof resource === 'string') {
      if (envBackend && (resource.startsWith('/api') || resource.startsWith('/uploads'))) {
        // En despliegue Serverless separado (ej: Frontend en Vercel -> Backend en Render)
        resource = `${envBackend.replace(/\/$/, '')}${resource}`;
      } else if (isDevPort) {
        // En entorno de desarrollo LAN o local, apuntar al backend en :3001 usando el hostname dinámico
        if (resource.includes('localhost:3001')) {
          resource = resource.replace('localhost:3001', `${currentHost}:3001`);
        } else if (resource.includes('127.0.0.1:3001')) {
          resource = resource.replace('127.0.0.1:3001', `${currentHost}:3001`);
        } else if (resource.startsWith('/api') || resource.startsWith('/uploads')) {
          resource = `http://${currentHost}:3001${resource}`;
        }
      } else {
        // En producción / Nginx / Túnel WAN, transformar rutas absolutas de dev a rutas relativas
        if (resource.startsWith('http://localhost:3001') || resource.startsWith('http://127.0.0.1:3001')) {
          resource = resource.replace(/^https?:\/\/(localhost|127\.0\.0\.1):3001/, '');
        }
      }
    }
    return originalFetch.call(this, resource, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
