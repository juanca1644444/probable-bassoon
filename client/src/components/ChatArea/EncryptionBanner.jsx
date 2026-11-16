// client/src/components/ChatArea/EncryptionBanner.jsx
// Banner de seguridad E2E con modal informativo — CHASKYAPP
import React, { useState } from 'react'

// ── Ícono de candado ───────────────────────────────────────────────────────
const LockIcon = () => (
  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
)

// ── Modal informativo de cifrado ───────────────────────────────────────────
function EncryptionModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[8500] flex items-end sm:items-center justify-center p-4 pb-8 sm:pb-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Tarjeta del modal */}
      <div
        className="relative bg-wa-header rounded-2xl shadow-2xl max-w-sm w-full border border-gray-700/40 animate-fade-in-up overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Franja decorativa verde */}
        <div className="h-[3px] w-full bg-gradient-to-r from-wa-green/60 via-wa-green to-wa-green/60" />

        <div className="p-6">
          {/* Encabezado */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 bg-wa-green/10 rounded-full flex items-center justify-center mb-3 ring-1 ring-wa-green/30">
              <svg className="w-7 h-7 text-wa-green" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </div>
            <h2 className="text-wa-text text-base font-semibold leading-snug">
              Cifrado de extremo a extremo
            </h2>
            <p className="text-wa-secondary text-xs mt-1">Tu privacidad, garantizada</p>
          </div>

          {/* Cuerpo */}
          <div className="space-y-3 text-sm text-wa-secondary leading-relaxed">
            <p>
              Los mensajes y las llamadas están cifrados de extremo a extremo para que nadie más,{' '}
              <span className="text-wa-text font-medium">ni siquiera CHASKYAPP</span>,
              pueda leerlos ni escucharlos.
            </p>

            {/* Card: ¿Cómo funciona? */}
            <div className="bg-wa-input rounded-xl p-3 border border-gray-700/40">
              <div className="flex gap-2.5 items-start">
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">🔐</span>
                <div>
                  <p className="text-wa-text text-xs font-medium mb-1">¿Cómo funciona?</p>
                  <p className="text-wa-secondary text-xs">
                    Cada mensaje se cifra con una clave única antes de salir de tu dispositivo.
                    Solo el destinatario posee la clave para descifrarlo.
                  </p>
                </div>
              </div>
            </div>

            {/* Card: ¿Qué está protegido? */}
            <div className="bg-wa-input rounded-xl p-3 border border-gray-700/40">
              <div className="flex gap-2.5 items-start">
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">🛡️</span>
                <div>
                  <p className="text-wa-text text-xs font-medium mb-1">¿Qué está protegido?</p>
                  <ul className="text-wa-secondary text-xs space-y-1 mt-0.5">
                    {['Mensajes de texto', 'Fotos, videos y archivos', 'Notas de voz', 'Llamadas de voz y video'].map(item => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="text-wa-green font-bold text-[10px]">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Botón de cierre */}
          <button
            onClick={onClose}
            className="mt-5 w-full py-2.5 bg-wa-green hover:bg-green-600 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Banner principal ───────────────────────────────────────────────────────
export default function EncryptionBanner() {
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      {/* Franja informativa */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Cifrado de extremo a extremo. Toca para más información."
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
        className="
          group flex items-center justify-center gap-2
          px-4 py-1.5 cursor-pointer flex-shrink-0
          border-b border-wa-green/10
          hover:bg-wa-green/5 transition-colors
        "
        style={{ background: 'rgba(0,168,132,0.07)' }}
      >
        {/* Contenido del banner */}
        <div className="flex items-center gap-1.5 text-slate-800 dark:text-wa-secondary group-hover:text-wa-icon transition-colors font-medium">
          <span className="text-wa-green">
            <LockIcon />
          </span>
          <p className="text-[11px] text-center leading-relaxed">
            Los mensajes y llamadas están cifrados de{' '}
            <span className="font-semibold text-wa-green">extremo a extremo</span>.{' '}
            <span className="underline underline-offset-2 decoration-dotted">
              Toca para más información.
            </span>
          </p>
        </div>

        {/* Botón cerrar banner */}
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="
            ml-1 p-0.5 rounded-full text-wa-secondary
            hover:text-wa-text hover:bg-black/20 transition-colors flex-shrink-0
          "
          title="Cerrar"
          aria-label="Cerrar banner de cifrado"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Modal */}
      {modalOpen && <EncryptionModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
