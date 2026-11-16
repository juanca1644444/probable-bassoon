import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

export default function UserIdentityModal({ onClose }) {
  const { currentUser, setCurrentUser, contacts } = useAppStore()
  const [agents, setAgents] = useState([])
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('agents') // 'agents' | 'contacts' | 'new'

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data)
      })
      .catch(() => {})
  }, [])

  const handleSelectProfile = (profile) => {
    setCurrentUser({
      id: profile.id,
      name: profile.name,
      role: profile.role || (profile.phone ? 'Contacto de Red' : 'Miembro'),
      avatar: profile.avatar || '',
      email: profile.email || '',
    })
    onClose()
  }

  const handleCreateMember = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole.trim() || 'Operador',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newName)}`
        })
      })
      if (res.ok) {
        const created = await res.json()
        setAgents(prev => [...prev, created])
        handleSelectProfile(created)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const currentId = currentUser?.id || 'agent-me'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-wa-header border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-wa-sidebar border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
              🛡️
            </span>
            <div>
              <h3 className="font-bold text-wa-text text-base leading-tight">CHASKY Red Privada · Identidad</h3>
              <p className="text-xs text-wa-secondary">Elige quién eres en este dispositivo o pestaña</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-wa-secondary hover:text-wa-text transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Active User Banner */}
        <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500" />
            ) : (
              <div className={`w-11 h-11 rounded-full ${getAvatarGradient(currentUser?.name || 'Yo')} flex items-center justify-center text-white font-bold text-sm ring-2 ring-emerald-500`}>
                {getInitials(currentUser?.name || 'Yo')}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-wa-text text-sm">{currentUser?.name || 'Yo (Super Admin)'}</p>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                  Activo Aquí
                </span>
              </div>
              <p className="text-xs text-wa-secondary">{currentUser?.role || 'Coordinador General'}</p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold hidden sm:inline">
            ID: {currentId}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-wa-sidebar/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'agents'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            👥 Equipo / Agentes ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'contacts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            👤 Contactos de Red ({contacts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'new'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            ➕ Nuevo Perfil
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'agents' && (
            <div className="space-y-1.5">
              {agents.map((agent) => {
                const isSelected = agent.id === currentId
                return (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectProfile(agent)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border border-emerald-500/50 shadow-sm'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${getAvatarGradient(agent.name)} flex items-center justify-center text-white font-bold text-sm`}>
                          {getInitials(agent.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-wa-text text-sm">{agent.name}</p>
                        <p className="text-xs text-wa-secondary">{agent.role || 'Miembro'}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow">
                        ✓
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-wa-secondary hover:text-emerald-400">
                        Usar este
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-1.5">
              {(contacts || []).map((contact) => {
                const isSelected = contact.id === currentId
                return (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectProfile(contact)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border border-emerald-500/50 shadow-sm'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${getAvatarGradient(contact.name)} flex items-center justify-center text-white font-bold text-sm`}>
                          {getInitials(contact.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-wa-text text-sm">{contact.name}</p>
                        <p className="text-xs text-wa-secondary">{contact.status || contact.phone || 'Contacto interno'}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow">
                        ✓
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-wa-secondary hover:text-emerald-400">
                        Usar este
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleCreateMember} className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-semibold text-wa-secondary mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej. Rodrigo Mendoza / Andre"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-wa-input border border-wa-border text-wa-text text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wa-secondary mb-1">Rol / Departamento</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="Ej. Docente, Coordinador, Alumno, Soporte"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-wa-input border border-wa-border text-wa-text text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !newName.trim()}
                className="w-full py-2.5 rounded-xl bg-wa-green hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-md disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear y Usar en esta Pantalla'}
              </button>
            </form>
          )}
        </div>

        {/* Footer info tip */}
        <div className="p-3.5 bg-wa-sidebar/80 border-t border-white/10 text-[11px] text-wa-secondary leading-relaxed flex items-start gap-2">
          <span>💡</span>
          <div>
            <strong className="text-wa-text">Prueba Multi-Dispositivo en Red Local:</strong> Abre esta app en una ventana de incógnito o en tu teléfono celular (<span className="text-emerald-400 font-mono">http://192.168.1.9:5173/</span>), selecciona un perfil diferente (ej. <em>Andre</em> o <em>Úrsula</em>) ¡y chatea en tiempo real con sonido, notas de voz y llamadas privadas entre tus dispositivos!
          </div>
        </div>
      </div>
    </div>
  )
}
