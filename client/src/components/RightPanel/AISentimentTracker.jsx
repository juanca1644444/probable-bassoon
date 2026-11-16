import React, { useState, useEffect, useCallback } from 'react'

export default function AISentimentTracker({ chatId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchSentiment = useCallback(async () => {
    if (!chatId) return
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/sentiment`)
      if (res.ok) {
        const data = await res.json()
        setAnalysis(data)
      }
    } catch (e) {
      console.error('Error fetching sentiment:', e)
    } finally {
      setLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    fetchSentiment()
  }, [fetchSentiment])

  if (!analysis) {
    return (
      <div className="p-3 bg-wa-input/40 rounded-xl border border-wa-border/50 text-xs text-wa-secondary text-center">
        Analizando tono con IA...
      </div>
    )
  }

  const { sentiment, score, label, keywords = [], customerMessagesCount = 0 } = analysis

  // Colors based on sentiment
  const config = {
    positive: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      bar: 'bg-emerald-400',
      emoji: '🟢',
      sub: 'Cliente receptivo y satisfecho',
      recommendation: 'Excelente momento para ofrecer ventas cruzadas o solicitar recomendación.'
    },
    urgent: {
      bg: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
      badge: 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse',
      bar: 'bg-rose-500',
      emoji: '🔴',
      sub: 'Atención crítica requerida',
      recommendation: 'Prioridad máxima: responder de inmediato con soluciones concretas y empatía.'
    },
    neutral: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      bar: 'bg-amber-400',
      emoji: '🟡',
      sub: 'Interacción estándar o informativa',
      recommendation: 'Mantener comunicación clara y resolver dudas puntuales del cliente.'
    }
  }[sentiment] || {
    bg: 'bg-wa-input border-wa-border text-wa-secondary',
    badge: 'bg-wa-input text-wa-text',
    bar: 'bg-wa-green',
    emoji: '🟡',
    sub: 'Tono neutral',
    recommendation: 'Atender consulta habitual.'
  }

  // Calculate gauge percentage: map score (-1.0 to 1.0) to (0% to 100%)
  const gaugePercent = Math.min(100, Math.max(0, Math.round(((score + 1) / 2) * 100)))

  return (
    <div className={`rounded-xl p-3.5 border transition-all ${config.bg} space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span>IA Sentiment Tracker</span>
        </div>
        <button
          onClick={fetchSentiment}
          disabled={loading}
          className="text-[10px] text-wa-secondary hover:text-wa-text flex items-center gap-1 hover:underline transition-colors"
          title="Reanalizar mensajes"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>{loading ? 'Analizando...' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Main Status Badge */}
      <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-lg border border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{config.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-wa-text">{label}</span>
              <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${config.badge}`}>
                Score: {score > 0 ? `+${score}` : score}
              </span>
            </div>
            <p className="text-[11px] text-wa-secondary">{config.sub}</p>
          </div>
        </div>
      </div>

      {/* Visual Meter / Gauge */}
      <div>
        <div className="flex justify-between text-[10px] font-semibold text-wa-secondary mb-1">
          <span className="text-rose-400">🔴 Crítico</span>
          <span className="text-amber-400">🟡 Neutral</span>
          <span className="text-emerald-400">🟢 Positivo</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-2 relative overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${config.bar}`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
      </div>

      {/* Keywords detected */}
      {keywords.length > 0 && (
        <div>
          <span className="text-[10px] text-wa-secondary block mb-1 font-semibold uppercase tracking-wider">
            Términos clave identificados:
          </span>
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-md bg-black/25 text-wa-text border border-white/10 font-mono"
              >
                #{kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Smart Recommendation */}
      <div className="p-2.5 rounded-lg bg-black/25 border border-white/5 text-[11px] leading-relaxed">
        <span className="font-bold text-wa-green mr-1">💡 Sugerencia IA:</span>
        <span className="text-wa-text/90">{config.recommendation}</span>
      </div>
    </div>
  )
}
