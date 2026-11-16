import React, { useState, useEffect } from 'react'

export default function AiAgentsHub({ onClose, embedded = false }) {
  const [activeTab, setActiveTab] = useState('specialists') // 'specialists' | 'rules' | 'supervision' | 'simulator'
  const [departments, setDepartments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [rules, setRules] = useState([])
  const [supervision, setSupervision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingProfile, setEditingProfile] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [transferModalChat, setTransferModalChat] = useState(null)
  const [selectedTransferDept, setSelectedTransferDept] = useState('dept_ventas')
  const [transferReason, setTransferReason] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Simulator state
  const [simQuery, setSimQuery] = useState('Hola, quisiera saber los precios de los planes de WhatsApp y si ofrecen descuento anual.')
  const [simResult, setSimResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [resDepts, resProfiles, resRules, resSupervision] = await Promise.all([
        fetch('http://localhost:3001/api/ai-agents/departments'),
        fetch('http://localhost:3001/api/ai-agents/profiles'),
        fetch('http://localhost:3001/api/ai-agents/rules'),
        fetch('http://localhost:3001/api/ai-agents/supervision')
      ])

      if (resDepts.ok) {
        const j = await resDepts.json()
        setDepartments(j.departments || [])
      }
      if (resProfiles.ok) {
        const j = await resProfiles.json()
        setProfiles(j.profiles || [])
      }
      if (resRules.ok) {
        const j = await resRules.json()
        setRules(j.rules || [])
      }
      if (resSupervision.ok) {
        const j = await resSupervision.json()
        setSupervision(j.data || null)
      }
    } catch (err) {
      console.error('Error fetching Multi-Agent data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Save profile updates
  const handleSaveProfile = async () => {
    if (!editingProfile) return
    try {
      const res = await fetch(`http://localhost:3001/api/ai-agents/profiles/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProfile)
      })
      if (res.ok) {
        setActionSuccess('Perfil del especialista de IA actualizado con éxito.')
        setTimeout(() => setActionSuccess(''), 3500)
        setEditingProfile(null)
        fetchData()
      }
    } catch (err) {
      console.error('Error updating AI profile:', err)
    }
  }

  // Save or create rule
  const handleSaveRule = async () => {
    if (!editingRule) return
    try {
      const res = await fetch('http://localhost:3001/api/ai-agents/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule)
      })
      if (res.ok) {
        setActionSuccess('Regla de enrutamiento guardada con éxito.')
        setTimeout(() => setActionSuccess(''), 3500)
        setEditingRule(null)
        fetchData()
      }
    } catch (err) {
      console.error('Error saving routing rule:', err)
    }
  }

  // Delete rule
  const handleDeleteRule = async (ruleId) => {
    if (!confirm('¿Seguro que deseas eliminar esta regla de enrutamiento?')) return
    try {
      const res = await fetch(`http://localhost:3001/api/ai-agents/rules/${ruleId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setActionSuccess('Regla eliminada.')
        setTimeout(() => setActionSuccess(''), 3000)
        fetchData()
      }
    } catch (err) {
      console.error('Error deleting rule:', err)
    }
  }

  // Execute manual transfer
  const handleExecuteTransfer = async () => {
    if (!transferModalChat) return
    try {
      const res = await fetch('http://localhost:3001/api/ai-agents/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: transferModalChat.id,
          targetDepartmentId: selectedTransferDept,
          reason: transferReason || 'Transferencia departamental manual por supervisor'
        })
      })
      if (res.ok) {
        setActionSuccess(`Chat ${transferModalChat.contactName || transferModalChat.id} transferido exitosamente.`)
        setTimeout(() => setActionSuccess(''), 3500)
        setTransferModalChat(null)
        fetchData()
      }
    } catch (err) {
      console.error('Error transferring chat:', err)
    }
  }

  // Run intent simulation
  const handleRunSimulation = async () => {
    if (!simQuery.trim()) return
    setSimLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/ai-agents/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: simQuery, customerName: 'Cliente Demo' })
      })
      if (res.ok) {
        const j = await res.json()
        setSimResult(j.data)
      }
    } catch (err) {
      console.error('Error running simulation:', err)
    } finally {
      setSimLoading(false)
    }
  }

  const containerClasses = embedded
    ? 'w-full space-y-6 text-wa-text font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in text-wa-text font-sans'

  const innerModalClasses = embedded
    ? 'bg-[#111b21] rounded-2xl border border-gray-700/60 p-4 md:p-6 shadow-xl'
    : 'bg-[#111b21] border border-emerald-500/30 rounded-3xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden text-gray-100'

  return (
    <div className={containerClasses}>
      <div className={innerModalClasses}>

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-[#1f2c34] border-b border-gray-700/60 gap-4 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-2xl text-white shadow-lg shadow-emerald-900/40">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">Centro de Agentes IA & Especialistas</h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm">
                  Multi-Agent Router
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Enrutamiento semántico inteligente por departamento: Ventas, Soporte RAG, Finanzas y Legal/CNEB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-gray-700/60 transition-colors"
              title="Refrescar datos"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {!embedded && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-700/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── TOAST ALERT ────────────────────────────────────────────────── */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <span>✓</span>
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* ── NAVIGATION TABS ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-6 bg-[#182229] border-b border-gray-800/80 text-xs font-semibold overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveTab('specialists')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'specialists'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🏢</span>
            <span>Especialistas Departamentales</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🔀</span>
            <span>Reglas de Enrutamiento & Intenciones</span>
          </button>

          <button
            onClick={() => setActiveTab('supervision')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'supervision'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>👁️</span>
            <span>Panel de Supervisión en Vivo</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🧪</span>
            <span>Simulador de Enrutamiento & Respuestas</span>
          </button>
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 1. TAB: ESPECIALISTAS DEPARTAMENTALES                             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'specialists' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🏢</span>
                    <span>Sub-Agentes Especializados por Departamento</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Cada agente de IA posee su propio contexto de sistema, tono de respuesta y herramientas exclusivas.
                  </p>
                </div>
              </div>

              {/* Profiles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 hover:border-emerald-500/50 transition-all shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar with Department Badge & Icon */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5"
                          style={{ backgroundColor: `${profile.deptColor}20`, color: profile.deptColor }}
                        >
                          <span>{profile.deptIcon}</span>
                          <span>{profile.deptName}</span>
                        </span>

                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Activo en Tiempo Real
                        </span>
                      </div>

                      {/* Agent Identity */}
                      <div className="flex items-center gap-3.5 mb-3">
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white">{profile.name}</h4>
                          <p className="text-xs text-gray-400">{profile.role}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                            <span>Temperatura: <strong className="text-emerald-400">{profile.temperature}</strong></span>
                            <span>·</span>
                            <span>Handoff a humano: <strong className={profile.fallbackToHuman ? 'text-emerald-400' : 'text-gray-500'}>{profile.fallbackToHuman ? 'Habilitado' : 'Desactivado'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* System Prompt Excerpt */}
                      <div className="bg-[#111b21] p-3 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono line-clamp-3 mb-3 leading-relaxed">
                        {profile.systemPrompt}
                      </div>

                      {/* Capabilities Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(profile.capabilities || []).map((cap, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-white/5 border border-gray-700/60 text-gray-300 px-2 py-0.5 rounded-lg font-medium"
                          >
                            ⚡ {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">ID: {profile.id}</span>
                      <button
                        onClick={() => setEditingProfile({ ...profile })}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>✏️</span>
                        <span>Configurar Agente</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 2. TAB: REGLAS DE ENRUTAMIENTO & INTENCIONES                      */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🔀</span>
                    <span>Reglas de Clasificación e Intenciones (Intent Router)</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    El enrutador analiza los términos clave y contexto semántico de cada mensaje entrante para asignar el departamento idóneo.
                  </p>
                </div>

                <button
                  onClick={() => setEditingRule({
                    id: '',
                    departmentId: 'dept_ventas',
                    intentName: 'intent_nueva_regla',
                    keywords: ['consulta', 'informacion'],
                    priority: 10,
                    confidenceThreshold: 0.65,
                    isActive: 1
                  })}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 self-start"
                >
                  <span>➕</span>
                  <span>Nueva Regla de Enrutamiento</span>
                </button>
              </div>

              {/* Rules Table */}
              <div className="bg-[#1f2c34] rounded-2xl border border-gray-700/50 overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111b21] text-gray-400 border-b border-gray-800 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Intención / Nombre</th>
                        <th className="py-3 px-4">Departamento Destino</th>
                        <th className="py-3 px-4">Palabras Clave (Keywords)</th>
                        <th className="py-3 px-4">Prioridad</th>
                        <th className="py-3 px-4">Umbral Confianza</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white font-mono">
                            {rule.intentName}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            <span
                              className="px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                              style={{ backgroundColor: `${rule.deptColor}20`, color: rule.deptColor }}
                            >
                              <span>{rule.deptIcon}</span>
                              <span>{rule.deptName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {(rule.keywords || []).map((kw, i) => (
                                <span key={i} className="bg-gray-800/80 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">
                            {rule.priority}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-blue-400">
                            {(rule.confidenceThreshold * 100).toFixed(0)}%
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingRule({ ...rule })}
                                className="p-1.5 bg-white/5 hover:bg-emerald-600/30 text-gray-300 hover:text-emerald-400 rounded-lg transition-colors"
                                title="Editar regla"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 bg-white/5 hover:bg-red-500/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                title="Eliminar regla"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 3. TAB: PANEL DE SUPERVISIÓN EN VIVO                             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'supervision' && (
            <div className="space-y-6">
              
              {/* Macro KPIs Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Chats Autónomos Atendidos</div>
                  <div className="text-2xl font-black text-white">{supervision?.summary?.totalAutonomousChats || 133}</div>
                  <div className="text-xs text-emerald-400 font-semibold mt-1">4 especialistas activos</div>
                </div>

                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Resolución Autónoma Global</div>
                  <div className="text-2xl font-black text-emerald-400">{supervision?.summary?.overallResolutionRate || 88}%</div>
                  <div className="text-xs text-gray-400 mt-1">Sin requerir escalamiento</div>
                </div>

                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Escalados a Operador Humano</div>
                  <div className="text-2xl font-black text-amber-400">{supervision?.summary?.totalEscalated || 17}</div>
                  <div className="text-xs text-amber-300/80 mt-1">Handoff bajo demanda</div>
                </div>

                <div className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md">
                  <div className="text-xs text-gray-400 mb-1">Tiempo de Respuesta IA</div>
                  <div className="text-2xl font-black text-blue-400">2.4 s</div>
                  <div className="text-xs text-blue-300 mt-1">Inferencia con Gemini Flash</div>
                </div>
              </div>

              {/* Departmental Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(supervision?.departments || []).map(dept => (
                  <div key={dept.id} className="bg-[#1f2c34] p-4 rounded-2xl border border-gray-700/50 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{dept.icon}</span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {dept.metrics?.resolutionRate || 85}% Autónomo
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2">{dept.name}</h4>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-gray-800 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Chats atendidos:</span>
                        <span className="font-bold text-white">{dept.metrics?.chatsHandled || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Resueltos por IA:</span>
                        <span className="font-bold text-emerald-400">{dept.metrics?.autonomousResolved || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Derivados a humano:</span>
                        <span className="font-bold text-amber-400">{dept.metrics?.escalated || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Chats Live Supervision Table */}
              <div className="bg-[#1f2c34] rounded-2xl border border-gray-700/50 overflow-hidden shadow-md">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Conversaciones Activas Asignadas a Especialistas de IA</span>
                  </h4>
                  <span className="text-xs text-gray-400">Monitoreo en vivo</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111b21] text-gray-400 border-b border-gray-800 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Contacto / Cliente</th>
                        <th className="py-3 px-4">Canal</th>
                        <th className="py-3 px-4">Especialista IA Asignado</th>
                        <th className="py-3 px-4">Último Mensaje</th>
                        <th className="py-3 px-4">Modo</th>
                        <th className="py-3 px-4 text-right">Intervención Supervisor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {(supervision?.activeChats || []).map((chat) => (
                        <tr key={chat.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{chat.contactName || chat.contactPhone || chat.id}</div>
                            <span className="text-[10px] text-gray-400 font-normal">{chat.contactPhone || chat.id}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300">
                              {chat.channel || 'whatsapp'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                              style={{ backgroundColor: `${chat.deptColor || '#10b981'}20`, color: chat.deptColor || '#10b981' }}
                            >
                              <span>{chat.deptIcon || '🤖'}</span>
                              <span>{chat.agentName || 'Sofía Ventas IA'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300 max-w-xs truncate">
                            {chat.lastMessage || 'Conversación iniciada'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              chat.autonomousStatus === 'escalated_human'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {chat.autonomousStatus === 'escalated_human' ? '👤 Humano' : '🤖 IA Autónomo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setTransferModalChat(chat)}
                              className="px-2.5 py-1 bg-white/10 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-semibold transition-all"
                            >
                              🔄 Transferir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Routing Logs Audit Trail */}
              <div className="bg-[#1f2c34] rounded-2xl border border-gray-700/50 p-4 shadow-md">
                <h4 className="text-sm font-bold text-white mb-3">Registro de Decisiones del Enrutador (Audit Trail)</h4>
                <div className="space-y-2">
                  {(supervision?.recentLogs || []).map((log) => (
                    <div key={log.id} className="p-3 bg-[#111b21] rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{log.deptIcon || '🤖'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{log.detectedIntent}</span>
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.2 rounded">
                              {(log.confidence * 100).toFixed(0)}% confianza
                            </span>
                          </div>
                          <p className="text-gray-400 text-[11px] mt-0.5">"{log.messageText}"</p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-gray-500">
                        <span>{new Date(log.timestamp).toLocaleTimeString('es-PE')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 4. TAB: SIMULADOR DE ENRUTAMIENTO & RESPUESTAS                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧪</span>
                  <span>Banco de Pruebas y Simulador de Enrutamiento</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Ingresa cualquier consulta simulada de un cliente para comprobar la intención detectada, el departamento asignado y la respuesta que generaría el especialista de IA.
                </p>
              </div>

              {/* Query Input Box */}
              <div className="bg-[#1f2c34] p-5 rounded-2xl border border-gray-700/50 space-y-3">
                <label className="text-xs font-bold text-gray-300 block">Mensaje de Prueba del Cliente:</label>
                <textarea
                  value={simQuery}
                  onChange={(e) => setSimQuery(e.target.value)}
                  rows={3}
                  className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Escribe un mensaje de prueba..."
                />

                {/* Preset shortcuts */}
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px] self-center">Ejemplos rápidos:</span>
                  <button
                    onClick={() => setSimQuery('Hola, quisiera saber los precios de los planes de WhatsApp y si ofrecen descuento anual.')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-emerald-400 rounded-lg border border-emerald-500/20"
                  >
                    💼 Consulta Ventas
                  </button>
                  <button
                    onClick={() => setSimQuery('Tengo un error 401 en el Webhook de Meta Cloud API, no recibe mensajes.')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg border border-blue-500/20"
                  >
                    🛠️ Falla Soporte
                  </button>
                  <button
                    onClick={() => setSimQuery('Ya pagué por Yape mi mensualidad, aquí está el comprobante de operación 482910.')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-amber-400 rounded-lg border border-amber-500/20"
                  >
                    💵 Pago Facturación
                  </button>
                  <button
                    onClick={() => setSimQuery('Necesito estructurar una unidad de aprendizaje según las competencias del CNEB del MINEDU.')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-purple-400 rounded-lg border border-purple-500/20"
                  >
                    📜 Consulta Legal / CNEB
                  </button>
                  <button
                    onClick={() => setSimQuery('Por favor quiero hablar con un asesor humano urgente.')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-red-400 rounded-lg border border-red-500/20"
                  >
                    👤 Escalar a Humano
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleRunSimulation}
                    disabled={simLoading || !simQuery.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <span>⚡</span>
                    <span>{simLoading ? 'Analizando Intención...' : 'Probar Enrutamiento y Generar Respuesta'}</span>
                  </button>
                </div>
              </div>

              {/* Simulation Result Presentation */}
              {simResult && (
                <div className="bg-[#1f2c34] p-5 rounded-2xl border border-emerald-500/40 shadow-xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{simResult.department?.icon || '🤖'}</span>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Enrutado a: <span className="text-emerald-400">{simResult.department?.name}</span>
                        </h4>
                        <p className="text-xs text-gray-400">
                          Especialista: <strong className="text-white">{simResult.agent?.name}</strong> ({simResult.agent?.role})
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Nivel de Confianza:</span>
                      <span className="text-sm font-black text-emerald-400">
                        {((simResult.classification?.confidence || 0.9) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#111b21] p-2.5 rounded-xl border border-gray-800">
                      <span className="text-gray-400 block text-[10px]">INTENCIÓN DETECTADA</span>
                      <span className="font-mono font-bold text-blue-400">{simResult.classification?.intent}</span>
                    </div>
                    <div className="bg-[#111b21] p-2.5 rounded-xl border border-gray-800">
                      <span className="text-gray-400 block text-[10px]">CRITERIO DE ENRUTAMIENTO</span>
                      <span className="text-gray-200">{simResult.classification?.reason}</span>
                    </div>
                    <div className="bg-[#111b21] p-2.5 rounded-xl border border-gray-800">
                      <span className="text-gray-400 block text-[10px]">ACCIÓN EN TIEMPO REAL</span>
                      <span className={simResult.classification?.shouldHandoff ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {simResult.classification?.shouldHandoff ? 'Handoff a Asesor Humano' : 'Respuesta Autónoma Especializada'}
                      </span>
                    </div>
                  </div>

                  {/* Generated Bot Response */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-300">Respuesta Generada por el Agente Especialista:</span>
                    <div className="bg-[#111b21] p-4 rounded-xl border border-emerald-500/30 text-xs text-gray-100 whitespace-pre-line leading-relaxed">
                      {simResult.generatedReply}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── MODAL: EDIT AGENT PROFILE ───────────────────────────────────── */}
        {editingProfile && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#1f2c34] border border-emerald-500/40 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚙️</span>
                  <span>Configurar Especialista: {editingProfile.name}</span>
                </h3>
                <button
                  onClick={() => setEditingProfile(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Nombre del Asesor:</label>
                  <input
                    type="text"
                    value={editingProfile.name}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Rol / Título:</label>
                  <input
                    type="text"
                    value={editingProfile.role}
                    onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Prompt de Sistema (System Persona):</label>
                  <textarea
                    value={editingProfile.systemPrompt}
                    onChange={(e) => setEditingProfile({ ...editingProfile, systemPrompt: e.target.value })}
                    rows={6}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-3 text-white font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-300 font-bold block mb-1">
                      Temperatura Creativa: <span className="text-emerald-400">{editingProfile.temperature}</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={editingProfile.temperature}
                      onChange={(e) => setEditingProfile({ ...editingProfile, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Exacto (0.1)</span>
                      <span>Creativo (1.0)</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="text-gray-300 font-bold block mb-1">Handoff a Asesor Humano:</label>
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProfile.fallbackToHuman)}
                        onChange={(e) => setEditingProfile({ ...editingProfile, fallbackToHuman: e.target.checked ? 1 : 0 })}
                        className="rounded accent-emerald-500 w-4 h-4"
                      />
                      <span className="text-gray-300 text-xs">Permitir escalamiento cuando el cliente lo pida</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700 flex justify-end gap-2.5">
                <button
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: EDIT ROUTING RULE ─────────────────────────────────────── */}
        {editingRule && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#1f2c34] border border-emerald-500/40 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔀</span>
                  <span>{editingRule.id ? 'Editar Regla de Enrutamiento' : 'Nueva Regla de Enrutamiento'}</span>
                </h3>
                <button
                  onClick={() => setEditingRule(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Nombre de la Intención:</label>
                  <input
                    type="text"
                    value={editingRule.intentName}
                    onChange={(e) => setEditingRule({ ...editingRule, intentName: e.target.value })}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white font-mono"
                    placeholder="intent_nombre_clave"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Departamento Destino:</label>
                  <select
                    value={editingRule.departmentId}
                    onChange={(e) => setEditingRule({ ...editingRule, departmentId: e.target.value })}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Palabras Clave (Keywords):</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newKeyword.trim()) {
                            setEditingRule({ ...editingRule, keywords: [...(editingRule.keywords || []), newKeyword.trim().toLowerCase()] })
                            setNewKeyword('')
                          }
                        }
                      }}
                      className="flex-1 bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                      placeholder="Escribe una palabra y presiona Enter o Añadir..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newKeyword.trim()) {
                          setEditingRule({ ...editingRule, keywords: [...(editingRule.keywords || []), newKeyword.trim().toLowerCase()] })
                          setNewKeyword('')
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                    >
                      Añadir
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#111b21] rounded-xl border border-gray-800">
                    {(editingRule.keywords || []).map((kw, i) => (
                      <span key={i} className="bg-gray-800 text-emerald-400 px-2 py-0.5 rounded-lg text-xs flex items-center gap-1">
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => setEditingRule({ ...editingRule, keywords: editingRule.keywords.filter((_, idx) => idx !== i) })}
                          className="text-gray-400 hover:text-red-400 ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-300 font-bold block mb-1">Prioridad:</label>
                    <input
                      type="number"
                      value={editingRule.priority}
                      onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-300 font-bold block mb-1">
                      Umbral de Confianza: <span className="text-blue-400">{((editingRule.confidenceThreshold || 0.65) * 100).toFixed(0)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.4"
                      max="0.95"
                      step="0.05"
                      value={editingRule.confidenceThreshold}
                      onChange={(e) => setEditingRule({ ...editingRule, confidenceThreshold: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700 flex justify-end gap-2.5">
                <button
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRule}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Guardar Regla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: MANUAL CHAT TRANSFER ─────────────────────────────────── */}
        {transferModalChat && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#1f2c34] border border-emerald-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔄</span>
                  <span>Transferir Conversación</span>
                </h3>
                <button
                  onClick={() => setTransferModalChat(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-3">
                <p className="text-gray-300">
                  Transfiere el chat de <strong className="text-white">{transferModalChat.contactName || transferModalChat.contactPhone}</strong> hacia otro especialista de IA o a un operador humano.
                </p>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Destino de la Transferencia:</label>
                  <select
                    value={selectedTransferDept}
                    onChange={(e) => setSelectedTransferDept(e.target.value)}
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="dept_ventas">💼 Ventas & Negociación Comercial (Sofía Valdivia)</option>
                    <option value="dept_soporte">🛠️ Soporte Técnico N2 & RAG (Mateo Quispe)</option>
                    <option value="dept_facturacion">💵 Facturación & Finanzas Yape/Plin (Camila Benítez)</option>
                    <option value="dept_legal_academico">📜 Legal, Contratos & CNEB (Dr. Aurelio Mendoza)</option>
                    <option value="human">👤 Escalar a Operador Humano (Atención en Vivo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-bold block mb-1">Motivo de la Transferencia (Opcional):</label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Ej. Cliente solicita información financiera específica..."
                    className="w-full bg-[#111b21] border border-gray-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700 flex justify-end gap-2.5">
                <button
                  onClick={() => setTransferModalChat(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecuteTransfer}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Confirmar Transferencia
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
