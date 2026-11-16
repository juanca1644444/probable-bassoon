import React, { useState, useEffect } from 'react'
import { formatRelativeTime } from '../../utils/formatters'

export default function LinkedDevices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPairModal, setShowPairModal] = useState(false)
  const [pairingStep, setPairingStep] = useState(1) // 1: QR, 2: Success
  const [newDeviceName, setNewDeviceName] = useState('Nuevo Dispositivo Web')
  const [closingId, setClosingId] = useState(null)
  const [feedback, setFeedback] = useState('')

  // WhatsApp Gateway State (Baileys)
  const [waStatus, setWaStatus] = useState({ status: 'connecting', qr: null, user: null })
  const [waLoading, setWaLoading] = useState(false)

  const fetchWaStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setWaStatus(json.data)
        }
      }
    } catch (e) {
      // Backend warming up or offline
    }
  }

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/devices')
      if (res.ok) {
        const data = await res.json()
        setDevices(data)
      }
    } catch (err) {
      console.error('Error fetching devices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
    fetchWaStatus()
  }, [])

  // Poll for QR updates while modal is open and not connected
  useEffect(() => {
    if (!showPairModal || waStatus.status === 'connected') return
    const timer = setInterval(() => {
      fetchWaStatus()
    }, 2500)
    return () => clearInterval(timer)
  }, [showPairModal, waStatus.status])

  const handleDisconnect = async (id, name) => {
    if (!window.confirm(`¿Deseas cerrar sesión en "${name}"?`)) return
    setClosingId(id)
    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== id))
        setFeedback(`Sesión cerrada en ${name}`)
        setTimeout(() => setFeedback(''), 3000)
      }
    } catch (err) {
      console.error('Error disconnecting device:', err)
    } finally {
      setClosingId(null)
    }
  }

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('¿Deseas cerrar sesión en WhatsApp Web Gateway? Deberás escanear nuevamente el código QR.')) return
    setWaLoading(true)
    try {
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' })
      if (res.ok) {
        setFeedback('Sesión de WhatsApp cerrada exitosamente.')
        setTimeout(() => setFeedback(''), 3500)
        fetchWaStatus()
      }
    } catch (e) {
      console.error('Error logging out WhatsApp:', e)
    } finally {
      setWaLoading(false)
    }
  }

  const handlePairNewDevice = async () => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: newDeviceName || 'Chrome en macOS',
          browser: 'Chrome 123',
          os: 'macOS Sonoma',
          ip: '192.168.1.' + Math.floor(Math.random() * 150 + 20),
          location: 'Madrid, España'
        })
      })
      if (res.ok) {
        setPairingStep(2)
        setTimeout(() => {
          setShowPairModal(false)
          setPairingStep(1)
          fetchDevices()
          setFeedback('¡Nuevo dispositivo vinculado con éxito!')
          setTimeout(() => setFeedback(''), 3500)
        }, 1200)
      }
    } catch (err) {
      console.error('Error pairing device:', err)
    }
  }

  const getDeviceIcon = (os = '', browser = '') => {
    const text = (os + ' ' + browser).toLowerCase()
    if (text.includes('mac') || text.includes('apple')) return '💻'
    if (text.includes('ipad') || text.includes('tablet')) return '📱'
    if (text.includes('iphone') || text.includes('android')) return '📲'
    if (text.includes('linux')) return '🐧'
    return '🖥️'
  }

  const currentDevice = devices.find(d => d.isCurrent === 1)
  const otherDevices = devices.filter(d => d.isCurrent !== 1)
  const isWaConnected = waStatus.status === 'connected'

  return (
    <div className="space-y-6 animate-fade-in max-h-full overflow-y-auto pr-1">
      {/* Header and Pairing CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-wa-border pb-4">
        <div>
          <h3 className="text-wa-text text-lg font-bold flex items-center gap-2">
            <span>🔗</span>
            <span>Dispositivos Vinculados & Gateway</span>
          </h3>
          <p className="text-slate-600 dark:text-wa-secondary text-xs mt-0.5">
            Conecta tu teléfono mediante código QR para enviar y recibir mensajes directamente a costo cero ($0.00).
          </p>
        </div>
        <button
          onClick={() => {
            setShowPairModal(true)
            setPairingStep(1)
            fetchWaStatus()
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 flex-shrink-0"
        >
          <span>📱</span>
          <span>{isWaConnected ? 'Ver Sesión WhatsApp' : 'Vincular Teléfono (QR)'}</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-400 font-bold text-xs flex items-center gap-2 animate-scale-in">
          <span>✅</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* WhatsApp Web Gateway Live Card */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isWaConnected
          ? 'bg-emerald-500/10 border-emerald-500/40'
          : 'bg-black/5 dark:bg-white/5 border-wa-border'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm ${
              isWaConnected ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-700 dark:text-wa-icon'
            }`}>
              {isWaConnected ? '🟢' : '📲'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-wa-text">
                  WhatsApp Web Gateway (Multi-Device)
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isWaConnected
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 animate-pulse'
                }`}>
                  {isWaConnected ? 'Conectado' : 'Pendiente de Escaneo'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-wa-secondary text-xs mt-0.5">
                {isWaConnected
                  ? `Vinculado como +${waStatus.user?.id ? waStatus.user.id.split(':')[0] : 'Teléfono Activo'} (${waStatus.user?.name || 'CHASKYAPP'})`
                  : 'Escanea el código QR desde tu app oficial de WhatsApp para activar el envío local.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isWaConnected ? (
              <button
                onClick={handleDisconnectWhatsApp}
                disabled={waLoading}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1.5"
              >
                <span>🚪</span>
                <span>{waLoading ? 'Cerrando...' : 'Desvincular WhatsApp'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowPairModal(true)
                  fetchWaStatus()
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>📷</span>
                <span>Escanear QR Ahora</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Security Info Banner */}
      <div className="bg-wa-sidebar p-4 rounded-2xl border border-wa-border flex items-center gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xl flex-shrink-0 font-bold">
          🔒
        </div>
        <div className="text-xs">
          <p className="text-wa-text font-bold">Cifrado de extremo a extremo activo</p>
          <p className="text-slate-600 dark:text-wa-secondary leading-relaxed font-medium">
            Tus mensajes, llamadas y archivos multimedia están protegidos. Ningún intermediario ni tercero tiene acceso a tus chats.
          </p>
        </div>
      </div>

      {/* Current Device Card */}
      {currentDevice && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-wa-secondary px-1">
            Navegador Actual
          </span>
          <div className="bg-wa-sidebar p-4 rounded-2xl border border-emerald-500/40 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                {getDeviceIcon(currentDevice.os, currentDevice.browser)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-wa-text truncate">{currentDevice.deviceName}</h4>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    Sesión Actual
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-wa-secondary mt-0.5 font-medium">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    En línea
                  </span>
                  <span>·</span>
                  <span>IP: {currentDevice.ip}</span>
                  <span>·</span>
                  <span>{currentDevice.location}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Linked Devices */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-wa-secondary">
            Otros Dispositivos Activos ({otherDevices.length})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-wa-secondary font-medium">Gestionar o cerrar sesiones</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-wa-secondary flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Cargando dispositivos vinculados...</span>
          </div>
        ) : otherDevices.length === 0 ? (
          <div className="p-6 bg-wa-sidebar rounded-2xl border border-wa-border text-center text-xs text-slate-600 dark:text-wa-secondary font-medium">
            No tienes otros navegadores vinculados en este momento.
          </div>
        ) : (
          <div className="space-y-2.5">
            {otherDevices.map((dev) => (
              <div
                key={dev.id}
                className="bg-wa-sidebar p-4 rounded-2xl border border-wa-border hover:border-emerald-500/30 transition-all flex items-center justify-between gap-3 group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-wa-header border border-wa-border flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    {getDeviceIcon(dev.os, dev.browser)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-wa-text truncate">{dev.deviceName}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-wa-secondary mt-0.5 font-medium">
                      <span>Última act.: {formatRelativeTime(dev.lastActive)}</span>
                      <span>·</span>
                      <span>IP: {dev.ip}</span>
                      <span>·</span>
                      <span>{dev.location}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDisconnect(dev.id, dev.deviceName)}
                  disabled={closingId === dev.id}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-400 border border-rose-500/30 transition-all flex-shrink-0 flex items-center gap-1.5"
                  title="Cerrar sesión en este dispositivo"
                >
                  {closingId === dev.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>🚪</span>
                  )}
                  <span>Cerrar sesión</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pairing Modal (Real Live QR from Baileys Gateway) */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-wa-header border border-wa-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-wa-border pb-3">
              <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
                <span>📱</span>
                <span>Vincular con WhatsApp (Código QR)</span>
              </h3>
              <button
                onClick={() => setShowPairModal(false)}
                className="p-1 rounded-full text-slate-600 dark:text-wa-secondary hover:text-wa-text"
              >
                ✕
              </button>
            </div>

            {isWaConnected ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-3xl mx-auto flex items-center justify-center font-bold">
                  ✓
                </div>
                <h4 className="text-base font-bold text-wa-text">¡WhatsApp ya está vinculado!</h4>
                <p className="text-xs text-slate-600 dark:text-wa-secondary font-medium">
                  Conectado como: <strong>+{waStatus.user?.id ? waStatus.user.id.split(':')[0] : 'Teléfono Activo'}</strong>
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setShowPairModal(false)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="text-left text-xs text-slate-600 dark:text-wa-secondary space-y-1.5 font-medium bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-wa-border">
                  <p className="font-bold text-wa-text">Instrucciones para vincular tu teléfono:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abre WhatsApp en tu teléfono móvil.</li>
                    <li>Toca <strong>Menú (⋮)</strong> o <strong>Ajustes ⚙️</strong>.</li>
                    <li>Selecciona <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
                    <li>Apunta la cámara de tu teléfono a este código QR:</li>
                  </ol>
                </div>

                {/* Real Live QR Code Box from Baileys */}
                <div className="mx-auto w-64 h-64 bg-white p-3 rounded-2xl shadow-md flex flex-col items-center justify-center relative overflow-hidden border-2 border-emerald-500">
                  {waStatus.qr ? (
                    <img
                      src={waStatus.qr}
                      alt="Código QR de WhatsApp"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-700 font-semibold">Generando código seguro de WhatsApp...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-wa-secondary pt-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Actualización automática activa
                  </span>
                  <button
                    onClick={fetchWaStatus}
                    className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                  >
                    Refrescar QR 🔄
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-wa-border">
                  <button
                    onClick={() => setShowPairModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-wa-secondary hover:text-wa-text"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
