import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

export default function FlowBuilder({ onClose }) {
  const [flows, setFlows] = useState([])
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Interactive Simulator state
  const [simMessages, setSimMessages] = useState([
    { id: 'sim-init', sender: 'bot', text: '¡Hola! Soy el simulador del bot. Escribe una de las palabras clave para probar el flujo.' }
  ])
  const [simInput, setSimInput] = useState('')

  const { addToast } = useAppStore()

  const fetchFlows = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/bots')
      if (res.ok) {
        const data = await res.json()
        setFlows(data)
        if (data.length > 0 && !selectedFlow) {
          setSelectedFlow(data[0])
        }
      }
    } catch (e) {
      console.error('Error fetching bot flows:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlows()
  }, [])

  const handleToggleFlow = async (flowId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/bots/${flowId}/toggle`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setFlows((prev) =>
          prev.map((f) => (f.id === flowId ? { ...f, isActive: data.isActive } : f))
        )
        if (selectedFlow?.id === flowId) {
          setSelectedFlow((prev) => ({ ...prev, isActive: data.isActive }))
        }
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Flujo de Bot',
          message: data.isActive ? 'Bot activado con éxito' : 'Bot desactivado',
        })
      }
    } catch (e) {
      console.error('Error toggling bot:', e)
    }
  }

  const handleCreateNewFlow = () => {
    const defaultNodes = [
      {
        id: 'node-trigger',
        type: 'trigger',
        title: 'Palabras clave activadoras',
        data: { keywords: ['soporte', 'ayuda', 'horario'] }
      },
      {
        id: 'node-msg',
        type: 'message',
        title: 'Mensaje de Bienvenida',
        data: {
          text: '¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?',
          options: [
            { id: 'opt-1', label: 'Consultar Horarios', reply: '🕒 Nuestro horario de atención es de Lunes a Viernes de 9:00 a 19:00.' },
            { id: 'opt-2', label: 'Hablar con Soporte Humano', reply: '👨‍💼 Un asesor se pondrá en contacto contigo en breve.' }
          ]
        }
      }
    ]

    const newFlow = {
      id: `flow-${Date.now()}`,
      name: 'Nuevo Flujo Automatizado',
      triggerKeyword: 'soporte, ayuda, horario',
      isActive: 1,
      nodesJson: JSON.stringify(defaultNodes),
      isNew: true
    }

    setFlows([newFlow, ...flows])
    setSelectedFlow(newFlow)
  }

  const handleSaveSelectedFlow = async () => {
    if (!selectedFlow) return
    setSaving(true)
    try {
      const url = selectedFlow.isNew
        ? 'http://localhost:3001/api/bots'
        : `http://localhost:3001/api/bots/${selectedFlow.id}`
      const method = selectedFlow.isNew ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedFlow.name,
          triggerKeyword: selectedFlow.triggerKeyword,
          nodesJson: selectedFlow.nodesJson,
          isActive: selectedFlow.isActive
        })
      })

      if (res.ok) {
        const saved = await res.json()
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Flujo Guardado',
          message: 'Flujo de automatización publicado con éxito',
        })
        fetchFlows()
        setSelectedFlow(saved)
      }
    } catch (e) {
      console.error('Error saving bot flow:', e)
    } finally {
      setSaving(false)
    }
  }

  // Simulator Engine
  const handleSimSend = (e) => {
    e.preventDefault()
    if (!simInput.trim() || !selectedFlow) return

    const userText = simInput.trim()
    const newMsgList = [...simMessages, { id: `user-${Date.now()}`, sender: 'user', text: userText }]
    setSimMessages(newMsgList)
    setSimInput('')

    // Check trigger
    const keywords = (selectedFlow.triggerKeyword || '')
      .toLowerCase()
      .split(',')
      .map((k) => k.trim())

    const matched = keywords.some((k) => userText.toLowerCase().includes(k))

    setTimeout(() => {
      if (matched) {
        let reply = '¡Hola! He detectado tu consulta.'
        try {
          const nodes = JSON.parse(selectedFlow.nodesJson || '[]')
          const msgNode = nodes.find((n) => n.type === 'message')
          if (msgNode) {
            reply = msgNode.data.text
            if (msgNode.data.options && msgNode.data.options.length > 0) {
              reply += '\n\n' + msgNode.data.options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n')
            }
          }
        } catch (err) {}

        setSimMessages((prev) => [
          ...prev,
          { id: `bot-${Date.now()}`, sender: 'bot', text: reply }
        ])
      } else {
        setSimMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: `(Palabra clave no coincide. Prueba escribiendo: "${keywords.slice(0, 3).join(', ')}")`
          }
        ])
      }
    }, 600)
  }

  // Parse nodes for the visual editor
  const nodes = (() => {
    try {
      return JSON.parse(selectedFlow?.nodesJson || '[]')
    } catch {
      return []
    }
  })()

  const updateNodeData = (nodeIndex, newData) => {
    const updated = [...nodes]
    updated[nodeIndex] = { ...updated[nodeIndex], data: { ...updated[nodeIndex].data, ...newData } }
    setSelectedFlow({ ...selectedFlow, nodesJson: JSON.stringify(updated) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-wa-sidebar border border-gray-700/60 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-wa-header px-6 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xl shadow-md">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Constructor de Chatbots (Flow Builder)</h3>
                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  Automatizaciones WhatsApp
                </span>
              </div>
              <p className="text-xs text-wa-secondary">
                Configura respuestas interactivas basadas en palabras clave y menús de opciones automáticos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNewFlow}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
            >
              <span>➕</span>
              <span>Nuevo Flujo</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Workspace Body: 3 Columns (Flow List, Visual Node Editor, Live Simulator) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 1: Flows List */}
          <div className="w-64 border-r border-gray-700/40 bg-wa-header/40 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-gray-700/40 text-xs font-semibold text-gray-400 flex justify-between items-center">
              <span>Flujos disponibles ({flows.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="py-8 text-center text-xs text-wa-secondary">Cargando flujos...</div>
              ) : (
                flows.map((f) => {
                  const isSelected = selectedFlow?.id === f.id
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFlow(f)}
                      className={`p-3 rounded-xl cursor-pointer transition-colors border ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500/50 text-white'
                          : 'bg-wa-header/80 border-gray-700/40 hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-xs truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleFlow(f.id)
                          }}
                          className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
                            f.isActive ? 'bg-emerald-500' : 'bg-gray-600'
                          }`}
                          title={f.isActive ? 'Desactivar bot' : 'Activar bot'}
                        >
                          <span
                            className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              f.isActive ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        🔑 {f.triggerKeyword}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Column 2: Visual Flow Steps Editor */}
          {selectedFlow ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-wa-dark/95">
              {/* Flow Settings Card */}
              <div className="p-4 bg-wa-header rounded-xl border border-gray-700/50 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-400">CONFIGURACIÓN GENERAL DEL BOT</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">Estado:</span>
                    <span className={`text-xs font-bold ${selectedFlow.isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {selectedFlow.isActive ? '● Activo en Chat' : '○ Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Nombre del Flujo:</label>
                    <input
                      type="text"
                      value={selectedFlow.name}
                      onChange={(e) => setSelectedFlow({ ...selectedFlow, name: e.target.value })}
                      className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Palabras clave activadoras (separadas por comas):</label>
                    <input
                      type="text"
                      value={selectedFlow.triggerKeyword}
                      onChange={(e) => setSelectedFlow({ ...selectedFlow, triggerKeyword: e.target.value })}
                      placeholder="ej. hola, precios, catalogo, ayuda"
                      className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 1 Node: Trigger */}
              <div className="relative pl-8 before:absolute before:left-3 before:top-6 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-purple-500 before:to-emerald-500">
                <div className="absolute left-1 top-4 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg">
                  1
                </div>
                <div className="bg-wa-header border border-purple-500/40 rounded-xl p-4 shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      ⚡ DISPARADOR (Trigger)
                    </span>
                    <span className="text-[10px] text-gray-400 bg-black/30 px-2 py-0.5 rounded-full">Mensaje Entrante</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Se activa cuando cualquier cliente envía un mensaje que incluya alguna de las siguientes palabras clave:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(selectedFlow.triggerKeyword || '').split(',').map((k, i) => (
                      <span key={i} className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                        {k.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2 Node: Message & Interactive Menu */}
              <div className="relative pl-8 before:absolute before:left-3 before:top-6 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:to-indigo-500">
                <div className="absolute left-1 top-4 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg">
                  2
                </div>
                <div className="bg-wa-header border border-emerald-500/40 rounded-xl p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      💬 MENSAJE DE BIENVENIDA Y MENÚ INTERACTIVO
                    </span>
                    <span className="text-[10px] text-gray-400 bg-black/30 px-2 py-0.5 rounded-full">Respuesta Bot</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Texto de Bienvenida:</label>
                    <textarea
                      rows={2}
                      value={nodes[1]?.data?.text || ''}
                      onChange={(e) => updateNodeData(1, { text: e.target.value })}
                      className="w-full bg-wa-input border border-gray-700/60 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  {/* Button Options list */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1.5">Opciones del Menú (Botones):</label>
                    <div className="space-y-2">
                      {(nodes[1]?.data?.options || []).map((opt, idx) => (
                        <div key={opt.id || idx} className="flex items-center gap-2 p-2 bg-black/25 rounded-xl border border-white/5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const updatedOpts = [...(nodes[1]?.data?.options || [])]
                              updatedOpts[idx] = { ...updatedOpts[idx], label: e.target.value }
                              updateNodeData(1, { options: updatedOpts })
                            }}
                            className="flex-1 bg-wa-input border border-gray-700/50 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 Node: Automated Execution */}
              <div className="relative pl-8">
                <div className="absolute left-1 top-4 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg">
                  3
                </div>
                <div className="bg-wa-header border border-indigo-500/40 rounded-xl p-4 shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      ⚡ ACCIÓN Y DERIVACIÓN
                    </span>
                    <span className="text-[10px] text-gray-400 bg-black/30 px-2 py-0.5 rounded-full">Automático</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Si el usuario responde con el número de opción, el bot despacha la información respectiva y, de solicitarse asesor humano, notifica al equipo de soporte.
                  </p>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveSelectedFlow}
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-opacity shadow-lg flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>{saving ? 'Guardando...' : 'Guardar y Publicar Flujo'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-wa-secondary">
              Selecciona o crea un flujo para editar.
            </div>
          )}

          {/* Column 3: Live Simulator */}
          <div className="w-80 border-l border-gray-700/40 bg-black/40 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-gray-700/40 bg-wa-header/80 flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>📱</span> Simulador en Vivo
              </span>
              <button
                onClick={() => setSimMessages([{ id: 'init', sender: 'bot', text: 'Simulador reiniciado. Escribe una palabra clave.' }])}
                className="text-[10px] text-purple-400 hover:underline"
              >
                Limpiar
              </button>
            </div>

            {/* Chat Box */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#efeae2]/10">
              {simMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-2.5 text-xs shadow-md ${
                      m.sender === 'user'
                        ? 'bg-wa-bubble text-white rounded-tr-sm'
                        : 'bg-wa-bubble-in text-wa-text rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                    <span className="text-[9px] text-wa-secondary block text-right mt-1">12:00</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sim Input */}
            <form onSubmit={handleSimSend} className="p-2.5 bg-wa-header border-t border-gray-700/40 flex gap-1.5">
              <input
                type="text"
                placeholder="Prueba con 'hola'..."
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                className="flex-1 bg-wa-input border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
