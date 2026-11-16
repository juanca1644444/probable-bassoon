import React, { useState, useEffect } from 'react'

export default function CartModal({ chatId, onClose, onOrderCreated }) {
  const [catalog, setCatalog] = useState([])
  const [cart, setCart] = useState({}) // { [productId]: quantity }
  const [currency, setCurrency] = useState('PEN')
  const [customerNotes, setCustomerNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/catalog')
        if (res.ok) {
          const data = await res.json()
          setCatalog(data)
          if (data.length > 0) {
            // Default 1 quantity on first product
            setCart({ [data[0].id]: 1 })
            if (data[0].currency) setCurrency(data[0].currency)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchCatalog()
  }, [])

  const updateQuantity = (id, delta) => {
    setCart((prev) => {
      const current = prev[id] || 0
      const next = current + delta
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: next }
    })
  }

  const selectedProducts = catalog
    .filter((p) => cart[p.id] > 0)
    .map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      quantity: cart[p.id],
      imageUrl: p.imageUrl,
      currency: p.currency || currency
    }))

  const subtotal = selectedProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0)
  const total = subtotal

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (selectedProducts.length === 0) {
      setError('Selecciona al menos un producto para la orden')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedProducts,
          currency,
          customerNotes: customerNotes.trim()
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (onOrderCreated) onOrderCreated(data.order)
        onClose()
      } else {
        const err = await res.json()
        setError(err.error || 'Error al generar la orden')
      }
    } catch (e) {
      setError('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-wa-header border-b border-wa-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛒</span>
            <div>
              <h3 className="text-sm font-bold text-wa-text">Carrito & Orden de Compra</h3>
              <p className="text-[11px] text-wa-secondary">Genera una tarjeta de pedido oficial de WhatsApp Business</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-wa-secondary hover:text-wa-text hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* Catalog items */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-wa-secondary uppercase tracking-wider block">
              Productos Disponibles ({catalog.length})
            </span>

            {loading ? (
              <p className="text-xs text-wa-secondary text-center py-4">Cargando catálogo...</p>
            ) : catalog.length === 0 ? (
              <p className="text-xs text-wa-secondary text-center py-4">No hay productos en el catálogo.</p>
            ) : (
              catalog.map((item) => {
                const qty = cart[item.id] || 0
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      qty > 0
                        ? 'bg-wa-header border-emerald-500/40 shadow-sm'
                        : 'bg-wa-input/40 border-wa-border/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover bg-black/40 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg flex-shrink-0">
                          🛍️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-wa-text truncate">{item.title}</h4>
                        <p className="text-[11px] text-emerald-400 font-semibold">
                          {item.currency || 'S/'} {Number(item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 flex-shrink-0 bg-wa-input px-2 py-1 rounded-lg border border-wa-border/50">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-wa-secondary hover:text-wa-text hover:bg-white/10"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-wa-text w-5 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Customer notes */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-wa-secondary block">
              Notas o Instrucciones del Pedido
            </span>
            <input
              type="text"
              placeholder="Ej. Envío prioritario, facturar con RUC..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full bg-wa-input border border-wa-border/70 rounded-xl px-3 py-2 text-xs text-wa-text placeholder-wa-secondary outline-none focus:border-wa-green"
            />
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-wa-input/60 rounded-xl border border-wa-border/60 space-y-2">
            <div className="flex justify-between text-xs text-wa-secondary">
              <span>Artículos seleccionados:</span>
              <span className="font-bold text-wa-text">{selectedProducts.length} productos</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-wa-text pt-1 border-t border-white/5">
              <span>Total a Cobrar:</span>
              <span className="text-emerald-400 text-base font-extrabold font-mono">
                {currency} {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-wa-header/90 border-t border-wa-border/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-wa-input hover:bg-white/10 text-wa-text rounded-xl text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateOrder}
            disabled={submitting || selectedProducts.length === 0}
            className="px-5 py-2.5 bg-wa-green hover:bg-green-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>{submitting ? 'Generando...' : '📦 Enviar Pedido al Chat'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
