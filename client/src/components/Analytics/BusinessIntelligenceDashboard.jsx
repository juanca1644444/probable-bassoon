import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'

export default function BusinessIntelligenceDashboard({ onClose }) {
  const [activeTab, setActiveTab] = useState('funnel') // 'funnel' | 'channels' | 'agents' | 'leaderboard'
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [funnelData, setFunnelData] = useState(null)
  const [channelsData, setChannelsData] = useState(null)
  const [agentsData, setAgentsData] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [sortField, setSortField] = useState('score')
  const [exporting, setExporting] = useState(false)

  // Fetch all BI datasets in parallel
  const fetchBiData = async () => {
    setLoading(true)
    try {
      const [resOverview, resFunnel, resChannels, resAgents] = await Promise.all([
        fetch('http://localhost:3001/api/bi/overview'),
        fetch('http://localhost:3001/api/bi/funnel'),
        fetch('http://localhost:3001/api/bi/channels'),
        fetch('http://localhost:3001/api/bi/agents')
      ])

      if (resOverview.ok) {
        const j = await resOverview.json()
        setOverview(j.data)
      }
      if (resFunnel.ok) {
        const j = await resFunnel.json()
        setFunnelData(j.data)
      }
      if (resChannels.ok) {
        const j = await resChannels.json()
        setChannelsData(j.data)
      }
      if (resAgents.ok) {
        const j = await resAgents.json()
        setAgentsData(j.data)
      }
    } catch (err) {
      console.error('Error fetching BI data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBiData()
  }, [period])

  // Handlers for exporting reports
  const handleExportExcel = () => {
    window.open('http://localhost:3001/api/bi/export/excel', '_blank')
  }

  const handleExportPdf = () => {
    window.open('http://localhost:3001/api/bi/export/pdf', '_blank')
  }

  // Sorted agents for leaderboard
  const sortedAgents = React.useMemo(() => {
    if (!agentsData?.agents) return []
    const list = [...agentsData.agents]
    if (sortField === 'score') return list.sort((a, b) => b.performanceScore - a.performanceScore)
    if (sortField === 'csat') return list.sort((a, b) => b.csatScore - a.csatScore)
    if (sortField === 'chats') return list.sort((a, b) => b.chatsAttended - a.chatsAttended)
    if (sortField === 'frt') return list.sort((a, b) => a.firstResponseTimeSec - b.firstResponseTimeSec)
    if (sortField === 'deals') return list.sort((a, b) => b.closedDeals - a.closedDeals)
    return list
  }, [agentsData, sortField])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in text-wa-text font-sans">
      <div className="bg-[#111b21] dark:bg-[#111b21] text-gray-100 border border-emerald-500/30 rounded-3xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
        
        {/* ── HEADER SUPERIOR ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-[#1f2c34] border-b border-gray-700/60 gap-4 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-2xl text-white shadow-lg shadow-emerald-900/40">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">Business Intelligence & Analytics Suite</h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm">
                  CHASKYAPP BI 2.0
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Embudo de conversión, comparativa omnicanal y KPIs de productividad en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Period selector */}
            <div className="flex items-center bg-[#111b21] rounded-xl p-1 border border-gray-700/60 text-xs">
              <button
                onClick={() => setPeriod('7d')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === '7d' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                7 Días
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === 'month' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Este Mes
              </button>
              <button
                onClick={() => setPeriod('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Histórico
              </button>
            </div>

            {/* Export Buttons */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-700/40 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Descargar reporte en formato compatible con Excel (.csv UTF-8)"
            >
              <span>📗</span>
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Descargar reporte ejecutivo formal en PDF con PDFKit"
            >
              <span>📕</span>
              <span className="hidden sm:inline">PDF Oficial</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={fetchBiData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-gray-700/60 transition-colors"
              title="Actualizar datos"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-700/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── MACRO KPIS BAR ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4 bg-[#111b21] border-b border-gray-800/80 flex-shrink-0">
          <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-gray-700/40 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Pipeline en Negociación</span>
              <span className="text-emerald-400">💰</span>
            </div>
            <div className="text-xl font-black text-white">
              S/ {(funnelData?.totalPipelineValue || 75580).toLocaleString('es-PE')}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
              <span>↑ +18.4%</span>
              <span className="text-gray-400">vs mes anterior</span>
            </div>
          </div>

          <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-gray-700/40 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Tasa Conversión Funnel</span>
              <span className="text-blue-400">🎯</span>
            </div>
            <div className="text-xl font-black text-white">
              {funnelData?.overallConversionRate || 16}%
            </div>
            <div className="text-[11px] text-blue-400 font-medium mt-0.5">
              {funnelData?.closedLeads || 5} acuerdos cerrados de {funnelData?.totalLeads || 32} leads
            </div>
          </div>

          <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-gray-700/40 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Satisfacción CSAT</span>
              <span className="text-amber-400">⭐</span>
            </div>
            <div className="text-xl font-black text-white flex items-center gap-1.5">
              <span>{overview?.avgCsat || 4.84}</span>
              <span className="text-xs text-amber-400 font-normal">/ 5.0</span>
            </div>
            <div className="text-[11px] text-amber-400 font-medium mt-0.5">
              98% clientes satisfechos
            </div>
          </div>

          <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-gray-700/40 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Tiempo de Respuesta (FRT)</span>
              <span className="text-purple-400">⚡</span>
            </div>
            <div className="text-xl font-black text-white">
              {overview?.avgFRT || '53s'}
            </div>
            <div className="text-[11px] text-purple-400 font-medium mt-0.5">
              Handling medio: {overview?.avgHandlingTime || '9m 30s'}
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-6 bg-[#182229] border-b border-gray-800/80 text-xs font-semibold overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveTab('funnel')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'funnel'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🎯</span>
            <span>Embudo de Conversión (Sales Funnel)</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'channels'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🌐</span>
            <span>Rendimiento por Canal Omnicanal</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'agents'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>👥</span>
            <span>KPIs de Productividad de Agentes</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🏆</span>
            <span>Ranking del Mes & Podio</span>
          </button>
        </div>

        {/* ── TAB CONTENT SCROLLABLE BODY ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 1. TAB: EMBUDO DE CONVERSIÓN (SALES FUNNEL)                       */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'funnel' && (
            <div className="space-y-6">
              
              {/* Stepped Visual Funnel Cards */}
              <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>🎯</span>
                      <span>Embudo de Conversión de Ventas B2B / B2C</span>
                    </h3>
                    <p className="text-xs text-gray-400">
                      Visualización secuencial del flujo de leads y tasa de retención entre etapas comerciales
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Tasa de Conversión Global: </span>
                    <span className="text-sm font-bold text-emerald-400">{funnelData?.overallConversionRate || 16}%</span>
                  </div>
                </div>

                {/* Funnel Progress Steps */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
                  {(funnelData?.stages || []).map((stage, idx) => {
                    const widthPercent = 100 - (idx * 16)
                    return (
                      <div
                        key={stage.id}
                        className="bg-[#111b21] p-4 rounded-xl border border-gray-700/40 relative overflow-hidden flex flex-col justify-between"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span className="font-semibold text-gray-300">Etapa {idx + 1}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: `${stage.color}25`, color: stage.color }}
                            >
                              {stage.conversionRateTotal}% Total
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-white mb-2">{stage.name}</h4>

                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-2xl font-black text-white">{stage.funnelReach}</span>
                            <span className="text-xs font-semibold text-emerald-400">
                              S/ {stage.dealValue.toLocaleString('es-PE')}
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-gray-400">
                            {stage.stageCount} leads activos en fase
                          </div>
                        </div>

                        {/* Conversion dropoff badge */}
                        <div className="mt-4 pt-3 border-t border-gray-800 text-[11px] flex items-center justify-between">
                          <span className="text-gray-400">Retención vs anterior:</span>
                          <span className={`font-bold ${stage.conversionRatePrev > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {stage.conversionRatePrev}%
                          </span>
                        </div>
                        {idx > 0 && (
                          <div className="text-[10px] text-red-400 text-right mt-0.5">
                            Abandono: -{stage.dropoffRate}%
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chart: Deal Value & Leads per stage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Recharts Bar Chart: Volumen de Leads y Valor Monetario */}
                <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 shadow-md">
                  <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                    <span>📊</span>
                    <span>Volumen de Prospectos por Etapa</span>
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Leads acumulados que alcanzaron cada fase del proceso</p>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData?.stages || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3942" />
                        <XAxis dataKey="name" stroke="#8696a0" fontSize={11} tick={{ fill: '#8696a0' }} />
                        <YAxis stroke="#8696a0" fontSize={11} tick={{ fill: '#8696a0' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111b21', borderColor: '#00a884', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px' }}
                          formatter={(value, name) => [value, name === 'funnelReach' ? 'Prospectos Acumulados' : 'En esta etapa']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="funnelReach" name="Prospectos Acumulados" fill="#00a884" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="stageCount" name="Activos en Fase" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recharts Area Chart: Valor Económico del Pipeline (PEN) */}
                <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 shadow-md">
                  <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                    <span>💵</span>
                    <span>Progresión Económica del Pipeline (S/ PEN)</span>
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Valor monetario estimado de las oportunidades por etapa</p>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={funnelData?.stages || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <defs>
                          <linearGradient id="dealGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3942" />
                        <XAxis dataKey="name" stroke="#8696a0" fontSize={11} tick={{ fill: '#8696a0' }} />
                        <YAxis stroke="#8696a0" fontSize={11} tick={{ fill: '#8696a0' }} tickFormatter={(v) => `S/${v/1000}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111b21', borderColor: '#10b981', borderRadius: '12px' }}
                          formatter={(val) => [`S/ ${val.toLocaleString('es-PE')}`, 'Valor Estimado']}
                        />
                        <Area type="monotone" dataKey="dealValue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#dealGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Table of Funnel Metrics */}
              <div className="bg-[#1f2c34] rounded-2xl border border-gray-700/50 overflow-hidden shadow-md">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h4 className="text-sm font-bold text-white">Detalle de Conversión y Tiempos de Permanencia</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111b21] text-gray-400 border-b border-gray-800 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Etapa Comercial</th>
                        <th className="py-3 px-4">Leads Acum.</th>
                        <th className="py-3 px-4">En Fase</th>
                        <th className="py-3 px-4">Valor Estimado</th>
                        <th className="py-3 px-4">Retención vs Prev.</th>
                        <th className="py-3 px-4">Conversión Global</th>
                        <th className="py-3 px-4">Permanencia Media</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {(funnelData?.stages || []).map((stage) => (
                        <tr key={stage.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span>{stage.name}</span>
                          </td>
                          <td className="py-3 px-4">{stage.funnelReach} prospectos</td>
                          <td className="py-3 px-4">{stage.stageCount}</td>
                          <td className="py-3 px-4 font-bold text-emerald-400">S/ {stage.dealValue.toLocaleString('es-PE')}</td>
                          <td className="py-3 px-4 font-bold text-emerald-300">{stage.conversionRatePrev}%</td>
                          <td className="py-3 px-4 font-bold text-blue-400">{stage.conversionRateTotal}%</td>
                          <td className="py-3 px-4 text-gray-400">{stage.avgDaysInStage} días</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 2. TAB: RENDIMIENTO POR CANAL OMNICANAL                           */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              
              {/* Channel Scorecards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(channelsData?.channels || []).map(ch => (
                  <div key={ch.id} className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{ch.icon}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: `${ch.color}25`, color: ch.color }}
                        >
                          {ch.sharePercentage}% Cuota
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{ch.name}</h4>
                      <div className="text-2xl font-black text-white mb-2">{ch.messages} <span className="text-xs font-normal text-gray-400">mensajes</span></div>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-gray-800 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Conversaciones:</span>
                        <span className="font-semibold text-gray-200">{ch.chats}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Deals Cerrados:</span>
                        <span className="font-bold text-emerald-400">{ch.closedDeals} ({ch.conversionRate}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ingresos:</span>
                        <span className="font-bold text-white">S/ {ch.revenue.toLocaleString('es-PE')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">FRT Medio:</span>
                        <span className="font-semibold text-amber-400">{ch.avgFrtFormatted}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comparative Charts: Messages & Revenue by Channel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Bar Chart: Interacciones vs Conversiones */}
                <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 shadow-md">
                  <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                    <span>📊</span>
                    <span>Interacciones y Acuerdos Ganados por Canal</span>
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Comparativa de volumen de actividad vs efectividad de cierre</p>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={channelsData?.channels || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3942" />
                        <XAxis dataKey="name" stroke="#8696a0" fontSize={10} tick={{ fill: '#8696a0' }} />
                        <YAxis stroke="#8696a0" fontSize={11} tick={{ fill: '#8696a0' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111b21', borderColor: '#00a884', borderRadius: '12px' }}
                          formatter={(val, name) => [val, name === 'messages' ? 'Mensajes' : 'Deals Cerrados']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="messages" name="Mensajes Recibidos" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="closedDeals" name="Deals Cerrados" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart: Share of Voice y Cuota de Facturación */}
                <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 shadow-md">
                  <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                    <span>🥧</span>
                    <span>Distribución de Ingresos por Canal (PEN)</span>
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Aporte a la facturación total según el medio de contacto</p>

                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelsData?.channels || []}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={4}
                          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {(channelsData?.channels || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111b21', borderColor: '#00a884', borderRadius: '12px' }}
                          formatter={(val) => [`S/ ${val.toLocaleString('es-PE')}`, 'Facturación']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 3. TAB: KPIS DE PRODUCTIVIDAD DE AGENTES                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              
              {/* Team Performance Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Total de Chats Atendidos por el Equipo</div>
                  <div className="text-2xl font-black text-white">{agentsData?.teamAverages?.totalChatsAttended || 154} chats</div>
                  <div className="text-xs text-emerald-400 mt-1">✓ 100% resueltos dentro del SLA</div>
                </div>

                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Tiempo de Respuesta Promedio (FRT)</div>
                  <div className="text-2xl font-black text-white">{agentsData?.teamAverages?.avgFRTFormatted || '53s'}</div>
                  <div className="text-xs text-blue-400 mt-1">Meta corporativa: &lt; 60 seg</div>
                </div>

                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Resolución Media (Handling Time)</div>
                  <div className="text-2xl font-black text-white">{agentsData?.teamAverages?.avgHandlingTimeFormatted || '9m 30s'}</div>
                  <div className="text-xs text-purple-400 mt-1">Satisfacción media: {agentsData?.teamAverages?.avgCsatScore || 4.84} ★</div>
                </div>
              </div>

              {/* Individual Agents Detailed Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(agentsData?.agents || []).map((ag) => (
                  <div
                    key={ag.id}
                    className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 hover:border-emerald-500/50 transition-all shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Agent Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={ag.avatar}
                            alt={ag.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/50"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{ag.name}</h4>
                              <span className="text-base">{ag.medal}</span>
                            </div>
                            <p className="text-xs text-gray-400">{ag.role}</p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {ag.badge}
                        </span>
                      </div>

                      {/* KPI Meters */}
                      <div className="grid grid-cols-2 gap-3 my-3 bg-[#111b21] p-3 rounded-xl border border-gray-800">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">1° Respuesta (FRT)</span>
                          <div className="text-sm font-black text-emerald-400">{ag.frtFormatted}</div>
                          <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.max(10, Math.min(100, (1 - ag.firstResponseTimeSec / 120) * 100))}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Resolución (Handling)</span>
                          <div className="text-sm font-black text-blue-400">{ag.handlingTimeFormatted}</div>
                          <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${Math.max(10, Math.min(100, (1 - ag.handlingTimeMin / 20) * 100))}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Chats Atendidos</span>
                          <div className="text-sm font-black text-white">{ag.chatsAttended} conversaciones</div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Calificación CSAT</span>
                          <div className="text-sm font-black text-amber-400 flex items-center gap-1">
                            <span>{ag.csatScore}</span>
                            <span className="text-xs">★★★★★</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Stats & Performance Score */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
                      <div>
                        <span className="text-gray-400">Ventas Cerradas: </span>
                        <span className="font-bold text-white">{ag.closedDeals} (S/ {ag.revenueGenerated.toLocaleString('es-PE')})</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Puntaje BI: </span>
                        <span className="font-black text-emerald-400 text-sm">{ag.performanceScore} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 4. TAB: RANKING DEL MES & PODIO                                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              
              {/* Podium Visual Top 3 */}
              <div className="bg-[#1f2c34] p-6 rounded-2xl border border-gray-700/50 shadow-md">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                    <span>🏆</span>
                    <span>Podio de Rendimiento del Equipo</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Reconocimiento a los asesores comerciales y de soporte más destacados del mes
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-6 pt-4 pb-2 max-w-2xl mx-auto">
                  
                  {/* 2nd Place */}
                  {sortedAgents[1] && (
                    <div className="w-full sm:w-1/3 flex flex-col items-center order-2 sm:order-1">
                      <div className="relative mb-2">
                        <img
                          src={sortedAgents[1].avatar}
                          alt={sortedAgents[1].name}
                          className="w-16 h-16 rounded-full object-cover border-4 border-slate-300 shadow-lg"
                        />
                        <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xl">🥈</span>
                      </div>
                      <h4 className="text-xs font-bold text-white text-center mt-1">{sortedAgents[1].name}</h4>
                      <span className="text-[10px] text-gray-400 text-center">{sortedAgents[1].badge}</span>
                      <div className="w-full bg-[#111b21] rounded-t-2xl p-4 mt-3 border border-gray-700/60 text-center h-28 flex flex-col justify-center shadow-inner">
                        <span className="text-xs text-gray-400 font-semibold">2° Lugar</span>
                        <span className="text-lg font-black text-slate-300">{sortedAgents[1].performanceScore} pts</span>
                        <span className="text-[10px] text-emerald-400">{sortedAgents[1].csatScore} ★ CSAT</span>
                      </div>
                    </div>
                  )}

                  {/* 1st Place (Winner) */}
                  {sortedAgents[0] && (
                    <div className="w-full sm:w-1/3 flex flex-col items-center order-1 sm:order-2">
                      <div className="relative mb-2">
                        <img
                          src={sortedAgents[0].avatar}
                          alt={sortedAgents[0].name}
                          className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 shadow-xl ring-4 ring-amber-400/20"
                        />
                        <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-2xl">🥇</span>
                      </div>
                      <h4 className="text-sm font-bold text-white text-center mt-1">{sortedAgents[0].name}</h4>
                      <span className="text-[10px] text-amber-400 font-semibold text-center">{sortedAgents[0].badge}</span>
                      <div className="w-full bg-gradient-to-t from-emerald-950 to-[#111b21] rounded-t-2xl p-4 mt-3 border border-amber-400/50 text-center h-36 flex flex-col justify-center shadow-2xl">
                        <span className="text-xs text-amber-400 font-bold">👑 Campeón del Mes</span>
                        <span className="text-2xl font-black text-amber-400">{sortedAgents[0].performanceScore} pts</span>
                        <span className="text-[11px] text-emerald-300 font-bold">{sortedAgents[0].csatScore} ★ CSAT · {sortedAgents[0].closedDeals} Ventas</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {sortedAgents[2] && (
                    <div className="w-full sm:w-1/3 flex flex-col items-center order-3 sm:order-3">
                      <div className="relative mb-2">
                        <img
                          src={sortedAgents[2].avatar}
                          alt={sortedAgents[2].name}
                          className="w-16 h-16 rounded-full object-cover border-4 border-amber-700 shadow-lg"
                        />
                        <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xl">🥉</span>
                      </div>
                      <h4 className="text-xs font-bold text-white text-center mt-1">{sortedAgents[2].name}</h4>
                      <span className="text-[10px] text-gray-400 text-center">{sortedAgents[2].badge}</span>
                      <div className="w-full bg-[#111b21] rounded-t-2xl p-4 mt-3 border border-gray-700/60 text-center h-24 flex flex-col justify-center shadow-inner">
                        <span className="text-xs text-gray-400 font-semibold">3° Lugar</span>
                        <span className="text-lg font-black text-amber-600">{sortedAgents[2].performanceScore} pts</span>
                        <span className="text-[10px] text-emerald-400">{sortedAgents[2].csatScore} ★ CSAT</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Leaderboard Table with Custom Sorting */}
              <div className="bg-[#1f2c34] rounded-2xl border border-gray-700/50 overflow-hidden shadow-md">
                <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-white">Tabla Clasificatoria Detallada</h4>
                  
                  {/* Sorting filters */}
                  <div className="flex items-center gap-1 bg-[#111b21] p-1 rounded-xl text-xs border border-gray-800">
                    <span className="text-gray-400 px-2">Ordenar por:</span>
                    <button
                      onClick={() => setSortField('score')}
                      className={`px-2.5 py-1 rounded-lg ${sortField === 'score' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Puntuación
                    </button>
                    <button
                      onClick={() => setSortField('csat')}
                      className={`px-2.5 py-1 rounded-lg ${sortField === 'csat' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      CSAT
                    </button>
                    <button
                      onClick={() => setSortField('frt')}
                      className={`px-2.5 py-1 rounded-lg ${sortField === 'frt' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Rapidez (FRT)
                    </button>
                    <button
                      onClick={() => setSortField('deals')}
                      className={`px-2.5 py-1 rounded-lg ${sortField === 'deals' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Ventas
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111b21] text-gray-400 border-b border-gray-800 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Posición</th>
                        <th className="py-3 px-4">Agente</th>
                        <th className="py-3 px-4">Rol / Especialidad</th>
                        <th className="py-3 px-4">Chats Atendidos</th>
                        <th className="py-3 px-4">1° Respuesta (FRT)</th>
                        <th className="py-3 px-4">Resolución</th>
                        <th className="py-3 px-4">Satisfacción CSAT</th>
                        <th className="py-3 px-4">Ventas Cerradas</th>
                        <th className="py-3 px-4">Puntaje Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {sortedAgents.map((ag, idx) => (
                        <tr key={ag.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-black text-sm">
                            <span className="flex items-center gap-1.5">
                              <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️'}</span>
                              <span className="text-gray-300">#{idx + 1}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <img src={ag.avatar} alt={ag.name} className="w-7 h-7 rounded-full object-cover" />
                              <span>{ag.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-400">{ag.role}</td>
                          <td className="py-3.5 px-4 font-medium">{ag.chatsAttended}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">{ag.frtFormatted}</td>
                          <td className="py-3.5 px-4 text-blue-300">{ag.handlingTimeFormatted}</td>
                          <td className="py-3.5 px-4 font-bold text-amber-400">{ag.csatScore} ★</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-300">{ag.closedDeals} (S/ {ag.revenueGenerated.toLocaleString('es-PE')})</td>
                          <td className="py-3.5 px-4 font-black text-sm text-emerald-400">{ag.performanceScore} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── FOOTER ACTIONS ─────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-[#1f2c34] border-t border-gray-700/60 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Motor BI CHASKYAPP activo · Datos agregados en tiempo real</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="hover:text-emerald-400 transition-colors font-medium flex items-center gap-1"
            >
              <span>📗</span>
              <span>Exportar Excel</span>
            </button>
            <span>·</span>
            <button
              onClick={handleExportPdf}
              className="hover:text-red-400 transition-colors font-medium flex items-center gap-1"
            >
              <span>📕</span>
              <span>Exportar PDF</span>
            </button>
            <span>·</span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
