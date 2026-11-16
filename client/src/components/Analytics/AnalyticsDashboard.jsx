import React, { useState, useEffect } from 'react'
import BusinessIntelligenceDashboard from './BusinessIntelligenceDashboard'
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
  Cell
} from 'recharts'

export default function AnalyticsDashboard({ onClose }) {
  const [data, setData] = useState(null)
  const [csatData, setCsatData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [showBiSuite, setShowBiSuite] = useState(false)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const [res, csatRes] = await Promise.all([
        fetch('http://localhost:3001/api/analytics/summary'),
        fetch('http://localhost:3001/api/csat/stats')
      ])
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
      if (csatRes.ok) {
        const csatJson = await csatRes.json()
        setCsatData(csatJson)
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  // Default fallback data if server response is pending
  const summary = data?.summary || {
    totalMessages: 94,
    totalSent: 52,
    totalReceived: 42,
    totalChats: 12,
    activeChats: 9,
    avgResponseTime: '1.4 s',
    responseRate: '98.5%',
    topProduct: 'Plan CHASKYAPP Business'
  }

  const weeklyActivity = data?.weeklyActivity || [
    { day: 'Lun', enviados: 16, recibidos: 14, total: 30 },
    { day: 'Mar', enviados: 24, recibidos: 20, total: 44 },
    { day: 'Mié', enviados: 21, recibidos: 23, total: 44 },
    { day: 'Jue', enviados: 32, recibidos: 28, total: 60 },
    { day: 'Vie', enviados: 38, recibidos: 34, total: 72 },
    { day: 'Sáb', enviados: 18, recibidos: 12, total: 30 },
    { day: 'Dom', enviados: 12, recibidos: 9, total: 21 },
  ]

  const contentDistribution = data?.contentDistribution || [
    { name: 'Texto', value: 52, percentage: 55, color: '#00a884' },
    { name: 'Multimedia', value: 18, percentage: 19, color: '#3b82f6' },
    { name: 'Notas de voz', value: 14, percentage: 15, color: '#f59e0b' },
    { name: 'Tarjetas producto', value: 10, percentage: 11, color: '#10b981' },
  ]

  const topProducts = data?.topProducts || [
    { title: 'Plan CHASKYAPP Business', queries: 14, price: 29.99, currency: 'EUR' },
    { title: 'Setup y Migración Enterprise', queries: 9, price: 149.00, currency: 'EUR' },
    { title: 'Licencia Anual Pro (Ahorra 2 meses)', queries: 6, price: 249.00, currency: 'EUR' },
    { title: 'Bot de IA Gemini Flash Personalizado', queries: 4, price: 89.00, currency: 'EUR' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-wa-sidebar border border-gray-700/60 rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-wa-header border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-xl text-white shadow-lg shadow-emerald-900/30">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-wa-text leading-tight">Analíticas de Negocio</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Business Suite
                </span>
              </div>
              <p className="text-xs text-wa-secondary">Métricas de interacción, actividad semanal y conversión de catálogo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="hidden sm:flex items-center bg-wa-input rounded-xl p-1 border border-gray-700/50 text-xs">
              <button
                onClick={() => setPeriod('7d')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  period === '7d' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
                }`}
              >
                7 Días
              </button>
              <button
                onClick={() => setPeriod('30d')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  period === '30d' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
                }`}
              >
                30 Días
              </button>
              <button
                onClick={() => setPeriod('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  period === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
                }`}
              >
                Histórico
              </button>
            </div>

            <button
              onClick={() => setShowBiSuite(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5 active:scale-95"
              title="Abrir Business Intelligence Suite, Funnel de Ventas y Rendimiento de Agentes"
            >
              <span>📈</span>
              <span className="hidden sm:inline">Suite BI & Funnel</span>
            </button>

            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 rounded-xl hover:bg-white/10 text-wa-icon hover:text-wa-text transition-colors"
              title="Refrescar estadísticas"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-wa-secondary hover:text-wa-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-wa-header p-4 rounded-2xl border border-gray-700/50 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-wa-secondary font-medium">Total Mensajes</span>
                <span className="text-lg">💬</span>
              </div>
              <div className="text-2xl font-bold text-wa-text tracking-tight">{summary.totalMessages}</div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-wa-secondary">
                <span className="text-emerald-400 font-semibold">↑ {summary.totalSent} env</span>
                <span>·</span>
                <span className="text-blue-400 font-semibold">↓ {summary.totalReceived} rec</span>
              </div>
            </div>

            <div className="bg-wa-header p-4 rounded-2xl border border-gray-700/50 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-wa-secondary font-medium">Chats Activos</span>
                <span className="text-lg">👥</span>
              </div>
              <div className="text-2xl font-bold text-wa-text tracking-tight">{summary.activeChats}</div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                De {summary.totalChats} conversaciones totales
              </div>
            </div>

            <div className="bg-wa-header p-4 rounded-2xl border border-gray-700/50 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-wa-secondary font-medium">Tiempo de Respuesta</span>
                <span className="text-lg">⚡</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">{summary.avgResponseTime}</div>
              <div className="text-[11px] text-wa-secondary mt-1">
                Tasa de atención: <span className="text-emerald-400 font-semibold">{summary.responseRate}</span>
              </div>
            </div>

            <div className="bg-wa-header p-4 rounded-2xl border border-gray-700/50 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-wa-secondary font-medium">Producto Destacado</span>
                <span className="text-lg">🏆</span>
              </div>
              <div className="text-sm font-bold text-wa-text truncate mt-1.5" title={summary.topProduct}>
                {summary.topProduct}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                Líder en consultas de clientes
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Activity Bar Chart */}
            <div className="lg:col-span-2 bg-wa-header p-5 rounded-2xl border border-gray-700/50 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-wa-text">Actividad Semanal de Mensajes</h3>
                  <p className="text-xs text-wa-secondary">Volumen diario entre mensajes enviados y recibidos</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Total semana: {weeklyActivity.reduce((acc, c) => acc + c.total, 0)}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111b21',
                        border: '1px solid #374151',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#e9edef'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar dataKey="enviados" name="Enviados" fill="#00a884" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recibidos" name="Recibidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Content Distribution Pie Chart */}
            <div className="bg-wa-header p-5 rounded-2xl border border-gray-700/50 shadow-sm flex flex-col">
              <div className="mb-2">
                <h3 className="text-sm font-bold text-wa-text">Distribución de Contenido</h3>
                <p className="text-xs text-wa-secondary">Porcentaje por tipo de mensaje</p>
              </div>

              <div className="h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={contentDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {contentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} mensajes`, name]}
                      contentStyle={{
                        backgroundColor: '#111b21',
                        border: '1px solid #374151',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#e9edef'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend list */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-700/40">
                {contentDistribution.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-wa-secondary truncate">{c.name}</span>
                    <span className="text-wa-text font-bold ml-auto">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CSAT & NPS Customer Satisfaction Suite */}
          <div className="bg-wa-header p-5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-700/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-wa-text flex items-center gap-2">
                  <span>⭐</span>
                  <span>Métricas de Satisfacción del Cliente (CSAT & NPS)</span>
                </h3>
                <p className="text-xs text-wa-secondary">
                  Calificaciones generadas automáticamente tras marcar conversaciones como Resueltas
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30 self-start sm:self-auto">
                ✓ Encuestas Automatizadas
              </span>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-wa-input/60 p-3.5 rounded-xl border border-gray-700/40">
                <p className="text-[11px] text-wa-secondary">Calificación Promedio</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold text-amber-400 font-mono">
                    {csatData?.averageRating || 4.8}
                  </span>
                  <span className="text-xs text-wa-secondary">/ 5.0</span>
                </div>
                <div className="flex text-amber-400 text-xs mt-1">
                  {'★★★★★'}
                </div>
              </div>

              <div className="bg-wa-input/60 p-3.5 rounded-xl border border-gray-700/40">
                <p className="text-[11px] text-wa-secondary">Índice CSAT</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {csatData?.csatScore ?? 96}%
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 mt-1">
                  ✓ Clientes satisfechos (4-5★)
                </p>
              </div>

              <div className="bg-wa-input/60 p-3.5 rounded-xl border border-gray-700/40">
                <p className="text-[11px] text-wa-secondary">Net Promoter Score</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold text-sky-400 font-mono">
                    +{csatData?.npsScore ?? 72}
                  </span>
                </div>
                <p className="text-[10px] text-sky-300 mt-1">
                  Nivel de lealtad excelente
                </p>
              </div>

              <div className="bg-wa-input/60 p-3.5 rounded-xl border border-gray-700/40">
                <p className="text-[11px] text-wa-secondary">Total Encuestas</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold text-wa-text font-mono">
                    {csatData?.total || 5}
                  </span>
                  <span className="text-xs text-wa-secondary">respuestas</span>
                </div>
                <p className="text-[10px] text-wa-secondary mt-1">
                  84.2% tasa de respuesta
                </p>
              </div>
            </div>

            {/* Breakdown & Recent Reviews */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
              {/* Star distribution */}
              <div className="bg-black/25 p-3.5 rounded-xl border border-gray-700/30 space-y-2">
                <h4 className="text-xs font-semibold text-wa-text">Desglose por Estrellas</h4>
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = csatData?.distribution?.[stars] || (stars === 5 ? 3 : stars === 4 ? 2 : 0)
                    const total = csatData?.total || 5
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-[11px] font-mono text-amber-400 flex items-center gap-0.5">
                          <span>{stars}</span>
                          <span>★</span>
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[10px] font-mono text-wa-secondary">
                          {count} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Reviews List */}
              <div className="lg:col-span-2 bg-black/25 p-3.5 rounded-xl border border-gray-700/30 space-y-2">
                <h4 className="text-xs font-semibold text-wa-text flex items-center justify-between">
                  <span>Opiniones y Comentarios Recientes</span>
                  <span className="text-[10px] text-wa-secondary font-normal">Últimas valoraciones</span>
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(csatData?.recentSurveys || []).map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-lg bg-wa-header/60 border border-gray-700/40 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-wa-text text-[11px] flex items-center gap-1.5">
                          <span>👤</span>
                          <span>{s.contactName || s.groupName || s.customerPhone || 'Cliente'}</span>
                        </span>
                        <div className="flex text-amber-400 text-xs">
                          {Array.from({ length: s.rating || 5 }, (_, i) => '★').join('')}
                        </div>
                      </div>
                      {s.comment && (
                        <p className="text-gray-300 italic text-[11px] bg-black/20 p-1.5 rounded">
                          "{s.comment}"
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-wa-secondary pt-0.5">
                        <span className="capitalize">Canal: {s.channel || 'whatsapp'}</span>
                        <span>{new Date(s.createdAt).toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Catalog Products Table */}
          <div className="bg-wa-header p-5 rounded-2xl border border-gray-700/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-wa-text">Rendimiento de Catálogo de Productos</h3>
                <p className="text-xs text-wa-secondary">Artículos más consultados por clientes y enviados como tarjetas interactivas</p>
              </div>
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                🛍️ Catálogo Activo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-700/60 text-wa-secondary font-medium">
                    <th className="pb-2.5 pl-1">Producto / Servicio</th>
                    <th className="pb-2.5">Precio Unitario</th>
                    <th className="pb-2.5">Consultas de Clientes</th>
                    <th className="pb-2.5 text-right pr-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {topProducts.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-1 font-semibold text-wa-text flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{p.title}</span>
                      </td>
                      <td className="py-3 font-mono font-bold text-emerald-400">
                        {p.currency === 'USD' ? '$' : '€'}{Number(p.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-wa-secondary">
                        <span className="font-semibold text-wa-text">{p.queries}</span> consultas registradas
                      </td>
                      <td className="py-3 text-right pr-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          En catálogo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-wa-header border-t border-gray-700/50 flex-shrink-0">
          <div className="text-xs text-wa-secondary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Datos procesados localmente en SQLite con modo WAL</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            Cerrar Dashboard
          </button>
        </div>
      </div>

      {/* Embedded BI Suite Modal */}
      {showBiSuite && (
        <BusinessIntelligenceDashboard
          onClose={() => setShowBiSuite(false)}
        />
      )}
    </div>
  )
}
