import React, { useState } from 'react'
import { PAYMENT_METHODS } from './PaymentModal'

export default function PaymentCard({ msg, isMe }) {
  const [showQR, setShowQR] = useState(false)
  const [validating, setValidating] = useState(false)
  const [localStatus, setLocalStatus] = useState(null)

  let payment = null
  try {
    payment = typeof msg.content === 'object' ? msg.content : JSON.parse(msg.content)
  } catch (e) {
    payment = {
      concept: msg.content,
      amount: 0,
      currency: 'PEN',
      method: 'yape',
      status: 'pending'
    }
  }

  const {
    paymentId,
    amount = 0,
    currency = 'PEN',
    concept = 'Cobro',
    method = 'yape',
    status = 'pending',
    transactionId = 'TXN-000000',
    paidAt
  } = payment

  const effectiveStatus = localStatus || status
  const isPaid = effectiveStatus === 'paid'
  const methodObj = PAYMENT_METHODS.find((m) => m.id === method) || PAYMENT_METHODS[0]

  const handleValidatePayment = async () => {
    if (!paymentId) return
    setValidating(true)
    try {
      const res = await fetch(`http://localhost:3001/api/payments/${paymentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      })
      if (res.ok) {
        setLocalStatus('paid')
      }
    } catch (e) {
      console.error('Error validating payment:', e)
    } finally {
      setValidating(false)
    }
  }

  const formatCurrency = (val, cur) => {
    const sym = cur === 'PEN' ? 'S/' : cur === 'USD' ? '$' : '€'
    return `${sym} ${Number(val).toFixed(2)}`
  }

  return (
    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-wa-border/60 bg-wa-header shadow-lg my-1 animate-fade-in text-wa-text">
      {/* Top Method Header */}
      <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold text-white ${methodObj.color}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{methodObj.icon}</span>
          <span>{methodObj.name} · Pasarela WhatsApp</span>
        </div>
        <span className="text-[10px] font-mono tracking-wider opacity-90 uppercase">
          {transactionId}
        </span>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-3">
        {/* Concept & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-wa-secondary uppercase tracking-wider block">
              Concepto
            </span>
            <p className="text-xs font-medium text-wa-text leading-snug truncate">
              {concept}
            </p>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 flex-shrink-0 ${
              isPaid
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
            }`}
          >
            <span>{isPaid ? '✓' : '●'}</span>
            <span>{isPaid ? 'PAGADO' : 'PENDIENTE'}</span>
          </span>
        </div>

        {/* Big Amount */}
        <div className="bg-wa-input/60 rounded-xl p-3 text-center border border-wa-border/40">
          <span className="text-xs text-wa-secondary block mb-0.5">Total a Pagar</span>
          <p className="text-2xl font-black text-wa-text tracking-tight">
            {formatCurrency(amount, currency)}
          </p>
          <span className="text-[10px] text-wa-secondary font-mono">
            {currency} · Sin comisiones adicionales
          </span>
        </div>

        {/* QR Code view toggle */}
        {showQR && (
          <div className="p-3 bg-white rounded-xl text-center shadow-inner animate-scale-in">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://whatsapp-pro.io/pay/${transactionId}`}
              alt="QR de Pago"
              className="w-36 h-36 mx-auto rounded-lg shadow-sm"
            />
            <p className="text-[10px] text-gray-700 font-bold mt-1.5">
              Escanea con la app {methodObj.name}
            </p>
          </div>
        )}

        {/* Actions Bar */}
        <div className="space-y-1.5 pt-1">
          {!isPaid ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowQR(!showQR)}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-wa-input hover:bg-white/10 text-wa-text border border-wa-border/60 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>📱</span>
                <span>{showQR ? 'Ocultar QR' : 'Ver QR'}</span>
              </button>

              <button
                onClick={handleValidatePayment}
                disabled={validating}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-wa-green hover:bg-green-600 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <span>{validating ? '⌛' : '✓'}</span>
                <span>{validating ? 'Validando...' : 'Validar Pago'}</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Transacción Confirmada</span>
              </span>
              <span className="text-[10px] text-wa-secondary">
                {paidAt ? new Date(paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Completado'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer metadata */}
      <div className="px-4 py-2 bg-wa-input/40 border-t border-wa-border/40 flex items-center justify-between text-[10px] text-wa-secondary">
        <span>Seguridad SSL 256-bit</span>
        <span className="font-mono text-emerald-400 font-bold">WHATSAPP PAY</span>
      </div>
    </div>
  )
}
