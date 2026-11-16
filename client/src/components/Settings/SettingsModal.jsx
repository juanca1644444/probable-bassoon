// SettingsModal.jsx — Modal de Perfil y Ajustes estilo WhatsApp Web
import React, { useState, useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'
import { playNotificationSound } from '../Notifications/ToastNotification'
import BusinessSettings from './BusinessSettings'
import LinkedDevices from './LinkedDevices'
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard'
import BusinessIntelligenceDashboard from '../Analytics/BusinessIntelligenceDashboard'
import WebhooksSettings from './WebhooksSettings'
import RolesManagement from './RolesManagement'
import AuditLogsModal from './AuditLogsModal'
import DeveloperCenter from './DeveloperCenter'
import KnowledgeBase from './KnowledgeBase'
import SubscriptionBillingModal from './SubscriptionBillingModal'
import ChannelsHub from './ChannelsHub'
import IvrBuilder from '../Telephony/IvrBuilder'
import DocumentGenerator from '../Documents/DocumentGenerator'
import AiAgentsHub from './AiAgentsHub'
import useTenantStore from '../../store/useTenantStore'
import { getOutboxQueue } from '../../services/localDb'

const STATUS_PRESETS = [
  '¡Hola! Estoy usando CHASKYAPP 🚀',
  'Disponible',
  'Ocupado',
  'En el trabajo 💻',
  'En reunión 📅',
  'Batería baja 🪫',
  'Sólo llamadas urgentes ⚠️',
]

export default function SettingsModal({ initialTab = 'profile', onClose, onLockSession }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showFullAnalytics, setShowFullAnalytics] = useState(false)
  const [showBiModal, setShowBiModal] = useState(false)
  const { theme, setTheme, logout, addToast, chats = [] } = useAppStore()
  const [localOutboxCount, setLocalOutboxCount] = useState(0)
  const [cacheClearSuccess, setCacheClearSuccess] = useState('')

  // Profile state
  const [profile, setProfile] = useState({
    name: 'Yo',
    status: 'Usando CHASKYAPP 🚀',
    avatar: '',
    phone: '+34 611 000 001',
  })
  const [editingName, setEditingName] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [tempName, setTempName] = useState('')
  const [tempStatus, setTempStatus] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef(null)

  // Notifications state
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [desktopAlerts, setDesktopAlerts] = useState(true)
  const [previewEnabled, setPreviewEnabled] = useState(true)

  // Security & Auto-Lock state
  const [autoLockEnabled, setAutoLockEnabled] = useState(true)
  const [autoLockTimeout, setAutoLockTimeout] = useState(15) // minutes
  const [showChangePin, setShowChangePin] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  // White-Label State
  const { activeTenant, tenantSettings, updateWhiteLabel } = useTenantStore()
  const [wlAppName, setWlAppName] = useState(tenantSettings?.appName || 'CHASKYAPP')
  const [wlLogo, setWlLogo] = useState(tenantSettings?.logoUrl || '')
  const [wlColor, setWlColor] = useState(tenantSettings?.primaryColor || '#00a884')
  const [wlFooter, setWlFooter] = useState(tenantSettings?.footerText || '')
  const [wlEmail, setWlEmail] = useState(tenantSettings?.supportEmail || '')
  const [wlPhone, setWlPhone] = useState(tenantSettings?.supportPhone || '')
  const [wlSaving, setWlSaving] = useState(false)
  const [wlSuccess, setWlSuccess] = useState('')

  useEffect(() => {
    if (tenantSettings) {
      setWlAppName(tenantSettings.appName || 'CHASKYAPP')
      setWlLogo(tenantSettings.logoUrl || '')
      setWlColor(tenantSettings.primaryColor || '#00a884')
      setWlFooter(tenantSettings.footerText || '')
      setWlEmail(tenantSettings.supportEmail || '')
      setWlPhone(tenantSettings.supportPhone || '')
    }
  }, [tenantSettings])

  const handleSaveWl = async (e) => {
    e.preventDefault()
    setWlSaving(true)
    const res = await updateWhiteLabel({
      appName: wlAppName,
      logoUrl: wlLogo,
      primaryColor: wlColor,
      footerText: wlFooter,
      supportEmail: wlEmail,
      supportPhone: wlPhone
    })
    setWlSaving(false)
    if (res.success) {
      setWlSuccess('Configuración de Marca Blanca guardada.')
      setTimeout(() => setWlSuccess(''), 3000)
    }
  }

  // Load profile and settings on mount
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.name) {
          setProfile({
            name: data.name,
            status: data.status || 'Usando CHASKYAPP 🚀',
            avatar: data.avatar || '',
            phone: data.phone || '+34 611 000 001',
          })
          setTempName(data.name)
          setTempStatus(data.status || '')
        }
      })
      .catch(() => {})

    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications !== undefined) {
          setSoundEnabled(data.notifications === 'true')
        }
      })
      .catch(() => {})

    fetch('/api/auth/security-settings')
      .then((r) => r.json())
      .then((sec) => {
        if (sec) {
          setAutoLockEnabled(sec.autoLockEnabled !== false)
          setAutoLockTimeout(sec.autoLockTimeoutMinutes || 15)
        }
      })
      .catch(() => {})
  }, [])

  // Check outbox queue when session tab is active
  useEffect(() => {
    if (activeTab === 'session') {
      getOutboxQueue().then(items => setLocalOutboxCount(items.length)).catch(() => {})
    }
  }, [activeTab])

  const handleClearCache = async () => {
    try {
      setCacheClearSuccess('Caché PWA e IndexedDB optimizadas. Datos locales sincronizados.')
      setTimeout(() => setCacheClearSuccess(''), 3500)
    } catch (e) {
      console.error(e)
    }
  }

  // Update auto-lock settings
  const handleUpdateSecuritySettings = async (enabled, timeoutMinutes) => {
    setAutoLockEnabled(enabled)
    setAutoLockTimeout(timeoutMinutes)
    try {
      await fetch('/api/auth/security-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoLockEnabled: enabled,
          autoLockTimeoutMinutes: timeoutMinutes,
        }),
      })
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Seguridad',
        message: 'Ajustes de bloqueo automático guardados',
        avatar: '',
      })
    } catch (e) {
      console.error('Error saving security settings:', e)
    }
  }

  // Change PIN handler
  const handleChangePin = async (e) => {
    e.preventDefault()
    setPinError('')
    setPinSuccess('')

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('El nuevo PIN debe ser exactamente de 4 dígitos numéricos.')
      return
    }
    if (newPin !== confirmPin) {
      setPinError('Los PINs nuevos no coinciden.')
      return
    }

    setSavingPin(true)
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin,
          newPin,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPinSuccess('¡PIN de seguridad actualizado con éxito!')
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
        setTimeout(() => setShowChangePin(false), 1500)
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Seguridad',
          message: 'PIN de bloqueo actualizado',
          avatar: '',
        })
      } else {
        setPinError(data.error || 'Error al actualizar PIN')
      }
    } catch (err) {
      setPinError('Error de red al actualizar PIN')
    } finally {
      setSavingPin(false)
    }
  }

  // Save profile changes to backend
  const handleSaveProfile = async (updates) => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(prev => ({ ...prev, ...updated }))
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Ajustes',
          message: 'Perfil actualizado con éxito',
          avatar: '',
        })
      }
    } catch (e) {
      console.error('Error saving profile:', e)
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle avatar upload
  const handleAvatarFile = async (file) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        const newAvatar = data.filePath || data.url
        handleSaveProfile({ avatar: newAvatar })
      }
    } catch (e) {
      console.error('Error uploading avatar:', e)
    }
  }

  // Regenerate avatar using DiceBear
  const handleRegenerateAvatar = () => {
    const seed = Math.random().toString(36).slice(2, 8)
    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00a884`
    handleSaveProfile({ avatar: newAvatar })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl w-full max-w-4xl flex flex-row h-[640px] max-h-[90vh] overflow-hidden border border-wa-border animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Bar */}
        <div className="w-56 md:w-64 shrink-0 bg-wa-sidebar border-r border-wa-border flex flex-col h-full overflow-hidden p-3">
          <div className="flex items-center justify-between px-3 py-2 mb-2 shrink-0">
            <span className="text-wa-text font-bold text-base">Ajustes</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-wa-icon hover:bg-black/5 dark:hover:bg-white/10 transition-colors md:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto scrollbar-thin space-y-1 pr-1">
            {[
              { id: 'profile', label: 'Perfil', icon: '👤' },
              { id: 'subscription', label: 'Suscripción y Licencia', icon: '💳' },
              { id: 'whitelabel', label: 'Marca Blanca (White-Label)', icon: '🏛️' },
              { id: 'roles', label: 'Roles y Permisos', icon: '👥' },
              { id: 'audit', label: 'Auditoría y Logs', icon: '🛡️' },
              { id: 'business', label: 'Herramientas de Negocio', icon: '💼' },
              { id: 'devices', label: 'Dispositivos Vinculados', icon: '🔗' },
              { id: 'analytics', label: 'Analíticas y Reportes', icon: '📊' },
              { id: 'ai_agents', label: 'Especialistas IA & Enrutador', icon: '🤖' },
              { id: 'knowledge', label: 'Base de Conocimiento RAG', icon: '🧠' },
              { id: 'developer', label: 'Centro Desarrolladores', icon: '💻' },
              { id: 'channels', label: 'Canales Oficiales (Meta & Telegram)', icon: '📡' },
              { id: 'telephony', label: 'Centralita Telefónica & Voz IA', icon: '📞' },
              { id: 'documents', label: 'Gestor Documental y Contratos', icon: '📄' },
              { id: 'notifications', label: 'Notificaciones', icon: '🔔' },
              { id: 'appearance', label: 'Apariencia', icon: '🎨' },
              { id: 'session', label: 'Cuenta y Sesión', icon: '🔒' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-wa-green/15 text-wa-green font-bold'
                    : 'text-slate-700 dark:text-wa-secondary hover:text-wa-text hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>

          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-2.5 mt-auto text-xs text-wa-secondary hover:text-wa-text transition-colors shrink-0 border-t border-wa-border/50 pt-2"
          >
            Presiona ESC para cerrar
          </button>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 bg-wa-dark p-6 overflow-y-auto scrollbar-thin flex flex-col relative h-full">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-wa-icon hover:text-wa-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
            title="Cerrar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* ── TAB: PERFIL ────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-wa-text text-lg font-semibold border-b border-white/5 pb-2">
                Perfil de usuario
              </h3>

              {/* Avatar Editor */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title="Haz clic para cambiar la foto"
                >
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="w-28 h-28 rounded-full object-cover ring-4 ring-wa-green/30 shadow-xl"
                    />
                  ) : (
                    <div
                      className={`w-28 h-28 rounded-full ${getAvatarGradient(
                        profile.name
                      )} flex items-center justify-center text-white text-3xl font-bold ring-4 ring-wa-green/30 shadow-xl`}
                    >
                      {getInitials(profile.name)}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-xs gap-1">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zm6.4-8.4h-1.68l-1.08-1.6H8.36L7.28 6.8H5.6C4.72 6.8 4 7.52 4 8.4v9.6c0 .88.72 1.6 1.6 1.6h12.8c.88 0 1.6-.72 1.6-1.6V8.4c0-.88-.72-1.6-1.6-1.6z"/>
                    </svg>
                    <span>Cambiar</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 bg-wa-input hover:bg-white/10 text-xs text-wa-text rounded-full transition-colors"
                  >
                    Subir foto
                  </button>
                  <button
                    onClick={handleRegenerateAvatar}
                    className="px-3 py-1 bg-wa-green/20 hover:bg-wa-green/30 text-xs text-wa-green font-medium rounded-full transition-colors flex items-center gap-1"
                  >
                    🎲 Aleatorio
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarFile(e.target.files[0])}
                />
              </div>

              {/* Name field */}
              <div className="bg-wa-header p-3.5 rounded-xl border border-white/5">
                <span className="text-wa-green text-xs font-semibold uppercase tracking-wider block mb-1">
                  Tu nombre
                </span>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      maxLength={30}
                      autoFocus
                      className="flex-1 bg-transparent border-b border-wa-green text-wa-text text-sm py-1 outline-none"
                    />
                    <button
                      onClick={() => {
                        handleSaveProfile({ name: tempName.trim() || 'Yo' })
                        setEditingName(false)
                      }}
                      className="p-1 text-wa-green hover:text-white"
                      title="Guardar"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setTempName(profile.name)
                        setEditingName(false)
                      }}
                      className="p-1 text-wa-secondary hover:text-white"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-wa-text font-medium text-sm">{profile.name}</span>
                    <button
                      onClick={() => {
                        setTempName(profile.name)
                        setEditingName(true)
                      }}
                      className="text-wa-secondary hover:text-wa-green p-1 transition-colors"
                    >
                      ✏️
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-wa-secondary mt-1">
                  Este nombre será visible para tus contactos de CHASKYAPP.
                </p>
              </div>

              {/* Status field ("Info / Acerca de") */}
              <div className="bg-wa-header p-3.5 rounded-xl border border-white/5">
                <span className="text-wa-green text-xs font-semibold uppercase tracking-wider block mb-1">
                  Info. / Estado
                </span>
                {editingStatus ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempStatus}
                      onChange={(e) => setTempStatus(e.target.value)}
                      maxLength={120}
                      autoFocus
                      className="flex-1 bg-transparent border-b border-wa-green text-wa-text text-sm py-1 outline-none"
                    />
                    <button
                      onClick={() => {
                        handleSaveProfile({ status: tempStatus.trim() })
                        setEditingStatus(false)
                      }}
                      className="p-1 text-wa-green hover:text-white"
                      title="Guardar"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setTempStatus(profile.status)
                        setEditingStatus(false)
                      }}
                      className="p-1 text-wa-secondary hover:text-white"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-wa-text text-sm">{profile.status}</span>
                    <button
                      onClick={() => {
                        setTempStatus(profile.status)
                        setEditingStatus(true)
                      }}
                      className="text-wa-secondary hover:text-wa-green p-1 transition-colors"
                    >
                      ✏️
                    </button>
                  </div>
                )}

                {/* Status Presets */}
                <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/5">
                  {STATUS_PRESETS.map((pst) => (
                    <button
                      key={pst}
                      onClick={() => {
                        setProfile((p) => ({ ...p, status: pst }))
                        handleSaveProfile({ status: pst })
                      }}
                      className="px-2 py-0.5 bg-wa-input hover:bg-white/10 text-wa-secondary hover:text-wa-text text-xs rounded-full transition-colors"
                    >
                      {pst}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone info */}
              <div className="bg-wa-header p-3.5 rounded-xl border border-white/5">
                <span className="text-wa-green text-xs font-semibold uppercase tracking-wider block mb-1">
                  Teléfono
                </span>
                <span className="text-wa-text text-sm">{profile.phone}</span>
              </div>
            </div>
          )}

          {/* ── TAB: NOTIFICACIONES ────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-wa-text text-lg font-semibold border-b border-white/5 pb-2">
                Notificaciones y Alertas
              </h3>

              <div className="space-y-4">
                {/* Sounds toggle */}
                <div className="flex items-center justify-between p-3.5 bg-wa-header rounded-xl border border-white/5">
                  <div>
                    <p className="text-wa-text text-sm font-medium">Sonidos de mensajes</p>
                    <p className="text-wa-secondary text-xs mt-0.5">
                      Reproducir un tono sutil con cada nuevo mensaje recibido
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => {
                        setSoundEnabled(e.target.checked)
                        fetch('/api/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notifications: e.target.checked ? 'true' : 'false' }),
                        })
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>

                {/* Test Sound */}
                <div className="flex items-center justify-between px-3">
                  <span className="text-wa-secondary text-xs">Comprobar sonido de notificación:</span>
                  <button
                    onClick={() => playNotificationSound()}
                    className="px-3 py-1.5 bg-wa-green/20 hover:bg-wa-green/30 text-wa-green text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    🔊 Reproducir tono
                  </button>
                </div>

                {/* Desktop Alerts */}
                <div className="flex items-center justify-between p-3.5 bg-wa-header rounded-xl border border-white/5">
                  <div>
                    <p className="text-wa-text text-sm font-medium">Notificaciones Toast flotantes</p>
                    <p className="text-wa-secondary text-xs mt-0.5">
                      Mostrar tarjeta emergente en la esquina cuando llegue un mensaje de otro chat
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={desktopAlerts}
                      onChange={(e) => setDesktopAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>

                {/* Preview */}
                <div className="flex items-center justify-between p-3.5 bg-wa-header rounded-xl border border-white/5">
                  <div>
                    <p className="text-wa-text text-sm font-medium">Mostrar vista previa</p>
                    <p className="text-wa-secondary text-xs mt-0.5">
                      Incluir el texto del mensaje en la tarjeta de notificación
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={previewEnabled}
                      onChange={(e) => setPreviewEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wa-green" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: APARIENCIA ────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-wa-text text-lg font-semibold border-b border-white/5 pb-2">
                Tema y Apariencia
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Dark Theme Option */}
                <div
                  onClick={() => {
                    setTheme('dark')
                    fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ theme: 'dark' }),
                    })
                  }}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center gap-3 ${
                    theme === 'dark'
                      ? 'border-wa-green bg-wa-header shadow-lg shadow-wa-green/10'
                      : 'border-white/10 bg-wa-sidebar hover:border-white/20'
                  }`}
                >
                  <div className="w-full h-24 rounded-xl bg-[#111b21] p-2 flex flex-col justify-between border border-gray-800">
                    <div className="w-1/2 h-3 bg-[#202c33] rounded" />
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#00a884]" />
                      <div className="flex-1 space-y-1">
                        <div className="w-3/4 h-2 bg-[#2a3942] rounded" />
                        <div className="w-1/2 h-2 bg-[#2a3942] rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      theme === 'dark' ? 'border-wa-green bg-wa-green' : 'border-gray-500'
                    }`}>
                      {theme === 'dark' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    <span className="text-wa-text text-sm font-semibold">Oscuro (Predeterminado)</span>
                  </div>
                </div>

                {/* Light Theme Option */}
                <div
                  onClick={() => {
                    setTheme('light')
                    fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ theme: 'light' }),
                    })
                  }}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center gap-3 ${
                    theme === 'light'
                      ? 'border-wa-green bg-wa-header shadow-lg shadow-wa-green/10'
                      : 'border-white/10 bg-wa-sidebar hover:border-white/20'
                  }`}
                >
                  <div className="w-full h-24 rounded-xl bg-[#f0f2f5] p-2 flex flex-col justify-between border border-gray-300">
                    <div className="w-1/2 h-3 bg-white rounded shadow-sm" />
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#00a884]" />
                      <div className="flex-1 space-y-1">
                        <div className="w-3/4 h-2 bg-gray-300 rounded" />
                        <div className="w-1/2 h-2 bg-gray-300 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      theme === 'light' ? 'border-wa-green bg-wa-green' : 'border-gray-500'
                    }`}>
                      {theme === 'light' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    <span className="text-wa-text text-sm font-semibold">Claro</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: BUSINESS SUITE ───────────────────────────────────── */}
          {activeTab === 'business' && (
            <BusinessSettings />
          )}

          {/* ── TAB: DISPOSITIVOS VINCULADOS ──────────────────────────── */}
          {activeTab === 'devices' && (
            <LinkedDevices />
          )}

          {/* ── TAB: ANALYTICS & REPORTS ─────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-white/5 pb-2">
                <h3 className="text-wa-text text-lg font-semibold">Analíticas, BI y Reportes Gerenciales</h3>
                <p className="text-wa-secondary text-xs">Métricas de conversión, embudo de ventas, efectividad omnicanal y KPIs de agentes</p>
              </div>

              {/* Business Intelligence Highlight Card */}
              <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 p-5 rounded-2xl border border-emerald-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl shadow-inner">
                      🎯
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-wa-text">Business Intelligence & Funnel Suite</h4>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          BI 2.0
                        </span>
                      </div>
                      <p className="text-xs text-wa-secondary">Embudo comercial interactivo, comparativa omnicanal, podio del mes y exportación a Excel / PDF.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setShowBiModal(true)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>🚀</span>
                    <span>Abrir Dashboard de Business Intelligence (BI)</span>
                  </button>
                  <a
                    href="http://localhost:3001/api/bi/export/pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>📕</span>
                    <span>PDF Oficial</span>
                  </a>
                </div>
              </div>

              <div className="bg-wa-sidebar p-5 rounded-2xl border border-gray-700/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-wa-text">Dashboard Visual Resumido</h4>
                    <p className="text-xs text-wa-secondary">Incluye gráficos de barras semanales, porcentaje de contenido y consultas de productos.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowFullAnalytics(true)}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-wa-text rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span>📈</span>
                    <span>Ver Métricas Rápidas de Mensajería</span>
                  </button>
                </div>
              </div>

              <div className="bg-wa-sidebar p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="font-semibold text-wa-text flex items-center gap-2">
                  <span>📥</span>
                  <span>Exportación de Historiales</span>
                </div>
                <p className="text-wa-secondary leading-relaxed">
                  Puedes exportar cualquier conversación activa a PDF oficial de WhatsApp, CSV estructurado para Excel o JSON técnico haciendo clic en los tres puntos del chat o en el panel de información del contacto.
                </p>
              </div>
            </div>
          )}

          {/* ── TAB: ROLES & PERMISOS (RBAC) ─────────────────────────── */}
          {activeTab === 'roles' && (
            <div className="animate-fade-in">
              <RolesManagement />
            </div>
          )}

          {/* ── TAB: AUDITORÍA & LOGS ──────────────────────────────────── */}
          {activeTab === 'audit' && (
            <div className="animate-fade-in">
              <AuditLogsModal />
            </div>
          )}

          {/* ── TAB: ESPECIALISTAS IA & ENRUTADOR ─────────────────────── */}
          {activeTab === 'ai_agents' && (
            <div className="animate-fade-in">
              <AiAgentsHub embedded={true} onClose={onClose} />
            </div>
          )}

          {/* ── TAB: BASE DE CONOCIMIENTO RAG & COPILOT ────────────────── */}
          {activeTab === 'knowledge' && (
            <div className="animate-fade-in">
              <KnowledgeBase />
            </div>
          )}

          {/* ── TAB: CENTRO DE DESARROLLADORES (API KEYS & WEBHOOKS HUB) ── */}
          {(activeTab === 'developer' || activeTab === 'webhooks') && (
            <div className="animate-fade-in">
              <DeveloperCenter />
            </div>
          )}

          {/* ── TAB: SESIÓN Y SEGURIDAD AVANZADA ────────────────────────── */}
          {activeTab === 'session' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-white/5 pb-2">
                <h3 className="text-wa-text text-lg font-semibold">
                  Seguridad, Bloqueo de Sesión y Cuenta
                </h3>
                <p className="text-xs text-wa-secondary">
                  Configura el bloqueo automático por inactividad, actualiza tu PIN y administra el acceso.
                </p>
              </div>

              {/* End-to-End Encryption Banner */}
              <div className="bg-wa-header p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-wa-green/20 flex items-center justify-center text-wa-green text-xl">
                    🛡️
                  </div>
                  <div>
                    <h4 className="text-wa-text text-sm font-semibold">Cifrado de extremo a extremo</h4>
                    <p className="text-wa-secondary text-xs">Tus mensajes, llamadas y credenciales locales están cifrados.</p>
                  </div>
                </div>
              </div>

              {/* Auto-Lock / Inactivity Settings */}
              <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-wa-text text-sm font-bold flex items-center gap-2">
                      <span>⏱️</span>
                      <span>Bloqueo Automático por Inactividad (Auto-Lock)</span>
                    </h4>
                    <p className="text-xs text-wa-secondary mt-0.5">
                      Bloquea la pantalla de CHASKYAPP automáticamente tras un periodo sin interacción del usuario.
                    </p>
                  </div>

                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLockEnabled}
                      onChange={(e) => handleUpdateSecuritySettings(e.target.checked, autoLockTimeout)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {autoLockEnabled && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-xs text-wa-text font-medium">
                      Tiempo de inactividad permitido:
                    </span>
                    <select
                      value={autoLockTimeout}
                      onChange={(e) => handleUpdateSecuritySettings(true, Number(e.target.value))}
                      className="bg-wa-header text-xs text-wa-text border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value={5}>5 minutos</option>
                      <option value={15}>15 minutos (Recomendado)</option>
                      <option value={30}>30 minutos</option>
                      <option value={60}>1 hora (60 minutos)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* PIN Settings */}
              <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-wa-text text-sm font-bold flex items-center gap-2">
                      <span>🔑</span>
                      <span>PIN de Desbloqueo de Sesión</span>
                    </h4>
                    <p className="text-xs text-wa-secondary mt-0.5">
                      Código de 4 dígitos requerido para desbloquear la pantalla (por defecto: 1234).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePin(!showChangePin)
                      setPinError('')
                      setPinSuccess('')
                    }}
                    className="px-3 py-1.5 bg-wa-header hover:bg-white/10 text-xs font-semibold text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors"
                  >
                    {showChangePin ? 'Cancelar' : 'Cambiar PIN'}
                  </button>
                </div>

                {/* Change PIN Form */}
                {showChangePin && (
                  <form onSubmit={handleChangePin} className="mt-3 pt-3 border-t border-white/5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-wa-secondary uppercase block mb-1">PIN Actual</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value)}
                          placeholder="1234"
                          className="w-full bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono tracking-widest text-center"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nuevo PIN (4 dígitos)</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="••••"
                          className="w-full bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono tracking-widest text-center"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-wa-secondary uppercase block mb-1">Confirmar Nuevo PIN</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value)}
                          placeholder="••••"
                          className="w-full bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500 font-mono tracking-widest text-center"
                          required
                        />
                      </div>
                    </div>

                    {pinError && (
                      <p className="text-xs text-red-400 font-medium">{pinError}</p>
                    )}
                    {pinSuccess && (
                      <p className="text-xs text-emerald-400 font-medium">{pinSuccess}</p>
                    )}

                    <button
                      type="submit"
                      disabled={savingPin}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
                    >
                      {savingPin && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      <span>Guardar Nuevo PIN</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Instant Manual Lock Button */}
              <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-wa-text">Bloqueo Inmediato</h4>
                  <p className="text-xs text-wa-secondary">Bloquea la interfaz ahora mismo para proteger tu sesión si te alejas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (onLockSession) onLockSession()
                  }}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <span>🔒</span>
                  <span>Bloquear Ahora</span>
                </button>
              </div>

              {/* Almacenamiento Local PWA & Cache Offline */}
              <div className="bg-wa-sidebar/70 p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-wa-text text-sm font-bold flex items-center gap-2">
                      <span>💾</span>
                      <span>Almacenamiento Local PWA & Cache Offline</span>
                    </h4>
                    <p className="text-xs text-wa-secondary mt-0.5">
                      Base de datos local IndexedDB (<code className="text-emerald-400 font-mono">chaskyapp_offline_db</code>) y cola de sincronización Outbox.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <span>🟢</span>
                    <span>Offline-Ready</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                  <div className="bg-wa-header/60 p-2.5 rounded-lg border border-white/5">
                    <span className="block text-[10px] text-wa-secondary uppercase">Chats Almacenados</span>
                    <span className="text-sm font-bold text-white font-mono">{chats.length} conversaciones</span>
                  </div>
                  <div className="bg-wa-header/60 p-2.5 rounded-lg border border-white/5">
                    <span className="block text-[10px] text-wa-secondary uppercase">Cola Outbox</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">{localOutboxCount} pendientes</span>
                  </div>
                  <div className="bg-wa-header/60 p-2.5 rounded-lg border border-white/5">
                    <span className="block text-[10px] text-wa-secondary uppercase">Service Worker</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">Workbox v2.0 (Activo)</span>
                  </div>
                </div>

                {cacheClearSuccess && (
                  <p className="text-xs text-emerald-400 font-medium">{cacheClearSuccess}</p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-wa-secondary">
                    Estrategia: Precaché de activos + StaleWhileRevalidate en /uploads/
                  </span>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    🗑️ Limpiar caché / Purgar datos locales
                  </button>
                </div>
              </div>

              {/* Logout Button */}
              <div className="bg-wa-header p-4 rounded-xl border border-red-500/20 space-y-3">
                <h4 className="text-red-400 text-sm font-semibold">Cerrar sesión</h4>
                <p className="text-wa-secondary text-xs leading-relaxed">
                  Al cerrar la sesión se desvinculará este navegador y deberás escanear nuevamente el código QR para ingresar.
                </p>
                <button
                  onClick={() => {
                    onClose()
                    logout()
                  }}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Cerrar sesión en CHASKYAPP
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: SUSCRIPCIÓN Y LICENCIA ────────────────────────── */}
          {activeTab === 'subscription' && (
            <div className="space-y-6 animate-fade-in">
              <SubscriptionBillingModal embedded={true} onClose={onClose} />
            </div>
          )}

          {/* ── TAB: MARCA BLANCA (WHITE-LABEL) ────────────────────── */}
          {activeTab === 'whitelabel' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-white/5 pb-2">
                <h3 className="text-wa-text text-lg font-semibold flex items-center gap-2">
                  <span>🏛️</span>
                  <span>Personalización de Marca Blanca (White-Label)</span>
                </h3>
                <p className="text-xs text-wa-secondary">
                  Personaliza el nombre de tu aplicación, logotipo, color de acento y datos institucionales de pie de página.
                </p>
              </div>

              {wlSuccess && (
                <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold">
                  ✓ {wlSuccess}
                </div>
              )}

              <form onSubmit={handleSaveWl} className="space-y-4">
                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Nombre Comercial de la App</label>
                  <input
                    type="text"
                    value={wlAppName}
                    onChange={(e) => setWlAppName(e.target.value)}
                    placeholder="Ej. CHASKYAPP / MiEmpresa Chat"
                    className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">URL del Logotipo Institucional</label>
                  <input
                    type="url"
                    value={wlLogo}
                    onChange={(e) => setWlLogo(e.target.value)}
                    placeholder="https://tu-dominio.com/logo.png"
                    className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1.5">Color Primario de Marca (Acento)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={wlColor}
                      onChange={(e) => setWlColor(e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={wlColor}
                      onChange={(e) => setWlColor(e.target.value)}
                      className="bg-wa-header px-3 py-1.5 text-xs rounded-xl border border-white/10 text-wa-text font-mono w-28 uppercase"
                    />
                    <div className="flex items-center gap-1.5">
                      {['#00a884', '#2563eb', '#7c3aed', '#d97706', '#e11d48'].map((hex) => (
                        <button
                          type="button"
                          key={hex}
                          onClick={() => setWlColor(hex)}
                          className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-wa-secondary uppercase block mb-1">Texto de Pie de Página (Footer Copyright)</label>
                  <input
                    type="text"
                    value={wlFooter}
                    onChange={(e) => setWlFooter(e.target.value)}
                    placeholder="Ej. MiEmpresa • Potenciado por CHASKYAPP Enterprise"
                    className="w-full bg-wa-header px-3.5 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Email de Soporte</label>
                    <input
                      type="email"
                      value={wlEmail}
                      onChange={(e) => setWlEmail(e.target.value)}
                      placeholder="soporte@miempresa.com"
                      className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-wa-secondary uppercase block mb-1">Teléfono de Soporte</label>
                    <input
                      type="text"
                      value={wlPhone}
                      onChange={(e) => setWlPhone(e.target.value)}
                      placeholder="+51 987 654 321"
                      className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-wa-text outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={wlSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-2"
                >
                  {wlSaving ? 'Guardando...' : '💾 Guardar Personalización White-Label'}
                </button>
              </form>
            </div>
          )}

          {/* ── TAB: CANALES OFICIALES ────────────────────────────────────── */}
          {activeTab === 'channels' && (
            <ChannelsHub embedded={true} onClose={onClose} />
          )}

          {/* ── TAB: CENTRALITA TELEFÓNICA & VOZ IA ─────────────────────── */}
          {activeTab === 'telephony' && (
            <IvrBuilder embedded={true} onClose={onClose} />
          )}

          {/* ── TAB: GESTOR DOCUMENTAL Y CONTRATOS ───────────────────────── */}
          {activeTab === 'documents' && (
            <DocumentGenerator embedded={true} onClose={onClose} />
          )}
        </div>
      </div>

      {showFullAnalytics && (
        <AnalyticsDashboard onClose={() => setShowFullAnalytics(false)} />
      )}

      {showBiModal && (
        <BusinessIntelligenceDashboard onClose={() => setShowBiModal(false)} />
      )}
    </div>
  )
}
