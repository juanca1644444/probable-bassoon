import React, { useState, useEffect, useRef } from 'react'

const NODE_TYPES = [
  { id: 'menu', label: 'Menú Interactivo (DTMF)', icon: '🔀', color: 'border-blue-500/40 bg-blue-950/20 text-blue-300' },
  { id: 'ai_agent', label: 'Agente de Voz IA (RAG)', icon: '🤖', color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' },
  { id: 'transfer', label: 'Transferencia a Humano', icon: '👨‍💼', color: 'border-purple-500/40 bg-purple-950/20 text-purple-300' },
  { id: 'voicemail', label: 'Buzón de Voz & Grabación', icon: '📼', color: 'border-amber-500/40 bg-amber-950/20 text-amber-300' },
  { id: 'hangup', label: 'Finalizar Llamada', icon: '🔴', color: 'border-rose-500/40 bg-rose-950/20 text-rose-300' }
]

const VOICES = [
  { id: 'es-PE-Camila', name: 'Camila (Perú • Natural Femenina)', lang: 'es-PE' },
  { id: 'es-PE-Alonso', name: 'Alonso (Perú • Ejecutivo Masculino)', lang: 'es-PE' },
  { id: 'es-MX-Mia', name: 'Mia (México • Neural Cálida)', lang: 'es-MX' },
  { id: 'es-US-Sofia', name: 'Sofia (Latam • ElevenLabs Turbo v2)', lang: 'es-US' }
]

export default function IvrBuilder({ onClose, embedded = false }) {
  const [activeTab, setActiveTab] = useState('flow') // 'flow' | 'dids' | 'ai_voice' | 'history'
  const [nodes, setNodes] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState('ivr-root')
  const [dids, setDids] = useState([])
  const [calls, setCalls] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  // Softphone & Live Simulator State
  const [showSoftphone, setShowSoftphone] = useState(false)
  const [simCall, setSimCall] = useState(null)
  const [simFromPhone, setSimFromPhone] = useState('+51 987 654 321')
  const [simToPhone, setSimToPhone] = useState('+51 1 700 8920')
  const [simCustomerName, setSimCustomerName] = useState('Elena Rostova')
  const [simCurrentNode, setSimCurrentNode] = useState(null)
  const [simPromptText, setSimPromptText] = useState('')
  const [simTurns, setSimTurns] = useState([])
  const [simSpeechInput, setSimSpeechInput] = useState('')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isMicListening, setIsMicListening] = useState(false)
  const [callDurationSecs, setCallDurationSecs] = useState(0)
  const callTimerRef = useRef(null)
  const speechRecRef = useRef(null)

  // New DID Form State
  const [showNewDidModal, setShowNewDidModal] = useState(false)
  const [newDidForm, setNewDidForm] = useState({
    phoneNumber: '+51 1 700 8999',
    friendlyName: 'Línea Comercial Anexo 2',
    provider: 'Twilio SIP Trunk',
    countryCode: 'PE',
    assignedIvrId: 'ivr-root'
  })

  // Voice AI Configuration State
  const [aiConfig, setAiConfig] = useState({
    provider: 'ElevenLabs & Gemini Voice',
    apiKey: 'el_live_9812739481928374',
    voiceId: 'es-PE-Camila',
    ragEnabled: true,
    confidenceThreshold: 0.35,
    autoHandoff: true
  })

  useEffect(() => {
    fetchIvrNodes()
    fetchDids()
    fetchCalls()
    fetchStats()
  }, [])

  // Call timer interval
  useEffect(() => {
    if (simCall && simCall.status !== 'completed') {
      callTimerRef.current = setInterval(() => {
        setCallDurationSecs(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(callTimerRef.current)
    }
    return () => clearInterval(callTimerRef.current)
  }, [simCall])

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setFeedbackError(msg)
      setFeedback('')
    } else {
      setFeedback(msg)
      setFeedbackError('')
    }
    setTimeout(() => {
      setFeedback('')
      setFeedbackError('')
    }, 4000)
  }

  // ── API Fetchers ────────────────────────────────────────────────────────────
  const fetchIvrNodes = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/telephony/ivr-nodes')
      if (res.ok) {
        const data = await res.json()
        setNodes(Array.isArray(data) ? data : [])
        if (!selectedNodeId && data.length > 0) {
          setSelectedNodeId(data[0].id)
        }
      }
    } catch (e) {
      console.error('Error fetching IVR nodes:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchDids = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/telephony/numbers')
      if (res.ok) {
        const data = await res.json()
        setDids(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching DIDs:', e)
    }
  }

  const fetchCalls = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/telephony/calls')
      if (res.ok) {
        const data = await res.json()
        setCalls(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching calls:', e)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/telephony/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (e) {
      console.error('Error fetching stats:', e)
    }
  }

  // ── Node Inspector / Editor Handlers ─────────────────────────────────────────
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0]

  const handleUpdateSelectedNode = (field, value) => {
    if (!selectedNode) return
    setNodes(prev => prev.map(node => {
      if (node.id === selectedNode.id) {
        return { ...node, [field]: value }
      }
      return node
    }))
  }

  const handleAddOption = () => {
    if (!selectedNode) return
    const currentOptions = selectedNode.options || []
    const nextKey = String(currentOptions.length + 1)
    const newOpt = {
      key: nextKey,
      action: 'route',
      targetNodeId: nodes.find(n => n.id !== selectedNode.id)?.id || 'ivr-root',
      label: `Opción ${nextKey}`
    }
    handleUpdateSelectedNode('options', [...currentOptions, newOpt])
  }

  const handleUpdateOption = (index, field, value) => {
    if (!selectedNode) return
    const currentOptions = [...(selectedNode.options || [])]
    if (currentOptions[index]) {
      currentOptions[index] = { ...currentOptions[index], [field]: value }
      handleUpdateSelectedNode('options', currentOptions)
    }
  }

  const handleDeleteOption = (index) => {
    if (!selectedNode) return
    const currentOptions = (selectedNode.options || []).filter((_, i) => i !== index)
    handleUpdateSelectedNode('options', currentOptions)
  }

  const handleAddNewNode = () => {
    const newId = `ivr-node-${Date.now().toString(36).slice(-4)}`
    const newNode = {
      id: newId,
      flowId: 'default-ivr-flow',
      title: `Nuevo Submenú ${nodes.length + 1}`,
      type: 'menu',
      promptText: 'Gracias por comunicarse con CHASKYAPP. Por favor seleccione una de las opciones del menú.',
      voiceId: 'es-PE-Camila',
      options: [],
      timeoutSec: 5,
      timeoutAction: 'ai_agent',
      posX: 450,
      posY: 300
    }
    setNodes(prev => [...prev, newNode])
    setSelectedNodeId(newId)
    showToast(`Nodo "${newNode.title}" creado`)
  }

  const handleDeleteNode = async (nodeId) => {
    if (nodeId === 'ivr-root') {
      showToast('No se puede eliminar el nodo raíz de bienvenida', true)
      return
    }
    try {
      const res = await fetch(`http://localhost:3001/api/telephony/ivr-nodes/${nodeId}`, { method: 'DELETE' })
      if (res.ok) {
        setNodes(prev => prev.filter(n => n.id !== nodeId))
        if (selectedNodeId === nodeId) {
          setSelectedNodeId('ivr-root')
        }
        showToast('Nodo eliminado con éxito')
      }
    } catch (e) {
      showToast('Error al eliminar nodo', true)
    }
  }

  const handleSaveFlow = async () => {
    setSaving(true)
    try {
      const res = await fetch('http://localhost:3001/api/telephony/ivr-nodes/save-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId: 'default-ivr-flow', nodes })
      })
      if (res.ok) {
        showToast('¡Flujo IVR guardado exitosamente en SQLite!')
        fetchIvrNodes()
      } else {
        const err = await res.json()
        showToast(err.error || 'Error al guardar flujo', true)
      }
    } catch (e) {
      showToast('Error de red al guardar flujo', true)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaultFlow = async () => {
    if (!window.confirm('¿Estás seguro de restablecer el flujo al menú estándar de CHASKYAPP? Se sobreescribirán los nodos actuales.')) return
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/telephony/ivr-nodes/reset-default', { method: 'POST' })
      if (res.ok) {
        showToast('Flujo IVR restablecido a los valores estándar')
        fetchIvrNodes()
        setSelectedNodeId('ivr-root')
      }
    } catch (e) {
      showToast('Error al restablecer flujo', true)
    } finally {
      setLoading(false)
    }
  }

  // ── Speech Synthesis (Audio Preview) ─────────────────────────────────────────
  const speakTextInBrowser = (text, voiceLang = 'es-PE') => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voiceLang
    utterance.rate = 1.0
    utterance.pitch = 1.0

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find(v => v.lang.includes(voiceLang) || v.lang.includes('es'))
    if (matchingVoice) utterance.voice = matchingVoice

    utterance.onstart = () => setIsAiSpeaking(true)
    utterance.onend = () => setIsAiSpeaking(false)
    utterance.onerror = () => setIsAiSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // ── Softphone / Live IVR & Speech Simulator ─────────────────────────────────
  const handleStartSimulatedCall = async () => {
    setCallDurationSecs(0)
    setSimSpeechInput('')
    try {
      const res = await fetch('http://localhost:3001/api/telephony/calls/start-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber: simFromPhone,
          toNumber: simToPhone,
          customerName: simCustomerName
        })
      })
      if (res.ok) {
        const data = await res.json()
        setSimCall(data.call)
        setSimCurrentNode(data.call.currentNode)
        setSimPromptText(data.promptText)
        setSimTurns(data.call.turns || [])
        setShowSoftphone(true)
        speakTextInBrowser(data.promptText, data.voiceId || 'es-PE')
        showToast('📞 Llamada telefónica conectada al IVR')
      }
    } catch (e) {
      showToast('Error al conectar llamada', true)
    }
  }

  const handleSimulateDtmf = async (digit) => {
    if (!simCall || simCall.status === 'completed') return
    try {
      const res = await fetch('http://localhost:3001/api/telephony/calls/simulate-dtmf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: simCall.id, digit })
      })
      if (res.ok) {
        const data = await res.json()
        setSimCurrentNode(data.nextNode)
        setSimPromptText(data.promptText)
        setSimTurns(data.turns || [])
        if (data.promptText) {
          speakTextInBrowser(data.promptText, data.nextNode?.voiceId || 'es-PE')
        }
      }
    } catch (e) {
      console.error('Error DTMF:', e)
    }
  }

  const handleSendSpeechToAi = async (customSpeech) => {
    const textToSend = customSpeech || simSpeechInput
    if (!simCall || !textToSend.trim()) return

    const updatedTurns = [...simTurns, { speaker: 'customer', text: textToSend, time: formatDuration(callDurationSecs) }]
    setSimTurns(updatedTurns)
    setSimSpeechInput('')

    try {
      const res = await fetch('http://localhost:3001/api/telephony/ai-speech/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: simCall.id,
          customerText: textToSend,
          voiceModel: aiConfig.provider
        })
      })
      if (res.ok) {
        const data = await res.json()
        setSimTurns(data.turns || [...updatedTurns, { speaker: 'ai', text: data.aiReply, time: formatDuration(callDurationSecs + 2) }])
        speakTextInBrowser(data.aiReply, data.voiceId || 'es-PE')

        if (data.action === 'transfer_human') {
          showToast('🔄 La IA ha transferido la llamada a un Asesor Humano')
          setSimCall(prev => ({ ...prev, status: 'transferred' }))
        }
      }
    } catch (e) {
      console.error('Error in speech interact:', e)
    }
  }

  const handleTransferToHuman = async () => {
    if (!simCall) return
    try {
      const res = await fetch('http://localhost:3001/api/telephony/calls/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: simCall.id, agentId: 'agent-me' })
      })
      if (res.ok) {
        setSimCall(prev => ({ ...prev, status: 'transferred' }))
        const transferText = 'Llamada transferida exitosamente al asesor humano con transcripción previa sincronizada.'
        setSimPromptText(transferText)
        speakTextInBrowser(transferText, 'es-PE')
        showToast('👨‍💼 Llamada transferida a tu bandeja de agente')
      }
    } catch (e) {
      showToast('Error al transferir llamada', true)
    }
  }

  const handleEndSimulatedCall = async () => {
    if (!simCall) return
    try {
      const res = await fetch('http://localhost:3001/api/telephony/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: simCall.id, reason: 'completed' })
      })
      if (res.ok) {
        if (window.speechSynthesis) window.speechSynthesis.cancel()
        setSimCall(prev => ({ ...prev, status: 'completed' }))
        showToast('📴 Grabación finalizada y añadida al chat omnicanal')
        fetchCalls()
        fetchStats()
      }
    } catch (e) {
      showToast('Error al colgar llamada', true)
    }
  }

  // Web Speech Microphone toggle
  const toggleMicrophone = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('Tu navegador no soporta Web Speech API. Puedes escribir en el casillero.', true)
      return
    }

    if (isMicListening) {
      if (speechRecRef.current) speechRecRef.current.stop()
      setIsMicListening(false)
      return
    }

    try {
      const rec = new SpeechRecognition()
      rec.lang = 'es-PE'
      rec.continuous = false
      rec.interimResults = false

      rec.onstart = () => setIsMicListening(true)
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript
        setSimSpeechInput(transcript)
        setIsMicListening(false)
        handleSendSpeechToAi(transcript)
      }
      rec.onerror = () => setIsMicListening(false)
      rec.onend = () => setIsMicListening(false)

      speechRecRef.current = rec
      rec.start()
    } catch (e) {
      setIsMicListening(false)
    }
  }

  // Add DID Form
  const handleCreateDid = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('http://localhost:3001/api/telephony/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDidForm)
      })
      if (res.ok) {
        showToast('Línea DID asignada exitosamente')
        setShowNewDidModal(false)
        fetchDids()
      } else {
        const err = await res.json()
        showToast(err.error || 'Error al crear DID', true)
      }
    } catch (e) {
      showToast('Error de red al crear DID', true)
    }
  }

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className={`${embedded ? 'h-full' : 'fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-md'}`}>
      <div className={`relative bg-wa-header rounded-2xl shadow-2xl w-full ${embedded ? 'h-full' : 'max-w-6xl h-[92vh]'} flex flex-col overflow-hidden border border-emerald-500/30 text-wa-text font-sans animate-fade-in`}>
        
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-black border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl shadow-inner">
              📞
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Centralita Telefónica IVR & Agente de Voz IA
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  VoIP • WebRTC • RAG
                </span>
              </div>
              <p className="text-xs text-wa-secondary">
                Constructor visual de menús interactivos, enrutamiento DID y respuestas habladas naturales con IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowSoftphone(true)
                if (!simCall) handleStartSimulatedCall()
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition active:scale-95"
            >
              <span>📞</span> Softphone / Probar Llamada
            </button>

            <button
              onClick={handleSaveFlow}
              disabled={saving}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-white/10 transition"
            >
              <span>💾</span> {saving ? 'Guardando...' : 'Guardar Flujo'}
            </button>

            {!embedded && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-wa-secondary hover:text-white transition"
                title="Cerrar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        {stats && (
          <div className="px-5 py-2 bg-black/40 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Líneas DIDs Activas:</span>
              <span className="font-bold text-white">{stats.activeDids} líneas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Llamadas Totales:</span>
              <span className="font-bold text-emerald-400">{stats.totalCalls} llamadas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Contención IA:</span>
              <span className="font-bold text-cyan-300">{stats.aiContainmentRate}% resueltas sin humano</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Troncal SIP:</span>
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Operacional
              </span>
            </div>
          </div>
        )}

        {/* Feedback Notifications */}
        {feedback && (
          <div className="px-5 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs border-b border-emerald-500/30 flex items-center justify-between">
            <span>✓ {feedback}</span>
            <button onClick={() => setFeedback('')} className="text-xs">✕</button>
          </div>
        )}
        {feedbackError && (
          <div className="px-5 py-1.5 bg-red-500/20 text-red-300 text-xs border-b border-red-500/30 flex items-center justify-between">
            <span>⚠️ {feedbackError}</span>
            <button onClick={() => setFeedbackError('')} className="text-xs">✕</button>
          </div>
        )}

        {/* Main Tab Navigation */}
        <div className="px-5 pt-2 bg-wa-sidebar border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'flow', label: '🔀 Constructor de Flujo IVR', count: nodes.length },
              { id: 'dids', label: '📞 Números Virtuales (DIDs)', count: dids.length },
              { id: 'ai_voice', label: '🤖 Agente de Voz IA (Speech-to-Speech)' },
              { id: 'history', label: '📜 Grabaciones & Historial', count: calls.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-colors border-t border-x ${
                  activeTab === tab.id
                    ? 'bg-wa-dark text-emerald-400 border-white/10 font-bold border-b-2 border-b-emerald-400'
                    : 'text-wa-secondary hover:text-white border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-zinc-300">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'flow' && (
            <div className="flex items-center gap-2 pb-1.5">
              <button
                onClick={handleAddNewNode}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition"
              >
                <span>➕</span> Añadir Nodo
              </button>
              <button
                onClick={handleResetDefaultFlow}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition"
                title="Restablecer menú estándar"
              >
                <span>🔄</span> Restablecer
              </button>
            </div>
          )}
        </div>

        {/* ─── TAB CONTENT ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden bg-wa-dark flex">

          {/* ════ TAB 1: IVR FLOW BUILDER ════ */}
          {activeTab === 'flow' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Canvas: Node Cards Grid */}
              <div className="flex-1 p-5 overflow-y-auto scrollbar-thin bg-gradient-to-b from-black/20 to-wa-dark/90 space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span>Haz clic en un nodo para configurar su locución TTS y opciones de marcación DTMF</span>
                  <span>{nodes.length} Nodos en el Flujo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id
                    const nodeTypeInfo = NODE_TYPES.find(t => t.id === node.type) || NODE_TYPES[0]
                    const optionsList = Array.isArray(node.options) ? node.options : []

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative shadow-lg ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/30'
                            : 'border-white/10 bg-wa-header/80 hover:border-white/20'
                        }`}
                      >
                        {/* Node Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="text-xl">{nodeTypeInfo.icon}</div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-white text-xs">{node.title}</h3>
                                {node.id === 'ivr-root' && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    INICIAL
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono">ID: {node.id}</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${nodeTypeInfo.color}`}>
                            {nodeTypeInfo.label}
                          </span>
                        </div>

                        {/* Spoken Text Preview */}
                        <p className="mt-2.5 text-xs text-zinc-300 line-clamp-2 bg-black/30 p-2 rounded-xl border border-white/5 font-sans leading-relaxed">
                          "{node.promptText}"
                        </p>

                        {/* DTMF Routes List */}
                        {optionsList.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                              Opciones DTMF:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {optionsList.map((opt, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-zinc-200 border border-white/5 flex items-center gap-1"
                                >
                                  <span className="font-bold text-emerald-400 font-mono">[{opt.key}]</span>
                                  <span>{opt.label || opt.targetNodeId}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Card Footer: Timeout & Action */}
                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                          <span>Voz: {node.voiceId || 'es-PE-Camila'}</span>
                          <span>Timeout: {node.timeoutSec || 5}s → {node.timeoutAction || 'ai_agent'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Panel: Node Inspector / Editor */}
              {selectedNode && (
                <div className="w-full md:w-96 bg-wa-sidebar border-t md:border-t-0 md:border-l border-white/10 p-5 overflow-y-auto scrollbar-thin flex flex-col gap-4 flex-shrink-0">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚙️</span>
                      <div>
                        <h4 className="font-bold text-white text-xs">Inspector de Nodo</h4>
                        <span className="text-[10px] text-emerald-400 font-mono">{selectedNode.id}</span>
                      </div>
                    </div>
                    {selectedNode.id !== 'ivr-root' && (
                      <button
                        onClick={() => handleDeleteNode(selectedNode.id)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                      >
                        Eliminar Nodo
                      </button>
                    )}
                  </div>

                  {/* Title & Type */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Título del Menú</label>
                      <input
                        type="text"
                        value={selectedNode.title || ''}
                        onChange={(e) => handleUpdateSelectedNode('title', e.target.value)}
                        className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Tipo de Nodo</label>
                      <select
                        value={selectedNode.type || 'menu'}
                        onChange={(e) => handleUpdateSelectedNode('type', e.target.value)}
                        className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      >
                        {NODE_TYPES.map(t => (
                          <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Speech Prompt (TTS Text) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-zinc-400 font-semibold">Locución de Voz (TTS / Prompt)</label>
                        <button
                          type="button"
                          onClick={() => speakTextInBrowser(selectedNode.promptText, selectedNode.voiceId || 'es-PE')}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                        >
                          <span>🔊</span> Escuchar Audio
                        </button>
                      </div>
                      <textarea
                        rows="4"
                        value={selectedNode.promptText || ''}
                        onChange={(e) => handleUpdateSelectedNode('promptText', e.target.value)}
                        className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500 resize-none font-sans leading-relaxed"
                        placeholder="Texto que pronunciará el sintetizador de voz telefónico..."
                      />
                    </div>

                    {/* Voice Selection */}
                    <div>
                      <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Voz Asignada</label>
                      <select
                        value={selectedNode.voiceId || 'es-PE-Camila'}
                        onChange={(e) => handleUpdateSelectedNode('voiceId', e.target.value)}
                        className="w-full bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                      >
                        {VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* DTMF Options Table */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                          Opciones de Teclado DTMF
                        </label>
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                        >
                          <span>➕</span> Añadir Tecla
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(selectedNode.options || []).map((opt, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Tecla"
                                value={opt.key}
                                onChange={(e) => handleUpdateOption(idx, 'key', e.target.value)}
                                className="w-12 bg-wa-header px-2 py-1 text-center font-bold font-mono text-emerald-400 rounded-lg border border-white/10 text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Etiqueta (ej. Admisiones)"
                                value={opt.label || ''}
                                onChange={(e) => handleUpdateOption(idx, 'label', e.target.value)}
                                className="flex-1 bg-wa-header px-2 py-1 text-white rounded-lg border border-white/10 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(idx)}
                                className="text-zinc-500 hover:text-rose-400 text-xs px-1"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400">Destino:</span>
                              <select
                                value={opt.targetNodeId}
                                onChange={(e) => handleUpdateOption(idx, 'targetNodeId', e.target.value)}
                                className="flex-1 bg-wa-header px-2 py-1 text-[11px] rounded-lg border border-white/10 text-zinc-200"
                              >
                                {nodes.map(n => (
                                  <option key={n.id} value={n.id}>{n.title} ({n.id})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeout Settings */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Timeout (segundos)</label>
                        <input
                          type="number"
                          value={selectedNode.timeoutSec ?? 5}
                          onChange={(e) => handleUpdateSelectedNode('timeoutSec', parseInt(e.target.value, 10))}
                          className="w-full bg-wa-header px-2.5 py-1.5 text-xs rounded-xl border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Acción al agotar</label>
                        <select
                          value={selectedNode.timeoutAction || 'ai_agent'}
                          onChange={(e) => handleUpdateSelectedNode('timeoutAction', e.target.value)}
                          className="w-full bg-wa-header px-2 py-1.5 text-[11px] rounded-xl border border-white/10 text-white"
                        >
                          <option value="ai_agent">🤖 Conectar con IA</option>
                          <option value="ivr-transfer-human">👨‍💼 Transferir a Asesor</option>
                          <option value="repeat">🔄 Repetir Menú</option>
                          <option value="hangup">🔴 Colgar</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 2: VIRTUAL DIDS & TELEPHONY NUMBERS ════ */}
          {activeTab === 'dids' && (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">Números Virtuales y DIDs Asignados</h3>
                  <p className="text-xs text-zinc-400">
                    Configura tus líneas telefónicas públicas, enlaces SIP Trunk y asígnales flujos IVR dedicados
                  </p>
                </div>
                <button
                  onClick={() => setShowNewDidModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <span>➕</span> Asignar Nuevo Número DID
                </button>
              </div>

              {/* DIDs Table */}
              <div className="rounded-2xl border border-white/10 overflow-hidden bg-wa-header/80 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 text-zinc-400 font-semibold uppercase text-[10px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Número DID</th>
                      <th className="px-4 py-3">Nombre Descriptivo</th>
                      <th className="px-4 py-3">Proveedor VoIP</th>
                      <th className="px-4 py-3">Flujo IVR Asignado</th>
                      <th className="px-4 py-3">Voz IA Modelo</th>
                      <th className="px-4 py-3 text-center">Llamadas</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-200">
                    {dids.map(did => (
                      <tr key={did.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3.5 font-bold font-mono text-emerald-400 text-sm">
                          {did.phoneNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {did.friendlyName}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {did.provider}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                            {did.assignedIvrTitle || did.assignedIvrId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {did.voiceAgentModel}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-white">
                          {did.totalCallsCount}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                            ✓ {did.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ TAB 3: AI SPEECH-TO-SPEECH AGENT SETTINGS ════ */}
          {activeTab === 'ai_voice' && (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin max-w-4xl mx-auto space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-base">Motor de Voz IA Autónomo (Speech-to-Speech)</h3>
                <p className="text-xs text-zinc-400">
                  Configura el modelo de generación de voz en tiempo real, latencia ultrabaja y conexión con la base RAG
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-wa-header border border-white/10 space-y-3">
                  <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider">
                    Proveedor de Síntesis y Streaming de Voz
                  </h4>

                  <div>
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Proveedor Principal</label>
                    <select
                      value={aiConfig.provider}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, provider: e.target.value }))}
                      className="w-full bg-black/40 px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                    >
                      <option value="ElevenLabs & Gemini Voice">ElevenLabs Multilingual v2 & Turbo</option>
                      <option value="Gemini Flash Realtime">Google Gemini Flash Voice Live (WebRTC)</option>
                      <option value="OpenAI Whisper & TTS">OpenAI Whisper + Neural TTS</option>
                      <option value="WebSpeech Native">Nativo del Navegador (Web Speech API)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Clave de API / Token</label>
                    <input
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full bg-black/40 px-3 py-2 text-xs rounded-xl border border-white/10 text-white font-mono outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Voz Predeterminada</label>
                    <select
                      value={aiConfig.voiceId}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, voiceId: e.target.value }))}
                      className="w-full bg-black/40 px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                    >
                      {VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-wa-header border border-white/10 space-y-3">
                  <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider">
                    Conexión con Base de Conocimiento RAG
                  </h4>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/30 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConfig.ragEnabled}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, ragEnabled: e.target.checked }))}
                      className="rounded border-zinc-600 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Consultar Base de Conocimiento RAG</span>
                      <span className="text-[10px] text-zinc-400">
                        La IA responde preguntas telefónicas citando manuales, catálogos y políticas de CHASKYAPP
                      </span>
                    </div>
                  </label>

                  <div>
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="text-zinc-400 font-semibold">Umbral Mínimo de Confianza</span>
                      <span className="text-emerald-400 font-bold font-mono">{(aiConfig.confidenceThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={aiConfig.confidenceThreshold}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/30 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConfig.autoHandoff}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, autoHandoff: e.target.checked }))}
                      className="rounded border-zinc-600 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Escalamiento Inteligente a Humano</span>
                      <span className="text-[10px] text-zinc-400">
                        Transfiere de inmediato si el cliente pide "humano", "asesor" o si la certeza es baja
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">Prueba de Pronunciación en Vivo</h4>
                  <p className="text-[11px] text-zinc-400">
                    Escucha una demostración de la síntesis de voz con acento peruano/latinoamericano
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => speakTextInBrowser('Bienvenido a CHASKYAPP. Soy Chasky Voice, su asistente de inteligencia artificial con voz natural conectada a RAG.', aiConfig.voiceId)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <span>🔊</span> Reproducir Audio Demo
                </button>
              </div>
            </div>
          )}

          {/* ════ TAB 4: CALL LOGS & RECORDINGS ════ */}
          {activeTab === 'history' && (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">Historial y Grabaciones Telefónicas</h3>
                  <p className="text-xs text-zinc-400">
                    Auditoría de llamadas gestionadas por el IVR y Agente de Voz IA con transcripción sincronizada
                  </p>
                </div>
                <button
                  onClick={fetchCalls}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-1 text-zinc-300"
                >
                  <span>🔄</span> Actualizar
                </button>
              </div>

              <div className="space-y-3">
                {calls.map((call) => (
                  <div key={call.id} className="p-4 rounded-2xl bg-wa-header border border-white/10 space-y-3 shadow-md hover:border-emerald-500/30 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                          📞
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{call.customerName || 'Cliente'}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">({call.fromNumber})</span>
                            <span className="text-[9px] text-zinc-500">→ {call.toNumber}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ID: {call.id} • Duración: {formatDuration(call.duration || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase border ${
                          call.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : call.status === 'transferred'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {call.status}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {call.sentiment === 'positive' ? '😊 Positivo' : '😐 Neutral'}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    {call.summary && (
                      <p className="text-xs text-zinc-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
                        {call.summary}
                      </p>
                    )}

                    {/* Audio Player if recording exists */}
                    {call.recordingUrl && (
                      <div className="pt-2 flex items-center justify-between border-t border-white/5 text-xs">
                        <audio controls src={call.recordingUrl} className="h-8 max-w-sm" />
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          ✓ Grabación y Transcripción Sincronizada
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── LIVE SOFTPHONE / TELEPHONY SIMULATOR MODAL ───────────────────────── */}
        {showSoftphone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-zinc-950 border border-emerald-500/40 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col font-sans">
              {/* Softphone Top Bar */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950 to-zinc-900 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-bold text-white text-xs tracking-wider uppercase">
                    CHASKY SOFTPHONE • LLAMADA EN VIVO
                  </span>
                </div>
                <button
                  onClick={() => setShowSoftphone(false)}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Call Display Header */}
              <div className="p-5 text-center bg-black/40 border-b border-white/10 space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-3xl text-emerald-400 shadow-lg shadow-emerald-950/60">
                  {isAiSpeaking ? '🗣️' : '📞'}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{simCustomerName}</h3>
                  <p className="text-xs text-zinc-400 font-mono">{simFromPhone} → {simToPhone}</p>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    ⏱️ {formatDuration(callDurationSecs)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    simCall?.status === 'transferred' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {simCall?.status === 'transferred' ? 'Transf. a Asesor' : 'Conectado al IVR'}
                  </span>
                </div>

                {/* Animated Waveform Indicator */}
                <div className="h-6 flex items-center justify-center gap-1 pt-1">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        isAiSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-700 h-2'
                      }`}
                      style={{
                        height: isAiSpeaking ? `${Math.max(25, (Math.sin(i * 0.8 + callDurationSecs) * 50 + 50))}%` : '6px'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Spoken Turn Live Banner */}
              <div className="p-3 bg-zinc-900/90 border-b border-white/10 text-xs">
                <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                  🤖 Chasky Voice (Locución Actual):
                </span>
                <p className="text-zinc-200 text-xs leading-relaxed italic line-clamp-3">
                  "{simPromptText || 'Conectando con la centralita...'}"
                </p>
              </div>

              {/* Interactive DTMF Dialpad & Speech Controls */}
              <div className="p-5 space-y-4">
                {/* DTMF Keypad (1-9, *, 0, #) */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                    <button
                      key={digit}
                      onClick={() => handleSimulateDtmf(digit)}
                      className="h-11 rounded-2xl bg-wa-header hover:bg-emerald-600/30 active:scale-95 text-white font-bold text-base border border-white/10 hover:border-emerald-500/50 transition flex items-center justify-center font-mono shadow"
                    >
                      {digit}
                    </button>
                  ))}
                </div>

                {/* Speech Input Box & Microphone Button */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Hablar con el Agente de Voz IA (Speech-to-Speech)</span>
                    {isMicListening && <span className="text-emerald-400 font-bold animate-pulse">● Escuchando voz...</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleMicrophone}
                      className={`p-2.5 rounded-xl border transition ${
                        isMicListening
                          ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                          : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title="Hablar por micrófono (Web Speech API)"
                    >
                      🎤
                    </button>

                    <input
                      type="text"
                      placeholder="O escribe lo que dice el cliente (ej. ¿Qué horarios tienen para Full Stack?)"
                      value={simSpeechInput}
                      onChange={(e) => setSimSpeechInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendSpeechToAi()
                      }}
                      className="flex-1 bg-wa-header px-3 py-2 text-xs rounded-xl border border-white/10 text-white outline-none focus:border-emerald-500"
                    />

                    <button
                      onClick={() => handleSendSpeechToAi()}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
                    >
                      Hablar
                    </button>
                  </div>
                </div>

                {/* Call Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleTransferToHuman}
                    className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>👨‍💼</span> Transferir a Humano
                  </button>

                  <button
                    onClick={handleEndSimulatedCall}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/50 flex items-center gap-1.5"
                  >
                    <span>📴</span> Colgar Llamada
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: NUEVO NÚMERO DID ────────────────────────────────────────── */}
        {showNewDidModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-wa-header border border-emerald-500/30 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-bold text-white text-sm">Asignar Nuevo Número DID</h3>
                <button onClick={() => setShowNewDidModal(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateDid} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Número Telefónico E.164</label>
                  <input
                    type="text"
                    required
                    value={newDidForm.phoneNumber}
                    onChange={(e) => setNewDidForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white font-mono"
                    placeholder="+51 1 700 8920"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Nombre Descriptivo</label>
                  <input
                    type="text"
                    required
                    value={newDidForm.friendlyName}
                    onChange={(e) => setNewDidForm(prev => ({ ...prev, friendlyName: e.target.value }))}
                    className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white"
                    placeholder="Línea Principal Ventas"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Proveedor VoIP</label>
                    <select
                      value={newDidForm.provider}
                      onChange={(e) => setNewDidForm(prev => ({ ...prev, provider: e.target.value }))}
                      className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white"
                    >
                      <option value="Twilio SIP Trunk">Twilio SIP Trunk</option>
                      <option value="Telnyx VoIP Cloud">Telnyx VoIP Cloud</option>
                      <option value="Vonage Enterprise">Vonage Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">País</label>
                    <select
                      value={newDidForm.countryCode}
                      onChange={(e) => setNewDidForm(prev => ({ ...prev, countryCode: e.target.value }))}
                      className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white"
                    >
                      <option value="PE">🇵🇪 Perú (+51)</option>
                      <option value="US">🇺🇸 EE.UU. (+1)</option>
                      <option value="MX">🇲🇽 México (+52)</option>
                      <option value="CO">🇨🇴 Colombia (+57)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Nodo IVR Inicial</label>
                  <select
                    value={newDidForm.assignedIvrId}
                    onChange={(e) => setNewDidForm(prev => ({ ...prev, assignedIvrId: e.target.value }))}
                    className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white"
                  >
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>{n.title} ({n.id})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowNewDidModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Guardar DID
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
