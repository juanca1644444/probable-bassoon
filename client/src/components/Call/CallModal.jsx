// CallModal.jsx — Llamadas y Videollamadas WebRTC P2P Reales para CHASKYAPP
import React, { useState, useEffect, useRef, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials } from '../../utils/formatters'

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Ripple de audio pulsante ────────────────────────────────────────────────
function AudioRipple({ active }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {active && [1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-emerald-400 opacity-0"
          style={{
            width: `${130 + i * 50}px`,
            height: `${130 + i * 50}px`,
            animation: `ripple 2s ease-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Botón de Control ────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, title, children, large }) {
  const base = large ? 'w-16 h-16' : 'w-12 h-12'
  const color = danger
    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 shadow-lg'
    : active
    ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-900/40 shadow-md'
    : 'bg-white/15 text-white hover:bg-white/25 border border-white/10'
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${base} rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${color}`}
    >
      {children}
    </button>
  )
}

// ── Configuración WebRTC STUN ───────────────────────────────────────────────
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' }
  ]
}

export default function CallModal() {
  const { activeCall, endCall, activeChat } = useAppStore()
  const ws = useAppStore(s => s.ws)

  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(activeCall?.type === 'video')
  const [screenSharing, setScreenSharing] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [mediaWarning, setMediaWarning] = useState('')
  const [connectionQuality, setConnectionQuality] = useState('conectando')

  const timerRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const pcRef = useRef(null)
  const iceQueueRef = useRef([])
  const isInitiatorRef = useRef(!activeCall?.isIncoming)
  const offerSentRef = useRef(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)

  const chat = activeCall?.chat || activeChat
  const name = chat?.groupName || chat?.contactName || 'Contacto'
  const avatar = chat?.groupAvatar || chat?.contactAvatar || ''
  const callType = activeCall?.type || 'voice'
  const status = activeCall?.status || 'connected'

  // Timer para duración de la llamada
  useEffect(() => {
    if (status !== 'connected') return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [status])

  // Limpiar y colgar llamada
  const handleEndCall = useCallback(() => {
    clearInterval(timerRef.current)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch {}
    }
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'END_CALL', callId: activeCall?.callId }))
    }
    endCall()
  }, [ws, activeCall, endCall])

  // Manejar tecla Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleEndCall() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleEndCall])

  // ── Inicialización WebRTC PeerConnection & Media ───────────────────────────
  useEffect(() => {
    if (!activeCall) return
    let isCancelled = false

    const initWebRTC = async () => {
      try {
        const wantsVideo = callType === 'video' || cameraOn
        let stream = null

        // 1. Obtener stream local (Micrófono y Cámara si es video)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: wantsVideo
              ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
              : false
          })
        } catch (mediaErr) {
          console.warn('[WebRTC] Falló getUserMedia con video, intentando solo audio:', mediaErr)
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            setMediaWarning('Cámara no disponible. Llamada activa solo en audio.')
          } catch (audioErr) {
            console.error('[WebRTC] Permisos de micrófono denegados:', audioErr)
            setMediaWarning('Permiso de micrófono denegado. No se podrá transmitir audio.')
          }
        }

        if (isCancelled) {
          if (stream) stream.getTracks().forEach(t => t.stop())
          return
        }

        localStreamRef.current = stream

        // Conectar stream a video local
        if (localVideoRef.current && stream && wantsVideo) {
          localVideoRef.current.srcObject = stream
        }

        // Crear analizador de voz para efecto visual de habla
        if (stream && stream.getAudioTracks().length > 0) {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            if (AudioContext) {
              const ctx = new AudioContext()
              audioContextRef.current = ctx
              const src = ctx.createMediaStreamSource(stream)
              const analyser = ctx.createAnalyser()
              analyser.fftSize = 64
              src.connect(analyser)
              analyserRef.current = analyser

              const checkAudioLevel = () => {
                if (!analyserRef.current || isCancelled) return
                const data = new Uint8Array(analyserRef.current.frequencyBinCount)
                analyserRef.current.getByteFrequencyData(data)
                let sum = 0
                for (let i = 0; i < data.length; i++) sum += data[i]
                const avg = sum / data.length
                setIsSpeaking(avg > 15 && !muted)
                requestAnimationFrame(checkAudioLevel)
              }
              checkAudioLevel()
            }
          } catch (e) {
            console.warn('[WebRTC] No se pudo inicializar analizador de audio:', e)
          }
        }

        // 2. Crear RTCPeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc

        // Añadir tracks locales a la conexión
        if (stream) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream)
          })
        }

        // 3. Manejo de Tracks Remotos
        pc.ontrack = (event) => {
          console.log('[WebRTC] 📡 Track remoto recibido:', event.track.kind)
          const remoteStream = event.streams[0]
          remoteStreamRef.current = remoteStream

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream
            remoteVideoRef.current.play().catch(() => {})
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream
            remoteAudioRef.current.play().catch(() => {})
          }
          if (event.track.kind === 'video') {
            setHasRemoteVideo(true)
          }
          setConnectionQuality('excelente')
        }

        // 4. Generación de ICE Candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WEBRTC_ICE_CANDIDATE',
              callId: activeCall.callId,
              candidate: event.candidate
            }))
          }
        }

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Estado de conexión:', pc.connectionState)
          if (pc.connectionState === 'connected') {
            setConnectionQuality('excelente')
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionQuality('reconectando')
          }
        }

        // 5. Si somos el llamador (Iniciador), crear y enviar la Oferta SDP
        if (isInitiatorRef.current && !offerSentRef.current) {
          offerSentRef.current = true
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          })
          await pc.setLocalDescription(offer)
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WEBRTC_OFFER',
              callId: activeCall.callId,
              offer
            }))
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error inicializando WebRTC:', err)
        setMediaWarning('Error de conexión WebRTC: ' + err.message)
      }
    }

    initWebRTC()

    return () => {
      isCancelled = true
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
        localStreamRef.current = null
      }
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
    }
  }, [activeCall?.callId, callType])

  // ── Listener de Señalización WebRTC (Offer, Answer, Candidates) ───────────
  useEffect(() => {
    const handleSignal = async (e) => {
      const data = e.detail
      if (!data || data.callId !== activeCall?.callId) return
      const pc = pcRef.current

      try {
        if (data.type === 'WEBRTC_OFFER' && !isInitiatorRef.current && pc) {
          // El receptor recibe la oferta del llamador
          console.log('[WebRTC] 📩 Recibida WEBRTC_OFFER')
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer))

          // Vaciar cola de candidatos pendientes
          while (iceQueueRef.current.length > 0) {
            const cand = iceQueueRef.current.shift()
            await pc.addIceCandidate(new RTCIceCandidate(cand))
          }

          // Generar y enviar Answer
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WEBRTC_ANSWER',
              callId: activeCall.callId,
              answer
            }))
          }
        } else if (data.type === 'WEBRTC_ANSWER' && isInitiatorRef.current && pc) {
          // El llamador recibe la respuesta del receptor
          console.log('[WebRTC] 📩 Recibida WEBRTC_ANSWER')
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer))

          // Vaciar cola de candidatos pendientes
          while (iceQueueRef.current.length > 0) {
            const cand = iceQueueRef.current.shift()
            await pc.addIceCandidate(new RTCIceCandidate(cand))
          }
        } else if (data.type === 'WEBRTC_ICE_CANDIDATE' && data.candidate && pc) {
          // Candidato de red ICE
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } else {
            iceQueueRef.current.push(data.candidate)
          }
        } else if (data.type === 'ACCEPT_CALL' && isInitiatorRef.current) {
          // Si el receptor aceptó y la oferta aún no se había procesado
          if (pc && pc.localDescription && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WEBRTC_OFFER',
              callId: activeCall.callId,
              offer: pc.localDescription
            }))
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error procesando señal WebRTC:', err)
      }
    }

    window.addEventListener('webrtc_signal', handleSignal)
    return () => window.removeEventListener('webrtc_signal', handleSignal)
  }, [activeCall?.callId, ws])

  // ── Controles de Hardware: Micrófono, Cámara, Altavoz, Pantalla ───────────

  // Silenciar / Activar Micrófono
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = muted
      })
      setMuted(!muted)
    }
  }

  // Activar / Apagar Cámara
  const toggleCamera = async () => {
    const pc = pcRef.current
    if (!localStreamRef.current) return

    const videoTrack = localStreamRef.current.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !cameraOn
      setCameraOn(!cameraOn)
    } else if (!cameraOn) {
      // Si la llamada inició en audio, adquirir track de video y añadir a peer connection
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        })
        const newTrack = vStream.getVideoTracks()[0]
        localStreamRef.current.addTrack(newTrack)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current
        }
        if (pc) {
          pc.addTrack(newTrack, localStreamRef.current)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WEBRTC_OFFER',
              callId: activeCall.callId,
              offer
            }))
          }
        }
        setCameraOn(true)
      } catch (e) {
        console.warn('No se pudo activar la cámara:', e)
        setMediaWarning('No se pudo encender la cámara.')
      }
    }
  }

  // Compartir Pantalla
  const toggleScreenShare = async () => {
    const pc = pcRef.current
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const screenTrack = screenStream.getVideoTracks()[0]
        const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video')
        if (sender) {
          sender.replaceTrack(screenTrack)
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }
        screenTrack.onended = () => {
          const originalVideo = localStreamRef.current?.getVideoTracks()[0]
          if (sender && originalVideo) sender.replaceTrack(originalVideo)
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
          setScreenSharing(false)
        }
        setScreenSharing(true)
      } catch (err) {
        console.warn('Screen share cancelado:', err)
      }
    } else {
      const originalVideo = localStreamRef.current?.getVideoTracks()[0]
      const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video')
      if (sender && originalVideo) sender.replaceTrack(originalVideo)
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
      setScreenSharing(false)
    }
  }

  // Altavoz
  const toggleSpeaker = () => {
    const next = !speakerOn
    setSpeakerOn(next)
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !next
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next
  }

  if (!activeCall) return null

  const isVideoMode = callType === 'video' || cameraOn || hasRemoteVideo

  // ── Vista Minimizada (Pill flotante) ──────────────────────────────────────
  if (minimized) {
    return (
      <div
        className="fixed bottom-24 right-6 z-50 bg-emerald-600 rounded-2xl shadow-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-emerald-500 transition-colors animate-fade-in border border-white/20"
        onClick={() => setMinimized(false)}
      >
        {/* Audio remoto oculto pero reproduciendo */}
        <audio ref={remoteAudioRef} autoPlay playsInline />
        {avatar ? (
          <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-10 h-10 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {getInitials(name)}
          </div>
        )}
        <div>
          <p className="text-white text-sm font-bold truncate max-w-[120px]">{name}</p>
          <p className="text-white/80 text-xs">{formatDuration(elapsed)} · {isVideoMode ? 'Video' : 'Audio'}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleEndCall() }}
          className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors ml-2 shadow"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
      </div>
    )
  }

  // ── Interfaz de Llamada de Voz ────────────────────────────────────────────
  if (!isVideoMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Audio remoto en reproducción directa */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Fondo con desenfoque elegante */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#07171d] via-[#0b2027] to-[#071318] opacity-98" />

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6 select-none animate-fade-in">
          {/* Barra superior */}
          <div className="w-full flex justify-between items-center mb-2">
            <span className="text-white/80 text-xs font-semibold flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Llamada de Voz Privada CHASKY
            </span>
            <button
              onClick={() => setMinimized(true)}
              className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Minimizar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/>
              </svg>
            </button>
          </div>

          {/* Banner de aviso/permisos */}
          {mediaWarning && (
            <div className="w-full px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs text-center font-medium">
              ⚠️ {mediaWarning}
            </div>
          )}

          {/* Avatar con ondas de sonido en tiempo real */}
          <div className="relative flex items-center justify-center w-52 h-52">
            <AudioRipple active={status === 'connected' && (isSpeaking || !muted)} />
            <div className="relative z-10">
              {avatar ? (
                <img src={avatar} alt={name} className="w-36 h-36 rounded-full object-cover ring-4 ring-emerald-500/50 shadow-2xl" />
              ) : (
                <div className={`w-36 h-36 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-5xl font-bold ring-4 ring-emerald-500/50 shadow-2xl`}>
                  {getInitials(name)}
                </div>
              )}
            </div>
          </div>

          {/* Nombre y Estado de Conexión */}
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold tracking-tight">{name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span className="text-emerald-400 text-sm font-semibold">
                {status === 'ringing' && '📳 Timbrando...'}
                {status === 'connecting' && '⏳ Estableciendo canal P2P...'}
                {status === 'connected' && formatDuration(elapsed)}
              </span>
              <span className="text-white/40 text-xs">• WebRTC Cifrado</span>
            </div>
            {muted && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                🎙️ Micrófono silenciado
              </span>
            )}
          </div>

          {/* Botonera de Controles */}
          <div className="flex items-center justify-center gap-6 mt-3 w-full">
            {/* Mute */}
            <div className="flex flex-col items-center gap-1.5">
              <CtrlBtn onClick={toggleMute} active={muted} title={muted ? 'Activar micrófono' : 'Silenciar micrófono'}>
                {muted ? (
                  <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </CtrlBtn>
              <span className="text-white/60 text-xs font-medium">{muted ? 'Reactivar' : 'Silenciar'}</span>
            </div>

            {/* Colgar */}
            <div className="flex flex-col items-center gap-1.5">
              <CtrlBtn onClick={handleEndCall} danger large title="Finalizar llamada">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </CtrlBtn>
              <span className="text-white/60 text-xs font-medium">Colgar</span>
            </div>

            {/* Altavoz */}
            <div className="flex flex-col items-center gap-1.5">
              <CtrlBtn onClick={toggleSpeaker} active={!speakerOn} title={speakerOn ? 'Altavoz activado' : 'Altavoz silenciado'}>
                {speakerOn ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                )}
              </CtrlBtn>
              <span className="text-white/60 text-xs font-medium">{speakerOn ? 'Altavoz' : 'Silencio'}</span>
            </div>
          </div>

          {/* Botón para cambiar a videollamada */}
          <button
            onClick={() => {
              useAppStore.getState().upgradeToVideo()
              toggleCamera()
            }}
            className="mt-2 flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-xs font-bold px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            Activar Cámara / Videollamada
          </button>
        </div>
      </div>
    )
  }

  // ── Interfaz de Videollamada en Pantalla Completa ─────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black animate-fade-in select-none">
      {/* Audio remoto */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Área Principal de Video Remoto */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-950 overflow-hidden">
        {/* Video Remoto Real */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Fallback de Avatar si el interlocutor aún no transmite cámara */}
        {!hasRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0c1f28] to-gray-950">
            {avatar ? (
              <img src={avatar} alt={name} className="w-32 h-32 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-2xl" />
            ) : (
              <div className={`w-32 h-32 rounded-full ${getAvatarGradient(name)} flex items-center justify-center text-white text-5xl font-bold ring-4 ring-emerald-500/30 shadow-2xl`}>
                {getInitials(name)}
              </div>
            )}
            <div className="text-center">
              <p className="text-white font-bold text-xl">{name}</p>
              <p className="text-white/60 text-xs mt-1">Conectando canal de video HD...</p>
            </div>
          </div>
        )}

        {/* Cámara Local PiP (Picture in Picture) */}
        <div className="absolute bottom-6 right-6 w-36 h-48 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/50 bg-gray-900 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 transition-opacity ${cameraOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white/50 text-xs p-2 text-center">
              <svg className="w-8 h-8 mb-1 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 1.5L2.1 3.3 4.8 6H3a1 1 0 00-1 1v10a1 1 0 001 1h13.2l2.7 2.7 1.8-1.8L3.9 1.5zM21 6.5l-4 4V7a1 1 0 00-1-1H7.8l9 9L21 11.5a1 1 0 00-.6-.9L17 8.4V7a1 1 0 001-1V1l-5 5h3.5L21 6.5z"/>
              </svg>
              <span>Cámara apagada</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
            Tú {muted ? '(Mute)' : ''}
          </span>
        </div>

        {/* Cabecera superior con estado y botón minimizar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-white font-bold text-lg leading-tight">{name}</p>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs font-semibold">
                  {status === 'ringing' ? '📳 Llamando...' : status === 'connecting' ? '⏳ Conectando...' : formatDuration(elapsed)}
                </span>
                <span className="text-white/40 text-[11px]">• CHASKY WebRTC P2P</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Minimizar llamada"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/>
            </svg>
          </button>
        </div>

        {/* Banner de aviso */}
        {mediaWarning && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-500/90 text-black font-bold text-xs rounded-full shadow-lg z-20 animate-fade-in">
            ⚠️ {mediaWarning}
          </div>
        )}
      </div>

      {/* Barra de Controles Inferior */}
      <div className="bg-gray-950 border-t border-white/10 px-6 py-4 flex items-center justify-center gap-4 sm:gap-6 z-20">
        {/* Micrófono */}
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={toggleMute} active={muted} title={muted ? 'Activar micrófono' : 'Silenciar micrófono'}>
            {muted ? (
              <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </CtrlBtn>
          <span className="text-white/50 text-[11px] font-medium">{muted ? 'Reactivar' : 'Micrófono'}</span>
        </div>

        {/* Cámara */}
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={toggleCamera} active={!cameraOn} title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}>
            {cameraOn ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 1.5L2.1 3.3 4.8 6H3a1 1 0 00-1 1v10a1 1 0 001 1h13.2l2.7 2.7 1.8-1.8L3.9 1.5zM21 6.5l-4 4V7a1 1 0 00-1-1H7.8l9 9L21 11.5a1 1 0 00-.6-.9L17 8.4V7a1 1 0 001-1V1l-5 5h3.5L21 6.5z"/>
              </svg>
            )}
          </CtrlBtn>
          <span className="text-white/50 text-[11px] font-medium">{cameraOn ? 'Cámara' : 'Sin cámara'}</span>
        </div>

        {/* Compartir Pantalla */}
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={toggleScreenShare} active={screenSharing} title="Compartir pantalla">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.5.69-4.54 4.5-5.53V8l3 3-2.5 3.47z"/>
            </svg>
          </CtrlBtn>
          <span className="text-white/50 text-[11px] font-medium">{screenSharing ? 'Compartiendo' : 'Pantalla'}</span>
        </div>

        {/* Altavoz */}
        <div className="flex flex-col items-center gap-1">
          <CtrlBtn onClick={toggleSpeaker} active={!speakerOn} title={speakerOn ? 'Altavoz activado' : 'Altavoz silenciado'}>
            {speakerOn ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            )}
          </CtrlBtn>
          <span className="text-white/50 text-[11px] font-medium">{speakerOn ? 'Altavoz' : 'Silencio'}</span>
        </div>

        {/* Colgar (Rojo Grande) */}
        <div className="flex flex-col items-center gap-1 ml-2">
          <CtrlBtn onClick={handleEndCall} danger large title="Finalizar llamada">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </CtrlBtn>
          <span className="text-rose-400 text-[11px] font-bold">Colgar</span>
        </div>
      </div>
    </div>
  )
}
