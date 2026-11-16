import React, { useState } from 'react'

export const ORDER_STATUSES = [
  { id: 'pending', name: 'Pendiente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: '⏳' },
  { id: 'preparing', name: 'En Preparación', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40', icon: '👨‍🍳' },
  { id: 'ready', name: 'Listo para Entrega', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: '📦' },
  { id: 'delivered', name: 'Entregado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: '✅' },
  { id: 'cancelled', name: 'Cancelado', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: '❌' },
]

export default function OrderCard({ msg, isMe, onOpenPayment }) {
  const [updating, setUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(null)

  let order = null
  try {
    order = typeof msg.content === 'object' ? msg.content : JSON.parse(msg.content)
  } catch (e) {
    order = {
      orderId: 'ord-unknown',
      orderNumber: 'PED-000000',
      items: [],
      total: 0,
      currency: 'PEN',
      status: 'pending'
    }
  }

  const {
    orderId,
    orderNumber = 'PED-000000',
    items = [],
    total = 0,
    currency = 'PEN',
    status = 'pending',
    customerNotes
  } = order

  const effectiveStatus = localStatus || status
  const currentStatusObj = ORDER_STATUSES.find((s) => s.id === effectiveStatus) || ORDER_STATUSES[0]

  const handleStatusChange = async (newStatus) => {
    if (!orderId) return
    setUpdating(true)
    try {
      const res = await fetch(`http://localhost:3001/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setLocalStatus(newStatus)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-wa-border/70 bg-wa-header shadow-xl my-1 animate-fade-in text-wa-text">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <div>
            <h4 className="text-xs font-bold leading-tight">Orden de Compra WhatsApp Business</h4>
            <span className="text-[10px] font-mono tracking-wider opacity-90">{orderNumber}</span>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 bg-black/30 backdrop-blur-sm border-white/20`}
        >
          <span>{currentStatusObj.icon}</span>
          <span>{currentStatusObj.name}</span>
        </span>
      </div>

      {/* Items list */}
      <div className="p-4 space-y-3">
        <div className="divide-y divide-white/5 space-y-1">
          {items.map((it, idx) => (
            <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <span className="w-5 h-5 rounded bg-wa-input font-bold text-[10px] text-emerald-400 flex items-center justify-center flex-shrink-0">
                  {it.quantity}x
                </span>
                <span className="font-medium text-wa-text truncate">{it.title}</span>
              </div>
              <span className="font-mono text-wa-secondary text-[11px] flex-shrink-0">
                {currency} {(it.price * it.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {customerNotes && (
          <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 text-[11px]">
            <span className="text-wa-secondary font-medium block text-[10px] uppercase">Nota del cliente:</span>
            <p className="text-wa-text italic">{customerNotes}</p>
          </div>
        )}

        {/* Total Price */}
        <div className="p-3 bg-wa-input/60 rounded-xl flex items-center justify-between border border-wa-border/50">
          <span className="text-xs font-semibold text-wa-secondary">Importe Total</span>
          <span className="text-lg font-black text-emerald-400 font-mono">
            {currency} {Number(total).toFixed(2)}
          </span>
        </div>

        {/* Status Selector dropdown */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-wa-secondary">
            <span>Actualizar Estado del Pedido:</span>
            {updating && <span className="text-emerald-400">Actualizando...</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ORDER_STATUSES.slice(0, 4).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStatusChange(st.id)}
                className={`py-1 px-2 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                  effectiveStatus === st.id
                    ? `${st.color} shadow-sm font-bold ring-1 ring-white/30`
                    : 'bg-wa-input/50 border-wa-border/40 text-wa-secondary hover:text-wa-text hover:bg-white/5'
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action: Cobrar rápido */}
        {effectiveStatus !== 'delivered' && (
          <button
            type="button"
            onClick={() => onOpenPayment && onOpenPayment(total, `Orden ${orderNumber}`)}
            className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>💳</span>
            <span>Cobrar Pedido ({currency} {Number(total).toFixed(2)})</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-wa-input/40 border-t border-wa-border/40 flex items-center justify-between text-[10px] text-wa-secondary">
        <span>Meta Commerce Architecture</span>
        <span className="font-mono text-emerald-400 font-bold">WHATSAPP ORDERS</span>
      </div>
    </div>
  )
}
