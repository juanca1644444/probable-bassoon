import React, { useState } from 'react'

export const PAYMENT_METHODS = [
  {
    id: 'yape',
    name: 'Yape',
    color: 'bg-purple-600',
    border: 'border-purple-500',
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300',
    icon: '🟣',
    desc: 'Pago móvil BCP y QR instantáneo'
  },
  {
    id: 'plin',
    name: 'Plin',
    color: 'bg-sky-600',
    border: 'border-sky-500',
    text: 'text-sky-400',
    badge: 'bg-sky-500/20 text-sky-300',
    icon: '🔵',
    desc: 'Interbank, BBVA y Scotiabank'
  },
  {
    id: 'card',
    name: 'Tarjeta / Stripe',
    color: 'bg-indigo-600',
    border: 'border-indigo-500',
    text: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    icon: '💳',
    desc: 'Visa, Mastercard y cobro internacional'
  },
  {
    id: 'transfer',
    name: 'Transferencia',
    color: 'bg-emerald-600',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    icon: '🏦',
    desc: 'Depósito a cuenta o código interbancario CCI'
  }
]

export default function PaymentModal({ chatId, customerPhone, onClose, onPaymentCreated }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PEN')
  const [concept, setConcept] = useState('Suscripción CHASKYAPP')
  const [method, setMethod] = useState('yape')
  const [phone, setPhone] = useState(customerPhone || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleQuickAmount = (val) => {
    setAmount(val.toString())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Por favor ingresa un monto válido mayor a 0.')
      return
    }
    if (!concept.trim()) {
      setError('El concepto del cobro es requerido.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          concept: concept.trim(),
          method,
          customerPhone: phone
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (onPaymentCreated) onPaymentCreated(data.payment)
        onClose()
      } else {
        const err = await res.json()
        setError(err.error || 'Error al generar cobro')
      }
    } catch (err) {
      setError('Error de conexión con la pasarela de pagos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-wa-header border border-emerald-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg">
              💳
            </div>
            <div>
              <h2 className="text-sm font-bold text-wa-text">Generar Solicitud de Cobro</h2>
              <p className="text-[11px] text-emerald-400/80">Pasarela de Pagos Rápida · Yape, Plin y Tarjetas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-secondary hover:text-wa-text hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 animate-fade-in">
              {error}
            </div>
          )}

          {/* Amount and Currency */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1.5">
              Monto a Cobrar
            </label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-wa-input border border-wa-border rounded-xl px-3 py-2.5 text-xs text-wa-text font-bold focus:outline-none focus:border-wa-green"
              >
                <option value="PEN">S/ (PEN)</option>
                <option value="USD">$ (USD)</option>
                <option value="EUR">€ (EUR)</option>
              </select>

              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-wa-input border border-wa-border rounded-xl px-3 py-2.5 text-lg font-bold text-wa-text focus:outline-none focus:border-wa-green placeholder-wa-secondary/40"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex gap-1.5 mt-2">
              {[20, 50, 85, 120, 250].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => handleQuickAmount(v)}
                  className="flex-1 py-1 rounded-lg bg-wa-input/60 hover:bg-wa-input border border-wa-border/50 text-[11px] font-semibold text-wa-secondary hover:text-wa-text transition-colors"
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>

          {/* Concept / Reason */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1.5">
              Concepto / Descripción del Pago
            </label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Licencia Pro, Anticipo de proyecto..."
              className="w-full bg-wa-input border border-wa-border rounded-xl px-3 py-2 text-xs text-wa-text focus:outline-none focus:border-wa-green"
            />
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1.5">
              Método de Pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = method === pm.id
                return (
                  <button
                    type="button"
                    key={pm.id}
                    onClick={() => setMethod(pm.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 ${
                      isSelected
                        ? `${pm.border} bg-white/10 shadow-sm ring-1 ${pm.border}`
                        : 'border-wa-border/50 bg-wa-input/50 hover:bg-wa-input opacity-80 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xl leading-none mt-0.5">{pm.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${isSelected ? 'text-wa-text' : 'text-wa-secondary'}`}>
                        {pm.name}
                      </p>
                      <p className="text-[10px] text-wa-secondary truncate leading-tight">
                        {pm.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Customer Phone (Optional) */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1">
              Teléfono para Confirmación SMS / Billetera (Opcional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+51 987 654 321"
              className="w-full bg-wa-input border border-wa-border rounded-xl px-3 py-2 text-xs text-wa-text focus:outline-none focus:border-wa-green"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-wa-input hover:bg-white/10 text-wa-secondary hover:text-wa-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-wa-green hover:bg-green-600 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <span>Generando...</span>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Enviar Cobro al Chat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
