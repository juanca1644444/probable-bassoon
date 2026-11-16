// AICopilotPanel.jsx — Copilot de IA para Asistencia Autónoma y Sugerencias RAG
import React, { useState, useEffect, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'

export default function AICopilotPanel({ chat }) {
  const { messages, setChatInputDraft, addToast, updateChat } = useAppStore()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [autonomousActive, setAutonomousActive] = useState(Boolean(chat?.ragBotActive))
  const [togglingBot, setTogglingBot] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [showQueryTester, setShowQueryTester] = useState(false)
  const [testQuery, setTestQuery] = useState('')
  const [testResults, setTestResults] = useState([])
  const [testingQuery, setTestingQuery] = useState(false)
  const [escalating, setEscalating] = useState(false)

  // Sync autonomous status if chat changes
  useEffect(() => {
    setAutonomousActive(Boolean(chat?.ragBotActive))
  }, [chat?.id, chat?.ragBotActive])

  // Get chat's message list
  const chatMessages = messages[chat?.id] || []
  const lastClientMessage = [...chatMessages]
    .reverse()
    .find(m => m.senderId !== 'me' && m.type === 'text')?.content || ''

  // Fetch contextual suggestions whenever latest customer message changes
  const fetchSuggestions = useCallback(async () => {
    if (!chat?.id || !lastClientMessage) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rag/copilot/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          messageText: lastClientMessage
        })
      })

      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (err) {
      console.error('Error fetching copilot suggestions:', err)
    } finally {
      setLoading(false)
    }
  }, [chat?.id, lastClientMessage])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  // Toggle Autonomous Bot for this chat
  const handleToggleAutonomous = async () => {
    if (!chat?.id || togglingBot) return
    const newState = !autonomousActive
    setTogglingBot(true)

    try {
      const res = await fetch('/api/rag/copilot/toggle-chat-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          active: newState
        })
      })

      if (res.ok) {
        setAutonomousActive(newState)
        updateChat(chat.id, { ragBotActive: newState ? 1 : 0 })
        if (addToast) {
          addToast({
            title: newState ? '🤖 Bot Autónomo RAG Activado' : '👤 Modo Agente Humano',
            description: newState
              ? 'Chasky Copilot responderá automáticamente las consultas usando la base de conocimiento.'
              : 'El chat ahora es gestionado exclusivamente por el operador humano.',
            type: newState ? 'success' : 'info'
          })
        }
      }
    } catch (err) {
      console.error('Error toggling bot:', err)
    } finally {
      setTogglingBot(false)
    }
  }

  // Send suggestion directly
  const handleSendDirectly = async (suggestion) => {
    if (!chat?.id || sendingId) return
    setSendingId(suggestion.id)

    try {
      const res = await fetch('/api/rag/copilot/send-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          suggestionText: suggestion.text,
          suggestionTitle: suggestion.title,
          confidence: suggestion.confidence
        })
      })

      if (res.ok) {
        if (addToast) {
          addToast({
            title: 'Mensaje Despachado 🚀',
            description: 'La sugerencia del Copilot ha sido enviada al cliente.',
            type: 'success'
          })
        }
      }
    } catch (err) {
      console.error('Error sending suggestion:', err)
    } finally {
      setSendingId(null)
    }
  }

  // Insert suggestion into chat draft input
  const handleInsertInChat = (suggestion) => {
    setChatInputDraft(suggestion.text)
    if (addToast) {
      addToast({
        title: 'Texto Insertado 📝',
        description: 'La sugerencia se copió en el casillero para que puedas editarla.',
        type: 'info'
      })
    }
  }

  // Smart Escalation / Handoff to Human
  const handleTriggerHandoff = async () => {
    if (!chat?.id || escalating) return
    setEscalating(true)

    try {
      const res = await fetch('/api/rag/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          reason: 'escalamiento_manual_agente',
          note: 'El operador forzó la transferencia a atención humana prioritaria.'
        })
      })

      if (res.ok) {
        setAutonomousActive(false)
        updateChat(chat.id, { status: 'pending', ragBotActive: 0 })
        if (addToast) {
          addToast({
            title: '🤝 Handoff Ejecutado',
            description: 'El chat fue escalado a estado Pendiente con notificación de atención humana.',
            type: 'success'
          })
        }
      }
    } catch (err) {
      console.error('Error executing handoff:', err)
    } finally {
      setEscalating(false)
    }
  }

  // Tester for custom query
  const handleRunTestQuery = async (e) => {
    e.preventDefault()
    if (!testQuery.trim() || testingQuery) return
    setTestingQuery(true)

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, topK: 3 })
      })
      if (res.ok) {
        const data = await res.json()
        setTestResults(data.matches || [])
      }
    } catch (err) {
      console.error('Error in test query:', err)
    } finally {
      setTestingQuery(false)
    }
  }

  return (
    <div className="bg-wa-header/40 rounded-xl p-3 border border-emerald-500/25 space-y-3">
      {/* Header with Title and Mode Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shadow-sm">
            🧠
          </div>
          <div>
            <h4 className="text-xs font-bold text-wa-text leading-tight flex items-center gap-1.5">
              <span>Chasky Copilot IA</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-medium border border-emerald-500/30">
                RAG v1.0
              </span>
            </h4>
            <p className="text-[10px] text-wa-secondary">Asistencia cognitiva y respuestas basadas en documentos</p>
          </div>
        </div>

        {/* Autonomous Mode Toggle */}
        <button
          onClick={handleToggleAutonomous}
          disabled={togglingBot}
          title={autonomousActive ? 'Desactivar bot autónomo en este chat' : 'Activar respuestas autónomas RAG en este chat'}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm ${
            autonomousActive
              ? 'bg-emerald-500 text-black shadow-emerald-500/20 animate-pulse'
              : 'bg-wa-input text-wa-secondary hover:text-wa-text border border-white/5'
          }`}
        >
          <span>{autonomousActive ? '🤖 Modo Autónomo' : '👤 Modo Copilot'}</span>
        </button>
      </div>

      {/* Autonomous Active Notice */}
      {autonomousActive && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2 text-[11px] text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">⚡</span>
            <span>El bot responde automáticamente usando la base de conocimiento oficial.</span>
          </div>
          <button
            onClick={handleTriggerHandoff}
            disabled={escalating}
            className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline flex-shrink-0"
          >
            {escalating ? 'Transfiriendo...' : 'Pasar a Humano 🤝'}
          </button>
        </div>
      )}

      {/* Suggestions Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <span>✨</span>
            <span>Sugerencias Inteligentes ({suggestions.length})</span>
          </span>
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="text-[10px] text-wa-secondary hover:text-emerald-400 flex items-center gap-1 transition-colors"
            title="Refrescar sugerencias con el último mensaje"
          >
            <span>🔄</span>
            <span>{loading ? 'Analizando...' : 'Actualizar'}</span>
          </button>
        </div>

        {loading ? (
          <div className="py-4 text-center space-y-2">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[11px] text-wa-secondary italic">Consultando fragmentos vectoriales y contexto...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-wa-input/30 rounded-xl p-3 text-center border border-dashed border-white/10 space-y-1">
            <span className="text-xl">📭</span>
            <p className="text-xs text-wa-secondary">No hay consultas recientes del cliente para sugerir respuestas.</p>
            <p className="text-[10px] text-wa-secondary/70">Las sugerencias aparecerán automáticamente cuando el usuario escriba.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                className="bg-wa-input/60 rounded-xl p-2.5 border border-white/5 hover:border-emerald-500/40 transition-all space-y-2 group"
              >
                {/* Suggestion Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{sug.icon || '🧠'}</span>
                    <h5 className="text-[11px] font-bold text-wa-text line-clamp-1">{sug.title}</h5>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    sug.confidence >= 0.8
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {Math.round(sug.confidence * 100)}% precisión
                  </span>
                </div>

                {/* Source Citation */}
                <p className="text-[10px] text-emerald-400/80 font-medium flex items-center gap-1">
                  <span>📎</span>
                  <span className="truncate">{sug.source}</span>
                </p>

                {/* Content */}
                <p className="text-xs text-gray-200 leading-relaxed select-text bg-black/20 p-2 rounded-lg border border-white/5 font-sans">
                  "{sug.text}"
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleInsertInChat(sug)}
                    className="flex-1 py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-wa-text border border-white/10 flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>📝</span>
                    <span>Insertar</span>
                  </button>
                  <button
                    onClick={() => handleSendDirectly(sug)}
                    disabled={sendingId === sug.id}
                    className="flex-1 py-1 px-2.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
                  >
                    {sendingId === sug.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>{sug.actionLabel || 'Enviar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Escalation / Handoff Button */}
      <div className="pt-1">
        <button
          onClick={handleTriggerHandoff}
          disabled={escalating}
          className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <span>👨‍💼</span>
          <span>{escalating ? 'Escalando conversación...' : 'Transferir a Asesor Humano (Handoff)'}</span>
        </button>
      </div>

      {/* Collapsible Vector Knowledge Tester */}
      <div className="pt-1 border-t border-white/5">
        <button
          onClick={() => setShowQueryTester(!showQueryTester)}
          className="w-full flex items-center justify-between text-[11px] font-semibold text-wa-secondary hover:text-emerald-400 py-1 transition-colors"
        >
          <span className="flex items-center gap-1">
            <span>🔎</span>
            <span>Consultar Base de Conocimientos</span>
          </span>
          <span>{showQueryTester ? '▲' : '▼'}</span>
        </button>

        {showQueryTester && (
          <div className="mt-2 space-y-2 animate-fade-in">
            <form onSubmit={handleRunTestQuery} className="flex gap-1.5">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Ej. Métodos de pago, planes o becas..."
                className="flex-1 bg-wa-input border border-white/10 text-wa-text text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="submit"
                disabled={testingQuery || !testQuery.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
              >
                {testingQuery ? '...' : 'Buscar'}
              </button>
            </form>

            {testResults.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {testResults.map((m, i) => (
                  <div key={m.id || i} className="bg-black/25 rounded-lg p-2 border border-white/5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-emerald-400 font-semibold text-[10px]">
                      <span className="truncate">{m.docTitle}</span>
                      <span>{Math.round(m.score * 100)}% match</span>
                    </div>
                    <p className="text-gray-300 text-[10px] line-clamp-3 leading-relaxed">
                      {m.content}
                    </p>
                    <button
                      onClick={() => setChatInputDraft(m.content)}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>↪ Copiar al chat</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
