import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

export default function BusinessSettings() {
  const [quickReplies, setQuickReplies] = useState([])
  const [catalog, setCatalog] = useState([])
  const [autoResponderEnabled, setAutoResponderEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  // New quick reply state
  const [newShortcut, setNewShortcut] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [showAddQr, setShowAddQr] = useState(false)

  // New product state
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [prodTitle, setProdTitle] = useState('')
  const [prodDesc, setProdDesc] = useState('')
  const [prodPrice, setProdPrice] = useState('')
  const [prodImage, setProdImage] = useState('')

  const { addToast } = useAppStore()

  const loadData = async () => {
    try {
      const [qrRes, catRes, setRes] = await Promise.all([
        fetch('http://localhost:3001/api/quick-replies'),
        fetch('http://localhost:3001/api/catalog'),
        fetch('http://localhost:3001/api/settings'),
      ])

      if (qrRes.ok) setQuickReplies(await qrRes.json())
      if (catRes.ok) setCatalog(await catRes.json())
      if (setRes.ok) {
        const settings = await setRes.json()
        setAutoResponderEnabled(settings.autoResponderEnabled === 'true')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleAutoResponder = async () => {
    const nextVal = !autoResponderEnabled
    setAutoResponderEnabled(nextVal)
    setSavingSettings(true)
    try {
      await fetch('http://localhost:3001/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoResponderEnabled: String(nextVal) }),
      })
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Auto-respondedor',
        message: nextVal ? 'Auto-respondedor IA activado' : 'Auto-respondedor desactivado',
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleAddQuickReply = async (e) => {
    e.preventDefault()
    if (!newShortcut.trim() || !newMessage.trim()) return
    try {
      const res = await fetch('http://localhost:3001/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortcut: newShortcut.trim(),
          message: newMessage.trim(),
          category: newCategory,
        }),
      })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Respuestas Rápidas',
          message: 'Atajo guardado con éxito',
        })
        setShowAddQr(false)
        setNewShortcut('')
        setNewMessage('')
        loadData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteQuickReply = async (id) => {
    try {
      await fetch(`http://localhost:3001/api/quick-replies/${id}`, { method: 'DELETE' })
      setQuickReplies((prev) => prev.filter((q) => q.id !== id))
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Respuestas Rápidas',
        message: 'Respuesta rápida eliminada',
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (!prodTitle.trim() || !prodPrice) return
    try {
      const res = await fetch('http://localhost:3001/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prodTitle.trim(),
          description: prodDesc.trim(),
          price: parseFloat(prodPrice),
          currency: 'EUR',
          imageUrl: prodImage.trim() || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80',
          inStock: 1,
        }),
      })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Catálogo',
          message: 'Producto guardado con éxito',
        })
        setShowAddProduct(false)
        setProdTitle('')
        setProdDesc('')
        setProdPrice('')
        setProdImage('')
        loadData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteProduct = async (id) => {
    try {
      await fetch(`http://localhost:3001/api/catalog/${id}`, { method: 'DELETE' })
      setCatalog((prev) => prev.filter((p) => p.id !== id))
      addToast({
        id: `toast-${Date.now()}`,
        name: 'Catálogo',
        message: 'Producto eliminado del catálogo',
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-wa-secondary flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Cargando herramientas de negocio...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* ── Section 1: Auto-responder ── */}
      <div className="bg-wa-sidebar/60 border border-gray-700/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🤖</span>
            <div>
              <h4 className="font-bold text-wa-text text-sm flex items-center gap-2">
                Auto-Respondedor Inteligente (IA Gemini Flash)
                {autoResponderEnabled && (
                  <span className="text-[10px] bg-wa-green/20 text-wa-green border border-wa-green/30 px-2 py-0.5 rounded-full font-medium">
                    Activo
                  </span>
                )}
              </h4>
              <p className="text-xs text-wa-secondary mt-1 leading-relaxed">
                Genera respuestas automáticas contextuales basadas en el mensaje recibido, horario comercial y productos de tu catálogo cuando no puedas responder.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={autoResponderEnabled}
              onChange={handleToggleAutoResponder}
              disabled={savingSettings}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wa-green" />
          </label>
        </div>
      </div>

      {/* ── Section 2: Quick Replies ── */}
      <div className="bg-wa-sidebar/60 border border-gray-700/50 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <h4 className="font-bold text-wa-text text-sm">Respuestas Rápidas (Atajos con '/')</h4>
              <p className="text-xs text-wa-secondary">Escribe una barra '/' en cualquier chat para autocompletar</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddQr(!showAddQr)}
            className="px-3 py-1.5 rounded-xl bg-wa-green/20 hover:bg-wa-green/30 text-wa-green text-xs font-semibold transition-colors"
          >
            {showAddQr ? '✕ Cancelar' : '＋ Nuevo atajo'}
          </button>
        </div>

        {/* Add Quick Reply form */}
        {showAddQr && (
          <form onSubmit={handleAddQuickReply} className="p-4 bg-wa-input/60 rounded-xl border border-white/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-wa-secondary block mb-1">Atajo (ej. /precio, /hola)</label>
                <input
                  type="text"
                  required
                  placeholder="/miatajo"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-wa-text outline-none focus:border-wa-green font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-wa-secondary block mb-1">Categoría</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-wa-text outline-none focus:border-wa-green"
                >
                  <option value="general">General</option>
                  <option value="saludos">Saludos</option>
                  <option value="ventas">Ventas</option>
                  <option value="informacion">Información</option>
                  <option value="soporte">Soporte</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-wa-secondary block mb-1">Mensaje completo a enviar</label>
              <textarea
                rows={2}
                required
                placeholder="Escribe el mensaje predeterminado..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full bg-wa-header border border-gray-700/60 rounded-xl p-2.5 text-xs text-wa-text outline-none focus:border-wa-green resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 bg-wa-green hover:bg-wa-green-hover text-wa-dark text-xs font-semibold rounded-xl transition-all shadow"
              >
                Guardar atajo
              </button>
            </div>
          </form>
        )}

        {/* Quick replies list */}
        <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
          {quickReplies.map((qr) => (
            <div key={qr.id} className="py-2.5 flex items-center justify-between gap-3 group">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs font-bold text-wa-green bg-wa-green/10 px-2 py-0.5 rounded-md">
                    {qr.shortcut}
                  </span>
                  <span className="text-[10px] text-wa-secondary uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                    {qr.category}
                  </span>
                </div>
                <p className="text-xs text-wa-text truncate">{qr.message}</p>
              </div>

              <button
                onClick={() => handleDeleteQuickReply(qr.id)}
                className="p-1.5 text-wa-secondary hover:text-red-400 opacity-60 group-hover:opacity-100 transition-all"
                title="Eliminar respuesta rápida"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Business Catalog ── */}
      <div className="bg-wa-sidebar/60 border border-gray-700/50 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛍️</span>
            <div>
              <h4 className="font-bold text-wa-text text-sm">Catálogo de Productos ({catalog.length})</h4>
              <p className="text-xs text-wa-secondary">Gestiona los productos que ofreces en el chat</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddProduct(!showAddProduct)}
            className="px-3 py-1.5 rounded-xl bg-wa-green/20 hover:bg-wa-green/30 text-wa-green text-xs font-semibold transition-colors"
          >
            {showAddProduct ? '✕ Cancelar' : '＋ Añadir producto'}
          </button>
        </div>

        {/* Add Product form */}
        {showAddProduct && (
          <form onSubmit={handleAddProduct} className="p-4 bg-wa-input/60 rounded-xl border border-white/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-wa-secondary block mb-1">Título del producto *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Suscripción Pro"
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-wa-text outline-none focus:border-wa-green"
                />
              </div>
              <div>
                <label className="text-xs text-wa-secondary block mb-1">Precio (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="29.99"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-wa-text outline-none focus:border-wa-green"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-wa-secondary block mb-1">URL de Imagen</label>
              <input
                type="url"
                placeholder="https://ejemplo.com/foto.jpg"
                value={prodImage}
                onChange={(e) => setProdImage(e.target.value)}
                className="w-full bg-wa-header border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-wa-text outline-none focus:border-wa-green"
              />
            </div>

            <div>
              <label className="text-xs text-wa-secondary block mb-1">Descripción</label>
              <textarea
                rows={2}
                placeholder="Breve descripción..."
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                className="w-full bg-wa-header border border-gray-700/60 rounded-xl p-2.5 text-xs text-wa-text outline-none focus:border-wa-green resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 bg-wa-green hover:bg-wa-green-hover text-wa-dark text-xs font-semibold rounded-xl transition-all shadow"
              >
                Guardar producto
              </button>
            </div>
          </form>
        )}

        {/* Catalog list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
          {catalog.map((prod) => (
            <div
              key={prod.id}
              className="bg-wa-header/70 border border-gray-700/40 rounded-xl p-3 flex gap-3 items-center justify-between group hover:border-wa-green/40 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={prod.imageUrl || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80'}
                  alt={prod.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-black/40"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-wa-text truncate">{prod.title}</p>
                  <p className="text-xs font-semibold text-wa-green">{Number(prod.price).toFixed(2)} €</p>
                  <p className="text-[10px] text-wa-secondary truncate">{prod.description}</p>
                </div>
              </div>

              <button
                onClick={() => handleDeleteProduct(prod.id)}
                className="p-1.5 text-wa-secondary hover:text-red-400 opacity-60 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Eliminar producto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
