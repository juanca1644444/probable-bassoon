// KnowledgeBase.jsx — Gestor de Base de Conocimiento RAG y Configuración del Copilot
import React, { useState, useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'

const CATEGORY_COLORS = {
  ventas: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  politicas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  soporte: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  educacion: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  general: 'bg-teal-500/15 text-teal-400 border-teal-500/30'
}

const FILE_ICONS = {
  pdf: '📕',
  manual: '📘',
  catalog: '🛍️',
  text: '📝',
  markdown: '📋',
  json: '📦',
  csv: '📊'
}

export default function KnowledgeBase() {
  const { addToast } = useAppStore()
  const [activeSubTab, setActiveSubTab] = useState('documents') // 'documents' | 'add' | 'playground' | 'settings' | 'logs'
  const [documents, setDocuments] = useState([])
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0, totalTokens: 0, categories: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // View Chunks Modal
  const [inspectDoc, setInspectDoc] = useState(null)
  const [docChunks, setDocChunks] = useState([])
  const [loadingChunks, setLoadingChunks] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Manual text entry state
  const [manualTitle, setManualTitle] = useState('')
  const [manualCategory, setManualCategory] = useState('ventas')
  const [manualContent, setManualContent] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  // Playground state
  const [playQuery, setPlayQuery] = useState('')
  const [playMatches, setPlayMatches] = useState([])
  const [playHandoff, setPlayHandoff] = useState(null)
  const [searchingPlay, setSearchingPlay] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    autonomous_enabled: 'false',
    confidence_threshold: '0.35',
    handoff_keywords: '',
    bot_name: 'Chasky Copilot (IA RAG)',
    handoff_message: '',
    fallback_message: '',
    system_prompt: ''
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Logs state
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Load documents and stats
  const fetchDocuments = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rag/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
        setStats(data.stats || { totalDocs: 0, totalChunks: 0, totalTokens: 0, categories: [] })
      } else {
        setError('No se pudieron cargar los documentos.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/rag/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) setSettings(data.settings)
      }
    } catch (err) {
      console.error('Error fetching RAG settings:', err)
    }
  }

  // Load logs
  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/rag/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Error fetching RAG logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
    fetchSettings()
  }, [])

  useEffect(() => {
    if (activeSubTab === 'logs') fetchLogs()
  }, [activeSubTab])

  // View chunks handler
  const handleInspectChunks = async (doc) => {
    setInspectDoc(doc)
    setLoadingChunks(true)
    try {
      const res = await fetch(`/api/rag/documents/${doc.id}/chunks`)
      if (res.ok) {
        const data = await res.json()
        setDocChunks(data.chunks || [])
      }
    } catch (err) {
      console.error('Error fetching chunks:', err)
    } finally {
      setLoadingChunks(false)
    }
  }

  // Delete document handler
  const handleDeleteDoc = async (id, title) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${title}" y todos sus fragmentos vectoriales?`)) return
    try {
      const res = await fetch(`/api/rag/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id))
        if (addToast) {
          addToast({
            title: 'Documento Eliminado 🗑️',
            description: `Se eliminó "${title}" de la base vectorial.`,
            type: 'info'
          })
        }
        fetchDocuments()
      }
    } catch (err) {
      console.error('Error deleting doc:', err)
    }
  }

  // Handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile || uploading) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('title', uploadTitle || uploadFile.name)
    formData.append('category', uploadCategory)

    try {
      const res = await fetch('/api/rag/documents/upload', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        if (addToast) {
          addToast({
            title: 'Documento Indexado 📚',
            description: `"${data.document?.title}" fragmentado en ${data.document?.totalChunks} vectores.`,
            type: 'success'
          })
        }
        setUploadFile(null)
        setUploadTitle('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchDocuments()
        setActiveSubTab('documents')
      } else {
        const err = await res.json()
        alert(err.error || 'Error al procesar archivo.')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  // Handle manual text ingestion
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualTitle.trim() || !manualContent.trim() || savingManual) return
    setSavingManual(true)

    try {
      const res = await fetch('/api/rag/documents/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle.trim(),
          category: manualCategory,
          content: manualContent.trim(),
          fileType: 'manual'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (addToast) {
          addToast({
            title: 'Base de Conocimiento Actualizada ✨',
            description: `"${data.document?.title}" indexado en ${data.document?.totalChunks} fragmentos.`,
            type: 'success'
          })
        }
        setManualTitle('')
        setManualContent('')
        fetchDocuments()
        setActiveSubTab('documents')
      } else {
        const err = await res.json()
        alert(err.error || 'Error al guardar texto.')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingManual(false)
    }
  }

  // Handle playground search
  const handlePlaygroundSearch = async (e) => {
    e.preventDefault()
    if (!playQuery.trim() || searchingPlay) return
    setSearchingPlay(true)

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: playQuery,
          topK: 4,
          threshold: parseFloat(settings.confidence_threshold || '0.20')
        })
      })

      if (res.ok) {
        const data = await res.json()
        setPlayMatches(data.matches || [])
        setPlayHandoff(data.handoffDetected ? data.handoffReason : null)
      }
    } catch (err) {
      console.error('Error running playground query:', err)
    } finally {
      setSearchingPlay(false)
    }
  }

  // Handle save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)

    try {
      const res = await fetch('/api/rag/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        if (addToast) {
          addToast({
            title: 'Ajustes RAG Guardados ⚙️',
            description: 'Parámetros del Bot Autónomo y Copilot actualizados.',
            type: 'success'
          })
        }
      }
    } catch (err) {
      console.error('Error saving settings:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-wa-header to-teal-950/30 p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold shadow-inner border border-emerald-500/30">
            🧠
          </div>
          <div>
            <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
              <span>Base de Conocimiento RAG & Copilot Autónomo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                AI Vector Store
              </span>
            </h3>
            <p className="text-xs text-wa-secondary">
              Indexación semántica de PDFs, catálogos y manuales para respuestas precisas y handoff inteligente.
            </p>
          </div>
        </div>

        {/* Global Autonomous Status Pill */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
            settings.autonomous_enabled === 'true'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
              : 'bg-white/5 text-wa-secondary border-white/10'
          }`}>
            <span>{settings.autonomous_enabled === 'true' ? '🤖 Bot Global Activo' : '👤 Modo Supervisado'}</span>
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-wa-header p-3.5 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-wa-secondary text-xs mb-1">
            <span>Documentos</span>
            <span>📚</span>
          </div>
          <div className="text-xl font-bold text-wa-text">{stats.totalDocs}</div>
          <p className="text-[10px] text-emerald-400 mt-0.5">Indexados y activos</p>
        </div>

        <div className="bg-wa-header p-3.5 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-wa-secondary text-xs mb-1">
            <span>Fragmentos (Chunks)</span>
            <span>🧩</span>
          </div>
          <div className="text-xl font-bold text-wa-green">{stats.totalChunks}</div>
          <p className="text-[10px] text-wa-secondary mt-0.5">Vectores calculados</p>
        </div>

        <div className="bg-wa-header p-3.5 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-wa-secondary text-xs mb-1">
            <span>Tokens Procesados</span>
            <span>🔢</span>
          </div>
          <div className="text-xl font-bold text-teal-400">{stats.totalTokens.toLocaleString()}</div>
          <p className="text-[10px] text-wa-secondary mt-0.5">Palabras clave y n-grams</p>
        </div>

        <div className="bg-wa-header p-3.5 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-wa-secondary text-xs mb-1">
            <span>Categorías</span>
            <span>🏷️</span>
          </div>
          <div className="text-xl font-bold text-purple-400">{stats.categories?.length || 0}</div>
          <p className="text-[10px] text-wa-secondary mt-0.5">Áreas de conocimiento</p>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-wa-header rounded-xl border border-white/5 overflow-x-auto">
        {[
          { id: 'documents', label: 'Documentos Indexados', icon: '📚' },
          { id: 'add', label: 'Subir / Agregar', icon: '➕' },
          { id: 'playground', label: 'Probador Vectorial', icon: '🧪' },
          { id: 'settings', label: 'Ajustes del Bot & Copilot', icon: '⚙️' },
          { id: 'logs', label: 'Logs de Consultas', icon: '📜' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeSubTab === tab.id
                ? 'bg-wa-green text-black font-bold shadow-sm'
                : 'text-wa-secondary hover:text-wa-text hover:bg-white/5'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DOCUMENTS LIST */}
      {activeSubTab === 'documents' && (
        <div className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-wa-text flex items-center gap-2">
              <span>Biblioteca de Documentos Corporativos</span>
              <span className="text-xs text-wa-secondary">({documents.length})</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDocuments}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-wa-secondary hover:text-wa-green hover:bg-white/5 transition-colors flex items-center gap-1"
              >
                <span>🔄</span>
                <span>Refrescar</span>
              </button>
              <button
                onClick={() => setActiveSubTab('add')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-wa-green hover:bg-green-600 text-black flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>+</span>
                <span>Nuevo Documento</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-wa-secondary space-y-2">
              <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Cargando base de conocimiento...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-wa-secondary space-y-2 border border-dashed border-white/10 rounded-xl">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-medium text-wa-text">No hay documentos indexados</p>
              <p className="text-xs max-w-sm mx-auto">
                Sube manuales en PDF, políticas o catálogos para que el Copilot y el Bot Autónomo respondan con contexto real.
              </p>
              <button
                onClick={() => setActiveSubTab('add')}
                className="mt-2 px-4 py-2 bg-wa-green text-black text-xs font-bold rounded-xl shadow-md"
              >
                Subir primer documento
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-wa-secondary uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Documento</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-center">Chunks</th>
                    <th className="py-2.5 px-3 text-center">Tokens</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {documents.map((doc) => {
                    const icon = FILE_ICONS[doc.fileType] || '📄'
                    const catBadge = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.general
                    return (
                      <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl flex-shrink-0">{icon}</span>
                            <div>
                              <p className="font-semibold text-wa-text line-clamp-1">{doc.title}</p>
                              <p className="text-[10px] text-wa-secondary font-mono">{doc.fileName || 'Texto manual'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${catBadge}`}>
                            {doc.category || 'general'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-wa-green">
                          {doc.actualChunks || doc.totalChunks || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-wa-secondary">
                          {doc.tokenCount || 0}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                            ✓ Indexado
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleInspectChunks(doc)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-wa-text font-medium text-[11px] border border-white/5 transition-colors flex items-center gap-1"
                              title="Ver fragmentos vectoriales"
                            >
                              <span>🔍</span>
                              <span>Chunks</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id, doc.title)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                              title="Eliminar documento"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD / UPLOAD DOCUMENT */}
      {activeSubTab === 'add' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Upload File */}
          <div className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📁</span>
              <div>
                <h4 className="text-sm font-bold text-wa-text">Subir Archivo de Referencia</h4>
                <p className="text-[11px] text-wa-secondary">Soporte para PDF, TXT, Markdown (.md), JSON o CSV</p>
              </div>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Título del Documento:</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ej. Manual de Garantías y Devoluciones 2026"
                  className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Categoría:</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
                >
                  <option value="ventas">Ventas y Catálogos</option>
                  <option value="politicas">Políticas y Garantías</option>
                  <option value="soporte">Soporte y Preguntas Frecuentes</option>
                  <option value="educacion">Educación y Admisiones</option>
                  <option value="general">General / Corporativo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Seleccionar Archivo:</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.json,.csv"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="w-full text-xs text-wa-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-wa-green/20 file:text-wa-green hover:file:bg-wa-green/30 cursor-pointer"
                />
                {uploadFile && (
                  <p className="text-[11px] text-emerald-400 mt-1">
                    ✓ Archivo seleccionado: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!uploadFile || uploading}
                className="w-full py-2.5 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Fragmentando y Vectorizando...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Procesar y Fragmentar Documento</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card B: Manual Text / FAQ Input */}
          <div className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">✍️</span>
              <div>
                <h4 className="text-sm font-bold text-wa-text">Entrada Directa de Texto o FAQ</h4>
                <p className="text-[11px] text-wa-secondary">Copia y pega políticas, listas de precios o respuestas predefinidas</p>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Título de la Guía:</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ej. Horarios de Envíos y Tarifas Motorizadas"
                  required
                  className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Categoría:</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
                >
                  <option value="ventas">Ventas y Catálogos</option>
                  <option value="politicas">Políticas y Garantías</option>
                  <option value="soporte">Soporte y Preguntas Frecuentes</option>
                  <option value="educacion">Educación y Admisiones</option>
                  <option value="general">General / Corporativo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">Contenido de Conocimiento:</label>
                <textarea
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="Escribe aquí los párrafos o FAQs oficiales que la IA debe conocer..."
                  rows={4}
                  required
                  className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl p-3 text-xs outline-none focus:border-wa-green transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!manualTitle.trim() || !manualContent.trim() || savingManual}
                className="w-full py-2.5 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {savingManual ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Guardando y Calculando Embeddings...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Guardar en Base Vectorial</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PLAYGROUND & VECTOR TESTER */}
      {activeSubTab === 'playground' && (
        <div className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-wa-text flex items-center gap-2">
              <span>🧪 Probador de Búsqueda Semántica Vectorial</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                Hybrid Search
              </span>
            </h4>
            <p className="text-xs text-wa-secondary">
              Ingresa una pregunta tal como la haría un cliente y evalúa qué fragmentos recupera el motor RAG.
            </p>
          </div>

          <form onSubmit={handlePlaygroundSearch} className="flex gap-2">
            <input
              type="text"
              value={playQuery}
              onChange={(e) => setPlayQuery(e.target.value)}
              placeholder="Ej. ¿Cuáles son los métodos de pago? o ¿Cuándo empiezan las clases?"
              className="flex-1 bg-wa-input border border-white/10 text-wa-text rounded-xl px-4 py-2.5 text-xs outline-none focus:border-wa-green transition-colors"
            />
            <button
              type="submit"
              disabled={searchingPlay || !playQuery.trim()}
              className="px-5 py-2.5 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              {searchingPlay ? 'Consultando...' : '🔍 Buscar'}
            </button>
          </form>

          {/* Handoff Trigger Alert in Playground */}
          {playHandoff && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <span className="font-bold">Disparador de Handoff Detectado: </span>
                <span>
                  {playHandoff === 'user_requested'
                    ? 'El usuario solicitó asistencia humana explícita. El chat se transferirá a un asesor humano.'
                    : 'Incertidumbre alta en la base de conocimientos. Se sugerirá derivar a humano.'}
                </span>
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-wa-secondary">
              Fragmentos Recuperados ({playMatches.length})
            </h5>

            {playMatches.length === 0 ? (
              <div className="py-8 text-center text-wa-secondary border border-dashed border-white/10 rounded-xl text-xs">
                Escribe una pregunta para visualizar la relevancia y puntuación de similitud coseno.
              </div>
            ) : (
              playMatches.map((m, idx) => (
                <div key={m.id || idx} className="bg-wa-input/60 rounded-xl p-3 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{FILE_ICONS[m.fileType] || '📄'}</span>
                      <span className="font-bold text-xs text-wa-text">{m.docTitle}</span>
                      <span className="text-[10px] text-wa-secondary font-mono">Chunk #{m.chunkIndex + 1}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                        {Math.round(m.score * 100)}% Coincidencia
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-200 bg-black/20 p-2.5 rounded-lg border border-white/5 leading-relaxed font-sans select-text">
                    {m.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-wa-text flex items-center gap-2">
              <span>⚙️ Configuración del Bot Autónomo y Reglas de Handoff</span>
            </h4>
            <p className="text-xs text-wa-secondary">
              Controla cuándo responde la IA automáticamente y los disparadores de escalamiento hacia asesores humanos.
            </p>
          </div>

          <div className="space-y-4">
            {/* Master Autonomous Toggle */}
            <div className="flex items-center justify-between p-3 bg-wa-input rounded-xl border border-white/5">
              <div>
                <p className="text-xs font-bold text-wa-text">Activar Bot Autónomo Globalmente</p>
                <p className="text-[11px] text-wa-secondary">
                  Si está activo, la IA responderá automáticamente a cualquier mensaje entrante de clientes.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autonomous_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, autonomous_enabled: e.target.checked ? 'true' : 'false' })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wa-green"></div>
              </label>
            </div>

            {/* Confidence Threshold */}
            <div className="p-3 bg-wa-input rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-wa-text">Umbral Mínimo de Confianza (Confidence Threshold)</p>
                  <p className="text-[11px] text-wa-secondary">
                    Si la similitud vectorial es inferior a este valor, la IA no inventará datos y ofrecerá transferir a un asesor.
                  </p>
                </div>
                <span className="font-mono font-bold text-wa-green text-sm">
                  {Math.round(parseFloat(settings.confidence_threshold || '0.35') * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={settings.confidence_threshold}
                onChange={(e) => setSettings({ ...settings, confidence_threshold: e.target.value })}
                className="w-full accent-wa-green"
              />
            </div>

            {/* Handoff Keywords */}
            <div>
              <label className="text-xs font-semibold text-wa-secondary block mb-1">
                Palabras Clave de Transferencia a Humano (separadas por comas):
              </label>
              <textarea
                value={settings.handoff_keywords}
                onChange={(e) => setSettings({ ...settings, handoff_keywords: e.target.value })}
                rows={2}
                className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl p-3 text-xs outline-none focus:border-wa-green transition-colors resize-none"
              />
            </div>

            {/* Handoff Message */}
            <div>
              <label className="text-xs font-semibold text-wa-secondary block mb-1">
                Mensaje de Transferencia al Cliente (Handoff Message):
              </label>
              <input
                type="text"
                value={settings.handoff_message}
                onChange={(e) => setSettings({ ...settings, handoff_message: e.target.value })}
                className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
              />
            </div>

            {/* Fallback Message */}
            <div>
              <label className="text-xs font-semibold text-wa-secondary block mb-1">
                Mensaje de Fallback (Cuando no hay contexto suficiente):
              </label>
              <input
                type="text"
                value={settings.fallback_message}
                onChange={(e) => setSettings({ ...settings, fallback_message: e.target.value })}
                className="w-full bg-wa-input border border-white/10 text-wa-text rounded-xl px-3 py-2 text-xs outline-none focus:border-wa-green transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {savingSettings ? 'Guardando...' : '💾 Guardar Ajustes'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-wa-header rounded-2xl p-4 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-wa-text flex items-center gap-2">
              <span>📜 Registro de Consultas y Acciones Copilot</span>
              <span className="text-xs text-wa-secondary">({logs.length})</span>
            </h4>
            <button
              onClick={fetchLogs}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-wa-secondary hover:text-wa-green hover:bg-white/5 transition-colors"
            >
              🔄 Refrescar
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-wa-secondary text-xs">Cargando registros...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-wa-secondary text-xs border border-dashed border-white/10 rounded-xl">
              No hay consultas registradas aún.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="bg-wa-input/50 rounded-xl p-3 border border-white/5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-wa-text line-clamp-1">"{log.query}"</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.handoffTriggered
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {log.handoffTriggered ? 'Escalado 🤝' : `${Math.round((log.confidenceScore || 0) * 100)}% Confianza`}
                    </span>
                  </div>
                  <p className="text-gray-300 text-[11px] bg-black/20 p-2 rounded-lg leading-relaxed">
                    {log.generatedResponse}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-wa-secondary pt-0.5">
                    <span>Modo: {log.mode === 'autonomous' ? '🤖 Autónomo' : '👤 Copilot Agente'}</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: VIEW CHUNKS */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wa-sidebar w-full max-w-2xl max-h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-wa-header">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{FILE_ICONS[inspectDoc.fileType] || '📄'}</span>
                <div>
                  <h4 className="text-sm font-bold text-wa-text">{inspectDoc.title}</h4>
                  <p className="text-[11px] text-wa-secondary font-mono">
                    {docChunks.length} fragmentos vectoriales (chunks) indexados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectDoc(null)}
                className="p-1 rounded-lg text-wa-secondary hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {loadingChunks ? (
                <div className="py-12 text-center text-wa-secondary text-xs">Cargando fragmentos...</div>
              ) : docChunks.length === 0 ? (
                <div className="py-12 text-center text-wa-secondary text-xs">No se encontraron chunks.</div>
              ) : (
                docChunks.map((chunk, i) => (
                  <div key={chunk.id || i} className="bg-wa-input/70 rounded-xl p-3 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-wa-secondary">
                      <span className="font-bold text-wa-green">Fragmento #{chunk.chunkIndex + 1}</span>
                      <span className="font-mono">{chunk.tokenCount} tokens</span>
                    </div>
                    <p className="text-xs text-gray-200 leading-relaxed font-sans select-text">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-white/10 bg-wa-header flex justify-end">
              <button
                onClick={() => setInspectDoc(null)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-wa-text rounded-xl text-xs font-semibold"
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
