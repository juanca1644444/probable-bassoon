// CSATSurveyCard.jsx — Tarjeta Interactiva de Encuesta de Satisfacción (CSAT / NPS) para CHASKYAPP
import React, { useState } from 'react'

const RATING_LABELS = {
  1: '1/5 — Muy insatisfecho 😠',
  2: '2/5 — Insatisfecho 🙁',
  3: '3/5 — Aceptable 😐',
  4: '4/5 — Buena atención 😊',
  5: '5/5 — ¡Excelente servicio! 🌟'
}

const QUICK_TAGS = [
  '⚡ Respuesta inmediata',
  '🎯 Solución clara',
  '🤝 Trato amable',
  '🚀 Excelente soporte'
]

export default function CSATSurveyCard({ message, chatId, onSurveyUpdated }) {
  const payload = (() => {
    try {
      return typeof message.content === 'string' ? JSON.parse(message.content) : (message.content || {})
    } catch {
      return {}
    }
  })()

  const [rating, setRating] = useState(payload.rating || 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState(payload.comment || '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(payload.status === 'submitted')
  const [error, setError] = useState('')

  const activeRating = hoverRating || rating

  const handleTagClick = (tag) => {
    if (submitted) return
    setComment(prev => prev ? `${prev}, ${tag}` : tag)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) {
      setError('Por favor selecciona una calificación de 1 a 5 estrellas.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/csat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: payload.surveyId || ('csat-' + message.id),
          chatId: chatId || payload.chatId,
          rating,
          comment
        })
      })

      if (res.ok) {
        setSubmitted(true)
        if (onSurveyUpdated) onSurveyUpdated()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al enviar calificación.')
      }
    } catch (err) {
      console.error('Error submitting CSAT:', err)
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border border-emerald-500/30 bg-gradient-to-b from-gray-900/95 to-gray-950/95 text-white my-1">
      {/* Header con gradiente andino */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider">CHASKYAPP Satisfacción</h4>
            <p className="text-[10px] text-emerald-100">Encuesta de Calidad del Servicio (CSAT)</p>
          </div>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-black/25 font-mono">
          {submitted ? '✅ Calificado' : 'Pendiente'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="text-center space-y-1">
          <h5 className="font-semibold text-sm text-gray-100">
            {payload.title || '¿Cómo calificarías la atención recibida?'}
          </h5>
          <p className="text-xs text-gray-400 leading-snug">
            {payload.subtitle || 'Tu caso ha sido marcado como Resuelto. Ayúdanos a mejorar nuestro servicio.'}
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 text-center space-y-2 animate-fade-in">
            <div className="text-2xl animate-bounce">🎉</div>
            <div className="flex justify-center gap-1 text-xl text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= rating ? 'opacity-100' : 'opacity-25'}>
                  ★
                </span>
              ))}
            </div>
            <p className="text-xs font-semibold text-emerald-300">
              {RATING_LABELS[rating] || '¡Gracias por tu calificación!'}
            </p>
            {comment && (
              <p className="text-[11px] text-gray-300 italic bg-black/20 p-2 rounded-lg border border-white/5">
                "{comment}"
              </p>
            )}
            <p className="text-[10px] text-gray-400">
              ✓ Tu opinión fue registrada y compartida con el equipo de calidad.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Selector interactivo de estrellas */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center justify-center gap-2 text-3xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => { setRating(star); setError('') }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transform hover:scale-125 transition-transform focus:outline-none p-1"
                    title={`Calificar con ${star} estrellas`}
                  >
                    <span className={star <= activeRating ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-gray-600'}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-xs font-medium text-emerald-400 h-4 mt-1 transition-opacity">
                {activeRating ? RATING_LABELS[activeRating] : 'Toca las estrellas para calificar'}
              </span>
            </div>

            {/* Tags rápidos de elogio / retroalimentación */}
            <div className="flex flex-wrap gap-1 justify-center pt-1">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-white/10 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Input de comentario */}
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Tienes algún comentario o sugerencia? (Opcional)"
                rows={2}
                className="w-full bg-black/40 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={submitting || !rating}
              className={`w-full py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                rating && !submitting
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer transform hover:scale-[1.02] active:scale-95'
                  : 'bg-emerald-500/20 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Enviando calificación...</span>
                </>
              ) : (
                <>
                  <span>Enviar Calificación</span>
                  <span>⭐</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
