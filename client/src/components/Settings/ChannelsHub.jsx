import React, { useState, useEffect } from 'react'

export default function ChannelsHub({ onClose, embedded = false }) {
  const [activeChannelTab, setActiveChannelTab] = useState('whatsapp') // 'whatsapp' | 'telegram' | 'sandbox' | 'logs'
  const [channels, setChannels] = useState([])
  const [stats, setStats] = useState({ activeMappings: 0, totalLogs: 0 })
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  // WhatsApp Form
  const [waForm, setWaForm] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    verifyToken: 'chasky_meta_verify_2026',
    displayPhoneNumber: '+51 987 654 321',
    businessAccountName: 'CHASKYAPP Enterprise'
  })
  const [waTesting, setWaTesting] = useState(false)
  const [waSaving, setWaSaving] = useState(false)

  // Telegram Form
  const [tgForm, setTgForm] = useState({
    botToken: '',
    botUsername: 'ChaskySupportBot',
    botDisplayName: 'Chasky Soporte Oficial'
  })
  const [tgTesting, setTgTesting] = useState(false)
  const [tgSaving, setTgSaving] = useState(false)

  // Simulator Sandbox Form
  const [simForm, setSimForm] = useState({
    channel: 'whatsapp',
    senderPhone: '51987654321',
    senderName: 'Usuario de Prueba Oficial',
    content: 'Hola, este es un mensaje entrante simulado desde el canal oficial.',
    type: 'text'
  })
  const [simLoading, setSimLoading] = useState(false)
  const [copiedField, setCopiedField] = useState('')

  useEffect(() => {
    fetchChannelStatus()
    fetchBridgeLogs()
  }, [])

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setFeedbackError(msg)
      setTimeout(() => setFeedbackError(''), 4500)
    } else {
      setFeedbackMsg(msg)
      setTimeout(() => setFeedbackMsg(''), 4500)
    }
  }

  const fetchChannelStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/channels/status').then(r => r.json())
      if (res.success) {
        setChannels(res.channels || [])
        setStats(res.stats || { activeMappings: 0, totalLogs: 0 })

        const wa = res.channels.find(c => c.channel === 'whatsapp')
        if (wa && wa.credentials) {
          setWaForm({
            phoneNumberId: wa.credentials.phoneNumberId || '',
            wabaId: wa.credentials.wabaId || '',
            accessToken: wa.credentials.accessToken || '',
            verifyToken: wa.verifyToken || wa.credentials.verifyToken || 'chasky_meta_verify_2026',
            displayPhoneNumber: wa.credentials.displayPhoneNumber || '+51 987 654 321',
            businessAccountName: wa.credentials.businessAccountName || 'CHASKYAPP Enterprise'
          })
        }

        const tg = res.channels.find(c => c.channel === 'telegram')
        if (tg && tg.credentials) {
          setTgForm({
            botToken: tg.credentials.botToken || '',
            botUsername: tg.credentials.botUsername || 'ChaskySupportBot',
            botDisplayName: tg.credentials.botDisplayName || 'Chasky Soporte Oficial'
          })
        }
      }
    } catch (err) {
      console.error('Failed to load channel status:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBridgeLogs = async () => {
    try {
      const res = await fetch('/api/channels/logs').then(r => r.json())
      if (res.success) {
        setLogs(res.logs || [])
      }
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
  }

  const handleCopy = (text, fieldName) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(''), 2500)
    }
  }

  // Save WhatsApp Cloud API Credentials
  const handleSaveWhatsApp = async (e) => {
    e.preventDefault()
    setWaSaving(true)
    try {
      const res = await fetch('/api/channels/whatsapp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waForm)
      }).then(r => r.json())

      if (res.success) {
        showToast(res.message || 'Credenciales de WhatsApp guardadas con éxito.')
        await fetchChannelStatus()
      } else {
        showToast(res.error || 'Error al guardar credenciales de WhatsApp.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setWaSaving(false)
    }
  }

  // Test WhatsApp Connection
  const handleTestWhatsApp = async () => {
    setWaTesting(true)
    try {
      const res = await fetch('/api/channels/whatsapp/test', { method: 'POST' }).then(r => r.json())
      if (res.success) {
        showToast(`✓ ${res.message}`)
        await fetchChannelStatus()
      } else {
        showToast(res.error || 'Fallo de prueba en WhatsApp Cloud API.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setWaTesting(false)
    }
  }

  // Save Telegram Bot Token
  const handleSaveTelegram = async (e) => {
    e.preventDefault()
    setTgSaving(true)
    try {
      const res = await fetch('/api/channels/telegram/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgForm)
      }).then(r => r.json())

      if (res.success) {
        showToast(res.message || 'Configuración de Telegram guardada con éxito.')
        await fetchChannelStatus()
      } else {
        showToast(res.error || 'Error al guardar bot de Telegram.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setTgSaving(false)
    }
  }

  // Test Telegram Bot
  const handleTestTelegram = async () => {
    setTgTesting(true)
    try {
      const res = await fetch('/api/channels/telegram/test', { method: 'POST' }).then(r => r.json())
      if (res.success) {
        showToast(`✓ ${res.message}`)
        await fetchChannelStatus()
      } else {
        showToast(res.error || 'Fallo de prueba en Telegram Bot API.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setTgTesting(false)
    }
  }

  // Send Simulated Message
  const handleSimulateIncoming = async (e) => {
    e.preventDefault()
    setSimLoading(true)
    try {
      const res = await fetch('/api/channels/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simForm)
      }).then(r => r.json())

      if (res.success) {
        showToast(`✓ ${res.message} (ID: ${res.result?.id})`)
        await fetchBridgeLogs()
        await fetchChannelStatus()
      } else {
        showToast(res.error || 'Error en simulación.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setSimLoading(false)
    }
  }

  const waChannel = channels.find(c => c.channel === 'whatsapp') || { status: 'connected' }
  const tgChannel = channels.find(c => c.channel === 'telegram') || { status: 'connected' }

  const fullWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/whatsapp`
    : 'https://tu-dominio.com/api/webhooks/whatsapp'

  const content = (
    <div className="space-y-6 animate-fade-in text-wa-text">

      {/* Global Alerts */}
      {feedbackMsg && (
        <div className="bg-emerald-600/90 text-white text-xs px-4 py-3 rounded-xl flex items-center justify-between font-medium shadow-sm animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')}>✕</button>
        </div>
      )}
      {feedbackError && (
        <div className="bg-red-600/90 text-white text-xs px-4 py-3 rounded-xl flex items-center justify-between font-medium shadow-sm animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{feedbackError}</span>
          </div>
          <button onClick={() => setFeedbackError('')}>✕</button>
        </div>
      )}

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* WhatsApp Card */}
        <div
          onClick={() => setActiveChannelTab('whatsapp')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeChannelTab === 'whatsapp'
              ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md'
              : 'bg-wa-sidebar/70 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟢</span>
              <span className="font-bold text-white text-xs">WhatsApp Cloud API</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {waChannel.status === 'connected' ? 'Conectado' : 'Configurar'}
            </span>
          </div>
          <p className="text-[11px] text-wa-secondary mt-1.5 line-clamp-1">
            Meta Graph API v19.0 • Webhook activo
          </p>
        </div>

        {/* Telegram Card */}
        <div
          onClick={() => setActiveChannelTab('telegram')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeChannelTab === 'telegram'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-md'
              : 'bg-wa-sidebar/70 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">✈️</span>
              <span className="font-bold text-white text-xs">Telegram Bot API</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {tgChannel.status === 'connected' ? 'Conectado' : 'Configurar'}
            </span>
          </div>
          <p className="text-[11px] text-wa-secondary mt-1.5 line-clamp-1">
            @{tgForm.botUsername || 'ChaskySupportBot'} • @BotFather
          </p>
        </div>

        {/* Sandbox Simulator Card */}
        <div
          onClick={() => setActiveChannelTab('sandbox')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeChannelTab === 'sandbox'
              ? 'bg-amber-950/40 border-amber-500/60 shadow-md'
              : 'bg-wa-sidebar/70 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <span className="font-bold text-white text-xs">Simulador Sandbox</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              QA Testing
            </span>
          </div>
          <p className="text-[11px] text-wa-secondary mt-1.5 line-clamp-1">
            Inyecta mensajes de prueba en vivo
          </p>
        </div>
      </div>

      {/* Channel Subtabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs">
        <button
          onClick={() => setActiveChannelTab('whatsapp')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
            activeChannelTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-white'
          }`}
        >
          <span>🟢</span>
          <span>Meta WhatsApp Cloud API</span>
        </button>
        <button
          onClick={() => setActiveChannelTab('telegram')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
            activeChannelTab === 'telegram' ? 'bg-blue-600 text-white shadow-sm' : 'text-wa-secondary hover:text-white'
          }`}
        >
          <span>✈️</span>
          <span>Telegram Bot API</span>
        </button>
        <button
          onClick={() => setActiveChannelTab('sandbox')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
            activeChannelTab === 'sandbox' ? 'bg-amber-600 text-white shadow-sm' : 'text-wa-secondary hover:text-white'
          }`}
        >
          <span>🧪</span>
          <span>Simulador de Canales</span>
        </button>
        <button
          onClick={() => setActiveChannelTab('logs')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
            activeChannelTab === 'logs' ? 'bg-teal-600 text-white shadow-sm' : 'text-wa-secondary hover:text-white'
          }`}
        >
          <span>📜</span>
          <span>Historial de Webhooks ({logs.length})</span>
        </button>
      </div>

      {/* ── TAB 1: WHATSAPP CLOUD API ─────────────────────────────────────── */}
      {activeChannelTab === 'whatsapp' && (
        <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🟢</span>
                <span>Configuración de Meta WhatsApp Business Cloud API</span>
              </h3>
              <p className="text-xs text-wa-secondary">
                Conecta tu WABA oficial directamente con los servidores de Meta Graph API v19.0.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={waTesting}
              className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              {waTesting && <span className="w-3 h-3 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />}
              <span>🔍 Probar Conexión con Meta</span>
            </button>
          </div>

          {/* Webhook Endpoint Instructions */}
          <div className="p-3.5 bg-wa-header/80 rounded-xl border border-white/10 space-y-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Parámetros de Configuración en Meta for Developers (Webhooks)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">URL de Devolución de Llamada (Webhook URL)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    readOnly
                    value={fullWebhookUrl}
                    className="flex-1 bg-wa-input px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(fullWebhookUrl, 'webhookUrl')}
                    className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-xs rounded-lg transition"
                  >
                    {copiedField === 'webhookUrl' ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Identificador de Verificación (Verify Token)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    readOnly
                    value={waForm.verifyToken}
                    className="flex-1 bg-wa-input px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(waForm.verifyToken, 'verifyToken')}
                    className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-xs rounded-lg transition"
                  >
                    {copiedField === 'verifyToken' ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveWhatsApp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Identificador de Número de Teléfono (Phone Number ID)</label>
                <input
                  type="text"
                  placeholder="Ej. 109823485729102"
                  value={waForm.phoneNumberId}
                  onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">ID de Cuenta de WhatsApp Business (WABA ID)</label>
                <input
                  type="text"
                  placeholder="Ej. 394827102938475"
                  value={waForm.wabaId}
                  onChange={(e) => setWaForm({ ...waForm, wabaId: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-wa-secondary uppercase block mb-1">Token de Acceso Permanente (System User Token de Meta)</label>
              <input
                type="password"
                placeholder="EAABwz..."
                value={waForm.accessToken}
                onChange={(e) => setWaForm({ ...waForm, accessToken: e.target.value })}
                className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono"
                required
              />
              <span className="text-[10px] text-wa-secondary mt-1 block">
                Generado en Meta Business Suite con permisos: <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Número de Teléfono Visible (E.164)</label>
                <input
                  type="text"
                  value={waForm.displayPhoneNumber}
                  onChange={(e) => setWaForm({ ...waForm, displayPhoneNumber: e.target.value })}
                  placeholder="+51 987 654 321"
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre Comercial de la Cuenta Oficial</label>
                <input
                  type="text"
                  value={waForm.businessAccountName}
                  onChange={(e) => setWaForm({ ...waForm, businessAccountName: e.target.value })}
                  placeholder="CHASKYAPP Enterprise"
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={waSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-2"
            >
              {waSaving ? 'Guardando...' : '💾 Guardar Credenciales de WhatsApp Cloud API'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 2: TELEGRAM BOT API ───────────────────────────────────────── */}
      {activeChannelTab === 'telegram' && (
        <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>✈️</span>
                <span>Configuración de Telegram Bot API (@BotFather)</span>
              </h3>
              <p className="text-xs text-wa-secondary">
                Atiende a tus clientes directamente desde tu bot verificado de Telegram.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={tgTesting}
              className="px-3.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              {tgTesting && <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />}
              <span>🔍 Probar Bot con Telegram</span>
            </button>
          </div>

          <form onSubmit={handleSaveTelegram} className="space-y-4">
            <div>
              <label className="text-[10px] text-wa-secondary uppercase block mb-1">Bot Token Oficial (Proporcionado por @BotFather)</label>
              <input
                type="password"
                placeholder="Ej. 7192849182:AAF9x-ChaskyEnterpriseOfficialBotToken"
                value={tgForm.botToken}
                onChange={(e) => setTgForm({ ...tgForm, botToken: e.target.value })}
                className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-blue-500 font-mono"
                required
              />
              <span className="text-[10px] text-wa-secondary mt-1 block">
                Para obtenerlo: abre Telegram, busca <strong>@BotFather</strong>, envía el comando <code>/newbot</code> y pega el HTTP API token generado.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre de Usuario del Bot (@username)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-wa-secondary text-xs">@</span>
                  <input
                    type="text"
                    placeholder="ChaskySupportBot"
                    value={tgForm.botUsername}
                    onChange={(e) => setTgForm({ ...tgForm, botUsername: e.target.value.replace('@', '') })}
                    className="w-full bg-wa-header pl-7 pr-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre Público del Bot</label>
                <input
                  type="text"
                  placeholder="Chasky Soporte Oficial"
                  value={tgForm.botDisplayName}
                  onChange={(e) => setTgForm({ ...tgForm, botDisplayName: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={tgSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-2"
            >
              {tgSaving ? 'Guardando...' : '💾 Guardar y Configurar Bot de Telegram'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 3: SANDBOX SIMULATOR ──────────────────────────────────────── */}
      {activeChannelTab === 'sandbox' && (
        <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h3 className="text-sm font-bold text-white">Simulador de Mensajes Entrantes Oficiales (QA Sandbox)</h3>
              <p className="text-xs text-wa-secondary">
                Prueba en tiempo real el puente de comunicación: inyecta un payload entrante como si viniera de Meta Graph API o Telegram Bot API.
              </p>
            </div>
          </div>

          <form onSubmit={handleSimulateIncoming} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Canal de Origen</label>
                <select
                  value={simForm.channel}
                  onChange={(e) => setSimForm({ ...simForm, channel: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="whatsapp">WhatsApp Business Cloud API (Meta)</option>
                  <option value="telegram">Telegram Bot API</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre del Remitente</label>
                <input
                  type="text"
                  placeholder="Ej. Roberto Gómez"
                  value={simForm.senderName}
                  onChange={(e) => setSimForm({ ...simForm, senderName: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Número / ID Remitente</label>
                <input
                  type="text"
                  placeholder="Ej. 51999888777"
                  value={simForm.senderPhone}
                  onChange={(e) => setSimForm({ ...simForm, senderPhone: e.target.value })}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text font-mono outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-wa-secondary uppercase block mb-1">Contenido del Mensaje</label>
              <textarea
                rows="2"
                placeholder="Escribe el texto simulado..."
                value={simForm.content}
                onChange={(e) => setSimForm({ ...simForm, content: e.target.value })}
                className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={simLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-2"
            >
              {simLoading ? 'Inyectando...' : '🚀 Inyectar Mensaje Entrante a Bandeja Unificada'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 4: WEBHOOK LOGS ───────────────────────────────────────────── */}
      {activeChannelTab === 'logs' && (
        <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden animate-fade-in">
          <div className="p-4 bg-wa-header/80 border-b border-white/10 flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Historial de Eventos del Puente Oficial ({logs.length})</h4>
            <button
              onClick={fetchBridgeLogs}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              🔄 Actualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 text-wa-secondary uppercase text-[10px] tracking-wider border-b border-white/10">
                  <th className="py-2.5 px-4">Canal</th>
                  <th className="py-2.5 px-4">Dirección</th>
                  <th className="py-2.5 px-4">Evento</th>
                  <th className="py-2.5 px-4">Resumen de Carga</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-wa-text">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-wa-secondary">
                      No se han registrado eventos recientes en los puentes oficiales.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-bold uppercase text-white font-mono">
                        {log.channel === 'whatsapp' ? '🟢 WhatsApp' : '✈️ Telegram'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.direction === 'incoming' ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {log.direction === 'incoming' ? '⬇ Entrante' : '⬆ Saliente'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-emerald-300">{log.event}</td>
                      <td className="py-2.5 px-4 text-wa-secondary truncate max-w-xs">{log.payloadSummary}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-wa-secondary font-mono">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="bg-wa-header px-6 py-4 border-b border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-lg">
              📡
            </div>
            <div>
              <h2 className="text-wa-text font-bold text-lg">Pasarela de Canales Oficiales</h2>
              <p className="text-xs text-wa-secondary">Meta WhatsApp Cloud API & Telegram Bot API Bridge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-wa-secondary hover:text-wa-text transition"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {content}
        </div>
      </div>
    </div>
  )
}
