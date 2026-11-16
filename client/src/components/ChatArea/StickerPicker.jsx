import React, { useState, useEffect, useRef } from 'react'

const FALLBACK_STICKERS = [
  { id: 'fb-1', name: 'Gato Chill 😺', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChillCat&backgroundColor=b6e3f4', category: 'popular' },
  { id: 'fb-2', name: 'Robot Feliz 🤖', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=HappyBot&backgroundColor=d1d4f9', category: 'popular' },
  { id: 'fb-3', name: 'Perro Gamer 🐶', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=GamerDog&backgroundColor=ffdfbf', category: 'popular' },
  { id: 'fb-4', name: 'Fuego Pro 🔥', imageUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=FirePro&backgroundColor=ffd5dc', category: 'popular' },
  { id: 'fb-5', name: 'Monstruo Fiesta 👾', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=PartyMonster&backgroundColor=c0aede', category: 'popular' },
  { id: 'fb-6', name: 'Alien Tech 👽', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=AlienTech&backgroundColor=aaffaa', category: 'popular' },
  { id: 'fb-7', name: 'Super Estrella ⭐', imageUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=StarPower&backgroundColor=fef08a', category: 'popular' },
  { id: 'fb-8', name: 'Gafas de Sol 😎', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=CoolVibe&backgroundColor=fed7aa', category: 'popular' },
]

export default function StickerPicker({ onSelectSticker, onClose }) {
  const [stickers, setStickers] = useState(FALLBACK_STICKERS)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('pack') // 'pack' | 'creator'
  const [filterCategory, setFilterCategory] = useState('all')

  // Creator state
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [stickerName, setStickerName] = useState('')
  const [creating, setCreating] = useState(false)
  const [hasBorder, setHasBorder] = useState(true)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const pickerRef = useRef(null)

  // Close on click outside (ignoring clicks on the sticker toggle button itself)
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (e.target.closest && e.target.closest('[data-sticker-toggle]')) return
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [onClose])

  const fetchStickers = async () => {
    try {
      const res = await fetch('/api/stickers')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setStickers(data)
        }
      }
    } catch (err) {
      console.warn('Could not fetch remote stickers, using local cache:', err.message)
    }
  }

  useEffect(() => {
    fetchStickers()
  }, [])

  // Process uploaded image on canvas
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setStickerName(file.name.replace(/\.[^/.]+$/, ''))

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        renderStickerCanvas(img, hasBorder)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const renderStickerCanvas = (img, withBorder) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 512
    canvas.height = 512
    ctx.clearRect(0, 0, 512, 512)

    // Fit image nicely inside 512x512
    const scale = Math.min(460 / img.width, 460 / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (512 - w) / 2
    const y = (512 - h) / 2

    if (withBorder) {
      // Subtle sticker drop shadow & white outline effect
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 15
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
    }

    ctx.drawImage(img, x, y, w, h)
    setPreviewUrl(canvas.toDataURL('image/png'))
  }

  const handleCreateAndSend = async () => {
    if (!previewUrl) return
    setCreating(true)
    try {
      const res = await fetch('/api/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: stickerName || 'Mi Sticker',
          imageUrl: previewUrl,
          category: 'custom'
        })
      })
      if (res.ok) {
        const newSticker = await res.json()
        onSelectSticker(newSticker.imageUrl)
        onClose()
      }
    } catch (err) {
      console.error('Error creating sticker:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSticker = async (e, id) => {
    e.stopPropagation()
    try {
      await fetch(`/api/stickers/${id}`, { method: 'DELETE' })
      setStickers(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Error deleting sticker:', err)
    }
  }

  const filteredStickers = filterCategory === 'all'
    ? stickers
    : stickers.filter(s => s.category === filterCategory)

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-2 sm:left-4 mb-3 z-50 bg-wa-header/95 backdrop-blur-md border border-gray-700/60 rounded-3xl shadow-2xl p-3 sm:p-4 w-[calc(100vw-1.5rem)] sm:w-96 max-w-[380px] animate-fade-in flex flex-col max-h-[440px]"
    >
      {/* Top Header & Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700/50 pb-2.5 mb-3">
        <div className="flex items-center gap-1 bg-wa-input p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('pack')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'pack' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>💟</span>
            <span>Stickers</span>
          </button>
          <button
            onClick={() => setActiveTab('creator')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'creator' ? 'bg-emerald-600 text-white shadow-sm' : 'text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>✨</span>
            <span>Crear Sticker</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-wa-secondary hover:text-wa-text transition-colors"
        >
          ✕
        </button>
      </div>

      {/* TAB 1: STICKERS PACKS */}
      {activeTab === 'pack' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Sub-filter chips */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filterCategory === 'all' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold' : 'bg-wa-input text-wa-secondary hover:text-wa-text'
              }`}
            >
              Todos ({stickers.length})
            </button>
            <button
              onClick={() => setFilterCategory('popular')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filterCategory === 'popular' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold' : 'bg-wa-input text-wa-secondary hover:text-wa-text'
              }`}
            >
              🔥 Populares
            </button>
            <button
              onClick={() => setFilterCategory('custom')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filterCategory === 'custom' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold' : 'bg-wa-input text-wa-secondary hover:text-wa-text'
              }`}
            >
              🎨 Mis Creaciones
            </button>
          </div>

          {/* Stickers Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-wa-secondary">Cargando stickers...</div>
            ) : filteredStickers.length === 0 ? (
              <div className="py-10 text-center text-xs text-wa-secondary space-y-2">
                <p>No hay stickers en esta categoría.</p>
                <button
                  onClick={() => setActiveTab('creator')}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  ¡Crea el primero con tu foto!
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5">
                {filteredStickers.map((stk) => (
                  <div
                    key={stk.id}
                    onClick={() => {
                      onSelectSticker(stk.imageUrl)
                      onClose()
                    }}
                    className="relative group aspect-square rounded-2xl bg-wa-input/40 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 flex items-center justify-center p-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title={stk.name}
                  >
                    <img
                      src={stk.imageUrl}
                      alt={stk.name}
                      className="w-full h-full object-contain filter drop-shadow-sm"
                    />

                    {/* Delete button on hover for custom stickers */}
                    {stk.category === 'custom' && (
                      <button
                        onClick={(e) => handleDeleteSticker(e, stk.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title="Eliminar sticker"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STICKER CREATOR */}
      {activeTab === 'creator' && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-emerald-500/80 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-wa-input/20 space-y-2"
            >
              <div className="text-3xl">🖼️</div>
              <p className="font-semibold text-wa-text">Selecciona una imagen para tu sticker</p>
              <p className="text-[11px] text-wa-secondary">PNG, JPG o WEBP (fondo transparente recomendado)</p>
              <button
                type="button"
                className="mt-2 px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-400 rounded-xl text-xs font-semibold"
              >
                Explorar archivos
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview and Canvas */}
              <div className="flex items-center justify-center bg-wa-input/40 rounded-2xl p-3 border border-white/5 relative">
                <img
                  src={previewUrl}
                  alt="Sticker Preview"
                  className="w-36 h-36 object-contain filter drop-shadow-md"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 px-2 py-1 bg-black/40 hover:bg-black/60 text-white rounded-lg text-[10px]"
                >
                  Cambiar foto
                </button>
              </div>

              {/* Sticker Name */}
              <div className="space-y-1 text-left">
                <label className="text-[11px] text-wa-secondary font-medium">Nombre del sticker:</label>
                <input
                  type="text"
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  placeholder="Ej. Mi meme favorito"
                  className="w-full px-3 py-1.5 bg-wa-input border border-gray-700/60 rounded-xl text-xs text-wa-text outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setPreviewUrl('') }}
                  className="px-3 py-1.5 text-xs text-wa-secondary hover:text-wa-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateAndSend}
                  disabled={creating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {creating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Guardar y Enviar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Hidden Canvas used for processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  )
}
