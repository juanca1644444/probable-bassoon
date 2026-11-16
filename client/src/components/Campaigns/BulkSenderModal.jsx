// BulkSenderModal.jsx — Módulo de Envío Masivo a Números con Carga de Archivos, Pegado Directo y Motor Anti-Ban
import React, { useState, useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { getWsUrl } from '../../utils/wsUrl'

export const DEFAULT_COUNTRIES = [
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+1', country: 'EE.UU. / Canadá', flag: '🇺🇸' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
]

export default function BulkSenderModal({ onClose }) {
  const [activeStep, setActiveStep] = useState('recipients') // 'recipients' | 'message' | 'antiban' | 'live'
  const [inputMode, setInputMode] = useState('paste') // 'paste' | 'file'
  
  // Recipients input state
  const [rawText, setRawText] = useState('')
  const [defaultCountry, setDefaultCountry] = useState(DEFAULT_COUNTRIES[0])
  const [recipients, setRecipients] = useState([])
  const [stats, setStats] = useState({ valid: 0, duplicates: 0, invalid: 0 })
  const [fileName, setFileName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Message & Spintax state
  const [campaignTitle, setCampaignTitle] = useState('Difusión Comercial Masiva')
  const [messageTemplate, setMessageTemplate] = useState('{¡Hola|Buen día|Estimado/a} {{nombre}}! 👋 Le compartimos una promoción especial de CHASKYAPP para el número {{telefono}}.')
  const [mediaUrl, setMediaUrl] = useState('')
  const [previewContactIndex, setPreviewContactIndex] = useState(0)

  // Anti-Ban Engine Configuration
  const [minDelay, setMinDelay] = useState(2)
  const [maxDelay, setMaxDelay] = useState(5)
  const [batchSize, setBatchSize] = useState(15)
  const [batchPause, setBatchPause] = useState(8)
  const [antiBanPreset, setAntiBanPreset] = useState('safe') // 'safe' | 'normal' | 'turbo'

  // Live execution state
  const [batchId, setBatchId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, sent: 0, failed: 0 })
  const [logs, setLogs] = useState([])
  const [throttleMessage, setThrottleMessage] = useState('')

  const fileInputRef = useRef(null)
  const logsEndRef = useRef(null)
  const { addToast } = useAppStore()

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // WebSocket Listener for live bulk progress
  useEffect(() => {
    const ws = new WebSocket(getWsUrl())
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'bulk_progress' && data.batchId === batchId) {
          setProgress({
            current: data.index,
            total: data.total,
            percent: data.percent,
            sent: data.sent,
            failed: data.failed
          })
          if (data.log) {
            setLogs((prev) => [...prev, data.log])
          }
          setThrottleMessage('')
        } else if (data.type === 'bulk_throttled' && data.batchId === batchId) {
          setThrottleMessage(data.message)
        } else if (data.type === 'bulk_paused' && data.batchId === batchId) {
          setIsPaused(true)
        } else if (data.type === 'bulk_resumed' && data.batchId === batchId) {
          setIsPaused(false)
        } else if (data.type === 'bulk_stopped' && data.batchId === batchId) {
          setIsSending(false)
          setIsPaused(false)
          addToast({
            id: `toast-${Date.now()}`,
            name: 'Envío detenido',
            message: `El proceso fue detenido. ${data.sent} enviados.`
          })
        } else if (data.type === 'bulk_completed' && data.batchId === batchId) {
          setIsSending(false)
          setIsPaused(false)
          setProgress((prev) => ({ ...prev, percent: 100 }))
          addToast({
            id: `toast-${Date.now()}`,
            name: '¡Envío completado!',
            message: `Se enviaron ${data.sent} mensajes con éxito (${data.failed} fallidos).`
          })
        }
      } catch (err) {
        // ignore parse error
      }
    }
    return () => ws.close()
  }, [batchId, addToast])

  // Normalization logic for phone numbers
  const normalizePhone = (phoneRaw, defaultPrefix) => {
    let clean = phoneRaw.trim()
    if (!clean) return null
    if (clean.startsWith('+')) {
      const digits = clean.replace(/[^\d]/g, '')
      return digits.length >= 7 ? `+${digits}` : null
    }
    const digitsOnly = clean.replace(/[^\d]/g, '')
    if (digitsOnly.length < 6) return null
    // If starts with prefix without plus (e.g. 51987654321)
    const rawPrefix = defaultPrefix.replace('+', '')
    if (digitsOnly.startsWith(rawPrefix) && digitsOnly.length >= 9) {
      return `+${digitsOnly}`
    }
    return `${defaultPrefix}${digitsOnly}`
  }

  // Parse text / lines
  const parseRawLines = (text, prefix) => {
    if (!text.trim()) {
      setRecipients([])
      setStats({ valid: 0, duplicates: 0, invalid: 0 })
      return
    }

    const lines = text.split(/\r?\n/)
    const seen = new Set()
    const validList = []
    let dupCount = 0
    let invalidCount = 0

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      // Split by comma, semicolon or tab
      const parts = trimmed.split(/[,;\t]/).map((p) => p.trim())
      const phoneCandidate = parts[0]
      const nameCandidate = parts[1] || ''
      const var1 = parts[2] || ''
      const var2 = parts[3] || ''

      const normalized = normalizePhone(phoneCandidate, prefix.code)
      if (!normalized) {
        invalidCount++
        return
      }

      if (seen.has(normalized)) {
        dupCount++
        return
      }

      seen.add(normalized)
      validList.push({
        phone: normalized,
        name: nameCandidate || normalized,
        var1,
        var2
      })
    })

    setRecipients(validList)
    setStats({ valid: validList.length, duplicates: dupCount, invalid: invalidCount })
  }

  // Handle textarea change
  const handleTextChange = (e) => {
    const val = e.target.value
    setRawText(val)
    parseRawLines(val, defaultCountry)
  }

  // Handle country code change
  const handleCountryChange = (c) => {
    setDefaultCountry(c)
    if (rawText) {
      parseRawLines(rawText, c)
    }
  }

  // Handle File Upload (CSV, TXT)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target.result || ''
      // If CSV with header row, detect columns
      const lines = content.split(/\r?\n/).filter(Boolean)
      if (lines.length > 0) {
        const header = lines[0].toLowerCase()
        const isHeader = header.includes('phone') || header.includes('telefono') || header.includes('celular') || header.includes('nombre') || header.includes('name')
        const dataLines = isHeader ? lines.slice(1).join('\n') : lines.join('\n')
        setRawText(dataLines)
        parseRawLines(dataLines, defaultCountry)
      }
    }
    reader.readAsText(file)
  }

  // Spintax Preview Resolver
  const resolveSpintax = (str) => {
    if (!str) return ''
    const spintaxRegex = /\{([^{}]+)\}/g
    let res = str
    let iterations = 0
    while (spintaxRegex.test(res) && iterations < 8) {
      res = res.replace(spintaxRegex, (_, choices) => {
        const arr = choices.split('|')
        return arr[Math.floor(Math.random() * arr.length)]
      })
      iterations++
    }
    return res
  }

  // Anti-Ban preset switcher
  const handlePresetChange = (preset) => {
    setAntiBanPreset(preset)
    if (preset === 'safe') {
      setMinDelay(3)
      setMaxDelay(7)
      setBatchSize(15)
      setBatchPause(12)
    } else if (preset === 'normal') {
      setMinDelay(2)
      setMaxDelay(5)
      setBatchSize(25)
      setBatchPause(8)
    } else if (preset === 'turbo') {
      setMinDelay(1)
      setMaxDelay(3)
      setBatchSize(40)
      setBatchPause(5)
    }
  }

  // Start Bulk Campaign
  const handleStartSending = async () => {
    if (!recipients.length) {
      alert('Debes agregar al menos un destinatario válido.')
      return
    }
    if (!messageTemplate.trim()) {
      alert('Debes escribir un mensaje.')
      return
    }

    setIsSending(true)
    setIsPaused(false)
    setLogs([])
    setProgress({ current: 0, total: recipients.length, percent: 0, sent: 0, failed: 0 })
    setActiveStep('live')

    try {
      const res = await fetch('http://localhost:3001/api/bulk/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaignTitle,
          recipients,
          template: messageTemplate,
          mediaUrl,
          antiBan: {
            minDelay,
            maxDelay,
            batchSize,
            batchPause
          }
        })
      })

      if (res.ok) {
        const data = await res.json()
        setBatchId(data.batchId)
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Envío iniciado',
          message: `Lote de ${recipients.length} mensajes en progreso con Anti-Ban activo.`
        })
      } else {
        const err = await res.json()
        alert(err.error || 'Error al iniciar envío')
        setIsSending(false)
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al servidor.')
      setIsSending(false)
    }
  }

  // Pause / Resume
  const handleTogglePause = async () => {
    if (!batchId) return
    const endpoint = isPaused ? 'resume' : 'pause'
    try {
      await fetch(`http://localhost:3001/api/bulk/${endpoint}/${batchId}`, { method: 'POST' })
      setIsPaused(!isPaused)
    } catch (e) {
      console.error(e)
    }
  }

  // Stop
  const handleStop = async () => {
    if (!batchId) return
    if (!window.confirm('¿Seguro que deseas detener el envío masivo?')) return
    try {
      await fetch(`http://localhost:3001/api/bulk/stop/${batchId}`, { method: 'POST' })
      setIsSending(false)
    } catch (e) {
      console.error(e)
    }
  }

  // Download CSV Report
  const handleDownloadReport = () => {
    if (!logs.length) return
    const header = 'Hora,Teléfono,Nombre,Estado,Mensaje Enviado\n'
    const rows = logs
      .map((l) => `"${l.time}","${l.phone}","${l.name}","${l.status}","${(l.text || l.error || '').replace(/"/g, '""')}"`)
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_Envio_Masivo_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // Sample preview recipient
  const previewRecipient = recipients[previewContactIndex] || {
    phone: '+51 987654321',
    name: 'Carlos Mendoza',
    var1: 'Cliente VIP',
    var2: 'S/. 150.00'
  }

  const generatedPreview = resolveSpintax(messageTemplate)
    .replace(/\{\{nombre\}\}/gi, previewRecipient.name)
    .replace(/\{\{telefono\}\}/gi, previewRecipient.phone)
    .replace(/\{\{var1\}\}/gi, previewRecipient.var1 || 'Opción 1')
    .replace(/\{\{var2\}\}/gi, previewRecipient.var2 || 'Opción 2')

  // Filtered recipients for inspection
  const filteredRecipients = recipients.filter(
    (r) =>
      r.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-white/10 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-wa-header border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shadow">
              🚀
            </div>
            <div>
              <h2 className="text-wa-text font-bold text-base flex items-center gap-2">
                <span>Envío Masivo Pro</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Anti-Ban Engine
                </span>
              </h2>
              <p className="text-wa-secondary text-xs">Sube archivos, pega listas y envía mensajes personalizados sin bloqueos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Steps Pills */}
            <div className="hidden md:flex items-center bg-wa-input/80 rounded-xl p-1 gap-1 border border-white/5">
              {[
                { id: 'recipients', label: '1. Destinatarios', icon: '📋' },
                { id: 'message', label: '2. Mensaje & Spintax', icon: '✍️' },
                { id: 'antiban', label: '3. Anti-Bloqueo', icon: '🛡️' },
                { id: 'live', label: '4. En Vivo', icon: '⚡' }
              ].map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeStep === step.id
                      ? 'bg-wa-green text-white shadow-sm'
                      : 'text-wa-secondary hover:text-wa-text'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-wa-icon hover:bg-white/10 transition-colors ml-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body based on Active Step */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* STEP 1: RECIPIENTS */}
          {activeStep === 'recipients' && (
            <div className="space-y-5">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-wa-input/40 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      inputMode === 'paste'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-wa-input text-wa-secondary hover:text-wa-text'
                    }`}
                  >
                    <span>📋</span>
                    <span>Pegar en Pantalla</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      inputMode === 'file'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-wa-input text-wa-secondary hover:text-wa-text'
                    }`}
                  >
                    <span>📁</span>
                    <span>Subir Archivo (CSV / TXT)</span>
                  </button>
                </div>

                {/* Country prefix selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-wa-secondary font-medium">Prefijo por defecto:</span>
                  <select
                    value={defaultCountry.code}
                    onChange={(e) => {
                      const c = DEFAULT_COUNTRIES.find((x) => x.code === e.target.value)
                      if (c) handleCountryChange(c)
                    }}
                    className="bg-wa-input text-wa-text text-xs rounded-xl px-2.5 py-1.5 border border-white/10 outline-none cursor-pointer"
                  >
                    {DEFAULT_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-wa-header">
                        {c.flag} {c.code} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Area */}
              {inputMode === 'paste' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-wa-secondary uppercase tracking-wider">
                      Pega aquí tus números telefónicos (un número por línea o separados por coma):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const example = `987654321, Carlos Mendoza, VIP\n912345678, Pedro Distribuidor, Lima\n+34 612345678, Lucía Gómez, España\n999888777, Almacén Central`
                        setRawText(example)
                        parseRawLines(example, defaultCountry)
                      }}
                      className="text-xs text-wa-green hover:underline font-semibold"
                    >
                      Cargar ejemplo
                    </button>
                  </div>
                  <textarea
                    rows="7"
                    value={rawText}
                    onChange={handleTextChange}
                    placeholder={`Ejemplo:\n987654321, Juan Pérez\n912345678, María Silva, Proveedor\n+51 999888777\n+34 612345678, Pedro Gómez`}
                    className="w-full bg-wa-input text-wa-text text-xs font-mono rounded-2xl p-4 border border-white/10 outline-none focus:border-wa-green transition-colors resize-none placeholder:text-wa-secondary/50 leading-relaxed"
                  />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-500/40 hover:border-wa-green bg-emerald-500/5 hover:bg-emerald-500/10 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
                    📄
                  </div>
                  <p className="text-sm font-bold text-wa-text">Haz clic aquí para seleccionar un archivo CSV o TXT</p>
                  <p className="text-xs text-wa-secondary mt-1">
                    Detecta automáticamente encabezados de teléfono y nombres (columnas separadas por comas o punto y coma)
                  </p>
                  {fileName && (
                    <div className="mt-3 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                      ✓ Archivo cargado: {fileName}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-xl font-extrabold text-emerald-400">{stats.valid}</p>
                    <p className="text-[11px] text-emerald-300/80 font-medium">Números Válidos Listos</p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🟡</span>
                  <div>
                    <p className="text-xl font-extrabold text-amber-400">{stats.duplicates}</p>
                    <p className="text-[11px] text-amber-300/80 font-medium">Duplicados Filtrados</p>
                  </div>
                </div>

                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">❌</span>
                  <div>
                    <p className="text-xl font-extrabold text-rose-400">{stats.invalid}</p>
                    <p className="text-[11px] text-rose-300/80 font-medium">Descartados / Inválidos</p>
                  </div>
                </div>
              </div>

              {/* Recipients Inspection Table */}
              {recipients.length > 0 && (
                <div className="bg-wa-input/30 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-wa-text">
                      Previsualización de Destinatarios ({filteredRecipients.length} de {recipients.length})
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o teléfono..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-wa-input text-xs text-wa-text px-3 py-1.5 rounded-xl border border-white/10 outline-none w-56 placeholder:text-wa-secondary/60"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs text-wa-secondary">
                      <thead className="bg-wa-input/60 text-[11px] uppercase tracking-wider text-wa-secondary/80 sticky top-0">
                        <tr>
                          <th className="px-4 py-2">#</th>
                          <th className="px-4 py-2">Teléfono</th>
                          <th className="px-4 py-2">Nombre / Alias</th>
                          <th className="px-4 py-2">Variable 1</th>
                          <th className="px-4 py-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredRecipients.slice(0, 100).map((r, idx) => (
                          <tr key={r.phone} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2 font-mono text-[11px]">{idx + 1}</td>
                            <td className="px-4 py-2 font-mono text-emerald-400 font-semibold">{r.phone}</td>
                            <td className="px-4 py-2 text-wa-text font-medium">{r.name}</td>
                            <td className="px-4 py-2">{r.var1 || '—'}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => {
                                  const updated = recipients.filter((x) => x.phone !== r.phone)
                                  setRecipients(updated)
                                  setStats((s) => ({ ...s, valid: updated.length }))
                                }}
                                className="text-rose-400 hover:text-rose-300 text-xs transition-colors"
                                title="Eliminar de la lista"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: MESSAGE & SPINTAX */}
          {activeStep === 'message' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Editor */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-wa-secondary mb-1">
                    Título de la Campaña
                  </label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full bg-wa-input text-wa-text text-sm rounded-xl px-3.5 py-2 border border-white/10 outline-none focus:border-wa-green transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-wa-secondary">
                      Plantilla del Mensaje (con Variables y Spintax)
                    </label>
                  </div>

                  {/* Variable insertion buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { tag: '{{nombre}}', desc: 'Nombre del cliente' },
                      { tag: '{{telefono}}', desc: 'Teléfono' },
                      { tag: '{{var1}}', desc: 'Variable 1' },
                      { tag: '{{var2}}', desc: 'Variable 2' }
                    ].map((v) => (
                      <button
                        type="button"
                        key={v.tag}
                        onClick={() => setMessageTemplate((t) => t + ` ${v.tag}`)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors"
                        title={v.desc}
                      >
                        +{v.tag}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMessageTemplate((t) => t + ' {Hola|Buen día|Saludos}')}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors"
                      title="Insertar Spintax aleatorio"
                    >
                      +Spintax {'{A|B|C}'}
                    </button>
                  </div>

                  <textarea
                    rows="8"
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    className="w-full bg-wa-input text-wa-text text-xs rounded-xl p-3.5 border border-white/10 outline-none focus:border-wa-green transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Media Attachment URL */}
                <div>
                  <label className="block text-xs font-semibold text-wa-secondary mb-1">
                    URL de Imagen o Adjunto (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/imagen-promocion.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full bg-wa-input text-wa-text text-xs rounded-xl px-3.5 py-2 border border-white/10 outline-none focus:border-wa-green transition-colors"
                  />
                </div>
              </div>

              {/* Live WhatsApp Bubble Preview */}
              <div className="bg-wa-sidebar/70 rounded-2xl p-4 border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                    <span className="text-xs font-bold text-wa-text flex items-center gap-1.5">
                      <span>📱</span> Vista Previa Simulada (WhatsApp)
                    </span>
                    {recipients.length > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewContactIndex((i) => Math.max(0, i - 1))}
                          disabled={previewContactIndex === 0}
                          className="px-2 py-0.5 rounded bg-wa-input text-xs disabled:opacity-40"
                        >
                          ◀
                        </button>
                        <span className="text-[11px] text-wa-secondary">
                          {previewContactIndex + 1}/{recipients.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewContactIndex((i) => Math.min(recipients.length - 1, i + 1))}
                          disabled={previewContactIndex >= recipients.length - 1}
                          className="px-2 py-0.5 rounded bg-wa-input text-xs disabled:opacity-40"
                        >
                          ▶
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chat simulated container */}
                  <div className="p-4 rounded-xl bg-[#0b141a] min-h-[220px] flex flex-col justify-end">
                    <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md max-w-sm ml-auto space-y-2">
                      {mediaUrl && (
                        <div className="rounded-lg overflow-hidden bg-black/40">
                          <img src={mediaUrl} alt="Adjunto" className="w-full h-32 object-cover" />
                        </div>
                      )}
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{generatedPreview}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200">
                        <span>10:30</span>
                        <span>✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                  💡 <strong>Spintax activo:</strong> Cada cliente recibirá una variación distinta del mensaje para evitar filtros de spam de Meta.
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ANTI-BAN ENGINE */}
          {activeStep === 'antiban' && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h4 className="text-sm font-bold text-emerald-400">Protección Anti-Bloqueo de Meta</h4>
                  <p className="text-xs text-emerald-300/80 mt-0.5 leading-relaxed">
                    Configuración basada en las políticas de seguridad de Meta extraídas por REA. El sistema emula el comportamiento de tipeo humano y aplica pausas estratégicas por lotes para proteger la reputación del número de teléfono.
                  </p>
                </div>
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-semibold text-wa-secondary mb-2 uppercase tracking-wider">
                  Modo de Protección Predeterminado
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'safe', label: 'Modo Seguro (Recomendado)', desc: 'Retardos de 3 a 7 seg. Pausa cada 15 msgs.', color: 'border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold' },
                    { id: 'normal', label: 'Modo Estándar', desc: 'Retardos de 2 a 5 seg. Pausa cada 25 msgs.', color: 'border-sky-500 bg-sky-500/15 text-sky-300 font-bold' },
                    { id: 'turbo', label: 'Modo Rápido (Alto Volumen)', desc: 'Retardos de 1 a 3 seg. Pausa cada 40 msgs.', color: 'border-amber-500 bg-amber-500/15 text-amber-300 font-bold' }
                  ].map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handlePresetChange(p.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        antiBanPreset === p.id ? p.color : 'border-white/5 bg-wa-input/40 text-wa-secondary hover:text-wa-text'
                      }`}
                    >
                      <p className="text-xs font-semibold">{p.label}</p>
                      <p className="text-[11px] text-wa-secondary mt-1">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Granular Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-wa-input/30 p-4 rounded-2xl border border-white/5">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-wa-secondary mb-1">
                    <span>Retardo Mínimo entre Mensajes:</span>
                    <span className="text-emerald-400 font-mono font-bold">{minDelay} seg.</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-wa-secondary mb-1">
                    <span>Retardo Máximo entre Mensajes:</span>
                    <span className="text-emerald-400 font-mono font-bold">{maxDelay} seg.</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Math.max(minDelay, Number(e.target.value)))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-wa-secondary mb-1">
                    <span>Pausa de Seguridad por Lote:</span>
                    <span className="text-emerald-400 font-mono font-bold">Cada {batchSize} mensajes</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-wa-secondary mb-1">
                    <span>Duración de la Pausa de Lote:</span>
                    <span className="text-emerald-400 font-mono font-bold">{batchPause} segundos</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={batchPause}
                    onChange={(e) => setBatchPause(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LIVE MONITOR / CONSOLE */}
          {activeStep === 'live' && (
            <div className="space-y-5">
              {/* Progress and Counter Card */}
              <div className="p-5 bg-wa-input/40 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-wa-text flex items-center gap-2">
                    {isSending ? (
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span>🏁</span>
                    )}
                    <span>{isPaused ? '⏸️ Envío Pausado' : isSending ? 'Procesando Envío Masivo...' : 'Envío Finalizado o Listo'}</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {progress.current} / {progress.total} ({progress.percent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>

                {throttleMessage && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl animate-pulse">
                    ⏳ {throttleMessage}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 bg-black/20 rounded-xl text-center">
                    <p className="text-emerald-400 font-bold text-lg">{progress.sent}</p>
                    <p className="text-[10px] text-wa-secondary">Entregados con Éxito</p>
                  </div>
                  <div className="p-2.5 bg-black/20 rounded-xl text-center">
                    <p className="text-rose-400 font-bold text-lg">{progress.failed}</p>
                    <p className="text-[10px] text-wa-secondary">Fallos / No Enviados</p>
                  </div>
                  <div className="p-2.5 bg-black/20 rounded-xl text-center">
                    <p className="text-sky-400 font-bold text-lg">{Math.max(0, progress.total - progress.current)}</p>
                    <p className="text-[10px] text-wa-secondary">Restantes en Cola</p>
                  </div>
                </div>
              </div>

              {/* Live Terminal Logs */}
              <div className="bg-[#0b141a] rounded-2xl border border-white/10 overflow-hidden flex flex-col h-64">
                <div className="px-4 py-2 bg-wa-header border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="font-mono text-emerald-400 font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Terminal de Envíos en Tiempo Real
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      disabled={logs.length === 0}
                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-wa-secondary hover:text-wa-text disabled:opacity-40 transition-colors"
                    >
                      📥 Descargar CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogs([])}
                      className="text-wa-secondary hover:text-wa-text text-[11px]"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin">
                  {logs.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-8">
                      Los eventos de envío aparecerán aquí en tiempo real...
                    </p>
                  ) : (
                    logs.map((log, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${
                          log.status === 'success' ? 'text-emerald-300' : 'text-rose-400'
                        }`}
                      >
                        <span className="text-gray-500 select-none">[{log.time}]</span>
                        <span className="font-bold">{log.status === 'success' ? '✓' : '✗'}</span>
                        <span className="font-semibold">{log.phone}</span>
                        <span className="text-gray-400 truncate">({log.name}):</span>
                        <span className="text-gray-300 truncate">{log.text || log.error}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation & Controls */}
        <div className="px-6 py-4 bg-wa-header border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {activeStep !== 'recipients' && !isSending && (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 'message') setActiveStep('recipients')
                  else if (activeStep === 'antiban') setActiveStep('message')
                  else if (activeStep === 'live') setActiveStep('antiban')
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-wa-secondary hover:text-wa-text hover:bg-white/5 transition-colors"
              >
                ◀ Volver
              </button>
            )}

            {isSending && (
              <>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
                >
                  <span>{isPaused ? '▶ Reanudar' : '⏸️ Pausar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all flex items-center gap-1.5"
                >
                  <span>⏹️ Detener</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-wa-secondary hover:text-wa-text disabled:opacity-40 transition-colors"
            >
              Cerrar
            </button>

            {activeStep === 'recipients' && (
              <button
                type="button"
                onClick={() => {
                  if (stats.valid === 0) {
                    alert('Por favor ingresa o carga al menos un número telefónico válido.')
                    return
                  }
                  setActiveStep('message')
                }}
                className="px-5 py-2.5 rounded-xl bg-wa-green hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-md flex items-center gap-2"
              >
                <span>Siguiente: Redactar Mensaje</span>
                <span>▶</span>
              </button>
            )}

            {activeStep === 'message' && (
              <button
                type="button"
                onClick={() => setActiveStep('antiban')}
                className="px-5 py-2.5 rounded-xl bg-wa-green hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-md flex items-center gap-2"
              >
                <span>Siguiente: Configurar Anti-Ban</span>
                <span>▶</span>
              </button>
            )}

            {activeStep === 'antiban' && (
              <button
                type="button"
                onClick={handleStartSending}
                className="px-6 py-2.5 rounded-xl bg-wa-green hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 animate-pulse"
              >
                <span>🚀 Iniciar Envío Masivo ({stats.valid} contactos)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
