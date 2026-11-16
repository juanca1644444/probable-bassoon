import React, { useState, useEffect, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'

const AVAILABLE_EVENTS = [
  { id: 'message.received', label: 'message.received', name: 'Mensaje Recibido', desc: 'Disparado cuando un cliente envía un mensaje entrante.', icon: '📥' },
  { id: 'message.sent', label: 'message.sent', name: 'Mensaje Saliente', desc: 'Disparado cuando un operador o bot despacha un mensaje.', icon: '📤' },
  { id: 'payment.completed', label: 'payment.completed', name: 'Pago Completado', desc: 'Disparado cuando un pago Yape/Plin/Stripe es validado.', icon: '✅' },
  { id: 'payment.created', label: 'payment.created', name: 'Cobro Generado', desc: 'Disparado al crear una nueva solicitud de cobro.', icon: '💳' },
  { id: 'chat.assigned', label: 'chat.assigned', name: 'Asignación de Chat', desc: 'Disparado cuando un ticket se asigna a un operador.', icon: '👤' },
  { id: 'ticket.status_changed', label: 'ticket.status_changed', name: 'Estado de Ticket', desc: 'Disparado al cambiar a Abierto, En Espera o Resuelto.', icon: '🏷️' },
  { id: 'csat.submitted', label: 'csat.submitted', name: 'Encuesta CSAT', desc: 'Disparado cuando el cliente califica el servicio con estrellas.', icon: '⭐' },
  { id: 'sentiment.urgent', label: 'sentiment.urgent', name: 'Alerta Urgente IA', desc: 'Disparado al detectar cliente con alta molestia o urgencia.', icon: '🚨' }
]

export default function WebhooksHub() {
  const { addToast } = useAppStore()
  const [webhooks, setWebhooks] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedLogPayload, setSelectedLogPayload] = useState(null)
  const [testingHookId, setTestingHookId] = useState(null)
  const [retryingLogId, setRetryingLogId] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState(['payment.completed', 'ticket.status_changed', 'message.sent'])
  const [secret, setSecret] = useState('whsec_' + Math.random().toString(36).slice(2, 10))
  const [creating, setCreating] = useState(false)

  // Fetch Webhooks
  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Fetch Delivery Logs
  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadWebhooks(), loadLogs()]).finally(() => setLoading(false))
  }, [loadWebhooks, loadLogs])

  // Toggle event in form
  const handleToggleEvent = (evId) => {
    if (selectedEvents.includes(evId)) {
      if (selectedEvents.length === 1) return
      setSelectedEvents(selectedEvents.filter(e => e !== evId))
    } else {
      setSelectedEvents([...selectedEvents, evId])
    }
  }

  // Create Webhook
  const handleCreateWebhook = async (e) => {
    e.preventDefault()
    if (!url.startsWith('http')) {
      alert('La URL debe comenzar con http:// o https://')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Webhook Endpoint',
          url: url.trim(),
          events: selectedEvents.join(','),
          secret: secret.trim(),
          isActive: 1
        })
      })

      if (res.ok) {
        setShowCreateModal(false)
        setName('')
        setUrl('')
        setSelectedEvents(['payment.completed', 'ticket.status_changed', 'message.sent'])
        setSecret('whsec_' + Math.random().toString(36).slice(2, 10))
        loadWebhooks()

        addToast({
          id: `toast-${Date.now()}`,
          name: 'Webhooks Hub',
          message: 'Webhook registrado exitosamente',
          avatar: ''
        })
      } else {
        const err = await res.json()
        alert(err.error || 'Error al registrar webhook')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // Toggle Active State
  const handleToggleActive = async (hook) => {
    const nextState = hook.isActive ? 0 : 1
    try {
      const res = await fetch(`/api/webhooks/${hook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState })
      })
      if (res.ok) {
        loadWebhooks()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Webhooks Hub',
          message: nextState ? 'Webhook activado' : 'Webhook pausado',
          avatar: ''
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Delete Webhook
  const handleDeleteWebhook = async (id, hookName) => {
    if (!window.confirm(`¿Eliminar el webhook "${hookName}"?`)) return
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Webhooks Hub',
          message: 'Webhook eliminado',
          avatar: ''
        })
        loadWebhooks()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Test Webhook (Ping)
  const handleTestWebhook = async (hook) => {
    setTestingHookId(hook.id)
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: hook.url,
          secret: hook.secret,
          event: 'webhook.ping'
        })
      })

      const data = await res.json()
      loadLogs()

      if (data.success) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Webhook Test',
          message: `✓ Ping exitoso (${data.status}) en ${data.duration_ms}ms`,
          avatar: ''
        })
      } else {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Webhook Test Fallido',
          message: `HTTP ${data.status}: ${data.response || 'Error de conexión'}`,
          avatar: ''
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setTestingHookId(null)
    }
  }

  // Manual Retry for a specific delivery log
  const handleRetryLog = async (logId) => {
    setRetryingLogId(logId)
    try {
      const res = await fetch(`/api/webhooks/logs/${logId}/retry`, { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Reintento Webhook',
          message: data.message || 'Reintento despachado con éxito',
          avatar: ''
        })
        setTimeout(() => {
          loadLogs()
          loadWebhooks()
        }, 1200)
      } else {
        alert(data.error || 'Error al reintentar entrega')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRetryingLogId(null)
    }
  }

  // Calculate Metrics
  const totalDeliveries = logs.length
  const successDeliveries = logs.filter(l => l.responseStatus >= 200 && l.responseStatus < 300).length
  const successRate = totalDeliveries > 0 ? Math.round((successDeliveries / totalDeliveries) * 100) : 100

  return (
    <div className="space-y-6 text-wa-text animate-fade-in">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-wa-text">Centro de Webhooks & Disparadores de Eventos</h3>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
              HMAC SHA-256
            </span>
          </div>
          <p className="text-xs text-wa-secondary mt-1">
            Transmite eventos en tiempo real a tus endpoints externos con firma criptográfica y reintentos automáticos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 self-start"
        >
          <span>＋</span>
          <span>Registrar Webhook</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
            🌐
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Webhooks</p>
            <p className="text-base font-bold text-wa-text">{webhooks.length}</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
            ⚡
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Eventos</p>
            <p className="text-base font-bold text-blue-300">8 Disponibles</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">
            📨
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Entregas</p>
            <p className="text-base font-bold text-teal-300">{totalDeliveries}</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
            🎯
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Éxito</p>
            <p className="text-base font-bold text-emerald-400">{successRate}%</p>
          </div>
        </div>
      </div>

      {/* Webhooks Registered Cards */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden shadow-lg space-y-1">
        <div className="p-3.5 bg-wa-header/80 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold text-wa-text uppercase tracking-wider">
            Endpoints Registrados ({webhooks.length})
          </span>
          <span className="text-[11px] text-emerald-400 font-medium">
            ✓ Transmisión asíncrona activa
          </span>
        </div>

        {webhooks.length === 0 ? (
          <div className="py-10 text-center text-wa-secondary space-y-2">
            <span className="text-3xl block">🌐</span>
            <p className="text-sm font-semibold">No hay webhooks registrados</p>
            <p className="text-xs">Registra un endpoint para empezar a recibir notificaciones automáticas.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {webhooks.map((hook) => {
              const eventsList = (hook.events || '').split(',').map(e => e.trim()).filter(Boolean)
              const isAllEvents = eventsList.includes('*')

              return (
                <div key={hook.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        🔗
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-wa-text truncate">{hook.name || 'Webhook'}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            hook.isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                          }`}>
                            {hook.isActive ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <code className="text-xs font-mono text-emerald-300 block truncate mt-0.5" title={hook.url}>
                          {hook.url}
                        </code>
                      </div>
                    </div>

                    {/* Events Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pl-11">
                      {isAllEvents ? (
                        <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-md">
                          ⭐ Todos los eventos (*)
                        </span>
                      ) : (
                        eventsList.map((ev) => (
                          <span key={ev} className="text-[10px] font-mono bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-md">
                            {ev}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Stats footer */}
                    <div className="text-[11px] text-wa-secondary pl-11 flex flex-wrap items-center gap-4">
                      <span>✓ Éxitos: <strong className="text-emerald-400">{hook.successCount || 0}</strong></span>
                      <span>✕ Fallos: <strong className="text-red-400">{hook.failureCount || 0}</strong></span>
                      <span>🔑 Secret: <code className="text-gray-400 font-mono text-[10px]">{hook.secret?.slice(0, 10)}...</code></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      disabled={testingHookId === hook.id}
                      onClick={() => handleTestWebhook(hook)}
                      className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                      title="Enviar un ping de prueba inmediato"
                    >
                      {testingHookId === hook.id ? (
                        <span className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>⚡</span>
                      )}
                      <span>Ping Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(hook)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                        hook.isActive
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {hook.isActive ? 'Pausar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWebhook(hook.id, hook.name)}
                      className="p-1.5 text-wa-icon hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar webhook"
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

      {/* ── DELIVERY LOGS SECTION ────────────────────────────────────────── */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden shadow-lg space-y-3">
        <div className="p-3.5 bg-wa-header/80 border-b border-white/5 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-wa-text uppercase tracking-wider">
              Historial de Entregas & Reintentos (Logs)
            </h4>
            <p className="text-[10px] text-wa-secondary">Últimos despachos HTTP y estado de respuesta del servidor externo</p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-wa-text border border-white/10 flex items-center gap-1 transition-colors"
          >
            <span>🔄</span>
            <span>Refrescar</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-wa-secondary">
            No hay registros de entregas recientes.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[340px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-wa-header/90 sticky top-0 z-10 border-b border-white/10 text-wa-secondary text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Hora</th>
                  <th className="py-2.5 px-3">Evento</th>
                  <th className="py-2.5 px-3">Estado HTTP</th>
                  <th className="py-2.5 px-3">Latencia</th>
                  <th className="py-2.5 px-3">Intento</th>
                  <th className="py-2.5 px-3">URL Destino</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const dateObj = new Date(log.createdAt)
                  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  const isSuccess = log.responseStatus >= 200 && log.responseStatus < 300

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-wa-secondary">
                        {timeStr}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] bg-white/5 text-emerald-300 px-2 py-0.5 rounded border border-white/10">
                          {log.event}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-red-500/20 text-red-400 border-red-500/40'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {log.responseStatus || 500} {isSuccess ? 'OK' : 'Error'}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] text-gray-400">
                        {log.duration_ms ? `${log.duration_ms} ms` : '< 50 ms'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                          #{log.attempt || 1}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate font-mono text-[10px] text-gray-300" title={log.url}>
                        {log.url}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLogPayload(log)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-wa-text rounded transition-colors"
                          title="Ver contenido transmitido"
                        >
                          👁️ Payload
                        </button>
                        <button
                          type="button"
                          disabled={retryingLogId === log.id}
                          onClick={() => handleRetryLog(log.id)}
                          className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/30 transition-colors inline-flex items-center gap-1"
                          title="Reintentar despacho manualmente"
                        >
                          {retryingLogId === log.id ? (
                            <span className="w-2.5 h-2.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>🔁</span>
                          )}
                          <span>Retry</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: REGISTRAR WEBHOOK ─────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-wa-header border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-wa-text flex items-center gap-2">
                <span>🌐</span>
                <span>Registrar Nuevo Webhook Endpoint</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-wa-icon hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-wa-text block mb-1">
                  Nombre descriptivo:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Zapier Lead Capture, Make Invoices, ERP Propio"
                  className="w-full bg-wa-input px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-wa-text block mb-1">
                  URL del Endpoint de Destino (POST):
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full bg-wa-input px-3.5 py-2 text-xs font-mono rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Event selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-wa-text block">
                  Eventos a Transmitir:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {AVAILABLE_EVENTS.map((ev) => {
                    const isChecked = selectedEvents.includes(ev.id)
                    return (
                      <label
                        key={ev.id}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-purple-950/25 border-purple-500/40 text-purple-100'
                            : 'bg-black/20 border-white/5 text-wa-secondary hover:border-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEvent(ev.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-700 text-purple-500 focus:ring-purple-500/30 bg-wa-header"
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-wa-text block">{ev.icon} {ev.name}</span>
                          <span className="text-[9px] font-mono text-purple-300 block">{ev.label}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Secret */}
              <div>
                <label className="text-xs font-bold text-wa-text block mb-1">
                  Clave Secreta de Firma (HMAC SHA-256):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="flex-1 bg-wa-input px-3.5 py-2 text-xs font-mono rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSecret('whsec_' + Math.random().toString(36).slice(2, 10))}
                    className="px-2.5 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-xl text-wa-secondary hover:text-white border border-white/10"
                    title="Generar nueva clave aleatoria"
                  >
                    🎲 Regenerar
                  </button>
                </div>
                <p className="text-[10px] text-wa-secondary mt-1">
                  Se envía en el encabezado <code>X-Chasky-Signature</code> para verificar autenticidad.
                </p>
              </div>

              {/* Buttons */}
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
                  disabled={creating || !url.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  {creating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Guardar Webhook</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VER PAYLOAD DETALLADO ─────────────────────────────────── */}
      {selectedLogPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-wa-header border border-white/10 rounded-2xl p-5 w-full max-w-lg shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-bold text-wa-text flex items-center gap-2">
                <span>📦</span>
                <span>Detalle de Entrega de Webhook</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLogPayload(null)}
                className="text-wa-icon hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-[11px]">
                <div>
                  <span className="text-wa-secondary block text-[10px]">EVENTO:</span>
                  <span className="text-emerald-400 font-bold">{selectedLogPayload.event}</span>
                </div>
                <div>
                  <span className="text-wa-secondary block text-[10px]">ESTADO HTTP:</span>
                  <span className={selectedLogPayload.responseStatus === 200 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedLogPayload.responseStatus}
                  </span>
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-wa-secondary block text-[10px]">URL DESTINO:</span>
                  <span className="text-gray-300">{selectedLogPayload.url}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-wa-secondary uppercase block mb-1">
                  Cuerpo del Mensaje Transmitido (JSON Payload):
                </label>
                <div className="bg-black/60 p-3 rounded-xl border border-white/10 font-mono text-[11px] text-emerald-300 max-h-52 overflow-y-auto scrollbar-thin">
                  <pre>{(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedLogPayload.payload), null, 2)
                    } catch {
                      return selectedLogPayload.payload
                    }
                  })()}</pre>
                </div>
              </div>

              {selectedLogPayload.responseBody && (
                <div>
                  <label className="text-[10px] font-bold text-wa-secondary uppercase block mb-1">
                    Respuesta del Servidor Externo:
                  </label>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 font-mono text-[10px] text-gray-300 max-h-24 overflow-y-auto">
                    {selectedLogPayload.responseBody}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogPayload(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
