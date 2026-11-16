import React, { useState, useEffect, useCallback } from 'react'

const AVAILABLE_EVENTS = [
  { id: 'payment.completed', label: 'Pagos Completados' },
  { id: 'payment.created', label: 'Nuevos Cobros Generados' },
  { id: 'ticket.status_changed', label: 'Cambios de Estado de Tickets' },
  { id: 'sentiment.urgent', label: 'Alertas de Sentimiento Urgente' },
  { id: 'new_message', label: 'Nuevos Mensajes Entrantes' }
]

export default function WebhooksSettings() {
  const [webhooks, setWebhooks] = useState([])
  const [logs, setLogs] = useState([])
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState(['payment.completed', 'ticket.status_changed'])
  const [secret, setSecret] = useState('whsec_' + Math.random().toString(36).slice(2, 10))
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [message, setMessage] = useState('')

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/webhooks/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadWebhooks()
    loadLogs()
  }, [loadWebhooks, loadLogs])

  const handleToggleEvent = (evId) => {
    if (selectedEvents.includes(evId)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== evId))
    } else {
      setSelectedEvents([...selectedEvents, evId])
    }
  }

  const handleCreateWebhook = async (e) => {
    e.preventDefault()
    if (!url || !url.startsWith('http')) {
      alert('Ingresa una URL válida que empiece con http:// o https://')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          events: selectedEvents.join(','),
          secret: secret.trim(),
          isActive: 1
        })
      })

      if (res.ok) {
        setUrl('')
        setMessage('Webhook configurado exitosamente')
        loadWebhooks()
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWebhook = async (id) => {
    if (!window.confirm('¿Eliminar este webhook?')) return
    try {
      await fetch(`http://localhost:3001/api/webhooks/${id}`, { method: 'DELETE' })
      loadWebhooks()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTestWebhook = async () => {
    setLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('http://localhost:3001/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url || webhooks[0]?.url || 'https://httpbin.org/post' })
      })
      const data = await res.json()
      setTestResult(data)
      loadLogs()
    } catch (e) {
      setTestResult({ success: false, status: 500, response: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
          <span>🌐</span>
          <span>Webhooks & Integraciones API Externas</span>
        </h3>
        <p className="text-xs text-wa-secondary mt-1 leading-relaxed">
          Notifica en tiempo real a tus sistemas ERP, CRM (HubSpot, Salesforce, Zoho) o bases de datos externas cada vez que ocurran eventos comerciales en CHASKYAPP.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold">
          ✓ {message}
        </div>
      )}

      {/* Create Webhook Form */}
      <form onSubmit={handleCreateWebhook} className="bg-wa-input/40 border border-wa-border/50 rounded-2xl p-4 space-y-3.5">
        <h4 className="text-xs font-bold text-wa-text uppercase tracking-wide">
          Nuevo Webhook Saliente
        </h4>

        <div>
          <label className="text-[11px] font-semibold text-wa-secondary block mb-1">
            URL del Endpoint (POST)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.tu-crm.com/webhooks/whatsapp"
            className="w-full bg-wa-input border border-wa-border rounded-xl px-3 py-2 text-xs text-wa-text focus:outline-none focus:border-wa-green font-mono"
            required
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-wa-secondary block mb-1.5">
            Eventos a Suscribir
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_EVENTS.map((ev) => (
              <label
                key={ev.id}
                className="flex items-center gap-2 text-xs text-wa-text cursor-pointer p-1.5 rounded-lg hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(ev.id)}
                  onChange={() => handleToggleEvent(ev.id)}
                  className="rounded border-wa-border text-wa-green focus:ring-0"
                />
                <span className="text-[11px]">{ev.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-wa-secondary block mb-1">
            Secret Key (Firma HMAC)
          </label>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full bg-wa-input border border-wa-border rounded-xl px-3 py-2 text-xs text-wa-text font-mono focus:outline-none focus:border-wa-green"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleTestWebhook}
            disabled={loading}
            className="py-2 px-3 rounded-xl text-xs font-semibold bg-wa-input hover:bg-white/10 text-wa-secondary hover:text-wa-text border border-wa-border transition-colors flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>Enviar Prueba</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-wa-green hover:bg-green-600 text-white transition-all shadow-md shadow-emerald-500/20"
          >
            {loading ? 'Guardando...' : '+ Guardar Webhook'}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs border animate-fade-in ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <p className="font-bold">
              Resultado de Prueba: {testResult.success ? '✓ 200 OK - Conexión Exitosa' : `✕ Error HTTP ${testResult.status}`}
            </p>
            <pre className="text-[10px] font-mono mt-1 opacity-80 truncate">
              {typeof testResult.response === 'string' ? testResult.response : JSON.stringify(testResult.response)}
            </pre>
          </div>
        )}
      </form>

      {/* Active Webhooks List */}
      <div>
        <h4 className="text-xs font-bold text-wa-secondary uppercase tracking-wider mb-2">
          Webhooks Configurados ({webhooks.length})
        </h4>

        {webhooks.length === 0 ? (
          <div className="p-4 bg-wa-input/30 rounded-xl border border-dashed border-wa-border text-center text-xs text-wa-secondary">
            No hay webhooks activos registrados.
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="p-3 bg-wa-input/50 rounded-xl border border-wa-border/50 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-mono font-bold text-wa-text truncate">{wh.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(wh.events || '').split(',').map((ev, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.2 bg-white/10 rounded text-wa-secondary font-mono">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteWebhook(wh.id)}
                  className="p-1.5 text-wa-secondary hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
                  title="Eliminar webhook"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Table */}
      {logs.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-wa-secondary uppercase tracking-wider mb-2">
            Historial de Envíos Recientes ({logs.length})
          </h4>
          <div className="bg-wa-input/40 border border-wa-border/50 rounded-xl overflow-hidden max-h-44 overflow-y-auto visible-scrollbar">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-wa-header text-wa-secondary sticky top-0">
                <tr>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Evento</th>
                  <th className="p-2">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.slice(0, 8).map((log) => (
                  <tr key={log.id} className="hover:bg-white/5">
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                          log.responseStatus >= 200 && log.responseStatus < 300
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.responseStatus}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-wa-text truncate max-w-[120px]">{log.event}</td>
                    <td className="p-2 text-wa-secondary">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
