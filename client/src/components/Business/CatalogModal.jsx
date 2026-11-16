import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

export default function CatalogModal({ onClose, onSendProduct }) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New product form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newImage, setNewImage] = useState('')

  const { addToast } = useAppStore()

  const loadCatalog = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/catalog')
      if (res.ok) {
        const data = await res.json()
        setCatalog(data)
      }
    } catch (err) {
      console.error('Error fetching catalog:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || !newPrice) return
    setSubmitting(true)
    try {
      const res = await fetch('http://localhost:3001/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          price: parseFloat(newPrice),
          currency: 'EUR',
          imageUrl: newImage.trim() || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80',
          inStock: 1,
        }),
      })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Catálogo',
          message: 'Producto añadido con éxito',
        })
        setShowAddForm(false)
        setNewTitle('')
        setNewDesc('')
        setNewPrice('')
        setNewImage('')
        loadCatalog()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCatalog = catalog.filter((p) =>
    (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-wa-sidebar border border-gray-700/50 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-wa-header px-5 py-4 flex items-center justify-between border-b border-gray-700/40">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛍️</span>
            <div>
              <h3 className="font-semibold text-wa-text text-base">Catálogo de Negocio</h3>
              <p className="text-xs text-wa-secondary">
                {catalog.length} productos y servicios disponibles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-xl bg-wa-green/20 hover:bg-wa-green/30 text-wa-green text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>{showAddForm ? '✕ Cancelar' : '＋ Nuevo producto'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-wa-secondary hover:text-wa-text transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search */}
        {!showAddForm && (
          <div className="px-5 py-2.5 bg-wa-input/50 border-b border-gray-700/30">
            <div className="flex items-center gap-2 bg-wa-sidebar px-3 py-1.5 rounded-xl border border-white/5">
              <svg className="w-4 h-4 text-wa-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar productos o servicios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-wa-text placeholder-wa-secondary outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-xs text-wa-secondary hover:text-wa-text">✕</button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {showAddForm ? (
            /* Add Product Form */
            <form onSubmit={handleAddProduct} className="space-y-4 max-w-lg mx-auto py-2">
              <h4 className="text-wa-text font-semibold text-sm border-b border-white/10 pb-2">
                Añadir nuevo producto al catálogo
              </h4>

              <div>
                <label className="text-xs text-wa-secondary block mb-1">Título del producto *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Paquete de Consultoría Premium"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3.5 py-2 text-sm text-wa-text outline-none focus:border-wa-green"
                />
              </div>

              <div>
                <label className="text-xs text-wa-secondary block mb-1">Precio en EUR (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="ej. 49.99"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3.5 py-2 text-sm text-wa-text outline-none focus:border-wa-green"
                />
              </div>

              <div>
                <label className="text-xs text-wa-secondary block mb-1">URL de la imagen (opcional)</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/foto.jpg"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3.5 py-2 text-sm text-wa-text outline-none focus:border-wa-green"
                />
              </div>

              <div>
                <label className="text-xs text-wa-secondary block mb-1">Descripción</label>
                <textarea
                  rows={3}
                  placeholder="Describe las características y beneficios del producto..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-wa-input border border-gray-700/60 rounded-xl px-3.5 py-2 text-sm text-wa-text outline-none focus:border-wa-green resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-wa-secondary hover:text-wa-text rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-wa-green hover:bg-wa-green-hover text-wa-dark font-medium rounded-xl text-sm transition-all disabled:opacity-50 shadow-md"
                >
                  {submitting ? 'Guardando...' : 'Guardar producto'}
                </button>
              </div>
            </form>
          ) : loading ? (
            <div className="py-16 text-center text-wa-secondary flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Cargando catálogo...</span>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="py-16 text-center text-wa-secondary flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-2xl mb-3">
                🛍️
              </div>
              <p className="text-wa-text font-medium text-sm">No se encontraron productos</p>
              <p className="text-xs text-wa-secondary mt-1">Añade tu primer producto con el botón superior.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((product) => (
                <div
                  key={product.id}
                  className="bg-wa-header/70 border border-gray-700/50 rounded-2xl overflow-hidden hover:border-wa-green/50 transition-all flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    {/* Product Image */}
                    <div className="h-40 w-full relative overflow-hidden bg-black/40">
                      <img
                        src={product.imageUrl || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80'}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 right-2.5 bg-wa-dark/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-wa-green border border-wa-green/30 shadow-md">
                        {Number(product.price).toFixed(2)} €
                      </div>
                      {product.inStock === 1 && (
                        <div className="absolute top-2.5 left-2.5 bg-emerald-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                          Disponible
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-4">
                      <h4 className="font-semibold text-wa-text text-sm mb-1 line-clamp-1">{product.title}</h4>
                      <p className="text-xs text-wa-secondary line-clamp-2 leading-relaxed">
                        {product.description || 'Sin descripción'}
                      </p>
                    </div>
                  </div>

                  {/* Send Action */}
                  <div className="px-4 pb-4 pt-1">
                    <button
                      onClick={() => {
                        onSendProduct(product)
                        onClose()
                      }}
                      className="w-full py-2 bg-wa-input hover:bg-wa-green hover:text-wa-dark text-wa-text border border-gray-700/60 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>📤</span>
                      <span>Enviar tarjeta al chat</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
