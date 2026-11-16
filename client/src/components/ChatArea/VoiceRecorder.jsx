// VoiceRecorder.jsx — Grabación de voz con visualización de ondas en canvas
import React, { useEffect, useRef, useState, useCallback } from 'react'

// ── Iconos inline ─────────────────────────────────────────────────────────────
const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6" />
    <path d="M10,11v6M14,11v6" />
    <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2" />
  </svg>
)
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
)
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
)

// Formatea segundos → mm:ss
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// Calcula waveform (array de 40 valores 0-1) desde AudioBuffer
function computeWaveform(audioBuffer, bars = 40) {
  const raw = audioBuffer.getChannelData(0)
  const step = Math.floor(raw.length / bars)
  const result = []
  for (let i = 0; i < bars; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += Math.abs(raw[i * step + j] || 0)
    result.push(Math.min(1, (sum / step) * 3))
  }
  return result
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function VoiceRecorder({ chatId, onSend, onCancel, senderId, senderName }) {
  const [seconds, setSeconds]       = useState(0)
  const [phase, setPhase]           = useState('recording') // 'recording' | 'preview' | 'sending'
  const [audioUrl, setAudioUrl]     = useState(null)
  const [waveform, setWaveform]     = useState([])
  const [audioBlob, setAudioBlob]   = useState(null)
  const [error, setError]           = useState(null)

  const canvasRef      = useRef(null)
  const mediaRec       = useRef(null)
  const audioCtx       = useRef(null)
  const analyser       = useRef(null)
  const animFrame      = useRef(null)
  const streamRef      = useRef(null)
  const chunksRef      = useRef([])
  const timerRef       = useRef(null)
  const startTime      = useRef(Date.now())

  // ── Dibuja waveform en tiempo real ──────────────────────────────────────────
  const drawLive = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser.current) return

    const ctx   = canvas.getContext('2d')
    const W     = canvas.width
    const H     = canvas.height
    const data  = new Uint8Array(analyser.current.frequencyBinCount)
    analyser.current.getByteFrequencyData(data)

    ctx.clearRect(0, 0, W, H)

    const bars   = 48
    const gap    = 2
    const bw     = (W - gap * (bars - 1)) / bars
    const slice  = Math.floor(data.length / bars)

    for (let i = 0; i < bars; i++) {
      let sum = 0
      for (let j = 0; j < slice; j++) sum += data[i * slice + j]
      const avg     = sum / slice / 255
      const barH    = Math.max(3, avg * H * 0.9)
      const x       = i * (bw + gap)
      const y       = (H - barH) / 2

      // Gradiente verde animado
      const grad = ctx.createLinearGradient(x, y, x, y + barH)
      grad.addColorStop(0,   'rgba(0,168,132,0.9)')
      grad.addColorStop(0.5, 'rgba(0,220,160,1)')
      grad.addColorStop(1,   'rgba(0,168,132,0.9)')
      ctx.fillStyle = grad
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, bw, barH, bw / 2)
      } else {
        const r = bw / 2
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + bw - r, y)
        ctx.arcTo(x + bw, y, x + bw, y + r, r)
        ctx.lineTo(x + bw, y + barH - r)
        ctx.arcTo(x + bw, y + barH, x + bw - r, y + barH, r)
        ctx.lineTo(x + r, y + barH)
        ctx.arcTo(x, y + barH, x, y + barH - r, r)
        ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.closePath()
      }
      ctx.fill()
    }

    animFrame.current = requestAnimationFrame(drawLive)
  }, [])

  // ── Inicia grabación ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream

        // Web Audio API
        audioCtx.current   = new AudioContext()
        analyser.current   = audioCtx.current.createAnalyser()
        analyser.current.fftSize = 256
        const source = audioCtx.current.createMediaStreamSource(stream)
        source.connect(analyser.current)

        // MediaRecorder — preferimos webm/opus, fallback a ogg
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm'

        const rec = new MediaRecorder(stream, { mimeType })
        mediaRec.current = rec
        chunksRef.current = []

        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

        rec.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          setAudioBlob(blob)
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)

          // Calcular waveform estático
          try {
            const arrayBuf = await blob.arrayBuffer()
            const ctx2     = new AudioContext()
            const decoded  = await ctx2.decodeAudioData(arrayBuf)
            setWaveform(computeWaveform(decoded))
            ctx2.close()
          } catch { setWaveform(Array.from({ length: 40 }, () => Math.random() * 0.6 + 0.1)) }

          setPhase('preview')
        }

        rec.start(100) // chunk cada 100ms
        startTime.current = Date.now()

        // Contador de segundos
        timerRef.current = setInterval(() => {
          setSeconds(Math.floor((Date.now() - startTime.current) / 1000))
        }, 500)

        // Canvas animation
        requestAnimationFrame(drawLive)
      } catch (err) {
        setError(err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.'
          : `Error: ${err.message}`)
      }
    }

    start()

    return () => {
      mounted = false
      clearInterval(timerRef.current)
      cancelAnimationFrame(animFrame.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtx.current?.close()
    }
  }, [drawLive])

  // ── Detener grabación ───────────────────────────────────────────────────────
  const stopRecording = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrame.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (mediaRec.current?.state !== 'inactive') mediaRec.current.stop()
  }

  // ── Cancelar ────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    stopRecording()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    onCancel()
  }

  // ── Enviar nota de voz ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!audioBlob || phase !== 'preview') return
    setPhase('sending')

    const form = new FormData()
    const ext  = audioBlob.type.includes('ogg') ? '.ogg' : '.webm'
    form.append('audio',      audioBlob, `voice${ext}`)
    form.append('chatId',     chatId)
    form.append('senderId',   senderId || 'agent-me')
    form.append('senderName', senderName || 'Yo')
    form.append('duration',   String(seconds))
    form.append('waveform',   JSON.stringify(waveform))

    try {
      const res  = await fetch('/api/voice', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const msg  = await res.json()
      URL.revokeObjectURL(audioUrl)
      onSend(msg)
    } catch (e) {
      setError(`Error al enviar: ${e.message}`)
      setPhase('preview')
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-wa-input rounded-xl mx-3 mb-2">
        <span className="text-red-400 text-sm flex-1">{error}</span>
        <button onClick={onCancel} className="text-wa-secondary hover:text-wa-text text-xs underline">Cerrar</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
      {/* Barra de grabación / preview */}
      <div className="flex items-center gap-3 bg-wa-header rounded-2xl px-4 py-3 shadow-lg">
        {/* Indicador mic o estado */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          phase === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-wa-green'
        }`}>
          {phase === 'sending'
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <MicIcon />
          }
        </div>

        {/* Contador */}
        <span className={`text-sm font-mono font-semibold flex-shrink-0 w-12 ${
          phase === 'recording' ? 'text-red-400' : 'text-wa-green'
        }`}>
          {fmtTime(seconds)}
        </span>

        {/* Canvas o waveform estático */}
        <div className="flex-1 h-10 relative overflow-hidden">
          {phase === 'recording' ? (
            <canvas
              ref={canvasRef}
              width={300}
              height={40}
              className="w-full h-full"
            />
          ) : (
            /* Waveform estático (preview / sending) */
            <StaticWaveform bars={waveform} />
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2">
        {/* Cancelar */}
        <button
          onClick={handleCancel}
          disabled={phase === 'sending'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-wa-header hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <TrashIcon />
          <span>Cancelar</span>
        </button>

        <div className="flex-1" />

        {/* Detener / Enviar */}
        {phase === 'recording' ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-wa-green hover:bg-green-500 text-white transition-colors text-sm font-semibold shadow-md"
          >
            <StopIcon />
            <span>Detener</span>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={phase === 'sending'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-wa-green hover:bg-green-500 text-white transition-colors text-sm font-semibold shadow-md disabled:opacity-60"
          >
            {phase === 'sending'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <SendIcon />
            }
            <span>{phase === 'sending' ? 'Enviando…' : 'Enviar'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Waveform estático ─────────────────────────────────────────────────────────
function StaticWaveform({ bars }) {
  const data = bars.length > 0
    ? bars
    : Array.from({ length: 40 }, (_, i) => 0.2 + 0.5 * Math.sin(i * 0.4) * Math.sin(i * 0.15))

  return (
    <div className="flex items-center gap-px h-full w-full">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-full bg-wa-green opacity-80"
          style={{ height: `${Math.max(15, v * 100)}%` }}
        />
      ))}
    </div>
  )
}
