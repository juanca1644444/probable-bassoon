import React, { useState, useEffect } from 'react'

export default function InstallPwaModal({ onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installSuccess, setInstallSuccess] = useState(false)

  useEffect(() => {
    // Detect if already installed (standalone mode)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setIsStandalone(isStandaloneMode)

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase()
    const iosDevice = /iphone|ipad|ipod/.test(ua)
    setIsIOS(iosDevice)

    // Listen for beforeinstallprompt event if available on window
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    if (window.__chasky_install_prompt) {
      setDeferredPrompt(window.__chasky_install_prompt)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = async () => {
    const promptEvent = deferredPrompt || window.__chasky_install_prompt
    if (!promptEvent) {
      alert('Para instalar en este navegador, abre el menú del navegador (tres puntos ⋮ arriba a la derecha) y selecciona "Instalar aplicación" o "Agregar a pantalla principal".')
      return
    }

    try {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        setInstallSuccess(true)
        window.__chasky_install_prompt = null
        setDeferredPrompt(null)
        setTimeout(() => onClose(), 2000)
      }
    } catch (err) {
      console.warn('Install prompt error:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="bg-wa-header border border-emerald-500/30 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header decorativo */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-inner">
                📲
              </div>
              <div>
                <h3 className="text-base font-bold text-wa-text leading-tight">Instalar CHASKYAPP</h3>
                <p className="text-xs text-wa-secondary">Red Privada en tu Pantalla de Inicio</p>
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

          {/* Success message */}
          {installSuccess ? (
            <div className="py-8 text-center space-y-3">
              <span className="text-5xl">🎉</span>
              <h4 className="text-lg font-bold text-emerald-400">¡Instalación Exitosa!</h4>
              <p className="text-xs text-wa-secondary">CHASKYAPP ya está disponible en tu pantalla de inicio como una aplicación nativa.</p>
            </div>
          ) : isStandalone ? (
            <div className="py-6 text-center space-y-3">
              <span className="text-4xl">✅</span>
              <h4 className="text-base font-bold text-emerald-400">¡Aplicación ya instalada!</h4>
              <p className="text-xs text-wa-secondary">Ya estás disfrutando de CHASKYAPP en modo nativo independiente con soporte offline total.</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
              >
                Entendido
              </button>
            </div>
          ) : isIOS ? (
            /* Guía para iPhone / iPad */
            <div className="py-4 space-y-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-xs space-y-2">
                <p className="font-bold text-wa-text flex items-center gap-1.5">
                  <span>🍎</span> Instrucciones para iPhone & iPad (Safari):
                </p>
                <ol className="list-decimal list-inside space-y-2 text-wa-secondary leading-relaxed pl-1 text-[11px]">
                  <li>
                    Toca el botón <strong className="text-sky-400 font-semibold">Compartir ⎋</strong> en la barra inferior de Safari.
                  </li>
                  <li>
                    Desliza hacia abajo en el menú de opciones y selecciona <strong className="text-emerald-400 font-semibold">"Agregar a pantalla de inicio" ⊞</strong>.
                  </li>
                  <li>
                    Toca <strong className="text-emerald-400 font-semibold">"Agregar"</strong> en la esquina superior derecha.
                  </li>
                </ol>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-300">
                <span>✨</span>
                <span>Al agregarla, se abrirá a pantalla completa sin barra de navegación, con notificaciones instantáneas y acceso offline.</span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md"
              >
                Listo, ya lo agregué
              </button>
            </div>
          ) : (
            /* Android y Escritorio */
            <div className="py-4 space-y-4">
              <div className="space-y-2.5 text-xs text-wa-secondary leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold text-sm">⚡</span>
                  <div>
                    <strong className="text-wa-text block font-semibold">Rendimiento Nativo Ultrarrápido</strong>
                    <span>Carga al instante sin esperas y funciona incluso cuando no haya señal de internet gracias a su base de datos local SQLite/IndexedDB.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold text-sm">📳</span>
                  <div>
                    <strong className="text-wa-text block font-semibold">Videollamadas y Notas de Voz P2P</strong>
                    <span>Acceso de hardware optimizado para micrófono, cámara y altavoz con notificaciones sonoras.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold text-sm">🔒</span>
                  <div>
                    <strong className="text-wa-text block font-semibold">Acceso con 1 Toque y Bloqueo Seguro</strong>
                    <span>Icono en tu pantalla de inicio con soporte de PIN de seguridad.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleInstall}
                className="w-full py-3 rounded-2xl bg-wa-green hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
              >
                <span>📲</span>
                <span>Instalar Ahora en este Dispositivo</span>
              </button>

              <p className="text-[10px] text-center text-wa-secondary/80">
                Compatible con Google Chrome, Microsoft Edge, Brave, Samsung Internet y navegadores Android.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
