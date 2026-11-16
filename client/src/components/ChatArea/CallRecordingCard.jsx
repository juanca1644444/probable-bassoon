import React, { useState, useRef, useEffect } from 'react'

export default function CallRecordingCard({ message }) {
  let callData = {}
  try {
    callData = typeof message.content === 'object' ? message.content : JSON.parse(message.content)
  } catch (e) {
    callData = {
      summary: message.content,
      duration: message.duration || 60,
      recordingUrl: message.filePath || '/uploads/voice-1794580620776-ee980fcf.webm',
      turns: []
    }
  }

  const {
    callId = 'CALL-000',
    direction = 'inbound',
    fromNumber = '+51 987 654 321',
    toNumber = '+51 1 700 8920',
    customerName = 'Cliente',
    duration = 60,
    status = 'completed',
    aiAgentActive = 1,
    sentiment = 'positive',
    summary = 'Llamada telefónica interactiva procesada a través del IVR de CHASKYAPP.',
    actionItems = [],
    recordingUrl = message.filePath || '/uploads/voice-1794580620776-ee980fcf.webm',
    turns = []
  } = callData

  // Audio Player State
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [checkedActions, setCheckedActions] = useState({})

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setAudioDuration(audio.duration)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleRateChange = () => {
    const rates = [1.0, 1.25, 1.5, 2.0]
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(nextRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate
    }
  }

  const formatSecs = (s) => {
    const total = Math.floor(s || 0)
    const mins = Math.floor(total / 60)
    const secs = total % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const toggleAction = (idx) => {
    setCheckedActions(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // Generate 28 waveform bars based on duration
  const waveformBars = Array.from({ length: 28 }, (_, i) => {
    const seed = (i * 17 + duration) % 100
    const height = Math.max(20, (Math.sin(i * 0.45) * 40 + 50) + (seed % 15))
    const progress = (currentTime / (audioDuration || 1)) * 28
    const isPlayed = i < progress
    return { height, isPlayed }
  })

  return (
    <div className="w-full max-w-md my-1.5 rounded-2xl bg-gradient-to-br from-[#0c1317] to-[#111b21] border border-emerald-500/30 shadow-xl overflow-hidden font-sans text-wa-text text-xs animate-fade-in">
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />

      {/* Header Banner */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/80 to-zinc-900 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-sm shadow-inner">
            📞
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs tracking-wide">
                {direction === 'inbound' ? 'Llamada Entrante IVR' : 'Llamada Saliente'}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                DID Oficial
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span>{fromNumber}</span>
              <span>→</span>
              <span className="text-emerald-300/90">{toNumber}</span>
            </div>
          </div>
        </div>

        {/* Status / Sentiment Pill */}
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase border ${
            status === 'completed'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : status === 'transferred'
              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            {status === 'completed' ? '✓ Completada' : status === 'transferred' ? '🔄 Transferida' : status}
          </span>
          <span className="text-[9px] text-zinc-400">
            {sentiment === 'positive' ? '😊 Satisfecho' : sentiment === 'neutral' ? '😐 Neutral' : '🙁 Descontento'}
          </span>
        </div>
      </div>

      {/* Main Body: Audio Player & Waveform */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* Play / Pause Circular Button */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 flex-shrink-0"
            title={isPlaying ? 'Pausar audio' : 'Reproducir grabación'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Interactive Waveform & Scrubbing */}
          <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
            <div className="h-7 flex items-center gap-1 px-1 py-1 rounded bg-black/40 border border-white/5 overflow-hidden">
              {waveformBars.map((bar, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    bar.isPlayed ? 'bg-emerald-400' : 'bg-zinc-600/70 hover:bg-zinc-400'
                  }`}
                  style={{ height: `${bar.height}%` }}
                />
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max={audioDuration || duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-700/60 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>{formatSecs(currentTime)}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRateChange}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-zinc-300 transition-colors"
                  title="Velocidad de reproducción"
                >
                  {playbackRate}x
                </button>
                <span>{formatSecs(audioDuration || duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Executive Summary */}
        {summary && (
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span>🤖</span> Resumen Ejecutivo de la IA
              </span>
              <span className="text-[9px] text-zinc-400">RAG Grounded</span>
            </div>
            <p className="text-[11px] text-zinc-200 leading-relaxed">
              {summary}
            </p>
          </div>
        )}

        {/* Action Items / Follow-ups */}
        {Array.isArray(actionItems) && actionItems.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Tareas y Acciones Recomendadas
            </span>
            <div className="space-y-1">
              {actionItems.map((act, idx) => (
                <label
                  key={idx}
                  onClick={() => toggleAction(idx)}
                  className="flex items-start gap-2 p-1.5 rounded-lg bg-black/20 hover:bg-white/5 transition-colors cursor-pointer text-[11px]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checkedActions[idx])}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-zinc-600 text-emerald-500 focus:ring-0"
                  />
                  <span className={checkedActions[idx] ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                    {act}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Transcript Accordion */}
        {Array.isArray(turns) && turns.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowTranscript(prev => !prev)}
              className="w-full py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-between transition-colors border border-emerald-500/20"
            >
              <span className="flex items-center gap-1.5">
                <span>📜</span>
                {showTranscript ? 'Ocultar Transcripción' : `Ver Transcripción Completa (${turns.length} turnos)`}
              </span>
              <span>{showTranscript ? '▲' : '▼'}</span>
            </button>

            {showTranscript && (
              <div className="mt-2 p-2.5 rounded-xl bg-black/50 border border-white/5 max-h-56 overflow-y-auto scrollbar-thin space-y-2 animate-fade-in">
                {turns.map((turn, idx) => {
                  const isAi = turn.speaker === 'ai'
                  const isCust = turn.speaker === 'customer'
                  const isAgent = turn.speaker === 'agent'
                  const isSys = turn.speaker === 'system'

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-[11px] space-y-0.5 ${
                        isAi
                          ? 'bg-emerald-950/40 border border-emerald-500/20'
                          : isCust
                          ? 'bg-blue-950/40 border border-blue-500/20'
                          : isAgent
                          ? 'bg-purple-950/40 border border-purple-500/20'
                          : 'bg-zinc-800/40 text-zinc-400 text-[10px]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className={
                          isAi ? 'text-emerald-400' : isCust ? 'text-blue-400' : isAgent ? 'text-purple-400' : 'text-zinc-400'
                        }>
                          {isAi ? '🤖 Chasky Voice (IA)' : isCust ? '👤 Cliente' : isAgent ? '👨‍💼 Asesor Humano' : '⚙️ Sistema'}
                        </span>
                        {turn.time && <span className="text-zinc-500 font-mono text-[9px]">{turn.time}</span>}
                      </div>
                      <p className="text-zinc-200 leading-relaxed font-sans">{turn.text}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info & Download button */}
      <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
        <span>ID: {callId.slice(0, 16)}</span>
        <a
          href={recordingUrl}
          download={`grabacion-${callId}.webm`}
          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>📥</span> Descargar Grabación Audio
        </a>
      </div>
    </div>
  )
}
