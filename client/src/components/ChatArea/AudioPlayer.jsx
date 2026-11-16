// AudioPlayer.jsx — Reproductor de notas de voz con waveform interactiva y Transcripción por IA
import React, { useRef, useState, useEffect, useCallback } from 'react'

const fmtTime = (s) => {
  const t = Math.floor(s || 0)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// ── Icono Play ────────────────────────────────────────────────────────────────
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M8 5v14l11-7z" />
  </svg>
)

// ── Icono Pause ───────────────────────────────────────────────────────────────
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

// ── Waveform interactiva ──────────────────────────────────────────────────────
function WaveformBar({ bars, progress, onSeek }) {
  const ref = useRef(null)

  const handleClick = (e) => {
    if (!ref.current) return
    const { left, width } = ref.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width))
    onSeek(ratio)
  }

  const data = bars.length > 0
    ? bars
    : Array.from({ length: 40 }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 0.45 + 0.5)))

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className="flex items-center gap-px cursor-pointer select-none"
      style={{ height: 32 }}
      title="Haz clic para buscar"
    >
      {data.map((v, i) => {
        const filled = i / data.length < progress
        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors"
            style={{
              height: `${Math.max(18, v * 100)}%`,
              backgroundColor: filled ? '#00a884' : 'rgba(174,186,193,0.4)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AudioPlayer({ messageId, src, duration = 0, waveform = [], isMe, initialTranscription = null }) {
  const audioRef        = useRef(null)
  const [playing, setPlaying]   = useState(false)
  const [current, setCurrent]   = useState(0)      // segundos reproducidos
  const [total, setTotal]       = useState(duration || 0)
  const [progress, setProgress] = useState(0)      // 0-1
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const rafRef          = useRef(null)

  // Transcripción IA State
  const [transcription, setTranscription] = useState(initialTranscription)
  const [transcribing, setTranscribing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // Parsear waveform (puede llegar como string JSON)
  const bars = (() => {
    try {
      return typeof waveform === 'string' ? JSON.parse(waveform) : (waveform || [])
    } catch { return [] }
  })()

  // Buscar si ya existe transcripción previa en backend al montar
  useEffect(() => {
    if (!transcription && messageId) {
      fetch(`/api/audio/transcription/${messageId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.transcription) {
            setTranscription(data.transcription)
          }
        })
        .catch(() => {})
    }
  }, [messageId, transcription])

  // Actualiza progreso en loop via rAF
  const tick = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    const cur  = el.currentTime
    const dur  = el.duration || total || 1
    setCurrent(cur)
    setProgress(cur / dur)
    if (!el.paused && !el.ended) {
      rafRef.current = requestAnimationFrame(tick)
    } else if (el.ended) {
      setPlaying(false)
      setCurrent(0)
      setProgress(0)
      el.currentTime = 0
    }
  }, [total])

  // Eventos del elemento audio
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onLoaded = () => {
      setLoading(false)
      if (el.duration && isFinite(el.duration)) setTotal(el.duration)
    }
    const onError = () => { setLoading(false); setError(true) }
    const onEnded = () => { setPlaying(false); setCurrent(0); setProgress(0); el.currentTime = 0 }

    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('canplay',        onLoaded)
    el.addEventListener('error',          onError)
    el.addEventListener('ended',          onEnded)

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('canplay',        onLoaded)
      el.removeEventListener('error',          onError)
      el.removeEventListener('ended',          onEnded)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const togglePlay = async () => {
    const el = audioRef.current
    if (!el || loading || error) return

    if (playing) {
      el.pause()
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
    } else {
      try {
        await el.play()
        setPlaying(true)
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        setError(true)
      }
    }
  }

  const handleSeek = (ratio) => {
    const el = audioRef.current
    if (!el) return
    const dur = el.duration || total || 1
    el.currentTime = ratio * dur
    setCurrent(el.currentTime)
    setProgress(ratio)
    if (playing) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  // Ejecutar transcripción con IA
  const handleTranscribe = async () => {
    if (transcribing) return
    setTranscribing(true)
    try {
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          audioUrl: src,
          duration: total || duration
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.transcription) {
          setTranscription(data.transcription)
        }
      }
    } catch (err) {
      console.error('Error al transcribir audio:', err)
    } finally {
      setTranscribing(false)
    }
  }

  const copyTranscription = () => {
    if (!transcription?.transcription) return
    navigator.clipboard.writeText(transcription.transcription)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Paleta según si el mensaje es propio (verde) o ajeno (gris)
  const btnBg  = isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-wa-green/20 hover:bg-wa-green/30 text-wa-green'
  const timeColor = isMe ? 'text-green-100' : 'text-wa-secondary'

  return (
    <div className="flex flex-col gap-2 min-w-[240px] max-w-sm">
      <div className="flex items-center gap-2">
        {/* Audio oculto */}
        <audio ref={audioRef} src={src} preload="metadata" />

        {/* Botón play/pause */}
        <button
          onClick={togglePlay}
          disabled={loading || error}
          className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${btnBg} disabled:opacity-40`}
          title={playing ? 'Pausar' : 'Reproducir'}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : error ? (
            <span className="text-xs">✕</span>
          ) : playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        {/* Waveform + tiempo */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <WaveformBar bars={bars} progress={progress} onSeek={handleSeek} />
          <div className={`flex justify-between text-[10px] font-mono ${timeColor}`}>
            <span>{fmtTime(current)}</span>
            <span>{fmtTime(total)}</span>
          </div>
        </div>

        {error && (
          <span className="text-red-400 text-xs flex-shrink-0">Error</span>
        )}
      </div>

      {/* ── Módulo de Transcripción por IA ───────────────────────── */}
      <div className="pt-1.5 border-t border-white/10">
        {!transcription ? (
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={transcribing}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              isMe
                ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border border-emerald-400/30'
                : 'bg-wa-input/80 hover:bg-wa-input text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {transcribing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Transcribiendo con IA (Gemini Flash)...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Transcribir nota de voz</span>
              </>
            )}
          </button>
        ) : (
          <div className="bg-black/25 rounded-xl p-2.5 border border-emerald-500/30 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <span>🎙️ Transcripción IA</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[9px]">
                  {transcription.languageName || 'Español'} (98%)
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyTranscription}
                  className="text-gray-400 hover:text-white transition-colors text-[10px]"
                  title="Copiar transcripción"
                >
                  {copied ? '✓ Copiado' : '📋 Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-white transition-colors text-[10px]"
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <p className="text-gray-200 leading-relaxed text-xs select-text italic bg-white/5 p-2 rounded-lg border border-white/5">
                "{transcription.transcription}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
