import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

export default function AuditLogsModal() {
  const { addToast } = useAppStore()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [agents, setAgents] = useState([])

  // Fetch logs from backend
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter)
      if (severityFilter !== 'ALL') params.append('severity', severityFilter)
      if (agentFilter !== 'ALL') params.append('agentId', agentFilter)
      params.append('limit', '100')

      const res = await fetch(`/api/audit/logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }

      // Also get agents list for the dropdown
      const agentsRes = await fetch('/api/agents')
      if (agentsRes.ok) {
        const agData = await agentsRes.json()
        setAgents(agData)
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err)
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Auditoría',
        message: 'No se pudieron cargar los registros de auditoría',
        avatar: '',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [categoryFilter, severityFilter, agentFilter])

  // Handle live search submit or keypress
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchLogs()
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!logs.length) {
      alert('No hay registros para exportar')
      return
    }

    const headers = ['ID', 'Fecha y Hora', 'Agente ID', 'Nombre Agente', 'Severidad', 'Categoría', 'Acción', 'Detalles', 'IP']
    const rows = logs.map((l) => [
      l.id,
      new Date(l.created_at).toLocaleString('es-ES'),
      l.agent_id || 'system',
      l.agent_name || 'Sistema',
      l.severity,
      l.category,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ip_address || '127.0.0.1'
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `auditoria_seguridad_chaskyapp_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    addToast({
      id: `toast-${Date.now()}`,
      name: 'Auditoría',
      message: 'Descarga de archivo CSV completada',
      avatar: '',
    })
  }

  // Severity styles
  const getSeverityChip = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            CRÍTICO
          </span>
        )
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ADVERTENCIA
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            INFO
          </span>
        )
    }
  }

  // Category badge
  const getCategoryBadge = (category) => {
    const map = {
      Seguridad: { bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: '🛡️' },
      Omnicanal: { bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: '🌐' },
      Mensajería: { bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: '💬' },
      Finanzas: { bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30', icon: '💳' },
      Campañas: { bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', icon: '📢' },
      Roles: { bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: '👥' },
    }
    const config = map[category] || { bg: 'bg-gray-500/15 text-gray-300 border-gray-500/30', icon: '📝' }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${config.bg}`}>
        <span>{config.icon}</span>
        <span>{category}</span>
      </span>
    )
  }

  // Metrics
  const criticalCount = logs.filter(l => l.severity === 'critical').length
  const warningCount = logs.filter(l => l.severity === 'warning').length
  const securityCount = logs.filter(l => l.category === 'Seguridad').length

  return (
    <div className="space-y-5 animate-fade-in text-wa-text">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
            <span>🛡️</span>
            <span>Auditoría y Registros del Sistema (Audit Logs)</span>
          </h3>
          <p className="text-xs text-wa-secondary">
            Trazabilidad en tiempo real de acciones operativas, cambios de roles, accesos y eventos sensibles de seguridad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            className="px-3 py-1.5 rounded-xl bg-wa-header hover:bg-white/10 text-xs font-semibold text-wa-text border border-white/10 flex items-center gap-1.5 transition-colors"
            title="Recargar logs"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>Refrescar</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-colors"
            title="Descargar archivo CSV estructurado"
          >
            <span>📥</span>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
            📋
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Total Eventos</p>
            <p className="text-base font-bold text-wa-text">{logs.length}</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Seguridad</p>
            <p className="text-base font-bold text-purple-300">{securityCount}</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg">
            ⚠️
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Advertencias</p>
            <p className="text-base font-bold text-amber-300">{warningCount}</p>
          </div>
        </div>

        <div className="bg-wa-sidebar/70 p-3 rounded-xl border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-lg">
            🚨
          </div>
          <div>
            <p className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold">Críticos</p>
            <p className="text-base font-bold text-red-400">{criticalCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-wa-sidebar/80 p-3.5 rounded-2xl border border-white/10 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-wa-icon text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por acción, detalles, agente o dirección IP..."
              className="w-full bg-wa-header pl-8 pr-3 py-2 text-xs rounded-xl text-wa-text border border-white/5 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-wa-header text-xs text-wa-text border border-white/10 rounded-xl px-2.5 py-2 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Categoría: Todas</option>
              <option value="Seguridad">🛡️ Seguridad</option>
              <option value="Omnicanal">🌐 Omnicanal</option>
              <option value="Mensajería">💬 Mensajería</option>
              <option value="Finanzas">💳 Finanzas</option>
              <option value="Campañas">📢 Campañas</option>
              <option value="Roles">👥 Roles</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-wa-header text-xs text-wa-text border border-white/10 rounded-xl px-2.5 py-2 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Severidad: Todas</option>
              <option value="info">🟢 Info</option>
              <option value="warning">🟡 Advertencia</option>
              <option value="critical">🔴 Crítico</option>
            </select>

            {/* Agent Filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-wa-header text-xs text-wa-text border border-white/10 rounded-xl px-2.5 py-2 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Agente: Todos</option>
              <option value="agent-me">Yo (Operador)</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Buscar
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-wa-secondary space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Consultando eventos de auditoría...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-wa-secondary space-y-2">
            <span className="text-3xl block">🔍</span>
            <p className="text-sm font-semibold">No se encontraron eventos</p>
            <p className="text-xs">Prueba ajustando los filtros de búsqueda o categoría.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-wa-header/90 sticky top-0 z-10 border-b border-white/10 text-wa-secondary text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Fecha y Hora</th>
                  <th className="py-3 px-3">Agente / Responsable</th>
                  <th className="py-3 px-3">Severidad</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-4">Acción y Evento</th>
                  <th className="py-3 px-3 text-right">Dirección IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const dateObj = new Date(log.created_at)
                  const formattedTime = dateObj.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                  const formattedDate = dateObj.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                  })

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Date & Time */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-wa-text font-bold text-[11px]">{formattedTime}</div>
                        <div className="text-[10px] text-wa-secondary">{formattedDate}</div>
                      </td>

                      {/* Agent */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full ${getAvatarGradient(
                              log.agent_name || 'Sistema'
                            )} flex items-center justify-center text-[10px] text-white font-bold`}
                          >
                            {getInitials(log.agent_name || 'SI')}
                          </div>
                          <div>
                            <p className="font-semibold text-wa-text text-[11px]">
                              {log.agent_name || 'Sistema'}
                            </p>
                            <p className="text-[9px] text-wa-secondary font-mono">{log.agent_id || 'system'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getSeverityChip(log.severity)}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Action & Details */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-wa-text text-[11px] flex items-center gap-1.5">
                          <span>{log.action}</span>
                        </div>
                        {log.details && (
                          <div className="text-[10px] text-wa-secondary line-clamp-2 mt-0.5 leading-snug">
                            {log.details}
                          </div>
                        )}
                      </td>

                      {/* IP */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[10px] text-gray-400">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
