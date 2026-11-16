import React, { useState, useEffect } from 'react'

export function MetaVerifiedBadge({ size = 'md' }) {
  const isSm = size === 'sm'
  const isLg = size === 'lg'
  const sz = isLg ? 'w-5 h-5' : isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <span
      className="inline-flex items-center text-emerald-400 align-middle flex-shrink-0 cursor-help"
      title="Cuenta oficial de empresa verificada por Meta (WhatsApp Business)"
    >
      <svg className={sz} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 15.4l-4.2-4.2 1.41-1.41 2.79 2.79 7.09-7.09 1.41 1.41-8.5 8.5z"/>
      </svg>
    </span>
  )
}

export default function BusinessProfileModal({ onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('info') // 'info' | 'hours' | 'automation'
  const [savedSuccess, setSavedSuccess] = useState(false)

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/business/profile')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSavedSuccess(false)
    try {
      const res = await fetch('http://localhost:3001/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(updated)
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Calculate if business is open right now based on hours
  const isBusinessOpen = () => {
    if (!profile?.businessHours?.enabled) return true
    const now = new Date()
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    const todayName = days[now.getDay()]
    const todayConfig = profile.businessHours?.days?.[todayName]

    if (!todayConfig || !todayConfig.active) return false

    const [openH, openM] = (todayConfig.open || '00:00').split(':').map(Number)
    const [closeH, closeM] = (todayConfig.close || '00:00').split(':').map(Number)

    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-wa-dark p-6 rounded-2xl text-wa-secondary text-sm">
          Cargando Perfil de Empresa Meta...
        </div>
      </div>
    )
  }

  const openNow = isBusinessOpen()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-wa-header border-b border-wa-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-wa-text">Perfil de Empresa Oficial</h3>
                <MetaVerifiedBadge size="md" />
              </div>
              <p className="text-[11px] text-wa-secondary">Meta Verified Business Suite</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-secondary hover:text-wa-text hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-white/5 bg-wa-input/40 px-5 pt-2 gap-2 text-xs font-semibold">
          {[
            { id: 'info', label: 'Información y Verificación', icon: 'ℹ️' },
            { id: 'hours', label: 'Horarios Comerciales', icon: '🕒' },
            { id: 'automation', label: 'Mensajes Auto (Greeting/Away)', icon: '🤖' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-wa-green text-wa-green font-bold bg-white/5 rounded-t-lg'
                  : 'border-transparent text-wa-secondary hover:text-wa-text'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {savedSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <span>✓</span>
              <span>Perfil de empresa actualizado con éxito en Meta Business Suite</span>
            </div>
          )}

          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Verification Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 rounded-2xl border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                    <MetaVerifiedBadge size="md" />
                    <span>Insignia de Empresa Verificada por Meta</span>
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.isVerified)}
                      onChange={(e) => setProfile({ ...profile, isVerified: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>
                <p className="text-[11px] text-wa-secondary leading-relaxed">
                  Esta insignia certifica ante tus clientes que la cuenta pertenece a una entidad legalmente constituida y auditada por Meta.
                </p>
                <div className="pt-1">
                  <label className="text-[10px] text-wa-secondary font-semibold uppercase block mb-1">
                    Razón Social Certificada
                  </label>
                  <input
                    type="text"
                    value={profile.verifiedName || ''}
                    onChange={(e) => setProfile({ ...profile, verifiedName: e.target.value })}
                    className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs text-wa-text font-medium outline-none focus:border-wa-green"
                  />
                </div>
              </div>

              {/* Business Name & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-wa-secondary block mb-1">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    value={profile.businessName || ''}
                    onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                    className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none focus:border-wa-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-wa-secondary block mb-1">
                    Categoría de Empresa
                  </label>
                  <input
                    type="text"
                    value={profile.category || ''}
                    onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                    className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none focus:border-wa-green"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-wa-secondary block mb-1">
                  Descripción del Negocio
                </label>
                <textarea
                  rows={2}
                  value={profile.description || ''}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                  className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none resize-none focus:border-wa-green"
                />
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Dirección física del negocio"
                  value={profile.address || ''}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none focus:border-wa-green"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    placeholder="Correo de contacto comercial"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none focus:border-wa-green"
                  />
                  <input
                    type="url"
                    placeholder="Sitio web (https://...)"
                    value={profile.website || ''}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full bg-wa-input border border-wa-border/80 rounded-xl px-3 py-2 text-xs text-wa-text outline-none focus:border-wa-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: HOURS */}
          {activeTab === 'hours' && (
            <div className="space-y-4">
              <div className="p-3 bg-wa-input/60 rounded-xl flex items-center justify-between border border-wa-border/50">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${openNow ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-xs font-bold text-wa-text">
                    Estado en Vivo: {openNow ? '🟢 Abierto ahora' : '🔴 Cerrado'}
                  </span>
                </div>
                <span className="text-[10px] text-wa-secondary">Basado en la hora local</span>
              </div>

              <div className="space-y-2">
                {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((day) => {
                  const cfg = profile.businessHours?.days?.[day] || { open: '09:00', close: '18:00', active: true }
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between p-2.5 bg-wa-header/80 rounded-xl border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2 w-28">
                        <input
                          type="checkbox"
                          checked={cfg.active}
                          onChange={(e) => {
                            const copy = { ...profile.businessHours }
                            if (!copy.days) copy.days = {}
                            copy.days[day] = { ...cfg, active: e.target.checked }
                            setProfile({ ...profile, businessHours: copy })
                          }}
                          className="rounded text-wa-green focus:ring-0"
                        />
                        <span className="capitalize font-medium text-wa-text">{day}</span>
                      </div>

                      {cfg.active ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={cfg.open || '09:00'}
                            onChange={(e) => {
                              const copy = { ...profile.businessHours }
                              copy.days[day] = { ...cfg, open: e.target.value }
                              setProfile({ ...profile, businessHours: copy })
                            }}
                            className="bg-wa-dark border border-wa-border rounded px-2 py-0.5 text-xs text-wa-text outline-none"
                          />
                          <span className="text-wa-secondary">a</span>
                          <input
                            type="time"
                            value={cfg.close || '18:00'}
                            onChange={(e) => {
                              const copy = { ...profile.businessHours }
                              copy.days[day] = { ...cfg, close: e.target.value }
                              setProfile({ ...profile, businessHours: copy })
                            }}
                            className="bg-wa-dark border border-wa-border rounded px-2 py-0.5 text-xs text-wa-text outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-wa-secondary italic pr-6">Cerrado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB: AUTOMATION (GREETING & AWAY) */}
          {activeTab === 'automation' && (
            <div className="space-y-4">
              {/* Greeting Message */}
              <div className="p-4 bg-wa-header/80 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">👋</span>
                    <span className="text-xs font-bold text-wa-text">Mensaje de Bienvenida</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.greetingEnabled)}
                      onChange={(e) => setProfile({ ...profile, greetingEnabled: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>
                <p className="text-[11px] text-wa-secondary">
                  Saluda a los clientes automáticamente cuando te escriban por primera vez o tras 14 días de inactividad.
                </p>
                <textarea
                  rows={2}
                  disabled={!profile.greetingEnabled}
                  value={profile.greetingMessage || ''}
                  onChange={(e) => setProfile({ ...profile, greetingMessage: e.target.value })}
                  className="w-full bg-wa-dark border border-wa-border/70 rounded-xl p-2.5 text-xs text-wa-text outline-none resize-none focus:border-wa-green disabled:opacity-40"
                />
              </div>

              {/* Away Message */}
              <div className="p-4 bg-wa-header/80 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🌙</span>
                    <span className="text-xs font-bold text-wa-text">Mensaje de Ausencia</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.awayEnabled)}
                      onChange={(e) => setProfile({ ...profile, awayEnabled: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>
                <p className="text-[11px] text-wa-secondary">
                  Responde automáticamente cuando recibes mensajes fuera del horario comercial establecido.
                </p>
                <textarea
                  rows={2}
                  disabled={!profile.awayEnabled}
                  value={profile.awayMessage || ''}
                  onChange={(e) => setProfile({ ...profile, awayMessage: e.target.value })}
                  className="w-full bg-wa-dark border border-wa-border/70 rounded-xl p-2.5 text-xs text-wa-text outline-none resize-none focus:border-wa-green disabled:opacity-40"
                />
              </div>
            </div>
          )}

          {/* Footer Save Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-wa-input hover:bg-white/10 text-wa-text rounded-xl text-xs font-semibold transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-wa-green hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <span>{saving ? 'Guardando...' : '✓ Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
