import React, { useState, useEffect } from 'react'
import useTenantStore from '../../store/useTenantStore'

const COLOR_SWATCHES = [
  { name: 'Esmeralda Andino', hex: '#00a884' },
  { name: 'Azul Real', hex: '#2563eb' },
  { name: 'Púrpura Retail', hex: '#7c3aed' },
  { name: 'Ámbar Comercial', hex: '#d97706' },
  { name: 'Rojo Carmesí', hex: '#e11d48' },
  { name: 'Teal Marino', hex: '#0d9488' },
  { name: 'Índigo Moderno', hex: '#4f46e5' }
]

export default function TenantManager({ onClose }) {
  const {
    tenants,
    plans,
    licenseKeys,
    activeTenant,
    tenantSettings,
    fetchTenants,
    fetchPlans,
    fetchLicenseKeys,
    switchTenant,
    updateWhiteLabel
  } = useTenantStore()

  const [activeTab, setActiveTab] = useState('tenants') // 'tenants' | 'plans' | 'licenses' | 'whitelabel'
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Create Tenant Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    domain: '',
    planId: 'plan_pro',
    billingCycle: 'monthly',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    primaryColor: '#00a884',
    appName: ''
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  // License Generator Form
  const [genForm, setGenForm] = useState({
    planId: 'plan_pro',
    durationDays: 365,
    organizationName: ''
  })
  const [genLoading, setGenLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')

  // White-label form for active tenant
  const [wlForm, setWlForm] = useState({
    appName: tenantSettings.appName || 'CHASKYAPP',
    companyLegalName: tenantSettings.companyLegalName || '',
    logoUrl: tenantSettings.logoUrl || '',
    primaryColor: tenantSettings.primaryColor || '#00a884',
    secondaryColor: tenantSettings.secondaryColor || '#111b21',
    footerText: tenantSettings.footerText || '',
    supportEmail: tenantSettings.supportEmail || '',
    supportPhone: tenantSettings.supportPhone || '',
    whiteLabelEnabled: tenantSettings.whiteLabelEnabled !== 0
  })
  const [wlLoading, setWlLoading] = useState(false)

  // Billing cycle toggle for plans tab
  const [plansCycle, setPlansCycle] = useState('monthly') // 'monthly' | 'yearly'

  useEffect(() => {
    fetchTenants()
    fetchPlans()
    fetchLicenseKeys()
  }, [])

  useEffect(() => {
    if (tenantSettings) {
      setWlForm({
        appName: tenantSettings.appName || 'CHASKYAPP',
        companyLegalName: tenantSettings.companyLegalName || '',
        logoUrl: tenantSettings.logoUrl || '',
        primaryColor: tenantSettings.primaryColor || '#00a884',
        secondaryColor: tenantSettings.secondaryColor || '#111b21',
        footerText: tenantSettings.footerText || '',
        supportEmail: tenantSettings.supportEmail || '',
        supportPhone: tenantSettings.supportPhone || '',
        whiteLabelEnabled: tenantSettings.whiteLabelEnabled !== 0
      })
    }
  }, [tenantSettings])

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setFeedbackError(msg)
      setTimeout(() => setFeedbackError(''), 4000)
    } else {
      setFeedbackMsg(msg)
      setTimeout(() => setFeedbackMsg(''), 4000)
    }
  }

  // Handle Create Tenant
  const handleCreateTenant = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    try {
      const res = await fetch('/api/saas/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      }).then(r => r.json())

      if (res.success) {
        showToast(res.message || 'Organización creada exitosamente.')
        setShowCreateModal(false)
        setCreateForm({
          name: '',
          slug: '',
          domain: '',
          planId: 'plan_pro',
          billingCycle: 'monthly',
          ownerName: '',
          ownerEmail: '',
          ownerPhone: '',
          primaryColor: '#00a884',
          appName: ''
        })
        await fetchTenants()
      } else {
        showToast(res.error || 'Error al crear organización.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setCreateLoading(false)
    }
  }

  // Handle Status Toggle
  const handleToggleStatus = async (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active'
    try {
      const res = await fetch(`/api/saas/tenants/${tenant.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      }).then(r => r.json())

      if (res.success) {
        showToast(`Organización '${tenant.name}' marcada como ${nextStatus.toUpperCase()}`)
        await fetchTenants()
      } else {
        showToast(res.error, true)
      }
    } catch (err) {
      showToast(err.message, true)
    }
  }

  // Handle Switch Tenant Context
  const handleSwitchTenant = async (tenantId) => {
    const res = await switchTenant(tenantId)
    if (res.success) {
      showToast(res.message || 'Contexto de organización actualizado.')
    } else {
      showToast(res.error, true)
    }
  }

  // Handle Delete Tenant
  const handleDeleteTenant = async (tenant) => {
    if (tenant.id === 'tenant_default') {
      alert('No es posible eliminar la organización matriz principal.')
      return
    }
    if (!confirm(`¿Estás seguro de eliminar permanentemente la organización "${tenant.name}"? Esta acción borrará todas sus suscripciones y configuraciones.`)) {
      return
    }
    try {
      const res = await fetch(`/api/saas/tenants/${tenant.id}`, { method: 'DELETE' }).then(r => r.json())
      if (res.success) {
        showToast(`Organización '${tenant.name}' eliminada correctamente.`)
        await fetchTenants()
      } else {
        showToast(res.error, true)
      }
    } catch (err) {
      showToast(err.message, true)
    }
  }

  // Handle Generate License Key
  const handleGenerateLicense = async (e) => {
    e.preventDefault()
    setGenLoading(true)
    try {
      const res = await fetch('/api/saas/license-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genForm)
      }).then(r => r.json())

      if (res.success) {
        showToast(`¡Clave generada! Código: ${res.license.key}`)
        setGenForm({ planId: 'plan_pro', durationDays: 365, organizationName: '' })
        await fetchLicenseKeys()
      } else {
        showToast(res.error || 'Error generando licencia.', true)
      }
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setGenLoading(false)
    }
  }

  // Copy License Key to Clipboard
  const handleCopyKey = (key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 2500)
    }
  }

  // Handle Save White-Label
  const handleSaveWhiteLabel = async (e) => {
    e.preventDefault()
    setWlLoading(true)
    const res = await updateWhiteLabel(wlForm)
    setWlLoading(false)
    if (res.success) {
      showToast('Configuración White-Label guardada exitosamente.')
      await fetchTenants()
    } else {
      showToast(res.error || 'Error al guardar configuración.', true)
    }
  }

  // Filtered tenants
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.domain && t.domain.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesPlan = filterPlan === 'all' || t.planId === filterPlan
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus
    return matchesSearch && matchesPlan && matchesStatus
  })

  // Calculate SaaS KPIs
  const totalTenants = tenants.length
  const activeCount = tenants.filter(t => t.status === 'active').length
  const totalAgents = tenants.reduce((acc, t) => acc + (t.currentAgentsCount || 1), 0)
  const estimatedMRR = tenants.reduce((acc, t) => {
    if (t.status !== 'active') return acc
    return acc + (t.billingCycle === 'yearly' ? Math.round((t.priceYearly || 0) / 12) : (t.priceMonthly || 0))
  }, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-wa-header px-6 py-4 border-b border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-lg">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-wa-text font-bold text-lg">Panel de Administración SaaS & Multi-Tenant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Superadmin Hub
                </span>
              </div>
              <p className="text-xs text-wa-secondary">
                Aislamiento estricto de organizaciones, cuotas de recursos, planes de suscripción y marca blanca.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-wa-secondary hover:text-wa-text transition"
              title="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div className="bg-emerald-600/90 text-white text-xs px-6 py-2 flex items-center justify-between font-medium">
            <span>✓ {feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg('')}>✕</button>
          </div>
        )}
        {feedbackError && (
          <div className="bg-red-600/90 text-white text-xs px-6 py-2 flex items-center justify-between font-medium">
            <span>⚠️ {feedbackError}</span>
            <button onClick={() => setFeedbackError('')}>✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-wa-sidebar/70 px-6 pt-3 border-b border-gray-700/50 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'tenants'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>🏢</span>
            <span>Organizaciones Inquilinas ({tenants.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'plans'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>📦</span>
            <span>Planes de Suscripción</span>
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'licenses'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>🔑</span>
            <span>Claves de Activación (Licenciamiento)</span>
          </button>
          <button
            onClick={() => setActiveTab('whitelabel')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'whitelabel'
                ? 'border-emerald-500 text-emerald-400 bg-white/5'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>🎨</span>
            <span>Personalización White-Label</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── TAB 1: TENANTS LIST ─────────────────────────────────────────── */}
          {activeTab === 'tenants' && (
            <div className="space-y-6 animate-fade-in">
              {/* KPI Header Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/5 shadow-sm">
                  <div className="text-wa-secondary text-[11px] font-semibold uppercase tracking-wider">Total Organizaciones</div>
                  <div className="text-2xl font-bold text-white mt-1 font-mono">{totalTenants}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Inquilinos en plataforma</div>
                </div>
                <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/5 shadow-sm">
                  <div className="text-wa-secondary text-[11px] font-semibold uppercase tracking-wider">Suscripciones Activas</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{activeCount} / {totalTenants}</div>
                  <div className="text-[10px] text-wa-secondary mt-0.5">Operando sin restricciones</div>
                </div>
                <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/5 shadow-sm">
                  <div className="text-wa-secondary text-[11px] font-semibold uppercase tracking-wider">MRR Estimado</div>
                  <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">${estimatedMRR} <span className="text-xs font-normal">USD/mes</span></div>
                  <div className="text-[10px] text-wa-secondary mt-0.5">Ingresos recurrentes</div>
                </div>
                <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/5 shadow-sm">
                  <div className="text-wa-secondary text-[11px] font-semibold uppercase tracking-wider">Agentes Desplegados</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{totalAgents}</div>
                  <div className="text-[10px] text-wa-secondary mt-0.5">Asesores de atención activos</div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-wa-header/50 p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                  <div className="relative flex-1 sm:max-w-xs">
                    <input
                      type="text"
                      placeholder="Buscar organización por nombre o slug..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-wa-input px-3.5 py-2 pl-9 text-xs rounded-xl border border-white/10 text-wa-text placeholder:text-wa-secondary outline-none focus:border-emerald-500"
                    />
                    <svg className="w-4 h-4 text-wa-secondary absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  <select
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value)}
                    className="bg-wa-input text-xs text-wa-text border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todos los Planes</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-wa-input text-xs text-wa-text border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="active">Activos</option>
                    <option value="suspended">Suspendidos</option>
                    <option value="trial">En Prueba</option>
                    <option value="expired">Expirados</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                >
                  <span>➕</span>
                  <span>Nueva Organización (Tenant)</span>
                </button>
              </div>

              {/* Tenants Table */}
              <div className="bg-wa-sidebar/60 rounded-xl border border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-wa-header text-wa-secondary uppercase text-[10px] tracking-wider border-b border-white/10">
                        <th className="py-3 px-4">Organización / Subdominio</th>
                        <th className="py-3 px-4">Plan Asignado</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4">Consumo de Recursos</th>
                        <th className="py-3 px-4">Vencimiento</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-wa-text">
                      {filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-wa-secondary">
                            No se encontraron organizaciones inquilinas con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map((t) => {
                          const isCurrentActive = t.isActiveTenant
                          const isSuspended = t.status === 'suspended'
                          const isExpired = t.isExpired

                          return (
                            <tr key={t.id} className={`hover:bg-white/5 transition-colors ${isCurrentActive ? 'bg-emerald-500/5' : ''}`}>
                              {/* Tenant Name & Domain */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: t.primaryColor || '#00a884' }}
                                  >
                                    {t.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-white truncate max-w-[180px]">{t.name}</span>
                                      {isCurrentActive && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          En Uso
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-wa-secondary flex items-center gap-1 font-mono">
                                      <span>slug: {t.slug}</span>
                                      {t.domain && <span className="text-teal-400">• {t.domain}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Plan */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-emerald-300 font-mono">
                                  <span>📦</span>
                                  <span>{t.planName || 'Plan Chasky Pro'}</span>
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <button
                                  onClick={() => handleToggleStatus(t)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                    isSuspended
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                                      : isExpired
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  }`}
                                  title="Haz clic para alternar estado"
                                >
                                  {isSuspended ? '🔴 Suspendido' : isExpired ? '⚠️ Expirado' : '🟢 Activo'}
                                </button>
                              </td>

                              {/* Resource Usage */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-1 min-w-[140px]">
                                  <div className="flex justify-between text-[10px] text-wa-secondary">
                                    <span>Agentes: {t.currentAgentsCount || 1}/{t.maxAgents}</span>
                                    <span>Chats: {t.currentChatsCount || 0}/{t.maxMonthlyChats}</span>
                                  </div>
                                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, Math.round(((t.currentChatsCount || 0) / t.maxMonthlyChats) * 100))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Expiration */}
                              <td className="py-3.5 px-4 font-mono text-[11px]">
                                {t.expiresAt ? (
                                  <div>
                                    <span className={isExpired ? 'text-red-400 font-bold' : 'text-wa-text'}>
                                      {new Date(t.expiresAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-wa-secondary">Sin límite</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isCurrentActive && (
                                    <button
                                      onClick={() => handleSwitchTenant(t.id)}
                                      className="px-2.5 py-1 bg-white/10 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-semibold transition"
                                      title="Conmutar y operar como esta organización"
                                    >
                                      👁️ Conmutar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteTenant(t)}
                                    disabled={t.id === 'tenant_default'}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition disabled:opacity-30 disabled:pointer-events-none"
                                    title="Eliminar organización"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PLANS & TIERS ────────────────────────────────────────── */}
          {activeTab === 'plans' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-wa-text text-base font-bold">Planes de Suscripción y Cuotas Multi-Tenant</h3>
                  <p className="text-xs text-wa-secondary">Precios, límites de agentes y funcionalidades incluidas por nivel.</p>
                </div>

                {/* Billing Cycle Selector */}
                <div className="flex items-center bg-wa-header p-1 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => setPlansCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      plansCycle === 'monthly' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
                    }`}
                  >
                    Facturación Mensual
                  </button>
                  <button
                    onClick={() => setPlansCycle('yearly')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                      plansCycle === 'yearly' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
                    }`}
                  >
                    <span>Facturación Anual</span>
                    <span className="bg-amber-400 text-black text-[10px] px-1 rounded-full font-bold">2 meses gratis</span>
                  </button>
                </div>
              </div>

              {/* Plans Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const price = plansCycle === 'yearly' ? p.priceYearly : p.priceMonthly
                  const isPop = p.isPopular === 1

                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-2xl p-6 border flex flex-col justify-between transition-all ${
                        isPop
                          ? 'bg-gradient-to-b from-emerald-950/40 via-wa-sidebar to-wa-dark border-emerald-500/60 shadow-xl shadow-emerald-950/30'
                          : 'bg-wa-sidebar/70 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {isPop && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-[11px] font-black px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                          ⭐ Más Popular
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-white text-lg font-bold">{p.name}</h4>
                          <span className="text-xl">
                            {p.code.includes('enterprise') ? '🏢' : p.code.includes('edu') ? '🎓' : '🚀'}
                          </span>
                        </div>
                        <p className="text-xs text-wa-secondary mt-1 min-h-[36px]">{p.description}</p>

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-extrabold text-white font-mono">${price}</span>
                            <span className="text-xs text-wa-secondary font-medium">USD / {plansCycle === 'yearly' ? 'año' : 'mes'}</span>
                          </div>
                        </div>

                        {/* Quotas */}
                        <div className="grid grid-cols-3 gap-2 my-4 p-2.5 bg-wa-header/70 rounded-xl border border-white/5 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-wa-secondary block uppercase">Agentes</span>
                            <span className="font-bold text-emerald-400 font-mono">{p.maxAgents}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-wa-secondary block uppercase">Chats/Mes</span>
                            <span className="font-bold text-teal-400 font-mono">{p.maxMonthlyChats >= 10000 ? `${p.maxMonthlyChats/1000}k` : p.maxMonthlyChats}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-wa-secondary block uppercase">Storage</span>
                            <span className="font-bold text-amber-400 font-mono">{Math.round(p.maxStorageMb/1024)} GB</span>
                          </div>
                        </div>

                        {/* Features list */}
                        <ul className="space-y-2 text-xs text-wa-text mt-4">
                          {p.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-400 font-bold">✓</span>
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5">
                        <button
                          onClick={() => {
                            setGenForm(prev => ({ ...prev, planId: p.id }))
                            setActiveTab('licenses')
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
                            isPop
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          Emitir Licencia de este Plan
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: LICENSE KEYS GENERATOR ──────────────────────────────── */}
          {activeTab === 'licenses' && (
            <div className="space-y-6 animate-fade-in">
              {/* License Generation Form */}
              <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔑</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Generador de Claves de Activación (License Key Dispatcher)</h3>
                    <p className="text-xs text-wa-secondary">Emite códigos alfanuméricos criptográficos para habilitar o renovar planes sin pasarela bancaria externa.</p>
                  </div>
                </div>

                <form onSubmit={handleGenerateLicense} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Organización / Cliente</label>
                    <input
                      type="text"
                      placeholder="Ej. Red Escolar San Martín"
                      value={genForm.organizationName}
                      onChange={(e) => setGenForm({ ...genForm, organizationName: e.target.value })}
                      className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Plan a Vincular</label>
                    <select
                      value={genForm.planId}
                      onChange={(e) => setGenForm({ ...genForm, planId: e.target.value })}
                      className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (${p.priceMonthly}/mes)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Vigencia de Licencia</label>
                    <select
                      value={genForm.durationDays}
                      onChange={(e) => setGenForm({ ...genForm, durationDays: Number(e.target.value) })}
                      className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value={30}>30 días (1 mes de prueba / mensual)</option>
                      <option value={90}>90 días (Trimestre)</option>
                      <option value={180}>180 días (Semestre)</option>
                      <option value={365}>365 días (1 Año Completo - Recomendado)</option>
                      <option value={730}>730 días (2 Años Corporativo)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={genLoading}
                      className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2"
                    >
                      {genLoading ? 'Generando...' : '✨ Emitir Licencia'}
                    </button>
                  </div>
                </form>
              </div>

              {/* License Keys Table */}
              <div className="bg-wa-sidebar/60 rounded-xl border border-white/5 overflow-hidden">
                <div className="px-4 py-3 bg-wa-header flex items-center justify-between border-b border-white/10">
                  <span className="text-xs font-bold text-white">Historial de Claves de Activación Emitidas ({licenseKeys.length})</span>
                  <span className="text-[11px] text-wa-secondary">Formato: CHASKY-[PLAN]-[AÑO]-[ID]</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 text-wa-secondary uppercase text-[10px] tracking-wider border-b border-white/10">
                        <th className="py-2.5 px-4">Clave de Activación</th>
                        <th className="py-2.5 px-4">Plan Vinculado</th>
                        <th className="py-2.5 px-4">Destinatario</th>
                        <th className="py-2.5 px-4">Duración</th>
                        <th className="py-2.5 px-4">Estado</th>
                        <th className="py-2.5 px-4">Fecha Emisión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-wa-text">
                      {licenseKeys.map((k) => {
                        const isRedeemed = k.isRedeemed === 1
                        return (
                          <tr key={k.id} className="hover:bg-white/5">
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              <div className="flex items-center gap-2">
                                <span>{k.key}</span>
                                <button
                                  onClick={() => handleCopyKey(k.key)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-wa-secondary hover:text-white transition"
                                  title="Copiar clave"
                                >
                                  {copiedKey === k.key ? '✓ Copiado' : 'Copiar'}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-white">{k.planName || 'Plan Pro'}</td>
                            <td className="py-3 px-4 text-wa-secondary">{k.createdForOrganization || 'Cliente'}</td>
                            <td className="py-3 px-4 font-mono">{k.durationDays} días</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isRedeemed
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                {isRedeemed ? `Canjeada (${k.redeemedByTenantName || 'Tenant'})` : 'Disponible'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-wa-secondary font-mono">
                              {new Date(k.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: WHITE-LABEL BRANDING ─────────────────────────────────── */}
          {activeTab === 'whitelabel' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
              {/* Form Settings */}
              <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🎨</span>
                      <span>Configuración White-Label (Marca Blanca)</span>
                    </h3>
                    <p className="text-xs text-wa-secondary">
                      Personalización para: <strong>{activeTenant?.name || 'Organización Activa'}</strong>
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wlForm.whiteLabelEnabled}
                      onChange={(e) => setWlForm({ ...wlForm, whiteLabelEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <form onSubmit={handleSaveWhiteLabel} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre Comercial de la App</label>
                    <input
                      type="text"
                      value={wlForm.appName}
                      onChange={(e) => setWlForm({ ...wlForm, appName: e.target.value })}
                      placeholder="Ej. San Martín Chat / Andina Express"
                      className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Razón Social de la Organización</label>
                    <input
                      type="text"
                      value={wlForm.companyLegalName}
                      onChange={(e) => setWlForm({ ...wlForm, companyLegalName: e.target.value })}
                      placeholder="Ej. Consorcio Educativo San Martín S.A.C."
                      className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">URL del Logotipo Institucional</label>
                    <input
                      type="url"
                      value={wlForm.logoUrl}
                      onChange={(e) => setWlForm({ ...wlForm, logoUrl: e.target.value })}
                      placeholder="https://tu-dominio.com/logo.png"
                      className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1.5">Color Primario de Marca (Acento)</label>
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          type="button"
                          key={c.hex}
                          onClick={() => setWlForm({ ...wlForm, primaryColor: c.hex })}
                          className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center text-white text-[10px] ${
                            wlForm.primaryColor === c.hex ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {wlForm.primaryColor === c.hex ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={wlForm.primaryColor}
                        onChange={(e) => setWlForm({ ...wlForm, primaryColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={wlForm.primaryColor}
                        onChange={(e) => setWlForm({ ...wlForm, primaryColor: e.target.value })}
                        className="bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text font-mono w-28 uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Texto de Pie de Página (Footer Copyright)</label>
                    <input
                      type="text"
                      value={wlForm.footerText}
                      onChange={(e) => setWlForm({ ...wlForm, footerText: e.target.value })}
                      placeholder="Ej. Plataforma de Atención • Potenciado por CHASKYAPP Enterprise"
                      className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-wa-secondary uppercase block mb-1">Email de Soporte</label>
                      <input
                        type="email"
                        value={wlForm.supportEmail}
                        onChange={(e) => setWlForm({ ...wlForm, supportEmail: e.target.value })}
                        placeholder="soporte@organizacion.com"
                        className="w-full bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-wa-secondary uppercase block mb-1">Teléfono de Soporte</label>
                      <input
                        type="text"
                        value={wlForm.supportPhone}
                        onChange={(e) => setWlForm({ ...wlForm, supportPhone: e.target.value })}
                        placeholder="+51 987 654 321"
                        className="w-full bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={wlLoading}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 mt-2"
                  >
                    {wlLoading ? 'Guardando...' : '💾 Guardar Personalización White-Label'}
                  </button>
                </form>
              </div>

              {/* Live Preview Panel */}
              <div className="space-y-4">
                <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider text-wa-secondary">
                    Vista Previa en Vivo de Marca Blanca
                  </h3>

                  {/* Simulated App Header */}
                  <div className="bg-wa-header rounded-xl p-3 border border-white/10 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2.5">
                      {wlForm.logoUrl ? (
                        <img src={wlForm.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm"
                          style={{ backgroundColor: wlForm.primaryColor }}
                        >
                          {wlForm.appName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-white">{wlForm.appName || 'CHASKYAPP'}</h4>
                        <span className="text-[9px] text-wa-secondary block">
                          powered by <strong className="text-emerald-400">CHASKYAPP Enterprise</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      className="px-2.5 py-1 text-[11px] font-bold text-white rounded-lg shadow-sm"
                      style={{ backgroundColor: wlForm.primaryColor }}
                    >
                      Nuevo Chat
                    </button>
                  </div>

                  {/* Simulated Chat Message */}
                  <div className="bg-wa-dark/80 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex items-start gap-2 max-w-[80%]">
                      <div className="bg-wa-input p-2.5 rounded-2xl rounded-tl-none text-xs text-wa-text shadow-sm">
                        Hola, ¿en qué podemos ayudarte hoy?
                      </div>
                    </div>
                    <div className="flex items-end justify-end">
                      <div
                        className="p-2.5 rounded-2xl rounded-tr-none text-xs text-white shadow-sm max-w-[80%]"
                        style={{ backgroundColor: wlForm.primaryColor }}
                      >
                        ¡Excelente! Gracias por comunicarte con {wlForm.appName}.
                      </div>
                    </div>
                  </div>

                  {/* Simulated Footer */}
                  <div className="p-3 bg-wa-header/40 rounded-xl border border-white/5 text-center text-[10px] text-wa-secondary">
                    <div>{wlForm.footerText || `${wlForm.appName} • Potenciado por CHASKYAPP Enterprise`}</div>
                    <div className="mt-0.5 text-[9px] text-wa-secondary">
                      Contacto: {wlForm.supportEmail || 'soporte@empresa.com'} • {wlForm.supportPhone || '+51 987 654 321'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal Crear Tenant */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-scale-in">
          <div className="bg-wa-sidebar border border-gray-700/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>➕</span>
                <span>Nueva Organización Inquilina (Tenant)</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-wa-secondary hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3">
              <div>
                <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre de la Organización</label>
                <input
                  type="text"
                  placeholder="Ej. Clínica Dental San Isidro"
                  value={createForm.name}
                  onChange={(e) => {
                    const val = e.target.value
                    setCreateForm({
                      ...createForm,
                      name: val,
                      slug: val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
                      appName: val
                    })
                  }}
                  className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Slug Identificador</label>
                  <input
                    type="text"
                    placeholder="clinica-san-isidro"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text font-mono outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Dominio Personalizado (opcional)</label>
                  <input
                    type="text"
                    placeholder="chat.clinica.com"
                    value={createForm.domain}
                    onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Plan Inicial</label>
                  <select
                    value={createForm.planId}
                    onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Ciclo de Facturación</label>
                  <select
                    value={createForm.billingCycle}
                    onChange={(e) => setCreateForm({ ...createForm, billingCycle: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Administrador Responsable</label>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={createForm.ownerName}
                    onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Email del Administrador</label>
                  <input
                    type="email"
                    placeholder="admin@clinica.com"
                    value={createForm.ownerEmail}
                    onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                    className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  {createLoading ? 'Aprovisionando...' : 'Aprovisionar Organización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
