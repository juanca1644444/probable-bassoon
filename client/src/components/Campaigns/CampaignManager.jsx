import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import BulkSenderModal from './BulkSenderModal'

export default function CampaignManager({ onClose }) {
  const [campaigns, setCampaigns] = useState([])
  const [broadcastLists, setBroadcastLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'create'
  const [showBulkModal, setShowBulkModal] = useState(false)
  
  // Create form state
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('¡Hola {{nombre}}! 🌟 Queremos compartir contigo una novedad exclusiva de CHASKYAPP.')
  const [targetAudience, setTargetAudience] = useState('all')
  const [launchingId, setLaunchingId] = useState(null)
  const [creating, setCreating] = useState(false)

  const { addToast } = useAppStore()

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch (e) {
      console.error('Error fetching campaigns:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchBroadcastLists = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/broadcasts')
      if (res.ok) {
        const data = await res.json()
        setBroadcastLists(data)
      }
    } catch (e) {
      console.error('Error fetching broadcast lists:', e)
    }
  }

  useEffect(() => {
    fetchCampaigns()
    fetchBroadcastLists()
  }, [])

  const insertVariable = (variable) => {
    setTemplate((prev) => prev + ` {{${variable}}}`)
  }

  const handleCreateCampaign = async (e) => {
    e.preventDefault()
    if (!name.trim() || !template.trim()) return

    setCreating(true)
    try {
      const res = await fetch('http://localhost:3001/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          template: template.trim(),
          targetAudience
        })
      })

      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Campaña creada',
          message: `Campaña "${name}" guardada con éxito`,
        })
        setName('')
        setActiveTab('list')
        fetchCampaigns()
      }
    } catch (err) {
      console.error('Error creating campaign:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleLaunchCampaign = async (campaignId) => {
    setLaunchingId(campaignId)
    try {
      const res = await fetch(`http://localhost:3001/api/campaigns/${campaignId}/launch`, {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Campaña lanzada',
          message: `Enviando a ${data.totalRecipients} destinatarios con rate-limiting`,
        })
        fetchCampaigns()
      }
    } catch (e) {
      console.error('Error launching campaign:', e)
    } finally {
      setLaunchingId(null)
    }
  }

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta campaña?')) return
    try {
      await fetch(`http://localhost:3001/api/campaigns/${campaignId}`, { method: 'DELETE' })
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Campaña eliminada',
        message: 'La campaña fue removida',
      })
    } catch (e) {
      console.error('Error deleting campaign:', e)
    }
  }

  // Aggregate stats
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0)
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0)
  const totalReplies = campaigns.reduce((acc, c) => acc + (c.replyCount || 0), 0)
  const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(0) : '100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-wa-sidebar border border-gray-700/60 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Bar */}
        <div className="bg-wa-header px-6 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md">
              📢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Campañas de Difusión Masiva</h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Marketing Suite
                </span>
              </div>
              <p className="text-xs text-wa-secondary">
                Envía mensajes personalizados a escala con variables dinámicas y control de tasa de entrega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-wa-input/30 border-b border-gray-700/40">
          <div className="bg-wa-header/80 border border-gray-700/40 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">TOTAL CAMPAÑAS</span>
            <span className="text-xl font-bold text-white">{campaigns.length}</span>
          </div>
          <div className="bg-wa-header/80 border border-gray-700/40 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">ENVIADOS CON ÉXITO</span>
            <span className="text-xl font-bold text-emerald-400">{totalSent}</span>
          </div>
          <div className="bg-wa-header/80 border border-gray-700/40 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">TASA DE ENTREGA</span>
            <span className="text-xl font-bold text-blue-400">{deliveryRate}%</span>
          </div>
          <div className="bg-wa-header/80 border border-gray-700/40 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">RESPUESTAS RECIBIDAS</span>
            <span className="text-xl font-bold text-purple-400">{totalReplies}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-700/40 bg-wa-header/60">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'list'
                ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                : 'text-wa-secondary border-transparent hover:text-white'
            }`}
          >
            <span>📋</span>
            <span>Historial y Reportes ({campaigns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                : 'text-wa-secondary border-transparent hover:text-white'
            }`}
          >
            <span>✨</span>
            <span>Crear Nueva Campaña</span>
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex-1 py-3 text-xs font-bold text-center border-b-2 border-transparent transition-colors flex items-center justify-center gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-mono"
          >
            <span>🚀</span>
            <span>Envío a Números (Excel/Pegar)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'create' ? (
            /* Create Campaign Screen */
            <form onSubmit={handleCreateCampaign} className="space-y-5 max-w-2xl mx-auto">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Nombre de la Campaña:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Promoción Fin de Año, Descuento Black Friday..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Segmento de Audiencia:
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">👥 Todos los contactos (Libreta completa)</option>
                  {broadcastLists.map((list) => (
                    <option key={list.id} value={`broadcast:${list.id}`}>
                      📢 Lista: {list.name} ({list.memberCount || list.members?.length || 0} contactos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Plantilla del Mensaje:
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-400">Insertar variable:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('nombre')}
                      className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md font-mono"
                    >
                      + {"{{nombre}}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('telefono')}
                      className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md font-mono"
                    >
                      + {"{{telefono}}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('empresa')}
                      className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md font-mono"
                    >
                      + {"{{empresa}}"}
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  rows={4}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Escribe la plantilla de tu mensaje..."
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 resize-none shadow-inner"
                />
              </div>

              {/* Live Preview Box */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">
                  Vista previa de entrega (simulada para María García):
                </label>
                <div className="p-4 bg-wa-chat-bg/60 rounded-xl border border-gray-700/50 flex justify-end">
                  <div className="bg-wa-bubble rounded-2xl rounded-tr-sm p-3 max-w-sm shadow-md text-sm text-white leading-relaxed">
                    <p className="whitespace-pre-line">
                      {template
                        .replace(/\{\{nombre\}\}/gi, 'María García')
                        .replace(/\{\{telefono\}\}/gi, '+34 612 345 678')
                        .replace(/\{\{empresa\}\}/gi, 'CHASKYAPP')}
                    </p>
                    <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-wa-secondary">
                      <span>12:00</span>
                      <span className="text-blue-400">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs text-wa-secondary hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg flex items-center gap-2"
                >
                  <span>🚀</span>
                  <span>{creating ? 'Guardando...' : 'Crear Campaña'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Campaign List & Reports */
            <div className="space-y-4">
              {loading ? (
                <div className="py-12 text-center text-xs text-wa-secondary">Cargando campañas...</div>
              ) : campaigns.length === 0 ? (
                <div className="py-16 text-center text-wa-secondary text-sm">
                  <p className="mb-3">No hay campañas registradas todavía.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Crear primera campaña
                  </button>
                </div>
              ) : (
                campaigns.map((camp) => {
                  const isSending = camp.status === 'sending' || launchingId === camp.id
                  const isCompleted = camp.status === 'completed'

                  return (
                    <div
                      key={camp.id}
                      className="bg-wa-header border border-gray-700/50 hover:border-emerald-500/40 rounded-xl p-4 transition-all shadow-md space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{camp.name}</h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isSending
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                  : 'bg-gray-700/50 text-gray-300'
                              }`}
                            >
                              {isCompleted ? '✓ Completada' : isSending ? '⏳ Enviando...' : 'Borrador'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">
                            "{camp.template}"
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {camp.status !== 'completed' && (
                            <button
                              disabled={isSending}
                              onClick={() => handleLaunchCampaign(camp.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
                            >
                              <span>🚀</span>
                              <span>{isSending ? 'Enviando...' : 'Lanzar Campaña'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar campaña"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Stats Grid inside Card */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-700/30 text-center text-xs">
                        <div className="bg-black/20 p-2 rounded-lg">
                          <span className="text-[10px] text-gray-400 block">Enviados</span>
                          <span className="font-bold text-white">{camp.sentCount || 0}</span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <span className="text-[10px] text-gray-400 block">Entregados</span>
                          <span className="font-bold text-emerald-400">{camp.deliveredCount || 0}</span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <span className="text-[10px] text-gray-400 block">Leídos</span>
                          <span className="font-bold text-blue-400">{camp.readCount || 0}</span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <span className="text-[10px] text-gray-400 block">Respuestas</span>
                          <span className="font-bold text-purple-400">{camp.replyCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk WhatsApp Sender Modal */}
      {showBulkModal && (
        <BulkSenderModal
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  )
}
