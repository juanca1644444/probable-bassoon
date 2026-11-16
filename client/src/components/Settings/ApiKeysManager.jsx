import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

const AVAILABLE_SCOPES = [
  { id: 'messages:send', label: 'messages:send', name: 'Enviar Mensajes', desc: 'Permite enviar mensajes de texto y plantillas a chats o números.' },
  { id: 'chats:read', label: 'chats:read', name: 'Lectura de Chats', desc: 'Permite consultar la lista de conversaciones y el historial de mensajes.' },
  { id: 'contacts:manage', label: 'contacts:manage', name: 'Gestión de Contactos', desc: 'Permite leer, crear y actualizar contactos del directorio.' },
  { id: 'payments:create', label: 'payments:create', name: 'Generar Cobros', desc: 'Permite generar links de cobro Yape, Plin y pasarelas.' },
  { id: 'webhooks:manage', label: 'webhooks:manage', name: 'Gestión de Webhooks', desc: 'Permite administrar y configurar endpoints de eventos.' }
]

export default function ApiKeysManager() {
  const { addToast } = useAppStore()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyResult, setNewKeyResult] = useState(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState(['messages:send', 'chats:read'])
  const [expiresDays, setExpiresDays] = useState('')
  const [creating, setCreating] = useState(false)

  // Fetch API Keys
  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/api-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching API keys:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  // Toggle scope in form
  const handleToggleScope = (scopeId) => {
    if (selectedScopes.includes(scopeId)) {
      if (selectedScopes.length === 1) return // Keep at least one
      setSelectedScopes(selectedScopes.filter(s => s !== scopeId))
    } else {
      setSelectedScopes([...selectedScopes, scopeId])
    }
  }

  // Create API Key
  const handleCreateKey = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          expiresDays: expiresDays ? Number(expiresDays) : null
        })
      })

      if (res.ok) {
        const data = await res.json()
        setShowCreateModal(false)
        setNewKeyResult(data)
        setName('')
        setSelectedScopes(['messages:send', 'chats:read'])
        setExpiresDays('')
        fetchKeys()

        addToast({
          id: `toast-${Date.now()}`,
          name: 'API Keys',
          message: 'Nueva clave de API generada',
          avatar: ''
        })
      } else {
        const err = await res.json()
        alert(err.message || 'Error al generar clave de API')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // Revoke Key
  const handleRevokeKey = async (id, keyName) => {
    if (!window.confirm(`¿Estás seguro de revocar la clave "${keyName}"? Los sistemas externos perderán el acceso inmediatamente.`)) return

    try {
      const res = await fetch(`/api/api-keys/${id}/revoke`, { method: 'PATCH' })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'API Keys',
          message: 'Clave de API revocada',
          avatar: ''
        })
        fetchKeys()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Delete Key
  const handleDeleteKey = async (id) => {
    if (!window.confirm('¿Eliminar permanentemente este registro de API Key?')) return

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'API Keys',
          message: 'Clave eliminada',
          avatar: ''
        })
        fetchKeys()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2500)
    addToast({
      id: `toast-${Date.now()}`,
      name: 'Portapapeles',
      message: 'Token copiado al portapapeles',
      avatar: ''
    })
  }

  return (
    <div className="space-y-6 text-wa-text animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-wa-text">Claves de API Públicas (API Keys)</h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              REST v1 Activa
            </span>
          </div>
          <p className="text-xs text-wa-secondary mt-1">
            Genera tokens seguros para integrar CHASKYAPP con Zapier, Make, n8n, CRMs y sistemas backend propios.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 self-start"
        >
          <span>＋</span>
          <span>Generar Nueva API Key</span>
        </button>
      </div>

      {/* Keys List */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
        <div className="p-3.5 bg-wa-header/80 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold text-wa-text uppercase tracking-wider">
            Tokens de Acceso Programático ({keys.length})
          </span>
          <span className="text-[11px] text-emerald-400 font-medium">
            🔒 Autenticación Bearer Token
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-14 text-wa-secondary space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Cargando credenciales de API...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-14 text-center text-wa-secondary space-y-2">
            <span className="text-3xl block">🔑</span>
            <p className="text-sm font-semibold">No hay claves de API generadas</p>
            <p className="text-xs">Haz clic en "Generar Nueva API Key" para comenzar.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {keys.map((k) => {
              const isActive = k.status === 'active'
              const lastUsedStr = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('es-ES') : 'Nunca'
              const createdStr = new Date(k.createdAt).toLocaleDateString('es-ES')

              return (
                <div key={k.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-sm font-bold">
                        🔑
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-wa-text">{k.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border-red-500/40'
                          }`}>
                            {isActive ? '● ACTIVA' : 'REVOCADA'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-0.5 rounded border border-white/10 select-all">
                            {k.keyPrefix}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(k.keyPrefix)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
                          >
                            copiar prefijo
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scopes Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pl-11">
                      {(k.scopes || []).map((scope) => (
                        <span key={scope} className="text-[10px] font-mono bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-md">
                          {scope}
                        </span>
                      ))}
                    </div>

                    {/* Stats footer */}
                    <div className="text-[11px] text-wa-secondary pl-11 flex flex-wrap items-center gap-4">
                      <span>📊 Uso: <strong className="text-wa-text">{k.usageCount || 0} peticiones</strong></span>
                      <span>⏱️ Último uso: <strong className="text-wa-text">{lastUsedStr}</strong></span>
                      <span>📅 Creada: {createdStr}</span>
                      {k.expiresAt && (
                        <span>⏳ Expira: {new Date(k.expiresAt).toLocaleDateString('es-ES')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(k.id, k.name)}
                        className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-xl transition-colors"
                        title="Desactivar esta clave de API"
                      >
                        Revocar
                      </button>
                    ) : (
                      <span className="text-xs text-red-400 font-semibold px-2">Revocada</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteKey(k.id)}
                      className="p-1.5 text-wa-icon hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar registro"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Example Snippet */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 p-4 space-y-3">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚡</span>
          <span>Ejemplo Rápido de Integración (cURL)</span>
        </h4>
        <p className="text-xs text-wa-secondary">
          Puedes enviar mensajes directamente desde tu terminal o servicio externo con una simple petición HTTP POST:
        </p>
        <div className="bg-black/50 p-3 rounded-xl border border-white/10 font-mono text-[11px] text-emerald-300 overflow-x-auto relative">
          <pre>{`curl -X POST http://localhost:3001/api/v1/messages/send \\
  -H "Authorization: Bearer chasky_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+34 612 345 678", "message": "Hola desde la API de CHASKYAPP! 🚀"}'`}</pre>
        </div>
      </div>

      {/* ── MODAL: GENERAR NUEVA API KEY ─────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-wa-header border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-wa-text flex items-center gap-2">
                <span>🔑</span>
                <span>Generar Nueva Clave de API</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-wa-icon hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-wa-text block mb-1">
                  Nombre descriptivo del token:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Integración Zapier Ventas, ERP Central, Bot Node.js"
                  className="w-full bg-wa-input px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Scopes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-wa-text block">
                  Permisos y Alcances (Scopes):
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {AVAILABLE_SCOPES.map((sc) => {
                    const isChecked = selectedScopes.includes(sc.id)
                    return (
                      <label
                        key={sc.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
                            : 'bg-black/20 border-white/5 text-wa-secondary hover:border-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleScope(sc.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-700 text-wa-green focus:ring-wa-green/30 bg-wa-header"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-wa-text">{sc.name}</span>
                            <span className="text-[10px] font-mono text-emerald-400">{sc.label}</span>
                          </div>
                          <p className="text-[10px] text-wa-secondary mt-0.5">{sc.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="text-xs font-bold text-wa-text block mb-1">
                  Vigencia de la clave:
                </label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  className="w-full bg-wa-input px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Nunca expira (Recomendado para servidores)</option>
                  <option value="30">30 días</option>
                  <option value="90">90 días</option>
                  <option value="365">1 año (365 días)</option>
                </select>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs text-wa-secondary hover:text-white rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  {creating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Crear Clave de API</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CLAVE GENERADA (ONE-TIME SHOW) ────────────────────────── */}
      {newKeyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-wa-header border-2 border-emerald-500/50 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl">
                🎉
              </div>
              <div>
                <h3 className="text-base font-bold text-wa-text">¡Clave de API Generada!</h3>
                <p className="text-xs text-emerald-400 font-medium">{newKeyResult.name}</p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
              <span className="text-base">⚠️</span>
              <p className="leading-relaxed">
                <strong>Atención:</strong> Por motivos de máxima seguridad, <strong>esta es la única vez que se mostrará tu clave de API completa</strong>. Cópiala y guárdala inmediatamente en un gestor seguro de secretos o variable de entorno.
              </p>
            </div>

            {/* Token box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-wa-secondary uppercase block">
                Tu Token de Acceso (Secret Key):
              </label>
              <div className="flex items-center gap-2 bg-black/60 p-3 rounded-2xl border border-emerald-500/40">
                <input
                  type="text"
                  readOnly
                  value={newKeyResult.key}
                  className="flex-1 bg-transparent text-emerald-300 font-mono text-xs outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newKeyResult.key)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>{copiedKey ? '✓' : '📋'}</span>
                  <span>{copiedKey ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setNewKeyResult(null)}
                className="w-full py-2.5 bg-wa-green hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                He guardado mi clave de forma segura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
