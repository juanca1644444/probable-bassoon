// client/src/components/RightPanel/MediaGallery.jsx
// Galería multimedia avanzada — Fotos · Documentos · Enlaces · Audio
import React, { useState, useEffect, useCallback } from 'react'
import { formatFileSize, formatDate } from '../../utils/formatters'

// ── Helpers ────────────────────────────────────────────────────────────────
const isImagePath = (p = '') => /\.(png|jpe?g|gif|webp|svg)$/i.test(p)

function extractLinks(messages) {
  const urlRe = /https?:\/\/[^\s<>"']+/g
  const links = []
  messages.forEach(m => {
    if (m.type === 'link') {
      links.push({ ...m, url: m.content })
      return
    }
    if (m.type === 'text' && m.content) {
      const matches = m.content.match(urlRe) || []
      matches.forEach(url => links.push({ ...m, url }))
    }
  })
  return links
}

function getDomain(url = '') {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function getFileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext))                    return { icon: '📄', color: 'text-red-400',    bg: 'bg-red-400/10' }
  if (['doc','docx'].includes(ext))             return { icon: '📝', color: 'text-blue-400',   bg: 'bg-blue-400/10' }
  if (['xls','xlsx','csv'].includes(ext))       return { icon: '📊', color: 'text-green-400',  bg: 'bg-green-400/10' }
  if (['ppt','pptx'].includes(ext))             return { icon: '📋', color: 'text-orange-400', bg: 'bg-orange-400/10' }
  if (['zip','rar','7z','tar','gz'].includes(ext)) return { icon: '🗜️', color: 'text-yellow-400', bg: 'bg-yellow-400/10' }
  if (['mp3','wav','ogg','m4a'].includes(ext))  return { icon: '🎵', color: 'text-purple-400', bg: 'bg-purple-400/10' }
  if (['mp4','mov','avi','mkv'].includes(ext))  return { icon: '🎬', color: 'text-pink-400',   bg: 'bg-pink-400/10' }
  return { icon: '📎', color: 'text-wa-green', bg: 'bg-wa-green/10' }
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      <img
        src={src}
        alt={alt || 'media'}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <p className="absolute bottom-4 text-white/50 text-xs">{alt} · Presiona ESC para cerrar</p>
    </div>
  )
}

// ── Pestaña: Fotos/Videos ──────────────────────────────────────────────────
function MediaTab({ chatId }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/chats/${chatId}/media?type=image`)
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [chatId])

  if (loading) return <LoadingSkeleton count={6} type="grid" />

  if (items.length === 0) return (
    <EmptyState icon="🖼️" title="Sin fotos ni videos"
      subtitle="Las imágenes y videos que compartas aparecerán aquí" />
  )

  return (
    <>
      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
      <div className="p-1">
        <p className="text-wa-secondary text-xs px-2 mb-2">{items.length} archivos multimedia</p>
        <div className="grid grid-cols-3 gap-1">
          {items.map(m => (
            <button
              key={m.id}
              onClick={() => setLightbox({ src: m.filePath, alt: m.fileName || 'imagen' })}
              className="aspect-square rounded-lg overflow-hidden relative group hover:ring-2 hover:ring-wa-green transition-all"
            >
              <img
                src={m.filePath}
                alt={m.fileName || 'media'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                </svg>
              </div>
              {/* Fecha badge */}
              <span className="absolute bottom-1 left-1 text-[9px] text-white/70 bg-black/50 rounded px-1">
                {formatDate(m.timestamp)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Pestaña: Documentos ────────────────────────────────────────────────────
function DocsTab({ chatId }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/chats/${chatId}/media?type=file`)
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [chatId])

  if (loading) return <LoadingSkeleton count={3} type="list" />

  if (items.length === 0) return (
    <EmptyState icon="📂" title="Sin documentos"
      subtitle="Los archivos PDF, Word y ZIP que envíes aparecerán aquí" />
  )

  return (
    <div className="p-2 space-y-2">
      <p className="text-wa-secondary text-xs px-1 mb-3">{items.length} documentos</p>
      {items.map(m => {
        const { icon, color, bg } = getFileIcon(m.fileName || '')
        return (
          <a
            key={m.id}
            href={m.filePath}
            download={m.fileName}
            className="flex items-center gap-3 p-3 rounded-xl bg-wa-input hover:bg-wa-header transition-colors group no-underline"
          >
            {/* Icono del tipo de archivo */}
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 text-lg`}>
              {icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-wa-text text-xs font-medium truncate">{m.fileName || 'Documento'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-wa-secondary text-[10px]">
                  {m.fileSize ? formatFileSize(m.fileSize) : '—'}
                </span>
                <span className="text-wa-secondary text-[10px]">·</span>
                <span className="text-wa-secondary text-[10px]">{formatDate(m.timestamp)}</span>
              </div>
            </div>

            {/* Botón descarga */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-wa-green/0 group-hover:bg-wa-green/20 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-wa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ── Pestaña: Enlaces ───────────────────────────────────────────────────────
function LinksTab({ chatId, messages }) {
  const links = extractLinks(messages)

  if (links.length === 0) return (
    <EmptyState icon="🔗" title="Sin enlaces"
      subtitle="Los links que compartas en este chat aparecerán aquí" />
  )

  return (
    <div className="p-2 space-y-2">
      <p className="text-wa-secondary text-xs px-1 mb-3">{links.length} enlace{links.length !== 1 ? 's' : ''}</p>
      {links.map((item, i) => {
        const domain = getDomain(item.url)
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        return (
          <a
            key={`${item.id}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-xl bg-wa-input hover:bg-wa-header transition-colors group no-underline"
          >
            {/* Favicon */}
            <div className="w-9 h-9 rounded-lg bg-wa-header flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src={faviconUrl}
                alt={domain}
                className="w-5 h-5 object-contain"
                onError={e => { e.target.src = ''; e.target.style.display = 'none'; e.target.parentElement.textContent = '🌐' }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-wa-green text-xs font-medium truncate group-hover:underline">{item.url}</p>
              <p className="text-wa-secondary text-[10px] mt-0.5 flex items-center gap-1">
                <span className="bg-wa-header rounded px-1.5 py-0.5 font-mono">{domain}</span>
                <span>·</span>
                <span>{formatDate(item.timestamp)}</span>
              </p>
              {item.content && item.content !== item.url && (
                <p className="text-wa-secondary text-[10px] mt-1 truncate opacity-70">{item.content.slice(0, 60)}</p>
              )}
            </div>

            {/* Flecha */}
            <svg className="w-4 h-4 text-wa-secondary flex-shrink-0 mt-0.5 group-hover:text-wa-green transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>
        )
      })}
    </div>
  )
}

