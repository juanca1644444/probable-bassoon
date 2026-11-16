import React, { useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { fetchAiSummary } from '../../utils/api'

export default function AIAssistant() {
  const { activeChat } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  if (!activeChat) return null

  const handleSummarize = async () => {
    setLoading(true)
    setSummary(null)
    setError(null)
    setShowModal(true)
    try {
      const data = await fetchAiSummary(activeChat.id)
      setSummary(data.summary || 'No hay resumen disponible.')
    } catch (err) {
      setError('No se pudo obtener el resumen. ¿Está el servidor activo?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button — positioned comfortably above the chat input box */}
      <div className="absolute bottom-36 right-6 z-20">
        <div className="relative">
          {showTooltip && (
            <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-wa-header text-wa-text text-xs px-2.5 py-1 rounded-lg border border-emerald-500/30 whitespace-nowrap shadow-xl pointer-events-none">
              ✨ Resumir chat con IA
            </div>
          )}
          <button
            onClick={handleSummarize}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all shadow-xl flex items-center justify-center group ring-2 ring-emerald-400/30"
            title="Resumir conversación con IA"
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-wa-header rounded-xl shadow-2xl w-full max-w-md mx-4 animate-scale-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-wa-green/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-wa-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <span className="text-wa-text font-semibold text-sm">Resumen IA</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-wa-secondary hover:text-wa-text transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5 min-h-[120px] flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                  <p className="text-wa-secondary text-sm">Analizando conversación...</p>
                </div>
              ) : error ? (
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                  <button
                    onClick={handleSummarize}
                    className="text-wa-green hover:text-green-400 text-sm transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <p className="text-wa-text text-sm leading-relaxed">{summary}</p>
              )}
            </div>

            {/* Modal footer */}
            {!loading && (
              <div className="px-5 pb-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-wa-secondary hover:text-wa-text text-sm transition-colors"
                >
                  Cerrar
                </button>
                {!error && summary && (
                  <button
                    onClick={handleSummarize}
                    className="px-4 py-2 rounded-lg bg-wa-green hover:bg-green-400 text-white text-sm transition-colors"
                  >
                    Actualizar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
