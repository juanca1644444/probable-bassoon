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

// ── Configuración WebRTC STUN de Alta Velocidad (Google Global Relay) ────
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10
}

// Helpers para distinguir cámaras físicas reales de controladores virtuales (ej. DroidCam, OBS)
const isVirtualCam = (label) => /droidcam|virtual|obs|manycam|vcam|fake/i.test(label || '')
const isPhysicalCam = (label) => /hd|webcam|integrated|realtek|camera|cámara|usb/i.test(label || '')

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
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [videoFit, setVideoFit] = useState('contain') // 'contain' (sin zoom ni recorte / encuadre completo) o 'cover'

  // Cámaras disponibles y cámara activa
  const [videoDevices, setVideoDevices] = useState([])
  const [currentCameraId, setCurrentCameraId] = useState('')
  const [currentCameraLabel, setCurrentCameraLabel] = useState('')

  const timerRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const pcRef = useRef(null)
  const iceQueueRef = useRef([])
  const isInitiatorRef = useRef(!activeCall?.isIncoming)
  const offerSentRef = useRef(false)
  const pendingOfferRef = useRef(null)
  const localIceCandidatesRef = useRef([])
  const pendingAcceptRef = useRef(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)

  // Sincronizar estado cuando se inicia o recibe llamada
  useEffect(() => {
    if (activeCall) {
      isInitiatorRef.current = !activeCall.isIncoming
      setCameraOn(activeCall.type === 'video')
      setHasRemoteVideo(false)
      setElapsed(0)
      setMuted(false)
      setAudioBlocked(false)
      setMediaWarning('')
      offerSentRef.current = false
      iceQueueRef.current = []
      localIceCandidatesRef.current = []
      pendingAcceptRef.current = false
    }
  }, [activeCall?.callId, activeCall?.type, activeCall?.isIncoming])

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
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch {}
    }
    if (window.__webrtcAudioCtx) {
      try { window.__webrtcAudioCtx.close() } catch {}
      window.__webrtcAudioCtx = null
    }
    remoteStreamRef.current = null
    offerSentRef.current = false
    pendingOfferRef.current = null
    iceQueueRef.current = []
    localIceCandidatesRef.current = []

    endCall()
  }, [endCall])

  // Manejar tecla Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleEndCall() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleEndCall])

  // Callback refs para asegurar que los elementos <video> y <audio> se vinculen inmediatamente
  const setLocalVideoRef = useCallback((el) => {
    localVideoRef.current = el
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current
      el.play().catch(() => {})
    }
  }, [])

  const setRemoteVideoRef = useCallback((el) => {
    remoteVideoRef.current = el
    if (el) {
      el.muted = true
      if (remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
        el.srcObject = new MediaStream(remoteStreamRef.current.getVideoTracks())
        el.play().catch(() => {})
      }
    }
  }, [])

  const setRemoteAudioRef = useCallback((el) => {
    remoteAudioRef.current = el
    if (el) {
      el.muted = false
      el.volume = 1.0
      if (remoteStreamRef.current && remoteStreamRef.current.getAudioTracks().length > 0) {
        el.srcObject = new MediaStream(remoteStreamRef.current.getAudioTracks())
        el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
      }
    }
  }, [])

  // Enviar oferta SDP (solo cuando el canal está listo)
  const sendOffer = useCallback(async (pc) => {
    if (!pc || offerSentRef.current) return
    try {
      offerSentRef.current = true
      console.log('[WebRTC] 🚀 Creando y enviando Oferta SDP a receptor...')
      if (pc.getTransceivers) {
        pc.getTransceivers().forEach(tr => {
          if (tr.receiver.track.kind === 'audio') {
            const hasAudio = localStreamRef.current?.getAudioTracks().length > 0
            tr.direction = hasAudio ? 'sendrecv' : 'recvonly'
          }
          if (tr.receiver.track.kind === 'video') {
            const hasVideo = localStreamRef.current?.getVideoTracks().length > 0
            tr.direction = hasVideo ? 'sendrecv' : 'recvonly'
          }
        })
      }
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await pc.setLocalDescription(offer)
      const liveWs = useAppStore.getState().ws || ws
      const liveCallId = activeCall?.callId || useAppStore.getState().activeCall?.callId
      if (liveWs?.readyState === WebSocket.OPEN && liveCallId) {
        liveWs.send(JSON.stringify({
          type: 'WEBRTC_OFFER',
          callId: liveCallId,
          offer,
        }))
        // Despachar candidatos ICE acumulados
        localIceCandidatesRef.current.forEach((cand) => {
          liveWs.send(JSON.stringify({
            type: 'WEBRTC_ICE_CANDIDATE',
            callId: liveCallId,
            candidate: cand,
          }))
        })
      }
    } catch (err) {
      console.error('[WebRTC] Error creando oferta SDP:', err)
    }
  }, [ws, activeCall?.callId])

  // Manejar oferta SDP remota
  const handleOfferSDP = useCallback(async (pc, offer) => {
    try {
      console.log('[WebRTC] 📩 Aplicando setRemoteDescription de Oferta remota')
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Vaciar cola de candidatos pendientes
      while (iceQueueRef.current.length > 0) {
        const cand = iceQueueRef.current.shift()
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch (iceErr) {
          console.warn('[WebRTC] Candidato en cola ignorado:', iceErr)
        }
      }

      if (pc.getTransceivers) {
        pc.getTransceivers().forEach(tr => {
          if (tr.receiver.track.kind === 'audio') {
            const hasAudio = localStreamRef.current?.getAudioTracks().length > 0
            tr.direction = hasAudio ? 'sendrecv' : 'recvonly'
          }
          if (tr.receiver.track.kind === 'video') {
            const hasVideo = localStreamRef.current?.getVideoTracks().length > 0
            tr.direction = hasVideo ? 'sendrecv' : 'recvonly'
          }
        })
      }

      // Generar y enviar Answer
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await pc.setLocalDescription(answer)
      console.log('[WebRTC] 📤 Enviando WEBRTC_ANSWER')
      const liveWs = useAppStore.getState().ws || ws
      const liveCallId = activeCall?.callId || useAppStore.getState().activeCall?.callId
      if (liveWs?.readyState === WebSocket.OPEN && liveCallId) {
        liveWs.send(JSON.stringify({
          type: 'WEBRTC_ANSWER',
          callId: liveCallId,
          answer,
        }))
        // Despachar candidatos locales acumulados
        localIceCandidatesRef.current.forEach((cand) => {
          liveWs.send(JSON.stringify({
            type: 'WEBRTC_ICE_CANDIDATE',
            callId: liveCallId,
            candidate: cand,
          }))
        })
      }
    } catch (err) {
      console.error('[WebRTC] Error en handleOfferSDP:', err)
    }
  }, [ws, activeCall?.callId])

  // ── Inicialización WebRTC PeerConnection & Media ───────────────────────────
  useEffect(() => {
    if (!activeCall) return
    let isCancelled = false

    const initWebRTC = async () => {
      try {
        const wantsVideo = callType === 'video' || cameraOn
        let stream = null

        // Priorizar cámaras físicas sobre controladores virtuales (DroidCam, OBS, etc.)
        let preferredCameraId = null
        try {
          if (navigator.mediaDevices?.enumerateDevices) {
            const initialDevs = await navigator.mediaDevices.enumerateDevices()
            const vDevs = initialDevs.filter(d => d.kind === 'videoinput')
            if (vDevs.length > 0) setVideoDevices(vDevs)
            const physical = vDevs.find(d => d.label && !isVirtualCam(d.label))
            if (physical) {
              preferredCameraId = physical.deviceId
              console.log('[WebRTC] 🎯 Cámara física detectada previamente:', physical.label)
            }
          }
        } catch (devInitErr) {
          console.warn('[WebRTC] Error enumerando dispositivos previos:', devInitErr)
        }

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
        const preferredVideoConstraint = preferredCameraId
          ? { deviceId: { exact: preferredCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : isMobile
            ? { facingMode: { ideal: 'user' }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
            : { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }

        // 1. Obtención universal de hardware (Micrófono y Cámara en PC / Móvil)
        if (wantsVideo) {
          try {
            // Intento 1: Audio + Video prioritario (física si está disponible)
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: preferredVideoConstraint
            })
          } catch (e1) {
            console.warn('[WebRTC] Intento 1 audio+video prioritario falló:', e1)
            try {
              // Intento 2: Audio + Video genérico para PC / Webcams USB
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: preferredCameraId ? { deviceId: preferredCameraId } : true
              })
            } catch (e2) {
              console.warn('[WebRTC] Intento 2 audio+video estándar falló:', e2)
              // Intento 3: Solo video si el PC carece de micrófono o fue denegado
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: preferredCameraId ? { deviceId: preferredCameraId } : true
                })
                setMediaWarning('Micrófono no detectado en PC. Transmitiendo solo video.')
              } catch (e3) {
                // Intento 4: Solo audio si el PC carece de cámara o fue denegada
                try {
                  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                  setMediaWarning('Cámara no detectada en PC. Transmitiendo solo audio.')
                } catch (e4) {
                  console.warn('[WebRTC] Sin dispositivos locales de captura:', e4)
                  stream = new MediaStream()
                  setMediaWarning('Sin cámara ni micrófono. Conectado en modo recepción.')
                }
              }
            }
          }

          // Verificación post-adquisición: si se abrió una cámara virtual (DroidCam) y existe una física (HD WebCam)
          try {
            if (navigator.mediaDevices?.enumerateDevices && stream.getVideoTracks().length > 0) {
              const allDevs = await navigator.mediaDevices.enumerateDevices()
              const vInputs = allDevs.filter(d => d.kind === 'videoinput')
              setVideoDevices(vInputs)

              const activeTrack = stream.getVideoTracks()[0]
              const activeLabel = activeTrack.label || ''
              setCurrentCameraLabel(activeLabel)
              const activeSettings = activeTrack.getSettings ? activeTrack.getSettings() : {}
              setCurrentCameraId(activeSettings.deviceId || '')

              // Si la cámara abierta es virtual (DroidCam) pero tenemos una física disponible:
              if (isVirtualCam(activeLabel)) {
                const physical = vInputs.find(d => !isVirtualCam(d.label))
                if (physical && physical.deviceId !== activeSettings.deviceId) {
                  console.log('[WebRTC] 🔄 Cambiando automáticamente de DroidCam a cámara física:', physical.label)
                  try {
                    const physicalStream = await navigator.mediaDevices.getUserMedia({
                      video: { deviceId: { exact: physical.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                    })
                    const physTrack = physicalStream.getVideoTracks()[0]
                    if (physTrack) {
                      activeTrack.stop()
                      stream.removeTrack(activeTrack)
                      stream.addTrack(physTrack)
                      setCurrentCameraId(physical.deviceId)
                      setCurrentCameraLabel(physTrack.label || physical.label)
                      console.log('[WebRTC] ✅ Cámara física conectada exitosamente:', physTrack.label)
                    }
                  } catch (pErr) {
                    console.warn('[WebRTC] No se pudo cambiar a cámara física automáticamente:', pErr)
                  }
                }
              }
            }
          } catch (enumErr) {
            console.warn('[WebRTC] Error en verificación post-adquisición:', enumErr)
          }
        } else {
          // Modo voz: solo audio
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            })
          } catch (aErr1) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch (aErr2) {
              console.warn('[WebRTC] Micrófono no detectado en llamada de voz:', aErr2)
              stream = new MediaStream()
              setMediaWarning('Micrófono no detectado en PC. Conectado en modo recepción de audio.')
            }
          }
        }

        if (isCancelled) {
          if (stream) stream.getTracks().forEach(t => t.stop())
          return
        }

        localStreamRef.current = stream

        const hasVideo = stream.getVideoTracks().length > 0
        setCameraOn(hasVideo)

        // Conectar stream a video local PiP
        if (localVideoRef.current && hasVideo) {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.play().catch(() => {})
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

        // 2. Crear RTCPeerConnection con STUN Google de alta velocidad
        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc

        // Añadir tracks locales a la conexión
        const localTracks = stream ? stream.getTracks() : []
        localTracks.forEach(track => {
          pc.addTrack(track, stream)
        })

        // Asegurar transceivers para recepción si falta algún tipo de medio local
        const hasLocalAudio = localTracks.some(t => t.kind === 'audio')
        const hasLocalVideo = localTracks.some(t => t.kind === 'video')
        try {
          if (!hasLocalAudio) {
            pc.addTransceiver('audio', { direction: 'recvonly' })
          }
          if (wantsVideo && !hasLocalVideo) {
            pc.addTransceiver('video', { direction: 'recvonly' })
          }
        } catch (trErr) {
          console.warn('[WebRTC] addTransceiver fallback:', trErr)
        }

        // 3. Manejo de Tracks Remotos con asignación directa garantizada (audio + video)
        pc.ontrack = (event) => {
          console.log('[WebRTC] 📡 Track remoto recibido:', event.track.kind, event.track.id)

          // Acumular pistas en remoteStreamRef
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream()
          }
          if (!remoteStreamRef.current.getTracks().some(t => t.id === event.track.id)) {
            remoteStreamRef.current.addTrack(event.track)
          }

          // A) Track de Audio Remoto -> Enrutamiento directo a <audio> y Web Audio API
          if (event.track.kind === 'audio') {
            event.track.enabled = true
            const directAudioStream = new MediaStream([event.track])

            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = directAudioStream
              remoteAudioRef.current.muted = false
              remoteAudioRef.current.volume = 1.0
              const playPromise = remoteAudioRef.current.play()
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  console.log('[WebRTC] 🔊 Audio remoto reproduciéndose con éxito vía <audio>')
                  setAudioBlocked(false)
                }).catch(err => {
                  console.warn('[WebRTC] Autoplay de audio diferido por navegador:', err)
                  setAudioBlocked(true)
                })
              }
            }

            // Puente directo con Web Audio API hacia altavoces del sistema (garantía de sonido en PC)
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext
              if (AudioCtx) {
                if (!window.__webrtcAudioCtx || window.__webrtcAudioCtx.state === 'closed') {
                  window.__webrtcAudioCtx = new AudioCtx()
                }
                const actx = window.__webrtcAudioCtx
                if (actx.state === 'suspended') {
                  actx.resume().catch(() => {})
                }
                const source = actx.createMediaStreamSource(directAudioStream)
                source.connect(actx.destination)
                console.log('[WebRTC] 🚀 Puente Web Audio conectado directamente a los altavoces de la PC')
              }
            } catch (actxErr) {
              console.warn('[WebRTC] WebAudio bridge error:', actxErr)
            }
          }

          // B) Track de Video Remoto
          if (event.track.kind === 'video') {
            const directVideoStream = new MediaStream([event.track])
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = directVideoStream
              remoteVideoRef.current.play().catch(e => console.warn('[WebRTC] Video autoPlay diferido:', e))
            }
            setHasRemoteVideo(true)
          }

          setConnectionQuality('excelente')
        }

        // 4. Generación y manejo de ICE Candidates con WebSocket en vivo
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            localIceCandidatesRef.current.push(event.candidate)
            const liveWs = useAppStore.getState().ws || ws
            const liveCallId = activeCall?.callId || useAppStore.getState().activeCall?.callId
            if (liveWs?.readyState === WebSocket.OPEN && liveCallId && (offerSentRef.current || !isInitiatorRef.current)) {
              liveWs.send(JSON.stringify({
                type: 'WEBRTC_ICE_CANDIDATE',
                callId: liveCallId,
                candidate: event.candidate,
              }))
            }
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

        // 5. Si había una oferta SDP en cola esperando inicialización de hardware, procesarla
        if (pendingOfferRef.current && !isInitiatorRef.current) {
          const queuedOffer = pendingOfferRef.current
          pendingOfferRef.current = null
          console.log('[WebRTC] ⚡ Procesando WEBRTC_OFFER que aguardaba en cola')
          await handleOfferSDP(pc, queuedOffer)
        }

        // 6. Si somos el llamador y la llamada ya fue aceptada, enviar oferta
        const currentCallStatus = useAppStore.getState().activeCall?.status
        if (isInitiatorRef.current && (currentCallStatus === 'connected' || pendingAcceptRef.current) && !offerSentRef.current) {
          pendingAcceptRef.current = false
          await sendOffer(pc)
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
        try { pcRef.current.close() } catch {}
        pcRef.current = null
      }
    }
  }, [activeCall?.callId, callType])

  // ── Listener de Señalización WebRTC (Offer, Answer, Candidates, Accept) ───
  useEffect(() => {
    const handleSignal = async (e) => {
      const data = e.detail
      const currentCallId = activeCall?.callId || useAppStore.getState().incomingCall?.callId
      if (!data || (data.callId && data.callId !== currentCallId)) return
      const pc = pcRef.current

      try {
        if (data.type === 'WEBRTC_OFFER' && !isInitiatorRef.current) {
          if (pc) {
            await handleOfferSDP(pc, data.offer)
          } else {
            console.log('[WebRTC] ⏳ Guardando oferta SDP en espera de hardware móvil...')
            pendingOfferRef.current = data.offer
          }
        } else if (data.type === 'WEBRTC_ANSWER' && isInitiatorRef.current && pc) {
          console.log('[WebRTC] 📩 Recibida WEBRTC_ANSWER')
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
            while (iceQueueRef.current.length > 0) {
              const cand = iceQueueRef.current.shift()
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand))
              } catch (iceErr) {
                console.warn('[WebRTC] Candidato en cola ignorado:', iceErr)
              }
            }
          } else {
            console.warn('[WebRTC] Ignorando WEBRTC_ANSWER en estado:', pc.signalingState)
          }
        } else if (data.type === 'WEBRTC_ICE_CANDIDATE' && data.candidate) {
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            } catch (iceErr) {
              console.warn('[WebRTC] Error candidate:', iceErr)
            }
          } else {
            iceQueueRef.current.push(data.candidate)
          }
        } else if (data.type === 'ACCEPT_CALL' && isInitiatorRef.current) {
          console.log('[WebRTC] 🚀 Receptor aceptó llamada. Enviando Oferta SDP...')
          if (pc) {
            await sendOffer(pc)
          } else {
            console.log('[WebRTC] ⏳ Guardando ACCEPT_CALL en espera de inicialización...')
            pendingAcceptRef.current = true
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error procesando señal WebRTC:', err)
      }
    }

    window.addEventListener('webrtc_signal', handleSignal)
    return () => window.removeEventListener('webrtc_signal', handleSignal)
  }, [activeCall?.callId, ws, handleOfferSDP, sendOffer])

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
      const nextState = !cameraOn
      videoTrack.enabled = nextState
      setCameraOn(nextState)
    } else if (!cameraOn) {
      try {
        let vStream = null
        let targetDevId = currentCameraId
        if (!targetDevId && videoDevices.length > 0) {
          const phys = videoDevices.find(d => !isVirtualCam(d.label))
          if (phys) targetDevId = phys.deviceId
        }

        try {
          vStream = await navigator.mediaDevices.getUserMedia({
            video: targetDevId
              ? { deviceId: { exact: targetDevId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }
          })
        } catch {
          vStream = await navigator.mediaDevices.getUserMedia({ video: true })
        }
        const newTrack = vStream ? vStream.getVideoTracks()[0] : null
        if (newTrack) {
          localStreamRef.current.addTrack(newTrack)
          setCurrentCameraLabel(newTrack.label || 'Cámara Web')
          if (newTrack.getSettings?.().deviceId) setCurrentCameraId(newTrack.getSettings().deviceId)

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
            localVideoRef.current.play().catch(() => {})
          }
          if (pc) {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
            if (sender) {
              await sender.replaceTrack(newTrack)
            } else {
              pc.addTrack(newTrack, localStreamRef.current)
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'WEBRTC_OFFER',
                  callId: activeCall?.callId,
                  offer
                }))
              }
            }
          }
          setCameraOn(true)
          setMediaWarning('')
        }
      } catch (e) {
        console.warn('No se pudo activar la cámara:', e)
        if (e.name === 'NotAllowedError') {
          setMediaWarning('Permiso de cámara bloqueado en el navegador.')
        } else if (e.name === 'NotReadableError') {
          setMediaWarning('La cámara está siendo usada por otra aplicación.')
        } else {
          setMediaWarning('No se pudo encender la cámara.')
        }
      }
    }
  }

  // Alternar entre cámaras disponibles (ej. HD WebCam <-> DroidCam o Frontal <-> Trasera)
  const switchCamera = async (targetDeviceId) => {
    try {
      const pc = pcRef.current
      if (!localStreamRef.current) return

      let nextId = targetDeviceId
      if (!nextId && videoDevices.length > 1) {
        const currIdx = videoDevices.findIndex(d => d.deviceId === currentCameraId)
        const nextIdx = (currIdx + 1) % videoDevices.length
        nextId = videoDevices[nextIdx].deviceId
      }
      if (!nextId) return

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      const oldTrack = localStreamRef.current.getVideoTracks()[0]
      if (oldTrack) {
        oldTrack.stop()
        localStreamRef.current.removeTrack(oldTrack)
      }
      localStreamRef.current.addTrack(newTrack)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        localVideoRef.current.play().catch(() => {})
      }

      if (pc) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
        if (sender) {
          await sender.replaceTrack(newTrack)
        } else {
          pc.addTrack(newTrack, localStreamRef.current)
        }
      }

      setCurrentCameraId(nextId)
      setCurrentCameraLabel(newTrack.label || 'Cámara Web')
      setCameraOn(true)
      setMediaWarning('')
      console.log('[WebRTC] Cámara cambiada exitosamente a:', newTrack.label)
    } catch (err) {
      console.error('[WebRTC] Error al cambiar cámara:', err)
      setMediaWarning('Error al cambiar de cámara: ' + (err.message || 'Dispositivo no disponible'))
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
    if (window.__webrtcAudioCtx) {
      if (!next) {
        window.__webrtcAudioCtx.suspend().catch(() => {})
      } else {
        window.__webrtcAudioCtx.resume().catch(() => {})
      }
    }
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
        <audio ref={setRemoteAudioRef} autoPlay playsInline />
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
        <audio ref={setRemoteAudioRef} autoPlay playsInline />

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

          {/* Banner para desbloqueo de audio en navegadores móviles */}
          {audioBlocked && (
            <button
              type="button"
              onClick={() => {
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {})
                }
              }}
              className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 animate-bounce cursor-pointer z-30"
            >
              <span>🔊</span>
              <span>Toca aquí para escuchar la llamada</span>
            </button>
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
      <audio ref={setRemoteAudioRef} autoPlay playsInline />

      {/* Área Principal de Video Remoto */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-950 overflow-hidden">
        {/* Fondo con desenfoque ambiental dinámico cuando el video es vertical de móvil */}
        {hasRemoteVideo && videoFit === 'contain' && (
          <video
            ref={(el) => {
              if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
                el.srcObject = remoteStreamRef.current
                el.play().catch(() => {})
              }
            }}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110 pointer-events-none"
          />
        )}

        {/* Video Remoto Real en Encuadre Completo (Sin recortar el plano de la cámara del teléfono) */}
        <video
          ref={setRemoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`relative max-w-full max-h-full transition-all duration-300 z-10 ${
            videoFit === 'contain' ? 'object-contain' : 'w-full h-full object-cover'
          } ${hasRemoteVideo ? 'block' : 'hidden'}`}
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
              <p className="text-emerald-400 text-xs mt-1 animate-pulse font-medium">
                {status === 'ringing' ? '📳 Llamando...' : '⏳ Conectando audio y video HD...'}
              </p>
            </div>
          </div>
        )}

        {/* Cámara Local PiP (Picture in Picture) */}
        <div className="absolute bottom-6 right-6 w-36 h-48 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/50 bg-gray-900 group z-30">
          <video
            ref={setLocalVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${cameraOn ? 'block' : 'hidden'}`}
          />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white/50 text-xs p-2 text-center">
              <svg className="w-8 h-8 mb-1 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 1.5L2.1 3.3 4.8 6H3a1 1 0 00-1 1v10a1 1 0 001 1h13.2l2.7 2.7 1.8-1.8L3.9 1.5zM21 6.5l-4 4V7a1 1 0 00-1-1H7.8l9 9L21 11.5a1 1 0 00-.6-.9L17 8.4V7a1 1 0 001-1V1l-5 5h3.5L21 6.5z"/>
              </svg>
              <span>Cámara apagada</span>
            </div>
          )}

          {/* Botón flotante para alternar cámara en el PiP si hay 2 o más */}
          {videoDevices.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                switchCamera()
              }}
              title={`Cámara: ${currentCameraLabel || 'Actual'}. Clic para alternar cámara`}
              className="absolute top-2 right-2 bg-black/80 hover:bg-emerald-600 text-white p-1.5 rounded-full backdrop-blur-md transition-all shadow-lg flex items-center justify-center hover:scale-110 active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v2l3-3-3-3v2H5v6h2V7zm10 10H7v-2l-3 3 3 3v-2h12v-6h-2v4z"/>
              </svg>
            </button>
          )}

          {/* Botón de cambio directo si la cámara detectada es DroidCam */}
          {isVirtualCam(currentCameraLabel) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const phys = videoDevices.find(d => !isVirtualCam(d.label))
                if (phys) switchCamera(phys.deviceId)
                else switchCamera()
              }}
              className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-extrabold px-2 py-1 rounded-md shadow-md animate-pulse cursor-pointer"
              title="Detectado DroidCam. Toca para cambiar a tu cámara web de PC."
            >
              ⚡ Usar HD Cam
            </button>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm truncate max-w-[70px]">
              Tú {muted ? '(Mute)' : ''}
            </span>
            {currentCameraLabel && (
              <span className="text-[9px] font-medium text-emerald-300 bg-black/75 px-1.5 py-0.5 rounded-full backdrop-blur-sm truncate max-w-[85px]">
                {currentCameraLabel.replace(/Video|Source|Device/gi, '').trim()}
              </span>
            )}
          </div>
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
          <div className="flex items-center gap-2">
            {/* Alternador de Encuadre Completo / Llenar Pantalla */}
            {hasRemoteVideo && (
              <button
                type="button"
                onClick={() => setVideoFit(f => f === 'contain' ? 'cover' : 'contain')}
                className="text-white/80 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border border-white/15 cursor-pointer shadow-sm"
                title={videoFit === 'contain' ? 'Cambiar a Llenar Pantalla (recorta los bordes)' : 'Cambiar a Encuadre Completo (sin zoom ni recorte)'}
              >
                {videoFit === 'contain' ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                    </svg>
                    <span className="hidden sm:inline font-semibold">Encuadre Completo</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h4m-4 0v4m11-4l-5 5m5-5h-4m4 0v4M9 15l-5 5m0 0h4m-4 0v-4m11 4l-5-5m5 5h-4m4 0v-4"/>
                    </svg>
                    <span className="hidden sm:inline font-semibold">Llenar Pantalla</span>
                  </>
                )}
              </button>
            )}

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
        </div>

        {/* Banner de aviso */}
        {mediaWarning && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-500/90 text-black font-bold text-xs rounded-full shadow-lg z-20 animate-fade-in">
            ⚠️ {mediaWarning}
          </div>
        )}

        {/* Banner para desbloqueo de audio en navegadores móviles */}
        {audioBlocked && (
          <button
            type="button"
            onClick={() => {
              if (remoteAudioRef.current) {
                remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {})
              }
              if (remoteVideoRef.current) {
                remoteVideoRef.current.play().catch(() => {})
              }
            }}
            className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-full shadow-2xl flex items-center justify-center gap-2 animate-bounce cursor-pointer z-40 border-2 border-white/40"
          >
            <span className="text-lg">🔊</span>
            <span>Toca aquí para activar el sonido</span>
          </button>
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

        {/* Cambiar Cámara (si hay 2 o más cámaras) */}
        {videoDevices.length > 1 && (
          <div className="flex flex-col items-center gap-1">
            <CtrlBtn
              onClick={() => switchCamera()}
              title={`Cámara actual: ${currentCameraLabel || 'Detectada'}. Clic para alternar cámara.`}
            >
              <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v2l3-3-3-3v2H5v6h2V7zm10 10H7v-2l-3 3 3 3v-2h12v-6h-2v4z"/>
              </svg>
            </CtrlBtn>
            <span className="text-white/50 text-[11px] font-medium truncate max-w-[65px]">
              {currentCameraLabel ? (currentCameraLabel.length > 8 ? currentCameraLabel.substring(0, 7) + '..' : currentCameraLabel) : 'Cambiar'}
            </span>
          </div>
        )}

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
