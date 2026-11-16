import React, { useState } from 'react'
import ApiKeysManager from './ApiKeysManager'
import WebhooksHub from './WebhooksHub'

export default function DeveloperCenter() {
  const [activeSubTab, setActiveSubTab] = useState('keys') // 'keys' | 'webhooks' | 'docs'
  const [copiedCodeId, setCopiedCodeId] = useState(null)

  const handleCopyCode = (id, code) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  return (
    <div className="space-y-6 text-wa-text animate-fade-in">
      {/* Main Header */}
      <div className="border-b border-white/5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
            <span>💻</span>
            <span>Centro de Desarrolladores & Conectividad Externa</span>
          </h3>
          <p className="text-xs text-wa-secondary">
            Administra tus Claves de API, configura disparadores de Webhooks y consulta la documentación de la API REST pública de CHASKYAPP.
          </p>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex items-center gap-1 bg-wa-header p-1 rounded-xl border border-white/5 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('keys')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'keys'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>🔑</span>
            <span>API Keys</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('webhooks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'webhooks'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>🌐</span>
            <span>Webhooks Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('docs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'docs'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>📖</span>
            <span>API Docs v1</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: API KEYS ────────────────────────────────────────────── */}
      {activeSubTab === 'keys' && (
        <ApiKeysManager />
      )}

      {/* ── TAB 2: WEBHOOKS HUB ────────────────────────────────────────── */}
      {activeSubTab === 'webhooks' && (
        <WebhooksHub />
      )}

      {/* ── TAB 3: API REST DOCUMENTATION (v1) ─────────────────────────── */}
      {activeSubTab === 'docs' && (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Quick info banner */}
          <div className="bg-wa-sidebar/70 rounded-2xl border border-emerald-500/30 p-4 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h4 className="text-sm font-bold text-wa-text">CHASKYAPP Public REST API v1</h4>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                http://localhost:3001/api/v1
              </span>
            </div>
            <p className="text-wa-secondary text-xs leading-relaxed">
              Todos los endpoints públicos requieren un token Bearer válido en la cabecera <code>Authorization: Bearer &lt;tu_api_key&gt;</code> o <code>X-API-Key: &lt;tu_api_key&gt;</code>.
            </p>
          </div>

          {/* Endpoints Accordion/List */}
          <div className="space-y-4">
            {/* Endpoint 1: Enviar Mensaje */}
            <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    POST
                  </span>
                  <code className="text-xs font-mono font-bold text-wa-text">/api/v1/messages/send</code>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                  Permiso: messages:send
                </span>
              </div>
              <p className="text-wa-secondary">
                Envía un mensaje de texto inmediato a un número de teléfono o a un chat ID existente. Si el número no existe, se crea el contacto automáticamente.
              </p>

              {/* cURL Snippet */}
              <div className="bg-black/50 p-3 rounded-xl border border-white/10 relative group font-mono text-[11px] text-emerald-300">
                <button
                  type="button"
                  onClick={() => handleCopyCode('send-msg', `curl -X POST http://localhost:3001/api/v1/messages/send \\\n  -H "Authorization: Bearer chasky_live_YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "to": "+34 612 345 678",\n    "message": "Hola! Tu pedido ha sido confirmado con éxito 🛍️"\n  }'`)}
                  className="absolute right-2.5 top-2.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded transition-colors"
                >
                  {copiedCodeId === 'send-msg' ? '✓ Copiado' : 'Copiar cURL'}
                </button>
                <pre>{`curl -X POST http://localhost:3001/api/v1/messages/send \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+34 612 345 678",
    "message": "Hola! Tu pedido ha sido confirmado con éxito 🛍️"
  }'`}</pre>
              </div>
            </div>

            {/* Endpoint 2: Listar Chats */}
            <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    GET
                  </span>
                  <code className="text-xs font-mono font-bold text-wa-text">/api/v1/chats</code>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                  Permiso: chats:read
                </span>
              </div>
              <p className="text-wa-secondary">
                Obtiene la lista de conversaciones activas con filtros opcionales por canal (<code>whatsapp</code>, <code>telegram</code>, <code>web</code>) y estado de ticket (<code>open</code>, <code>pending</code>, <code>resolved</code>).
              </p>

              <div className="bg-black/50 p-3 rounded-xl border border-white/10 relative group font-mono text-[11px] text-blue-300">
                <button
                  type="button"
                  onClick={() => handleCopyCode('get-chats', `curl -X GET "http://localhost:3001/api/v1/chats?channel=whatsapp&status=open" \\\n  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`)}
                  className="absolute right-2.5 top-2.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded transition-colors"
                >
                  {copiedCodeId === 'get-chats' ? '✓ Copiado' : 'Copiar cURL'}
                </button>
                <pre>{`curl -X GET "http://localhost:3001/api/v1/chats?channel=whatsapp&status=open" \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`}</pre>
              </div>
            </div>

            {/* Endpoint 3: Historial de Mensajes */}
            <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    GET
                  </span>
                  <code className="text-xs font-mono font-bold text-wa-text">/api/v1/chats/:id/messages</code>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                  Permiso: chats:read
                </span>
              </div>
              <p className="text-wa-secondary">
                Recupera la cronología completa de mensajes, estados de entrega (sent, delivered, read) y archivos de una conversación.
              </p>

              <div className="bg-black/50 p-3 rounded-xl border border-white/10 relative group font-mono text-[11px] text-blue-300">
                <button
                  type="button"
                  onClick={() => handleCopyCode('get-msgs', `curl -X GET "http://localhost:3001/api/v1/chats/ch1/messages?limit=50" \\\n  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`)}
                  className="absolute right-2.5 top-2.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded transition-colors"
                >
                  {copiedCodeId === 'get-msgs' ? '✓ Copiado' : 'Copiar cURL'}
                </button>
                <pre>{`curl -X GET "http://localhost:3001/api/v1/chats/ch1/messages?limit=50" \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`}</pre>
              </div>
            </div>

            {/* Endpoint 4: Crear Contacto */}
            <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    POST
                  </span>
                  <code className="text-xs font-mono font-bold text-wa-text">/api/v1/contacts</code>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                  Permiso: contacts:manage
                </span>
              </div>
              <p className="text-wa-secondary">
                Registra un nuevo contacto en el directorio omnicanal de CHASKYAPP.
              </p>

              <div className="bg-black/50 p-3 rounded-xl border border-white/10 relative group font-mono text-[11px] text-emerald-300">
                <button
                  type="button"
                  onClick={() => handleCopyCode('create-contact', `curl -X POST http://localhost:3001/api/v1/contacts \\\n  -H "Authorization: Bearer chasky_live_YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Juan Perez",\n    "phone": "+51 987 654 321",\n    "status": "Lead Calificado (CRM)"\n  }'`)}
                  className="absolute right-2.5 top-2.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded transition-colors"
                >
                  {copiedCodeId === 'create-contact' ? '✓ Copiado' : 'Copiar cURL'}
                </button>
                <pre>{`curl -X POST http://localhost:3001/api/v1/contacts \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Juan Perez",
    "phone": "+51 987 654 321",
    "status": "Lead Calificado (CRM)"
  }'`}</pre>
              </div>
            </div>

            {/* Endpoint 5: Resumen de Plataforma */}
            <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    GET
                  </span>
                  <code className="text-xs font-mono font-bold text-wa-text">/api/v1/overview</code>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                  Permiso: chats:read
                </span>
              </div>
              <p className="text-wa-secondary">
                Devuelve el estado operativo de la plataforma, conteo de chats, mensajes, contactos y claves de API activas.
              </p>

              <div className="bg-black/50 p-3 rounded-xl border border-white/10 relative group font-mono text-[11px] text-blue-300">
                <button
                  type="button"
                  onClick={() => handleCopyCode('get-overview', `curl -X GET http://localhost:3001/api/v1/overview \\\n  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`)}
                  className="absolute right-2.5 top-2.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded transition-colors"
                >
                  {copiedCodeId === 'get-overview' ? '✓ Copiado' : 'Copiar cURL'}
                </button>
                <pre>{`curl -X GET http://localhost:3001/api/v1/overview \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN"`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
