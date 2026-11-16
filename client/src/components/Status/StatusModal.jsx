// StatusModal.jsx — Visor de Estados / Stories al estilo WhatsApp Web
import React, { useState, useEffect, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import { getAvatarGradient, getInitials, formatRelativeTime } from '../../utils/formatters'

export default function StatusModal({ onClose, initialIndex = 0, initialShowCreate = false }) {
  const [statuses, setStatuses] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showCreate, setShowCreate] = useState(initialShowCreate)
  const [newText, setNewText] = useState('')
  const [newBg, setNewBg] = useState('bg-gradient-to-br from-teal-600 to-emerald-800')
  const [newMediaUrl, setNewMediaUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const { addToast } = useAppStore()
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load statuses from backend
  const loadStatuses = () => {
    fetch('http://localhost:3001/api/statuses')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStatuses(data)
          if (initialIndex < data.length) {
            setSelectedIndex(initialIndex)
          }
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadStatuses()
  }, [])

  const currentStatus = statuses[selectedIndex]

  // Progress bar auto-advance
  useEffect(() => {
    if (!currentStatus || isPaused || showCreate) return
    setProgress(0)

    const interval = 50 // update every 50ms (total 5000ms = 5s)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setSelectedIndex((idx) => (idx + 1) % statuses.length)
          return 0
        }
        return prev + 1
      })
    }, interval)

    return () => clearInterval(timerRef.current)
  }, [selectedIndex, isPaused, statuses.length, showCreate, currentStatus])

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleNext = () => {
    setProgress(0)
    setSelectedIndex((idx) => (idx + 1) % statuses.length)
  }

  const handlePrev = () => {
    setProgress(0)
    setSelectedIndex((idx) => (idx - 1 + statuses.length) % statuses.length)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setNewMediaUrl(data.filePath)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateStatus = async () => {
    if (!newText.trim() && !newMediaUrl) return
    try {
      const res = await fetch('http://localhost:3001/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newText.trim(),
          mediaUrl: newMediaUrl || null,
          background: newBg,
        }),
      })
      if (res.ok) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Estados',
          message: 'Tu estado fue publicado',
        })
        setShowCreate(false)
        setNewText('')
        setNewMediaUrl('')
        loadStatuses()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendReply = (e) => {
    e.preventDefault()
    if (!replyText.trim() || !currentStatus) return
    addToast({
      id: `toast-${Date.now()}`,
      name: currentStatus.contactName || 'Contacto',
      message: `Respondiste a su estado: "${replyText}"`,
      avatar: currentStatus.contactAvatar,
    })
    setReplyText('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        title="Cerrar estados"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden">
        {/* Left column: List of stories */}
        <div className="w-full md:w-80 bg-wa-sidebar border-r border-white/5 flex flex-col h-full z-10">
          <div className="p-4 bg-wa-header flex items-center justify-between border-b border-white/5">
            <h3 className="text-wa-text font-bold text-base">Estados</h3>
            <button
              onClick={() => setShowCreate(true)}
              className="p-1.5 rounded-full hover:bg-white/10 text-wa-green transition-colors text-xs font-semibold flex items-center gap-1"
            >
              <span>＋</span> Mi estado
            </button>
          </div>

          {/* User's story row */}
          <div
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-3 p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full avatar-gradient-3 flex items-center justify-center text-white font-bold text-sm ring-2 ring-wa-green ring-offset-2 ring-offset-wa-sidebar">
                Yo
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-wa-green text-white rounded-full flex items-center justify-center text-xs font-bold">
                +
              </span>
            </div>
            <div>
              <p className="text-wa-text text-sm font-semibold">Mi estado</p>
              <p className="text-wa-secondary text-xs">Toca para añadir una actualización</p>
            </div>
          </div>

          {/* Contacts stories list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-white/5">
            <p className="px-4 py-2 text-[11px] uppercase tracking-wider text-wa-secondary font-semibold">
              Recientes ({statuses.length})
            </p>

            {statuses.map((item, idx) => {
              const isSelected = idx === selectedIndex && !showCreate
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setShowCreate(false)
                    setSelectedIndex(idx)
                    setProgress(0)
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-wa-header' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative">
                    {item.contactAvatar ? (
                      <img
                        src={item.contactAvatar}
                        alt={item.contactName}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-wa-green ring-offset-2 ring-offset-wa-sidebar"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full ${getAvatarGradient(
                          item.contactName
                        )} flex items-center justify-center text-white text-xs font-bold ring-2 ring-wa-green ring-offset-2 ring-offset-wa-sidebar`}
                      >
                        {getInitials(item.contactName)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-wa-text text-sm font-medium truncate">{item.contactName}</p>
                    <p className="text-wa-secondary text-xs truncate">
                      {formatRelativeTime(item.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column: Story Viewer */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-4 bg-black">
          {showCreate ? (
            /* Create new story modal view */
            <div className="w-full max-w-md bg-wa-header rounded-2xl p-6 border border-white/10 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-wa-text font-bold text-base">Crear estado</h4>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-wa-secondary hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Preview card */}
              <div
                className={`w-full h-64 rounded-xl flex items-center justify-center p-6 text-center text-white shadow-inner mb-4 relative overflow-hidden ${
                  newMediaUrl ? 'bg-black' : newBg
                }`}
              >
                {newMediaUrl ? (
                  /\.(mp4|webm|mov)$/i.test(newMediaUrl) ? (
                    <video src={newMediaUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={newMediaUrl} alt="" className="w-full h-full object-contain" />
                  )
                ) : (
                  <p className="text-xl font-semibold break-words leading-relaxed">
                    {newText || 'Escribe algo para tu estado...'}
                  </p>
                )}
                {newMediaUrl && (
                  <button
                    onClick={() => setNewMediaUrl('')}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 text-xs"
                    title="Quitar medio"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Color picker & media attach */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {[
                    'bg-gradient-to-br from-teal-600 to-emerald-800',
                    'bg-gradient-to-br from-indigo-700 to-purple-900',
                    'bg-gradient-to-br from-amber-700 to-orange-900',
                    'bg-gradient-to-br from-rose-700 to-pink-900',
                    'bg-gradient-to-br from-blue-700 to-cyan-900',
                  ].map((bgClass) => (
                    <button
                      key={bgClass}
                      onClick={() => { setNewBg(bgClass); setNewMediaUrl('') }}
                      className={`w-6 h-6 rounded-full ${bgClass} transition-transform ${
                        newBg === bgClass && !newMediaUrl ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>

                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1 transition-colors"
                  >
                    <span>📷</span>
                    <span>{uploading ? 'Subiendo...' : 'Foto / Video'}</span>
                  </button>
                </div>
              </div>

              {/* Input */}
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                maxLength={200}
                placeholder={newMediaUrl ? 'Añade un comentario a la foto/video...' : 'Escribe tu estado...'}
                rows={2}
                className="w-full bg-wa-input text-wa-text rounded-xl p-3 text-sm outline-none resize-none mb-4 border border-white/5"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-wa-secondary hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateStatus}
                  disabled={!newText.trim() && !newMediaUrl}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    newText.trim() || newMediaUrl
                      ? 'bg-wa-green text-white hover:bg-wa-green/90 shadow-lg shadow-wa-green/30'
                      : 'bg-wa-input text-wa-secondary cursor-not-allowed'
                  }`}
                >
                  Publicar
                </button>
              </div>
            </div>
          ) : currentStatus ? (
            /* Active story player */
            <div
              className="relative w-full max-w-sm h-[580px] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4"
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {/* Background or Media */}
              {currentStatus.mediaUrl ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                  {/\.(mp4|webm|mov)$/i.test(currentStatus.mediaUrl) ? (
                    <video src={currentStatus.mediaUrl} autoPlay loop playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={currentStatus.mediaUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                </div>
              ) : (
                <div
                  className={`absolute inset-0 ${
                    currentStatus.background || 'bg-gradient-to-br from-teal-700 to-emerald-900'
                  }`}
                />
              )}

              {/* Left / Right touch zones for navigation */}
              <div
                className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
                onClick={handlePrev}
              />
              <div
                className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer"
                onClick={handleNext}
              />

              {/* Top: Progress Bars */}
              <div className="relative z-20 flex gap-1.5 w-full pt-1">
                {statuses.map((_, i) => (
                  <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all"
                      style={{
                        width:
                          i < selectedIndex
                            ? '100%'
                            : i === selectedIndex
                            ? `${progress}%`
                            : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Story Author Header */}
              <div className="relative z-20 flex items-center gap-3 pt-2">
                {currentStatus.contactAvatar ? (
                  <img
                    src={currentStatus.contactAvatar}
                    alt={currentStatus.contactName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white/50"
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarGradient(
                      currentStatus.contactName
                    )} flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/50`}
                  >
                    {getInitials(currentStatus.contactName)}
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold text-sm drop-shadow">{currentStatus.contactName}</p>
                  <p className="text-white/70 text-xs drop-shadow">{formatRelativeTime(currentStatus.timestamp)}</p>
                </div>
              </div>

              {/* Story Center Text */}
              <div className="relative z-20 flex items-center justify-center px-4 text-center my-auto">
                {currentStatus.text && (
                  <p className="text-white text-2xl font-bold leading-relaxed drop-shadow-lg bg-black/20 p-4 rounded-2xl backdrop-blur-sm">
                    {currentStatus.text}
                  </p>
                )}
              </div>

              {/* Story Reply Form */}
              <form onSubmit={handleSendReply} className="relative z-20 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Responder estado..."
                  className="flex-1 bg-black/40 backdrop-blur-md text-white text-xs rounded-full px-4 py-2.5 outline-none placeholder:text-white/60 border border-white/20"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="w-9 h-9 rounded-full bg-wa-green text-white flex items-center justify-center hover:bg-wa-green/90 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <div className="text-center text-wa-secondary">
              <p>No hay estados disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
