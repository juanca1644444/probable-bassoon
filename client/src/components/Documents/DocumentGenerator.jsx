import React, { useState, useEffect } from 'react'
import DigitalSignatureModal from './DigitalSignatureModal'

export default function DocumentGenerator({ onClose, embedded = false, activeChat = null }) {
  const [activeTab, setActiveTab] = useState('generator') // 'generator' | 'templates' | 'archive'
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-contract-services')
  const [documentsArchive, setDocumentsArchive] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  // Form State
  const [variables, setVariables] = useState({
    clientName: '',
    clientDoc: '',
    clientAddress: '',
    clientEmail: '',
    serviceTitle: '',
    amount: '',
    currency: 'PEN',
    paymentTerms: '',
    slaUptime: '99.9%',
    issueDate: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }),
    validUntil: '15 de Noviembre de 2027',
    quoteNumber: 'COT-2026-092',
    termYears: '3 años',
    courseName: 'Diplomado en Automatización Omnicanal con IA'
  })

  const [customText, setCustomText] = useState('')
  const [isEditingText, setIsEditingText] = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState(null)
  const [showSignModal, setShowSignModal] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchArchive()
  }, [])

  // Auto-populate with active chat/contact data
  useEffect(() => {
    if (activeChat) {
      autoFillFromChat(activeChat)
    }
  }, [activeChat])

  const autoFillFromChat = (chat) => {
    const name = chat.contactName || chat.groupName || 'Cliente CHASKYAPP'
    const phone = chat.contactPhone || chat.phone || '+51 987 654 321'
    setVariables(prev => ({
      ...prev,
      clientName: name,
      clientDoc: name.includes('Elena') ? 'RUC 20601928374' : 'DNI 45892019',
      clientAddress: 'Av. Javier Prado Este 4200, San Borja, Lima',
      clientEmail: name.includes('Elena') ? 'erostova@inversionesglobales.pe' : 'cliente@empresa.pe',
      serviceTitle: 'Licencia CHASKYAPP Enterprise & Pasarela Omnicanal Oficial',
      amount: '4,850.00',
      currency: 'PEN',
      paymentTerms: '50% a la firma del contrato y 50% al despliegue en producción'
    }))
    showToast(`✓ Datos del cliente "${name}" autocompletados desde el CRM`)
  }

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setFeedbackError(msg)
      setFeedback('')
    } else {
      setFeedback(msg)
      setFeedbackError('')
    }
    setTimeout(() => {
      setFeedback('')
      setFeedbackError('')
    }, 4000)
  }

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/documents/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(Array.isArray(data) ? data : [])
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id)
        }
      }
    } catch (e) {
      console.error('Error fetching templates:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchArchive = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/documents')
      if (res.ok) {
        const data = await res.json()
        setDocumentsArchive(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching archive:', e)
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0]

  // When template changes, load default variables if not customized
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.defaultVariables) {
      setVariables(prev => ({
        ...selectedTemplate.defaultVariables,
        ...prev,
        clientName: prev.clientName || selectedTemplate.defaultVariables.clientName || '',
        clientDoc: prev.clientDoc || selectedTemplate.defaultVariables.clientDoc || ''
      }))
      setCustomText(selectedTemplate.contentTemplate || '')
    }
  }, [selectedTemplateId])

  // Hydrate preview text
  const getHydratedPreview = () => {
    let raw = isEditingText && customText ? customText : (selectedTemplate ? selectedTemplate.contentTemplate : '')
    for (const [k, v] of Object.entries(variables)) {
      raw = raw.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `[${k}]`)
    }
    return raw
  }

  const handleGeneratePdf = async () => {
    setGenerating(true)
    try {
      const res = await fetch('http://localhost:3001/api/documents/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          chatId: activeChat?.id || 'ch1',
          contactId: activeChat?.contactId || 'co1',
          title: `${selectedTemplate?.title || 'Documento'} - ${variables.clientName || 'Cliente'}`,
          category: selectedTemplate?.category || 'contract',
          contentCustom: isEditingText ? customText : null,
          variables,
          amount: variables.amount,
          currency: variables.currency
        })
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedDoc(data.document)
        showToast('📄 ¡PDF Oficial compilado y generado con éxito!')
        fetchArchive()
      } else {
        const err = await res.json()
        showToast(err.error || 'Error al generar PDF', true)
      }
    } catch (e) {
      showToast('Error de red al compilar documento', true)
    } finally {
      setGenerating(false)
    }
  }

  const handleSendToChat = async () => {
    const docToSend = generatedDoc || documentsArchive[0]
    if (!docToSend) {
      showToast('Por favor genera el documento primero', true)
      return
    }

    try {
      const res = await fetch('http://localhost:3001/api/documents/send-to-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docToSend.id,
          chatId: activeChat?.id || 'ch1'
        })
      })

      if (res.ok) {
        showToast('💬 Documento enviado directamente a la conversación del chat')
        fetchArchive()
      } else {
        const err = await res.json()
        showToast(err.error || 'Error al enviar al chat', true)
      }
    } catch (e) {
      showToast('Error al enviar documento al chat', true)
    }
  }

  return (
    <div className={`${embedded ? 'h-full' : 'fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md'}`}>
      <div className={`relative bg-wa-header rounded-3xl shadow-2xl w-full ${embedded ? 'h-full' : 'max-w-6xl h-[92vh]'} flex flex-col overflow-hidden border border-emerald-500/30 text-wa-text font-sans animate-fade-in`}>

        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-black border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl shadow-inner">
              📄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Generador Inteligente de Documentos & Contratos IA
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  PDFKit • Firma Legal • RAG
                </span>
              </div>
              <p className="text-xs text-wa-secondary">
                Plantillas dinámicas, autocompletado con CRM y firma electrónica certificada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeChat && (
              <button
                onClick={() => autoFillFromChat(activeChat)}
                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                title="Rellenar campos con el cliente del chat"
              >
                <span>🔄</span> Datos de {activeChat.contactName?.slice(0, 15) || 'Cliente'}
              </button>
            )}

            {!embedded && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-wa-secondary hover:text-white transition"
                title="Cerrar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Feedback alerts */}
        {feedback && (
          <div className="px-5 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs border-b border-emerald-500/30 flex items-center justify-between">
            <span>✓ {feedback}</span>
            <button onClick={() => setFeedback('')}>✕</button>
          </div>
        )}
        {feedbackError && (
          <div className="px-5 py-1.5 bg-red-500/20 text-red-300 text-xs border-b border-red-500/30 flex items-center justify-between">
            <span>⚠️ {feedbackError}</span>
            <button onClick={() => setFeedbackError('')}>✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-5 pt-2 bg-wa-sidebar border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'generator', label: '📝 Generador y Editor Inteligente' },
              { id: 'templates', label: '📑 Biblioteca de Plantillas', count: templates.length },
              { id: 'archive', label: '📜 Archivo y Registro Legal', count: documentsArchive.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-colors border-t border-x ${
                  activeTab === tab.id
                    ? 'bg-wa-dark text-emerald-400 border-white/10 font-bold border-b-2 border-b-emerald-400'
                    : 'text-wa-secondary hover:text-white border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-zinc-300">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ─── TAB CONTENT ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden bg-wa-dark flex flex-col md:flex-row">

          {/* ════ TAB 1: SMART GENERATOR & LIVE PREVIEW ════ */}
          {activeTab === 'generator' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Form & Variables */}
              <div className="w-full md:w-96 bg-wa-sidebar border-b md:border-b-0 md:border-r border-white/10 p-5 overflow-y-auto scrollbar-thin space-y-4 flex-shrink-0 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block mb-1.5">
                    Seleccionar Plantilla Oficial
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500 font-semibold"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                {/* Variable Inputs */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      Datos del Cliente y Variables
                    </span>
                    <span className="text-[10px] text-zinc-500">Auto-hidratación</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Razón Social / Cliente</label>
                    <input
                      type="text"
                      value={variables.clientName}
                      onChange={(e) => setVariables(prev => ({ ...prev, clientName: e.target.value }))}
                      className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      placeholder="Elena Rostova / Empresa S.A.C."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">RUC / DNI</label>
                      <input
                        type="text"
                        value={variables.clientDoc}
                        onChange={(e) => setVariables(prev => ({ ...prev, clientDoc: e.target.value }))}
                        className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500 font-mono"
                        placeholder="20601928374"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Moneda</label>
                      <select
                        value={variables.currency}
                        onChange={(e) => setVariables(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      >
                        <option value="PEN">Soles (PEN)</option>
                        <option value="USD">Dólares (USD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Monto Total</label>
                      <input
                        type="text"
                        value={variables.amount}
                        onChange={(e) => setVariables(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-emerald-400 font-bold font-mono outline-none focus:border-emerald-500"
                        placeholder="4,850.00"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Fecha Emisión</label>
                      <input
                        type="text"
                        value={variables.issueDate}
                        onChange={(e) => setVariables(prev => ({ ...prev, issueDate: e.target.value }))}
                        className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Servicio / Objeto</label>
                    <input
                      type="text"
                      value={variables.serviceTitle}
                      onChange={(e) => setVariables(prev => ({ ...prev, serviceTitle: e.target.value }))}
                      className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      placeholder="Implementación CHASKYAPP Enterprise"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Condiciones de Pago</label>
                    <input
                      type="text"
                      value={variables.paymentTerms}
                      onChange={(e) => setVariables(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      className="w-full bg-wa-header px-3 py-1.5 rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      placeholder="50% a la firma y 50% al despliegue"
                    />
                  </div>
                </div>

                {/* Compile & Action Buttons */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <button
                    onClick={handleGeneratePdf}
                    disabled={generating}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 transition active:scale-95"
                  >
                    <span>📄</span> {generating ? 'Compilando PDF...' : 'Generar PDF Oficial'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSendToChat}
                      disabled={!generatedDoc}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                        generatedDoc
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/5 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>💬</span> Enviar al Chat
                    </button>

                    <button
                      onClick={() => setShowSignModal(true)}
                      disabled={!generatedDoc}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                        generatedDoc
                          ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40'
                          : 'bg-white/5 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>✍️</span> Firmar
                    </button>
                  </div>

                  {generatedDoc && (
                    <a
                      href={generatedDoc.pdfPath}
                      download
                      className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <span>📥</span> Descargar PDF Generado
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Live Interactive Document Layout Preview */}
              <div className="flex-1 p-5 overflow-y-auto scrollbar-thin bg-gradient-to-b from-black/40 to-wa-dark flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-white/5">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    Vista Previa del Documento en Formato A4
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingText(prev => !prev)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <span>✏️</span> {isEditingText ? 'Ver Renderizado' : 'Editar Cláusulas'}
                    </button>
                  </div>
                </div>

                {/* Simulated A4 Paper */}
                <div className="flex-1 max-w-3xl mx-auto w-full bg-white text-zinc-900 rounded-2xl p-7 shadow-2xl space-y-4 font-sans text-xs border border-zinc-200">
                  {/* Corporate Header */}
                  <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-black text-emerald-700 tracking-tight">CHASKYAPP</span>
                        <span className="text-[10px] text-zinc-500 font-semibold">ENTERPRISE</span>
                      </div>
                      <p className="text-[9px] text-zinc-500 mt-0.5">
                        CHASKYAPP ENTERPRISE S.A.C. • RUC 20608912345 • www.chaskyapp.com
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 uppercase block mb-1">
                        Documento Oficial
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {variables.quoteNumber || 'REF-2026-CHKY'}
                      </span>
                    </div>
                  </div>

                  {/* Document Title */}
                  <h3 className="text-center font-bold text-sm text-zinc-900 uppercase tracking-wide">
                    {selectedTemplate?.title || 'Contrato Oficial'}
                  </h3>

                  {/* Metadata Box */}
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-700">
                    <div>
                      <span className="font-bold text-zinc-900 block">DESTINATARIO / CLIENTE:</span>
                      <p className="font-medium">{variables.clientName || 'Cliente'}</p>
                      <p className="text-zinc-500">{variables.clientDoc}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 block">CONDICIONES COMERCIALES:</span>
                      {variables.amount && (
                        <p className="font-bold text-emerald-700 font-mono text-xs">
                          {variables.currency} {variables.amount}
                        </p>
                      )}
                      <p className="text-zinc-500">Fecha: {variables.issueDate}</p>
                    </div>
                  </div>

                  {/* Body Content / Cláusulas */}
                  {isEditingText ? (
                    <textarea
                      rows="14"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="w-full bg-zinc-50 text-zinc-900 p-3 rounded-xl border border-zinc-300 font-mono text-xs leading-relaxed outline-none focus:border-emerald-600 resize-none"
                    />
                  ) : (
                    <div className="space-y-2.5 text-zinc-800 text-[11px] leading-relaxed max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                      {getHydratedPreview().split('\n').map((line, i) => {
                        if (!line.trim()) return <div key={i} className="h-1.5" />
                        const isHeader = line.startsWith('CLÁUSULA') || line.startsWith('DETALLE') || line.startsWith('RESUMEN') || line.startsWith('1.') || line.startsWith('2.')
                        return (
                          <p key={i} className={isHeader ? 'font-bold text-emerald-800 text-xs mt-2' : ''}>
                            {line}
                          </p>
                        )
                      })}
                    </div>
                  )}

                  {/* Signatures Area */}
                  <div className="pt-5 border-t border-zinc-200 grid grid-cols-2 gap-8 text-center text-[10px]">
                    <div className="space-y-1">
                      <div className="w-36 mx-auto border-b border-zinc-400 pb-1 text-emerald-700 font-serif italic text-xs">
                        Chasky Enterprise
                      </div>
                      <p className="font-bold text-zinc-900">CHASKYAPP ENTERPRISE S.A.C.</p>
                      <p className="text-zinc-500">Representante Legal</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-36 mx-auto border-b border-zinc-400 pb-1 text-zinc-700 font-serif italic text-xs">
                        {generatedDoc?.status === 'signed' ? '✓ Firma Electrónica' : 'Pendiente'}
                      </div>
                      <p className="font-bold text-zinc-900">{variables.clientName || 'EL CLIENTE'}</p>
                      <p className="text-zinc-500">Firma y Aceptación Digital</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ TAB 2: TEMPLATES LIBRARY ════ */}
          {activeTab === 'templates' && (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-5">
              <div className="border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-base">Biblioteca de Plantillas Dinámicas</h3>
                <p className="text-xs text-zinc-400">
                  Modelos contractuales y formatos institucionales listos para rellenado automático
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tpl => (
                  <div
                    key={tpl.id}
                    className="p-5 rounded-2xl bg-wa-header border border-white/10 hover:border-emerald-500/40 transition space-y-3 shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">
                          {tpl.category === 'contract' ? '📜' : tpl.category === 'quote' ? '💰' : tpl.category === 'nda' ? '🔒' : '🎓'}
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-xs">{tpl.title}</h4>
                          <span className="text-[10px] text-zinc-400 uppercase font-mono">ID: {tpl.id}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {tpl.category}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {tpl.description}
                    </p>

                    <button
                      onClick={() => {
                        setSelectedTemplateId(tpl.id)
                        setActiveTab('generator')
                      }}
                      className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                    >
                      <span>📝</span> Usar esta Plantilla
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ TAB 3: DOCUMENT ARCHIVE ════ */}
          {activeTab === 'archive' && (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">Archivo y Registro Legal de Documentos</h3>
                  <p className="text-xs text-zinc-400">
                    Historial de contratos, propuestas y actas generadas con firma digital comprobable
                  </p>
                </div>
                <button
                  onClick={fetchArchive}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 flex items-center gap-1"
                >
                  <span>🔄</span> Actualizar
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-wa-header shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 text-zinc-400 font-semibold uppercase text-[10px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Destinatario</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Estado Legal</th>
                      <th className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-200">
                    {documentsArchive.map(doc => {
                      const isSigned = doc.status === 'signed'
                      return (
                        <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-white block">{doc.title}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">ID: {doc.id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-zinc-200">{doc.variables?.clientName || 'Cliente'}</span>
                          </td>
                          <td className="px-4 py-3 font-bold font-mono text-emerald-400">
                            {doc.amount > 0 ? `${doc.currency} ${Number(doc.amount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase border ${
                              isSigned
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}>
                              {isSigned ? '✓ Firmado' : '⏳ Emitido'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <a
                                href={doc.pdfPath}
                                download
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg text-[11px] font-semibold transition"
                              >
                                Descargar
                              </a>
                              {!isSigned && (
                                <button
                                  onClick={() => {
                                    setGeneratedDoc(doc)
                                    setShowSignModal(true)
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-[11px] font-bold transition"
                                >
                                  Firmar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Digital Signature Modal */}
        {showSignModal && generatedDoc && (
          <DigitalSignatureModal
            document={generatedDoc}
            onClose={() => setShowSignModal(false)}
            onSigned={(updated) => {
              setGeneratedDoc(updated)
              setShowSignModal(false)
              showToast('✓ Documento firmado digitalmente con éxito')
              fetchArchive()
            }}
          />
        )}

      </div>
    </div>
  )
}