// ── Pestaña: Audio ─────────────────────────────────────────────────────────
function AudioTab({ chatId }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/chats/${chatId}/media?type=audio`)
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [chatId])

  if (loading) return <LoadingSkeleton count={3} type="list" />

  if (items.length === 0) return (
    <EmptyState icon="🎙️" title="Sin notas de voz"
      subtitle="Las notas de voz que compartas aparecerán aquí" />
  )

  return (
    <div className="p-2 space-y-2">
      <p className="text-wa-secondary text-xs px-1 mb-3">{items.length} nota{items.length !== 1 ? 's' : ''} de voz</p>
      {items.map(m => {
        const isPlaying = playing === m.id
        return (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-wa-input">
            <button
              onClick={() => {
                const audio = document.getElementById(`audio-gallery-${m.id}`)
                if (!audio) return
                if (isPlaying) { audio.pause(); setPlaying(null) }
                else { audio.play(); setPlaying(m.id) }
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isPlaying ? 'bg-wa-green text-white' : 'bg-wa-green/20 text-wa-green hover:bg-wa-green/30'
              }`}
            >
              {isPlaying
                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <audio
              id={`audio-gallery-${m.id}`}
              src={m.filePath}
              onEnded={() => setPlaying(null)}
              className="hidden"
            />
            <div className="flex-1 min-w-0">
              <p className="text-wa-text text-xs font-medium">Nota de voz</p>
              <p className="text-wa-secondary text-[10px] mt-0.5">
                {m.duration ? `${m.duration}s` : '—'} · {formatDate(m.timestamp)}
              </p>
            </div>
            <span className="text-lg flex-shrink-0">🎤</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Skeleton loader ────────────────────────────────────────────────────────
function LoadingSkeleton({ count = 4, type = 'list' }) {
  if (type === 'grid') return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square rounded-lg bg-wa-input animate-pulse" />
      ))}
    </div>
  )
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-wa-input animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-wa-header flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 bg-wa-header rounded w-3/4" />
            <div className="h-2 bg-wa-header rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-wa-text text-sm font-medium mb-1">{title}</p>
      <p className="text-wa-secondary text-xs leading-relaxed">{subtitle}</p>
    </div>
  )
}

// ── Componente principal MediaGallery ──────────────────────────────────────
const TABS = [
  { key: 'media',  label: 'Fotos',       icon: '🖼️' },
  { key: 'docs',   label: 'Docs',        icon: '📄' },
  { key: 'links',  label: 'Enlaces',     icon: '🔗' },
  { key: 'audio',  label: 'Audio',       icon: '🎙️' },
]

export default function MediaGallery({ chatId, messages = [], onClose }) {
  const [tab, setTab] = useState('media')

  return (
    <div className="flex flex-col h-full bg-wa-sidebar">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-wa-header sticky top-0 z-10 border-b border-white/5">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-wa-icon transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-wa-text font-semibold text-sm">Archivos, enlaces y docs</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-wa-header sticky top-[52px] z-10">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-[11px] font-medium transition-all border-b-2 flex flex-col items-center gap-0.5 ${
              tab === t.key
                ? 'border-wa-green text-wa-green'
                : 'border-transparent text-wa-secondary hover:text-wa-text'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === 'media'  && <MediaTab  chatId={chatId} />}
        {tab === 'docs'   && <DocsTab   chatId={chatId} />}
        {tab === 'links'  && <LinksTab  chatId={chatId} messages={messages} />}
        {tab === 'audio'  && <AudioTab  chatId={chatId} />}
      </div>
    </div>
  )
}
