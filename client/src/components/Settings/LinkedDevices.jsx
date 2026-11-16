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

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/devices')
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
  }, [])

  const handleDisconnect = async (id, name) => {
    if (!window.confirm(`¿Deseas cerrar sesión en "${name}"?`)) return
    setClosingId(id)
    try {
      const res = await fetch(`http://localhost:3001/api/devices/${id}`, { method: 'DELETE' })
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

  const handlePairNewDevice = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/devices', {
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

  return (
    <div className="space-y-6 animate-fade-in max-h-full overflow-y-auto pr-1">
      {/* Header and Pairing CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-wa-text text-lg font-bold flex items-center gap-2">
            <span>🔗</span>
            <span>Dispositivos Vinculados</span>
          </h3>
          <p className="text-wa-secondary text-xs mt-0.5">
            Usa WhatsApp en un máximo de 4 dispositivos adicionales sin mantener tu teléfono conectado.
          </p>
        </div>
        <button
          onClick={() => { setShowPairModal(true); setPairingStep(1) }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95 flex-shrink-0"
        >
          <span>➕</span>
          <span>Vincular un dispositivo</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-scale-in">
          <span>✅</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Security Info Banner */}
      <div className="bg-wa-sidebar p-4 rounded-2xl border border-white/5 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl flex-shrink-0">
          🔒
        </div>
        <div className="text-xs">
          <p className="text-wa-text font-semibold">Cifrado de extremo a extremo activo</p>
          <p className="text-wa-secondary leading-relaxed">
            Tus mensajes, llamadas y archivos multimedia están protegidos. Ningún dispositivo no autorizado puede acceder a tus claves de cifrado.
          </p>
        </div>
      </div>

      {/* Current Device Card */}
      {currentDevice && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wa-secondary px-1">
            Este Dispositivo
          </span>
          <div className="bg-wa-sidebar p-4 rounded-2xl border border-emerald-500/40 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                {getDeviceIcon(currentDevice.os, currentDevice.browser)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-wa-text truncate">{currentDevice.deviceName}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Sesión Actual
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-wa-secondary mt-0.5">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-wa-secondary">
            Otros Dispositivos Activos ({otherDevices.length})
          </span>
          <span className="text-[11px] text-wa-secondary">Toca para gestionar o cerrar sesión</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-wa-secondary flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Cargando dispositivos vinculados...</span>
          </div>
        ) : otherDevices.length === 0 ? (
          <div className="p-6 bg-wa-sidebar rounded-2xl border border-white/5 text-center text-xs text-wa-secondary">
            No tienes otros dispositivos vinculados en este momento.
          </div>
        ) : (
          <div className="space-y-2.5">
            {otherDevices.map((dev) => (
              <div
                key={dev.id}
                className="bg-wa-sidebar p-4 rounded-2xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-wa-header border border-white/5 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    {getDeviceIcon(dev.os, dev.browser)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-wa-text truncate">{dev.deviceName}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-wa-secondary mt-0.5">
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
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all flex-shrink-0 flex items-center gap-1.5"
                  title="Cerrar sesión en este dispositivo"
                >
                  {closingId === dev.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
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

      {/* Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-wa-header border border-gray-700/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700/50 pb-3">
              <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
                <span>📱</span>
                <span>Vincular con Código QR</span>
              </h3>
              <button
                onClick={() => setShowPairModal(false)}
                className="p-1 rounded-full text-wa-secondary hover:text-wa-text"
              >
                ✕
              </button>
            </div>

            {pairingStep === 1 ? (
              <div className="space-y-4 text-center">
                <p className="text-xs text-wa-secondary leading-relaxed">
                  Para vincular un nuevo navegador o equipo, escanea este código o pulsa el botón de simulación rápida:
                </p>

                {/* Simulated QR Box */}
                <div className="mx-auto w-48 h-48 bg-white p-3 rounded-2xl shadow-inner flex flex-col items-center justify-center relative overflow-hidden border-2 border-emerald-500/40">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=whatsapp-pro-device-pair-auth-token-99418"
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs text-wa-secondary font-medium">Nombre identificador del equipo:</label>
                  <input
                    type="text"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="Ej. MacBook Air Personal"
                    className="w-full px-3 py-2 bg-wa-input border border-gray-700/60 rounded-xl text-xs text-wa-text outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowPairModal(false)}
                    className="px-4 py-2 text-xs text-wa-secondary hover:text-wa-text"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePairNewDevice}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Simular escaneo y vincular
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl mx-auto flex items-center justify-center animate-bounce">
                  ✓
                </div>
                <h4 className="text-base font-bold text-wa-text">¡Dispositivo Vinculado!</h4>
                <p className="text-xs text-wa-secondary">Sincronizando claves y chats cifrados...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
