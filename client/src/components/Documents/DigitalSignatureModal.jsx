import React, { useState, useRef, useEffect } from 'react'

export default function DigitalSignatureModal({ document, onClose, onSigned }) {
  const [signerName, setSignerName] = useState('')
  const [signerDocId, setSignerDocId] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [signMode, setSignMode] = useState('draw') // 'draw' | 'type'
  const [typedSignature, setTypedSignature] = useState('')
  const [signing, setSigning] = useState(false)
  const [signedResult, setSignedResult] = useState(null)
  const [error, setError] = useState('')

  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  useEffect(() => {
    if (document) {
      const vars = document.variables || {}
      setSignerName(vars.clientName || '')
      setSignerDocId(vars.clientDoc || '')
      setSignerEmail(vars.clientEmail || 'cliente@empresa.pe')
      setTypedSignature(vars.clientName || '')
    }
  }, [document])

  // Setup Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#00a884'
  }, [signMode])

  const startDrawing = (e) => {
    isDrawingRef.current = true
    hasDrawnRef.current = true
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
  }

  const handleSubmitSignature = async (e) => {
    e.preventDefault()
    if (!signerName.trim()) {
      setError('Por favor ingresa el nombre completo del firmante.')
      return
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los términos y condiciones legales para firmar.')
      return
    }

    let signatureDataUrl = ''
    if (signMode === 'draw') {
      if (!hasDrawnRef.current) {
        setError('Por favor dibuja tu firma en el recuadro.')
        return
      }
      signatureDataUrl = canvasRef.current.toDataURL('image/png')
    } else {
      signatureDataUrl = `typed:${typedSignature || signerName}`
    }

    setSigning(true)
    setError('')

    try {
      const res = await fetch('http://localhost:3001/api/documents/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id || document.documentId,
          signerName,
          signerDocId,
          signerEmail,
          signatureDataUrl
        })
      })

      if (res.ok) {
        const data = await res.json()
        setSignedResult(data)
        if (onSigned) onSigned(data.document)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al firmar documento')
      }
    } catch (err) {
      setError('Error de conexión al firmar documento')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans text-wa-text text-xs">
      <div className="bg-wa-header border border-emerald-500/40 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950 via-zinc-900 to-black border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg">
              ✍️
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Firma Electrónica Avanzada</h3>
              <p className="text-[10px] text-zinc-400">Validez legal bajo la Ley N° 27269 de Firmas Digitales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white">✕</button>
        </div>

        {/* Success State */}
        {signedResult ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-3xl flex items-center justify-center text-emerald-400 animate-bounce">
              ✓
            </div>
            <div>
              <h4 className="text-base font-bold text-white">¡Documento Firmado Exitosamente!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                La firma digital y el sello criptográfico han sido estampados en el PDF oficial.
              </p>
            </div>

            <div className="p-3 bg-black/40 rounded-2xl border border-white/10 text-left space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Firmante:</span>
                <span className="text-white font-bold">{signerName}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Identificación:</span>
                <span className="text-white">{signerDocId}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Fecha y Hora:</span>
                <span className="text-emerald-400">{new Date().toLocaleString('es-PE')}</span>
              </div>
              <div className="pt-1 border-t border-white/10">
                <span className="text-zinc-500 block">Sello SHA-256 (Audit Hash):</span>
                <span className="text-emerald-300 break-all">{signedResult.auditHash}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={signedResult.document?.pdfPath || `/uploads/${document.id}-firmado.pdf`}
                download
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition"
              >
                <span>📥</span> Descargar PDF Firmado
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          /* Signature Form */
          <form onSubmit={handleSubmitSignature} className="p-5 space-y-4">
            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                ⚠️ {error}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Documento a Suscribir:</span>
              <p className="font-bold text-white text-xs">{document.title}</p>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                <span>ID: {document.id || document.documentId}</span>
                {document.amount && <span className="text-emerald-400 font-bold">{document.currency || 'PEN'} {document.amount}</span>}
              </div>
            </div>

            {/* Signer Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                  placeholder="Elena Rostova"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">DNI / RUC</label>
                <input
                  type="text"
                  required
                  value={signerDocId}
                  onChange={(e) => setSignerDocId(e.target.value)}
                  className="w-full bg-wa-dark px-3 py-2 rounded-xl border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                  placeholder="20601928374"
                />
              </div>
            </div>

            {/* Signature Mode Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-zinc-400 uppercase font-semibold">Trazo de Firma</label>
                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSignMode('draw')}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold transition ${
                      signMode === 'draw' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    ✏️ Dibujar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignMode('type')}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold transition ${
                      signMode === 'type' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    ⌨️ Escribir
                  </button>
                </div>
              </div>

              {signMode === 'draw' ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={130}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-32 bg-black/50 border border-emerald-500/30 rounded-2xl cursor-crosshair shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded-lg transition"
                  >
                    Borrar
                  </button>
                  <span className="absolute bottom-2 left-3 text-[9px] text-zinc-500 pointer-events-none">
                    Dibuja tu firma con el mouse o pantalla táctil
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-black/50 border border-emerald-500/30 rounded-2xl space-y-2">
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="w-full bg-transparent text-xl text-emerald-400 font-serif italic text-center outline-none border-b border-white/20 pb-1"
                    placeholder="Escribe tu firma"
                  />
                  <span className="text-[9px] text-zinc-500 block text-center">
                    Representación caligráfica automatizada con validez probatoria
                  </span>
                </div>
              )}
            </div>

            {/* Legal Consent Checkbox */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-zinc-600 text-emerald-500 focus:ring-0"
              />
              <span className="text-[10px] text-zinc-300 leading-relaxed">
                Acepto y ratifico electrónicamente el contenido del documento, declarando bajo juramento que los datos ingresados corresponden a mi identidad legal.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={signing}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
              >
                {signing ? 'Estampando Firma...' : '✍️ Firmar y Aceptar Documento'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
