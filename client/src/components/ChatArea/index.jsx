// src/components/ChatArea/index.jsx — Main chat view
import React, { useState, useEffect, useRef, useCallback } from 'react'
import useAppStore from '../../store/useAppStore'
import { fetchMessages, sendMessage, uploadFile } from '../../utils/api'
import { sendOfflineFirstMessage } from '../../services/syncManager'
import { getLocalMessages, saveLocalMessages } from '../../services/localDb'
import { formatTime, formatDate, formatFileSize } from '../../utils/formatters'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import VoiceRecorder from './VoiceRecorder'
import AudioPlayer   from './AudioPlayer'
import EncryptionBanner from './EncryptionBanner'
import CatalogModal from '../Business/CatalogModal'
import ExportModal from './ExportModal'
import StickerPicker from './StickerPicker'
import ScheduleMessageModal from './ScheduleMessageModal'
import PaymentModal from './PaymentModal'
import PaymentCard from './PaymentCard'
import CartModal from '../Orders/CartModal'
import OrderCard from '../Orders/OrderCard'
import CSATSurveyCard from './CSATSurveyCard'
import CallRecordingCard from './CallRecordingCard'
import DocumentCard from './DocumentCard'
import DocumentGenerator from '../Documents/DocumentGenerator'
import SaveContactModal from '../Contacts/SaveContactModal'
import AiAgentsHub from '../Settings/AiAgentsHub'
import { ChannelBadge, TicketStatusBadge } from '../Sidebar/UnifiedSidebar'

// ── Icons (inline SVG) ─────────────────────────────────────────────────────
const SearchIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
const PhoneIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z"/></svg>
const VideoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
const DotsIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
const SendIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
const AttachIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656L5.757 10.757a6 6 0 108.485 8.485L20 13"/></svg>
const EmojiIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
const MicIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
const ReplyIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
const CloseIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
const FileIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>

const EMOJIS = ['😀','😂','❤️','👍','👎','🔥','🎉','😍','🤔','😢','😮','🙏','💯','🚀','⭐','🎯','💪','🤝','✅','❌','⚡','🌟','💡','📌','🔑','💎','🎸','🏆','🍕','☕']

// ── Tick component ─────────────────────────────────────────────────────────
function Ticks({ status }) {
  if (status === 'pending_sync') return <span className="text-amber-400 text-xs inline-block animate-pulse" title="Pendiente de sincronización (Modo Offline)">🕒</span>
  if (status === 'sent')      return <span className="text-wa-secondary text-xs">✓</span>
  if (status === 'delivered') return <span className="text-wa-secondary text-xs">✓✓</span>
  if (status === 'read')      return <span className="text-blue-400 text-xs">✓✓</span>
  return null
}

// ── Context Menu ───────────────────────────────────────────────────────────
function ContextMenu({ x, y, msg, isMe, onClose, onReply, onReact, onDelete, onCopy, isPinned, onPin, onUnpin, isStarred, onStar, onUnstar, onExportChat, onTranslate }) {
  const ref = useRef(null)
  const [showTranslateSubmenu, setShowTranslateSubmenu] = useState(false)

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!ref.current) return
    const { right, bottom } = ref.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    if (right > vw)  ref.current.style.left = `${x - ref.current.offsetWidth}px`
    if (bottom > vh) ref.current.style.top  = `${y - ref.current.offsetHeight}px`
  }, [x, y])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('contextmenu', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('contextmenu', handler)
    }
  }, [onClose])

  const isDeleted = msg.isDeleted === 1

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isDeleted && (
        <>
          <button onClick={() => { onReply(msg); onClose() }}>
            <svg className="w-4 h-4 text-wa-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
            </svg>
            Responder
          </button>
          <button onClick={() => { (isPinned ? onUnpin(msg.id) : onPin(msg.id)); onClose() }}>
            <svg className="w-4 h-4 text-wa-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
            </svg>
            {isPinned ? 'Desfijar' : 'Fijar mensaje'}
          </button>
          <button onClick={() => { (isStarred ? onUnstar(msg.id) : onStar(msg.id)); onClose() }}>
            <span className="text-sm">{isStarred ? '⭐' : '☆'}</span>
            {isStarred ? 'Quitar de destacados' : 'Destacar'}
          </button>
          
          {/* Opción de traducción multilingüe por IA */}
          {msg.content && (
            <div className="relative border-y border-white/5 my-0.5 py-0.5">
              {!showTranslateSubmenu ? (
                <button
                  type="button"
                  onClick={() => setShowTranslateSubmenu(true)}
                  className="flex items-center justify-between w-full hover:bg-emerald-500/10 text-emerald-400 font-medium"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🌐</span>
                    <span>Traducir mensaje</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/70">▶</span>
                </button>
              ) : (
                <div className="bg-wa-header p-1.5 rounded-lg space-y-1 border border-emerald-500/30">
                  <div className="px-2 py-0.5 text-[10px] font-bold text-emerald-400 flex items-center justify-between">
                    <span>Elegir idioma:</span>
                    <button
                      type="button"
                      onClick={() => setShowTranslateSubmenu(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  {[
                    { code: 'qu', label: 'Quechua (Runasimi) 🇵🇪' },
                    { code: 'en', label: 'English 🇺🇸' },
                    { code: 'pt', label: 'Português 🇧🇷' },
                    { code: 'fr', label: 'Français 🇫🇷' },
                    { code: 'es', label: 'Español 🇪🇸' }
                  ].map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onTranslate && onTranslate(msg, lang.code)
                        onClose()
                      }}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-emerald-500/20 hover:text-emerald-300 rounded flex items-center justify-between transition-colors"
                    >
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => { onExportChat && onExportChat(); onClose() }}>
            <span className="text-sm">📤</span>
            Exportar chat
          </button>
          <button onClick={() => { onCopy(msg.content); onClose() }}>
            <svg className="w-4 h-4 text-wa-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            Copiar
          </button>
          <button onClick={() => { onReact(msg.id, '❤️'); onClose() }}>
            <svg className="w-4 h-4 text-wa-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            Reaccionar ❤️
          </button>
        </>
      )}
      {isMe && !isDeleted && (
        <button className="danger" onClick={() => { onDelete(msg.id); onClose() }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Eliminar
        </button>
      )}
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  isMe,
  onReact,
  onReply,
  onDelete,
  isPinned,
  onPin,
  onUnpin,
  isStarred,
  onStar,
  onUnstar,
  activeChat,
  onConsultProduct,
  onExportChat,
  translations = {},
  onTranslate,
  onRevertTranslation
}) {
  const [showActions, setShowActions] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)   // { x, y }
  const [copied, setCopied] = useState(false)

  const reactions = (() => {
    try { return typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || {}) }
    catch { return {} }
  })()

  const isDeleted = msg.isDeleted === 1
  const isAudio = msg.type === 'audio'
  const isSticker = msg.type === 'sticker'
  const isPayment = msg.type === 'payment_request'
  const isOrder = msg.type === 'order_card'
  const isCSAT = msg.type === 'csat_survey'
  const isCallRecording = msg.type === 'call_recording'
  const isDocumentCard = msg.type === 'document_card'
  const isImage = !isAudio && !isSticker && !isPayment && !isOrder && !isCSAT && !isCallRecording && !isDocumentCard && (msg.type === 'image' || (msg.filePath && /\.(png|jpg|jpeg|gif|webp)$/i.test(msg.filePath || '')))
  const isFile  = !isAudio && !isSticker && !isPayment && !isOrder && !isCSAT && !isCallRecording && !isDocumentCard && msg.type === 'file' && !isImage
  const isProductCard = !isPayment && !isOrder && !isCSAT && !isCallRecording && !isDocumentCard && msg.type === 'product_card'

  let productData = null
  if (isProductCard) {
    try {
      productData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
    } catch {
      productData = { title: 'Producto', price: 0, description: msg.content }
    }
  }

  const bubbleClass = (isSticker || isPayment || isOrder || isCSAT || isCallRecording || isDocumentCard)
    ? 'bg-transparent shadow-none p-0'
    : isMe
      ? 'bg-wa-bubble rounded-tl-2xl rounded-tr-sm rounded-b-2xl shadow-md'
      : 'bg-wa-bubble-in rounded-tr-2xl rounded-tl-sm rounded-b-2xl shadow-md'

  const handleContextMenu = (e) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCopy = async (text) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group px-4 transition-all duration-300`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false) }}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar for group chats (incoming) */}
      {!isMe && activeChat?.type === 'group' && (
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`}
          className="w-7 h-7 rounded-full mr-2 mt-1 flex-shrink-0 self-end"
          alt=""
        />
      )}

      <div className="max-w-[75%] relative">
        {/* Reply preview */}
        {msg.replyTo && (
          <div className={`text-xs mb-1 px-3 py-2 rounded-lg border-l-4 border-wa-green bg-black/20 ${isMe ? 'text-right' : 'text-left'}`}>
            <span className="text-wa-green font-medium">↩ Respuesta</span>
          </div>
        )}

        {/* Bubble */}
        <div className={`relative px-3 pt-2 pb-1 shadow-md ${bubbleClass} max-w-full`}>
          {/* Group sender name */}
          {!isMe && activeChat?.type === 'group' && (
            <p className="text-wa-green text-xs font-semibold mb-1">{msg.senderName || msg.senderId}</p>
          )}

          {isDeleted ? (
            <p className="italic text-wa-secondary text-sm">🚫 Este mensaje fue eliminado</p>
          ) : isSticker ? (
            <div className="py-0.5 select-none">
              <img
                src={msg.filePath || msg.content}
                alt="Sticker"
                className="w-36 h-36 max-w-[150px] max-h-[150px] object-contain drop-shadow-md cursor-pointer hover:scale-105 transition-transform"
                onClick={() => window.open(msg.filePath || msg.content, '_blank')}
                loading="lazy"
              />
            </div>
          ) : isAudio ? (
            <AudioPlayer
              messageId={msg.id}
              src={msg.filePath}
              duration={msg.duration || 0}
              waveform={msg.waveform || '[]'}
              isMe={isMe}
            />
          ) : isImage ? (
            <div>
              <img
                src={msg.filePath}
                alt={msg.fileName || 'imagen'}
                className="rounded-lg max-h-72 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(msg.filePath, '_blank')}
              />
              {msg.content && <p className="text-sm mt-1 text-wa-text">{msg.content}</p>}
            </div>
          ) : isFile ? (
            <a
              href={msg.filePath}
              download={msg.fileName}
              className="flex items-center gap-3 no-underline"
            >
              <div className="text-wa-green"><FileIcon /></div>
              <div>
                <p className="text-sm font-medium text-wa-text">{msg.fileName}</p>
                <p className="text-xs text-wa-secondary">{formatFileSize(msg.fileSize)}</p>
              </div>
              <span className="text-wa-green text-xs ml-2">↓</span>
            </a>
          ) : isProductCard && productData ? (
            <div className="w-64 max-w-full overflow-hidden rounded-xl bg-black/25 border border-emerald-500/30 my-1">
              {productData.imageUrl && (
                <img
                  src={productData.imageUrl}
                  alt={productData.title}
                  className="w-full h-36 object-cover bg-black/40 cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(productData.imageUrl, '_blank')}
                />
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="font-semibold text-sm text-wa-text line-clamp-1">{productData.title}</h4>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                    {productData.currency === 'USD' ? '$' : '€'}{Number(productData.price || 0).toFixed(2)}
                  </span>
                </div>
                {productData.description && (
                  <p className="text-xs text-wa-secondary line-clamp-2 mb-3 leading-relaxed">{productData.description}</p>
                )}
                <button
                  type="button"
                  onClick={() => onConsultProduct && onConsultProduct(productData)}
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>💬</span> Consultar producto
                </button>
              </div>
            </div>
          ) : isPayment ? (
            <PaymentCard msg={msg} isMe={isMe} />
          ) : isOrder ? (
            <OrderCard msg={msg} isMe={isMe} onOpenPayment={(amt, concept) => setShowPaymentModal(true)} />
          ) : isCSAT ? (
            <CSATSurveyCard message={msg} chatId={activeChat?.id} />
          ) : isCallRecording ? (
            <CallRecordingCard message={msg} />
          ) : isDocumentCard ? (
            <DocumentCard message={msg} chatId={activeChat?.id} />
          ) : (
            <div className="text-sm text-wa-text leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-code:bg-black/10 dark:prose-code:bg-black/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-black/10 dark:prose-pre:bg-black/40 prose-pre:rounded-lg">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content || ''}
              </ReactMarkdown>

              {/* Inline translation result */}
              {translations[msg.id] && (
                <div className="mt-2 pt-2 border-t border-white/10 text-xs select-text">
                  <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold mb-1">
                    <span className="flex items-center gap-1">
                      <span>🌐</span>
                      <span>Traducido al {translations[msg.id].targetLangName || translations[msg.id].targetLang}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRevertTranslation && onRevertTranslation(msg.id)}
                      className="text-gray-400 hover:text-white underline text-[9px]"
                    >
                      Ocultar
                    </button>
                  </div>
                  <p className="text-gray-100 italic bg-black/25 p-2 rounded-xl border border-emerald-500/20 leading-relaxed">
                    "{translations[msg.id].translatedText}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Timestamp + ticks */}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'} ${isSticker ? 'bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full w-fit ml-auto' : ''}`}>
            {isStarred && <span className="text-[10px]" title="Mensaje destacado">⭐</span>}
            {isPinned && <span className="text-[10px]" title="Mensaje fijado">📌</span>}
            {copied && <span className="text-[9px] text-wa-green">¡Copiado!</span>}
            <span className="text-[10px] text-wa-secondary">{formatTime(msg.timestamp)}</span>
            {isMe && <Ticks status={msg.status} />}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="bg-wa-header rounded-full px-2 py-0.5 text-xs flex items-center gap-1 hover:bg-wa-input transition-colors"
              >
                {emoji} <span className="text-wa-secondary">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        {showActions && !isDeleted && (
          <div className={`absolute top-0 ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} flex items-center gap-1 z-10`}>
            {msg.content && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCtxMenu({ x: e.clientX, y: e.clientY })
                }}
                className="p-1.5 rounded-full bg-wa-header hover:bg-wa-input text-wa-icon hover:text-emerald-400 transition-colors"
                title="Traducir mensaje con IA"
              >
                <span className="text-xs">🌐</span>
              </button>
            )}
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded-full bg-wa-header hover:bg-wa-input text-wa-icon transition-colors"
              title="Reaccionar"
            >
              <EmojiIcon />
            </button>
            <button
              onClick={() => onReply(msg)}
              className="p-1.5 rounded-full bg-wa-header hover:bg-wa-input text-wa-icon transition-colors"
              title="Responder"
            >
              <ReplyIcon />
            </button>
            {isMe && (
              <button
                onClick={() => onDelete(msg.id)}
                className="p-1.5 rounded-full bg-wa-header hover:bg-red-500/20 text-wa-icon hover:text-red-400 transition-colors"
                title="Eliminar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Emoji picker on hover */}
        {showEmoji && (
          <div className={`absolute top-8 ${isMe ? 'right-0' : 'left-0'} z-20 bg-wa-header border border-gray-700 rounded-2xl p-2 shadow-xl`}>
            <div className="grid grid-cols-6 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { onReact(msg.id, e); setShowEmoji(false) }}
                  className="text-lg hover:scale-125 transition-transform p-0.5"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          msg={msg}
          isMe={isMe}
          isPinned={isPinned}
          isStarred={isStarred}
          onClose={() => setCtxMenu(null)}
          onReply={onReply}
          onReact={onReact}
          onDelete={onDelete}
          onCopy={handleCopy}
          onPin={onPin}
          onUnpin={onUnpin}
          onStar={onStar}
          onUnstar={onUnstar}
          onExportChat={onExportChat}
          onTranslate={onTranslate}
        />
      )}
    </div>
  )
}

// ── Typing Indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start px-4 mb-2">
      <div className="bg-wa-bubble-in rounded-2xl px-4 py-3 flex items-center gap-1.5">
        <span className="text-wa-secondary text-xs mr-1">escribiendo</span>
        {[0,1,2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-wa-secondary rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Date Separator ─────────────────────────────────────────────────────────
function DateSeparator({ date }) {
  return (
    <div className="flex items-center justify-center my-3 px-4">
      <div className="bg-wa-bubble-in/80 backdrop-blur-sm text-wa-secondary text-xs px-4 py-1.5 rounded-full">
        {date}
      </div>
    </div>
  )
}

// ── Internal Note Card (Private helpdesk memo) ────────────────────────
function InternalNoteCard({ note, onDelete }) {
  return (
    <div className="flex justify-center my-3 px-4 animate-fade-in">
      <div className="w-full max-w-xl bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/50 rounded-2xl p-3.5 shadow-md backdrop-blur-sm transition-all hover:border-amber-400">
        <div className="flex items-center justify-between pb-2 border-b border-amber-300/60 dark:border-amber-500/30 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 uppercase tracking-wider">
              <span>🔒 NOTA INTERNA</span>
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-amber-200">
              👤 {note.authorName || 'Agente'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-700 dark:text-amber-300/70 font-semibold">
              {formatTime(note.createdAt)}
            </span>
            {onDelete && (
              <button
                onClick={() => onDelete(note.id)}
                className="text-slate-600 dark:text-amber-400/60 hover:text-red-500 p-1 rounded hover:bg-black/10 dark:hover:bg-black/20 transition-colors"
                title="Eliminar nota interna"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="text-sm text-slate-900 dark:text-amber-100/90 whitespace-pre-wrap leading-relaxed px-0.5 font-medium">
          {note.content}
        </div>

        <div className="flex items-center justify-between pt-2 mt-2 border-t border-amber-300/40 dark:border-amber-500/20 text-[10px] text-slate-700 dark:text-amber-300/60 font-semibold">
          <span className="flex items-center gap-1">
            <span>🛡️</span>
            <span>Visible únicamente para el equipo interno · NUNCA se envía al cliente</span>
          </span>
          <span className="font-mono text-[9px] text-slate-800 dark:text-amber-400/50 font-bold">CRM CONFIDENCIAL</span>
        </div>
      </div>
    </div>
  )
}

// ── Emoji Picker Panel ─────────────────────────────────────────────────────
function EmojiPanel({ onSelect, onClose }) {
  return (
    <div className="absolute bottom-full left-0 mb-2 z-20 bg-wa-header border border-gray-700/60 rounded-2xl shadow-2xl p-3 w-72">
      <div className="grid grid-cols-8 gap-1.5">
        {['😀','😂','😍','🥰','😎','😢','😡','😱',
          '👍','👎','❤️','🔥','🎉','🙏','💯','⭐',
          '🚀','🎯','💡','🔑','💎','🏆','⚡','✅',
          '🍕','☕','🎸','🌟','💪','🤝','😊','🤔'].map(e => (
          <button key={e} onClick={() => onSelect(e)}
            className="text-xl hover:scale-125 transition-transform p-1 rounded">
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Load More Button ────────────────────────────────────────────────────────
function LoadMoreButton({ onClick, loading }) {
  return (
    <div className="flex justify-center my-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-1.5 bg-wa-header text-wa-secondary text-xs rounded-full hover:bg-wa-input transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="w-3 h-3 border-2 border-wa-secondary border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/>
          </svg>
        )}
        {loading ? 'Cargando...' : 'Mensajes anteriores'}
      </button>
    </div>
  )
}

// ── Main ChatArea Component ────────────────────────────────────────────────
export default function ChatArea() {
  const { activeChat, messages, typingUsers, ws, setMessages, addMessage, markChatRead, toggleRightPanel, replyTo, setReplyTo, startCall, inChatSearchOpen, setInChatSearchOpen, chatInputDraft, setChatInputDraft, currentUser } = useAppStore()
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [showCatalog, setShowCatalog] = useState(false)
  const [showCartModal, setShowCartModal] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showDocGenerator, setShowDocGenerator] = useState(false)
  const [showAiAgentsHub, setShowAiAgentsHub] = useState(false)
  const [showSaveContact, setShowSaveContact] = useState(false)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [quickReplies, setQuickReplies] = useState([])
  const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0)
  const [internalNotes, setInternalNotes] = useState([])
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false)
  const [isContactSimulatorMode, setIsContactSimulatorMode] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [translations, setTranslations] = useState({})

  // Consume text inserted from Copilot suggestions or Knowledge Base
  useEffect(() => {
    if (chatInputDraft) {
      setText((prev) => (prev ? `${prev} ${chatInputDraft}` : chatInputDraft))
      setChatInputDraft('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [chatInputDraft, setChatInputDraft])

  const handleTranslateMessage = async (msg, targetLang = 'qu') => {
    const textToTranslate = msg.content || msg.fileName
    if (!textToTranslate) return

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          targetLang
        })
      })
      if (res.ok) {
        const data = await res.json()
        setTranslations(prev => ({
          ...prev,
          [msg.id]: {
            originalText: textToTranslate,
            translatedText: data.translatedText,
            targetLang: data.targetLang,
            targetLangName: data.targetLangName
          }
        }))
      }
    } catch (err) {
      console.error('Error translating message:', err)
    }
  }

  const handleRevertTranslation = (msgId) => {
    setTranslations(prev => {
      const next = { ...prev }
      delete next[msgId]
      return next
    })
  }

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const attachMenuRef = useRef(null)

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`
    }
  }, [text])

  // Close attach menu on click outside
  useEffect(() => {
    if (!showAttachMenu) return
    const handleClickOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAttachMenu])

  const chatId = activeChat?.id
  const chatMessages = messages[chatId] || []
  const isTyping = Object.keys(typingUsers[chatId] || {}).length > 0

  const fetchPinnedMessages = useCallback(async () => {
    if (!chatId) return
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/pinned`)
      if (res.ok) {
        const data = await res.json()
        setPinnedMessages(data)
      }
    } catch (err) {
      console.error('Error fetching pinned messages:', err)
    }
  }, [chatId])

  useEffect(() => {
    fetchPinnedMessages()
  }, [fetchPinnedMessages])

  const fetchInternalNotes = useCallback(async () => {
    if (!chatId) return
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/notes`)
      if (res.ok) {
        const data = await res.json()
        setInternalNotes(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching internal notes:', e)
    }
  }, [chatId])

  useEffect(() => {
    fetchInternalNotes()
  }, [fetchInternalNotes])

  useEffect(() => {
    if (!ws) return
    const handleWs = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        if (data.type === 'internal_note_added' && data.chatId === chatId) {
          setInternalNotes(prev => [...prev.filter(n => n.id !== data.note.id), data.note])
        } else if (data.type === 'internal_note_deleted' && data.chatId === chatId) {
          setInternalNotes(prev => prev.filter(n => n.id !== data.noteId))
        }
      } catch {}
    }
    ws.addEventListener('message', handleWs)
    return () => ws.removeEventListener('message', handleWs)
  }, [ws, chatId])

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('¿Eliminar esta nota interna privada?')) return
    try {
      await fetch(`http://localhost:3001/api/notes/${noteId}`, { method: 'DELETE' })
      setInternalNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (e) {
      console.error(e)
    }
  }

  const handlePin = async (messageId) => {
    try {
      await fetch(`http://localhost:3001/api/chats/${chatId}/pinned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })
      fetchPinnedMessages()
    } catch (err) {
      console.error('Error pinning message:', err)
    }
  }

  const handleUnpin = async (messageId) => {
    try {
      await fetch(`http://localhost:3001/api/chats/${chatId}/pinned/${messageId}`, {
        method: 'DELETE'
      })
      fetchPinnedMessages()
    } catch (err) {
      console.error('Error unpinning message:', err)
    }
  }

  const handleStar = async (messageId) => {
    try {
      await fetch(`http://localhost:3001/api/messages/${messageId}/star`, { method: 'POST' })
      useAppStore.setState((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, isStarred: 1 } : m
          ),
        },
      }))
    } catch (err) {
      console.error('Error starring message:', err)
    }
  }

  const handleUnstar = async (messageId) => {
    try {
      await fetch(`http://localhost:3001/api/messages/${messageId}/star`, { method: 'DELETE' })
      useAppStore.setState((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, isStarred: 0 } : m
          ),
        },
      }))
    } catch (err) {
      console.error('Error unstarring message:', err)
    }
  }

  // Load quick replies on mount
  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/quick-replies')
        if (res.ok) {
          const data = await res.json()
          setQuickReplies(data)
        }
      } catch (err) {
        console.error('Error fetching quick replies:', err)
      }
    }
    loadQuickReplies()
  }, [])

  const showQuickReplies = text.startsWith('/')
  const filteredQuickReplies = quickReplies.filter(qr =>
    qr.shortcut.toLowerCase().startsWith(text.toLowerCase()) ||
    qr.message.toLowerCase().includes(text.slice(1).toLowerCase())
  )

  const handleSelectQuickReply = (qr) => {
    if (!qr) return
    setText(qr.message)
    setSelectedQuickReplyIndex(0)
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleSendProduct = async (product) => {
    if (!chatId) return
    setShowCatalog(false)
    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const payload = {
      productId: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency || 'EUR',
      imageUrl: product.imageUrl,
      inStock: product.inStock
    }
    const contentStr = JSON.stringify(payload)
    const optimistic = {
      id: optId,
      chatId,
      senderId: 'me',
      content: contentStr,
      type: 'product_card',
      timestamp: Date.now(),
      status: 'sent',
      replyTo: null,
      reactions: '{}',
    }
    addMessage(chatId, optimistic)

    try {
      const saved = await sendMessage(chatId, {
        content: contentStr,
        senderId: 'me',
        type: 'product_card'
      })
      useAppStore.setState((s) => ({
        messages: {
          ...s.messages,
          [chatId]: s.messages[chatId].map((m) => m.id === optId ? { ...saved, _confirmed: true } : m),
        },
      }))
    } catch (e) {
      console.error('Send product card failed', e)
    }
  }

  const handleConsultProduct = (product) => {
    const symbol = product.currency === 'USD' ? '$' : '€'
    const queryText = `Hola, me interesa obtener más información sobre "${product.title}" (${symbol}${Number(product.price || 0).toFixed(2)}).`
    setText(queryText)
    textareaRef.current?.focus()
  }

  const handleSendSticker = async (stickerUrl) => {
    if (!chatId || !stickerUrl) return
    setShowStickerPicker(false)
    try {
      await sendOfflineFirstMessage({
        chatId,
        content: stickerUrl,
        filePath: stickerUrl,
        type: 'sticker'
      }, useAppStore)
    } catch (e) {
      console.error('Send sticker failed', e)
    }
  }

  // Load messages when active chat changes (IndexedDB offline-first cache + network fetch)
  useEffect(() => {
    if (!chatId) return
    setHasMore(true)

    // 1. Instant offline hydration from local IndexedDB
    getLocalMessages(chatId).then((cachedMsgs) => {
      if (cachedMsgs && cachedMsgs.length > 0 && !messages[chatId]) {
        setMessages(chatId, cachedMsgs)
      }
    }).catch(() => {})

    // 2. Fetch fresh messages from network
    if (!messages[chatId]) {
      fetchMessages(chatId, { limit: 50 }).then((msgs) => {
        setMessages(chatId, msgs)
        saveLocalMessages(msgs).catch(() => {})
        setHasMore(msgs.length >= 50)
      }).catch((err) => {
        console.warn('Network unreachable, displaying cached messages for chat:', chatId)
      })
    }
    markChatRead(chatId)
  }, [chatId])

  // Sync search state from store (e.g. from RightPanel)
  useEffect(() => {
    if (inChatSearchOpen) setSearchOpen(true)
  }, [inChatSearchOpen])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length, isTyping])

  // Load older messages (pagination)
  const loadMore = async () => {
    if (loadingMore || !hasMore || !chatId) return
    const oldest = chatMessages[0]
    if (!oldest) return
    setLoadingMore(true)
    try {
      const older = await fetchMessages(chatId, { limit: 50, before: oldest.timestamp })
      if (older.length === 0) { setHasMore(false); return }
      useAppStore.setState((s) => ({
        messages: {
          ...s.messages,
          [chatId]: [...older, ...(s.messages[chatId] || [])],
        }
      }))
      setHasMore(older.length >= 50)
      // Keep scroll position stable
      const container = scrollContainerRef.current
      if (container) {
        const prevScrollHeight = container.scrollHeight
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevScrollHeight
        })
      }
    } catch (e) {
      console.error('loadMore failed', e)
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle send
  const handleSend = useCallback(async () => {
    const content = text.trim()
    if (!content || !chatId) return

    if (isInternalNoteMode) {
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      try {
        const res = await fetch(`/api/chats/${chatId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            authorName: currentUser?.name || 'Yo (Operador Actual)',
            authorId: currentUser?.id || 'agent-me'
          })
        })
        if (res.ok) {
          const note = await res.json()
          setInternalNotes(prev => [...prev.filter(n => n.id !== note.id), note])
        }
      } catch (err) {
        console.error('Error saving internal note:', err)
      }
      return
    }

    setText('')
    const targetReplyTo = replyTo
    setReplyTo(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    ws?.send(JSON.stringify({ type: 'stop_typing', chatId, userId: currentUser?.id || 'me' }))

    const senderId = isContactSimulatorMode
      ? (activeChat?.contactId || 'c_' + (activeChat?.contactName || 'contacto').toLowerCase().replace(/\s+/g, '_'))
      : (currentUser?.id || 'agent-me');
    const senderName = isContactSimulatorMode
      ? (activeChat?.groupName || activeChat?.contactName || 'Contacto')
      : (currentUser?.name || 'Yo');

    try {
      await sendOfflineFirstMessage({
        chatId,
        content,
        replyTo: targetReplyTo?.id || null,
        type: 'text',
        senderId,
        senderName
      }, useAppStore)
    } catch (e) {
      console.error('sendOfflineFirstMessage failed', e)
    }
  }, [text, chatId, replyTo, ws, isInternalNoteMode, isContactSimulatorMode, currentUser, activeChat])

  // Typing indicator via WS
  const handleTyping = (val) => {
    setText(val)
    if (!ws) return
    ws.send(JSON.stringify({ type: 'typing', chatId, userId: 'me' }))
    if (typingTimeout) clearTimeout(typingTimeout)
    setTypingTimeout(setTimeout(() => {
      ws.send(JSON.stringify({ type: 'stop_typing', chatId, userId: 'me' }))
    }, 2000))
  }

  // Key handler
  const handleKey = (e) => {
    if (showQuickReplies && filteredQuickReplies.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedQuickReplyIndex((i) => (i + 1) % filteredQuickReplies.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedQuickReplyIndex((i) => (i - 1 + filteredQuickReplies.length) % filteredQuickReplies.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectQuickReply(filteredQuickReplies[selectedQuickReplyIndex] || filteredQuickReplies[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setText('')
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  // File upload
  const handleFile = async (file) => {
    if (!file || !chatId) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const result = await uploadFile(file, setUploadProgress)
      const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)
      const msg = await sendMessage(chatId, {
        senderId: 'me',
        content: '',
        type: isImg ? 'image' : 'file',
        fileName: result.fileName,
        fileSize: result.fileSize,
        filePath: result.filePath,
      })
      addMessage(chatId, msg)
    } catch (e) { console.error('Upload failed', e) }
    finally { setUploading(false); setUploadProgress(0) }
  }

  // Drag & drop
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Reactions
  const handleReact = async (messageId, emoji) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userId: 'me' }),
      })
      const { reactions } = await res.json()
      useAppStore.getState().updateMessageReactions(messageId, reactions)
      ws?.send(JSON.stringify({ type: 'reaction', messageId, reactions }))
    } catch {}
  }

  // Delete message
  const handleDelete = async (messageId) => {
    try {
      await fetch(`/api/messages/${messageId}`, { method: 'DELETE' })
      useAppStore.getState().markMessageDeleted(messageId)
      ws?.send(JSON.stringify({ type: 'message_deleted', messageId }))
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  // Group messages and internal notes chronologically by date
  const grouped = []
  let lastDate = null
  const filtered = searchText
    ? chatMessages.filter((m) => m.content?.toLowerCase().includes(searchText.toLowerCase()))
    : chatMessages

  const combinedTimeline = [
    ...filtered.map((m) => ({ ...m, _itemType: 'message', _sortTime: m.timestamp || 0 })),
    ...internalNotes.map((n) => ({ ...n, _itemType: 'note', _sortTime: n.createdAt || 0 })),
  ].sort((a, b) => a._sortTime - b._sortTime)

  combinedTimeline.forEach((item) => {
    const d = formatDate(item._sortTime)
    if (d !== lastDate) { grouped.push({ type: 'date', date: d }); lastDate = d }
    if (item._itemType === 'note') {
      grouped.push({ type: 'note', note: item })
    } else {
      grouped.push({ type: 'msg', msg: item })
    }
  })

  const chatName = activeChat?.type === 'group' ? activeChat.groupName : activeChat?.contactName
  const chatAvatar = activeChat?.type === 'group' ? activeChat.groupAvatar : activeChat?.contactAvatar
  const isOnline = activeChat?.contactIsOnline === 1

  if (!activeChat) return null

  return (
    <div
      className="flex flex-col h-full bg-wa-chat relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-wa-dark/80 flex items-center justify-center border-2 border-dashed border-wa-green rounded-none">
          <div className="text-center">
            <div className="text-5xl mb-3">📎</div>
            <p className="text-wa-green text-xl font-semibold">Suelta para enviar</p>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-wa-header px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-700/30 flex-shrink-0">
        <button
          type="button"
          onClick={() => useAppStore.getState().setActiveChat(null)}
          className="md:hidden p-2 -ml-1 rounded-full hover:bg-white/10 text-wa-icon hover:text-wa-text flex items-center justify-center transition-colors flex-shrink-0"
          title="Volver a la lista de chats"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={toggleRightPanel} className="flex items-center gap-2.5 sm:gap-3 flex-1 text-left hover:opacity-80 transition-opacity min-w-0">
          <div className="relative flex-shrink-0">
            <img src={chatAvatar} alt={chatName} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover" />
            {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-wa-green rounded-full border-2 border-wa-header" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <p className="font-semibold text-wa-text text-sm sm:text-base leading-tight truncate">{chatName}</p>
              <ChannelBadge channel={activeChat.channel} size="sm" />
              <TicketStatusBadge status={activeChat.status} size="sm" />
              {activeChat.disappearingTimer > 0 && (
                <span className="text-xs text-wa-secondary" title="Mensajes temporales activados">⏱️</span>
              )}
              {activeChat.aiDepartmentId && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowAiAgentsHub(true); }}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-sm"
                  title="Atendido por Especialista Departamental de IA. Clic para supervisar o transferir."
                >
                  <span>{activeChat.aiDepartmentId === 'dept_ventas' ? '💼 Ventas IA' : activeChat.aiDepartmentId === 'dept_soporte' ? '🛠️ Soporte RAG' : activeChat.aiDepartmentId === 'dept_facturacion' ? '💵 Finanzas IA' : activeChat.aiDepartmentId === 'dept_legal_academico' ? '📜 Legal CNEB' : '🤖 IA Autónomo'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-wa-secondary truncate">
              {isTyping ? (
                <span className="text-wa-green animate-pulse">escribiendo...</span>
              ) : activeChat.type === 'group' ? (
                `Grupo · ${activeChat.unreadCount > 0 ? `${activeChat.unreadCount} no leídos` : 'activo'}`
              ) : isOnline ? 'en línea' : (
                activeChat.contactLastSeen ? `visto ${formatTime(activeChat.contactLastSeen)}` : 'desconectado'
              )}
            </p>
          </div>
        </button>

        {/* Header actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button onClick={() => setSearchOpen(!searchOpen)} className="hidden sm:inline-flex p-2 rounded-full hover:bg-black/20 text-wa-icon transition-colors" title="Buscar en el chat"><SearchIcon /></button>
          <button onClick={() => startCall(activeChat, 'voice')} className="p-2 rounded-full hover:bg-black/20 text-wa-icon hover:text-wa-green transition-colors" title="Llamada de voz"><PhoneIcon /></button>
          <button onClick={() => startCall(activeChat, 'video')} className="p-2 rounded-full hover:bg-black/20 text-wa-icon hover:text-wa-green transition-colors" title="Videollamada"><VideoIcon /></button>
          <button
            onClick={() => setShowDocGenerator(true)}
            className="hidden sm:inline-flex p-2 rounded-full hover:bg-black/20 text-wa-icon hover:text-cyan-400 transition-colors"
            title="Generador de Documentos & Contratos IA"
          >
            <span className="text-sm">📄</span>
          </button>
          <button
            onClick={() => setShowAiAgentsHub(true)}
            className="hidden sm:inline-flex p-2 rounded-full hover:bg-black/20 text-wa-icon hover:text-emerald-400 transition-colors"
            title="Especialistas y Enrutamiento Multi-Agente de IA"
          >
            <span className="text-sm">🤖</span>
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="p-2 rounded-full hover:bg-black/20 text-wa-icon transition-colors"
              title="Más opciones del chat"
            >
              <DotsIcon />
            </button>
            {showHeaderMenu && (
              <div className="absolute right-0 top-10 w-56 bg-wa-header rounded-xl shadow-2xl z-30 py-1.5 border border-gray-700/60 animate-scale-in text-sm">
                <button
                  onClick={() => { setShowHeaderMenu(false); toggleRightPanel() }}
                  className="w-full text-left px-4 py-2 hover:bg-white/10 text-wa-text flex items-center gap-2.5 transition-colors"
                >
                  <span>ℹ️</span>
                  <span>Info del chat</span>
                </button>
                <button
                  onClick={() => { setShowHeaderMenu(false); setShowDocGenerator(true) }}
                  className="w-full text-left px-4 py-2 hover:bg-white/10 text-cyan-400 font-semibold flex items-center gap-2.5 transition-colors"
                >
                  <span>📄</span>
                  <span>Generar Documento / Contrato</span>
                </button>
                <button
                  onClick={() => { setShowHeaderMenu(false); setShowExportModal(true) }}
                  className="w-full text-left px-4 py-2 hover:bg-white/10 text-emerald-400 font-medium flex items-center gap-2.5 transition-colors"
                >
                  <span>📤</span>
                  <span>Exportar chat</span>
                </button>
                <button
                  onClick={() => { setShowHeaderMenu(false); setSearchOpen(true) }}
                  className="w-full text-left px-4 py-2 hover:bg-white/10 text-wa-text flex items-center gap-2.5 transition-colors"
                >
                  <span>🔍</span>
                  <span>Buscar mensajes</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="bg-wa-sidebar px-4 py-2 flex items-center gap-2 border-b border-gray-700/30">
          <SearchIcon />
          <input
            autoFocus
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar en el chat..."
            className="flex-1 bg-transparent text-wa-text placeholder-wa-secondary outline-none text-sm"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="text-wa-secondary hover:text-wa-text"><CloseIcon /></button>
          )}
          <button onClick={() => { setSearchOpen(false); setInChatSearchOpen(false); setSearchText('') }} className="text-wa-secondary hover:text-wa-text text-sm">Cerrar</button>
        </div>
      )}

      {/* ── Encryption Banner ────────────────────────────────────────── */}
      <EncryptionBanner />

      {/* ── Unsaved Number Banner ─────────────────────────────────── */}
      {activeChat.type !== 'group' && (activeChat.contactName?.startsWith('+') || /\d{6,}/.test(activeChat.contactName || '') || activeChat.contactStatus === 'Número no guardado') && (
        <div className="bg-wa-sidebar/95 border-b border-wa-border/40 px-4 py-2 flex items-center justify-between text-xs animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 text-wa-secondary">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span>📞</span> Número no guardado: {activeChat.contactPhone || activeChat.contactName}
            </span>
            <span className="hidden sm:inline text-wa-secondary/70">• No está en tu lista de contactos.</span>
          </div>
          <button
            onClick={() => setShowSaveContact(true)}
            className="px-3.5 py-1 rounded-full bg-wa-green hover:bg-emerald-600 active:scale-95 text-white font-bold text-[11px] transition-all shadow flex items-center gap-1"
          >
            <span>➕</span>
            <span>Añadir a contactos</span>
          </button>
        </div>
      )}

      {/* ── Disappearing Messages Notification ─────────────────────── */}
      {activeChat.disappearingTimer > 0 && (
        <div className="flex items-center justify-center my-1.5 px-4">
          <div className="bg-wa-sidebar/90 backdrop-blur-sm text-wa-secondary text-[11px] px-3.5 py-1 rounded-full flex items-center gap-1.5 border border-white/5 shadow-sm">
            <span>⏱️</span>
            <span>
              Mensajes temporales activados:{' '}
              {activeChat.disappearingTimer === 86400000
                ? '24 horas'
                : activeChat.disappearingTimer === 604800000
                ? '7 días'
                : activeChat.disappearingTimer === 7776000000
                ? '90 días'
                : 'activados'}
            </span>
          </div>
        </div>
      )}

      {/* ── Pinned Message Banner ─────────────────────────────────── */}
      {pinnedMessages.length > 0 && (
        <div className="bg-wa-sidebar/95 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-gray-700/40 text-xs shadow-md z-10 transition-all">
          <div
            className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 group"
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessages[0].id}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('ring-2', 'ring-wa-green', 'rounded-xl')
                setTimeout(() => el.classList.remove('ring-2', 'ring-wa-green', 'rounded-xl'), 2000)
              }
            }}
          >
            <span className="text-wa-green font-bold flex items-center gap-1 flex-shrink-0">
              📌 {pinnedMessages.length > 1 ? `${pinnedMessages.length} fijados` : 'Fijado'}
            </span>
            <span className="text-wa-secondary truncate group-hover:text-wa-text transition-colors">
              {pinnedMessages[0].content || pinnedMessages[0].fileName || 'Archivo multimedia'}
            </span>
          </div>
          <button
            onClick={() => handleUnpin(pinnedMessages[0].id)}
            className="text-wa-secondary hover:text-wa-text ml-2 p-1 rounded-full hover:bg-black/20 transition-colors"
            title="Desfijar mensaje"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Messages List ───────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-4 chat-bg"
      >
        {/* Upload progress */}
        {uploading && (
          <div className="sticky top-2 mx-4 z-10 bg-wa-header rounded-xl p-3 flex items-center gap-3 shadow-xl">
            <div className="text-wa-green text-sm font-medium">Subiendo archivo...</div>
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div className="bg-wa-green h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-wa-secondary text-xs">{uploadProgress}%</span>
          </div>
        )}

        {/* Load more button */}
        {hasMore && chatMessages.length >= 50 && !searchText && (
          <LoadMoreButton onClick={loadMore} loading={loadingMore} />
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') return <DateSeparator key={`d-${i}`} date={item.date} />
          if (item.type === 'note') {
            return (
              <InternalNoteCard
                key={item.note.id}
                note={item.note}
                onDelete={handleDeleteNote}
              />
            )
          }
          const { msg } = item
          const myId = currentUser?.id || 'agent-me'
          const isMe = msg.senderId === myId || (msg.senderId === 'me' && (myId === 'agent-me' || myId === 'me'))
          const isPinned = pinnedMessages.some((p) => p.id === msg.id)
          const isStarred = Boolean(msg.isStarred)
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMe={isMe}
              isPinned={isPinned}
              isStarred={isStarred}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onStar={handleStar}
              onUnstar={handleUnstar}
              onReact={handleReact}
              onReply={setReplyTo}
              onDelete={handleDelete}
              onConsultProduct={handleConsultProduct}
              onExportChat={() => setShowExportModal(true)}
              activeChat={activeChat}
              translations={translations}
              onTranslate={handleTranslateMessage}
              onRevertTranslation={handleRevertTranslation}
            />
          )
        })}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 relative transition-colors ${
        isInternalNoteMode ? 'bg-amber-950/30 border-t border-amber-500/30' : 'bg-wa-input'
      }`}>
        {/* Input Mode Selector: Mensaje al Cliente vs Nota Interna Privada + Herramientas Rápidas */}
        <div className={`flex items-center justify-between px-3 py-1.5 border-b transition-colors ${
          isInternalNoteMode
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
            : 'bg-wa-header/70 border-white/5'
        }`}>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 mr-2 pb-0.5">
            <button
              type="button"
              onClick={() => setIsInternalNoteMode(false)}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-all ${
                !isInternalNoteMode
                  ? 'bg-wa-green text-white shadow-sm font-bold'
                  : 'text-slate-700 dark:text-wa-secondary hover:text-wa-text hover:bg-black/5 dark:hover:bg-white/5 font-medium'
              }`}
            >
              <span>💬 Mensaje</span>
            </button>
            <button
              type="button"
              onClick={() => setIsInternalNoteMode(true)}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-all ${
                isInternalNoteMode
                  ? 'bg-amber-500 text-black font-bold shadow-md ring-2 ring-amber-400/50'
                  : 'text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-500/15 font-bold'
              }`}
            >
              <span>🔒 Nota Interna</span>
              {internalNotes.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isInternalNoteMode ? 'bg-black/25 text-black' : 'bg-amber-500/20 text-amber-900 dark:text-amber-300'
                }`}>
                  {internalNotes.length}
                </span>
              )}
            </button>

            {/* Simulator: Responder como Contacto */}
            {activeChat?.type !== 'group' && (
              <button
                type="button"
                onClick={() => {
                  setIsContactSimulatorMode(!isContactSimulatorMode)
                  if (isInternalNoteMode) setIsInternalNoteMode(false)
                }}
                className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 flex-shrink-0 transition-all ${
                  isContactSimulatorMode
                    ? 'bg-sky-500 text-white font-bold shadow-md ring-2 ring-sky-400'
                    : 'text-sky-800 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 hover:bg-sky-500/15 font-bold border border-sky-400/40'
                }`}
                title={`Simular respuesta del contacto (${activeChat?.contactName || 'Contacto'}) para probar timbre y chat en vivo`}
              >
                <span>👤</span>
                <span>{isContactSimulatorMode ? `Respondiendo como ${activeChat?.contactName?.split(' ')[0] || 'Contacto'}` : `Responder como ${activeChat?.contactName?.split(' ')[0] || 'Contacto'}`}</span>
              </button>
            )}

            {/* Separator */}
            <div className="h-4 w-px bg-wa-border mx-1 flex-shrink-0" />

            {/* Quick Tools Pills for Business */}
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-400 border border-emerald-500/40 flex items-center gap-1 flex-shrink-0 transition-colors shadow-sm"
              title="Cobrar con Yape, Plin o Tarjetas"
            >
              <span>💳</span>
              <span>Cobrar</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCartModal(true)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-800 dark:text-indigo-400 border border-indigo-500/40 flex items-center gap-1 flex-shrink-0 transition-colors shadow-sm"
              title="Crear Pedido / Carrito de Compras (Meta WhatsApp Business)"
            >
              <span>🛒</span>
              <span>Pedido</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-400 border border-amber-500/40 flex items-center gap-1 flex-shrink-0 transition-colors shadow-sm"
              title="Programar mensaje automático"
            >
              <span>⏰</span>
              <span>Programar</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-800 dark:text-sky-400 border border-sky-500/40 flex items-center gap-1 flex-shrink-0 transition-colors shadow-sm"
              title="Catálogo de productos"
            >
              <span>🛍️</span>
              <span>Catálogo</span>
            </button>

            <button
              type="button"
              data-sticker-toggle="true"
              onClick={() => {
                setShowStickerPicker(prev => !prev)
                setShowEmoji(false)
                setShowAttachMenu(false)
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 flex-shrink-0 transition-all shadow-sm ${
                showStickerPicker
                  ? 'bg-rose-500/30 text-rose-900 dark:text-rose-300 border-rose-500/60 ring-2 ring-rose-500/40'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-400 border-rose-500/40'
              }`}
              title="Stickers y creador"
            >
              <span>💟</span>
              <span>Stickers</span>
            </button>
          </div>

          {isInternalNoteMode ? (
            <span className="text-[11px] text-amber-900 dark:text-amber-300 font-bold hidden lg:inline flex-shrink-0">
              🛡️ Modo Privado
            </span>
          ) : (
            <span className="text-[10px] text-slate-600 dark:text-wa-secondary font-semibold hidden lg:inline flex-shrink-0">
              Enter ↵ para enviar
            </span>
          )}
        </div>

        {/* Sticker Picker Popover */}
        {showStickerPicker && (
          <StickerPicker
            onSelectSticker={handleSendSticker}
            onClose={() => setShowStickerPicker(false)}
          />
        )}

        {/* Quick Replies Autocomplete Popover */}
        {showQuickReplies && filteredQuickReplies.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 max-h-56 overflow-y-auto bg-wa-header/95 backdrop-blur-md border border-emerald-500/40 rounded-xl shadow-2xl z-30 divide-y divide-gray-700/40">
            <div className="px-3 py-1.5 bg-emerald-950/60 text-[11px] font-semibold text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">⚡ Respuestas Rápidas ({filteredQuickReplies.length})</span>
              <span className="text-gray-400 font-normal text-[10px]">Usa ↑ ↓ y Enter para elegir</span>
            </div>
            {filteredQuickReplies.map((qr, idx) => (
              <div
                key={qr.id}
                onClick={() => handleSelectQuickReply(qr)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                  idx === selectedQuickReplyIndex ? 'bg-emerald-600/30 text-white' : 'hover:bg-white/5 text-wa-text'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 mr-2">{qr.shortcut}</span>
                  <span className="text-xs text-gray-200 truncate">{qr.message}</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono flex-shrink-0">Enter ↵</span>
              </div>
            ))}
          </div>
        )}

        {/* Reply preview */}
        {replyTo && !showRecorder && (
          <div className="flex items-center gap-3 px-4 py-2 bg-wa-header border-b border-gray-700/30">
            <div className="flex-1 border-l-4 border-wa-green pl-3">
              <p className="text-wa-green text-xs font-semibold">Respondiendo a {replyTo.senderId === 'me' ? 'ti mismo' : replyTo.senderName || replyTo.senderId}</p>
              <p className="text-wa-secondary text-xs truncate">{replyTo.content || replyTo.fileName}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-wa-secondary hover:text-wa-text"><CloseIcon /></button>
          </div>
        )}

        {/* VoiceRecorder */}
        {showRecorder ? (
          <VoiceRecorder
            chatId={chatId}
            senderId={currentUser?.id || 'agent-me'}
            senderName={currentUser?.name || 'Yo'}
            onSend={(msg) => {
              addMessage(chatId, msg)
              setShowRecorder(false)
            }}
            onCancel={() => setShowRecorder(false)}
          />
        ) : (
          <div className="flex items-end gap-2 px-3 py-2.5">
            {/* Emoji Button */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => { setShowEmoji(!showEmoji); setShowAttachMenu(false); setShowStickerPicker(false) }}
                className={`p-2.5 rounded-full hover:bg-black/20 transition-colors ${
                  showEmoji ? 'text-emerald-400 bg-emerald-500/10' : 'text-wa-icon hover:text-wa-text'
                }`}
                title="Emojis"
              >
                <EmojiIcon />
              </button>
              {showEmoji && (
                <EmojiPanel
                  onSelect={(e) => { setText((t) => t + e); textareaRef.current?.focus() }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>

            {/* Sticker Icon Button */}
            <button
              type="button"
              data-sticker-toggle="true"
              onClick={() => {
                setShowStickerPicker(prev => !prev)
                setShowEmoji(false)
                setShowAttachMenu(false)
              }}
              className={`p-2.5 rounded-full hover:bg-black/20 transition-colors flex-shrink-0 ${
                showStickerPicker ? 'text-rose-400 bg-rose-500/10' : 'text-wa-icon hover:text-wa-text'
              }`}
              title="Stickers y Creador"
            >
              <span className="text-xl leading-none">💟</span>
            </button>

            {/* Attach & Business Tools Popover (Estilo Oficial WhatsApp Web) */}
            <div className="relative flex-shrink-0" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); setShowStickerPicker(false) }}
                className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex-shrink-0 ${
                  showAttachMenu ? 'text-emerald-400 bg-emerald-500/10 rotate-45' : 'text-wa-icon hover:text-wa-text'
                }`}
                title="Adjuntar y Herramientas"
              >
                <AttachIcon />
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-12 left-0 mb-2 w-60 bg-wa-header/95 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl p-2 z-40 animate-scale-in space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      fileInputRef.current?.click()
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm flex-shrink-0">
                      📎
                    </span>
                    <div>
                      <p className="font-semibold text-wa-text">Fotos y Documentos</p>
                      <p className="text-[10px] text-wa-secondary">Imágenes, PDFs, archivos</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowPaymentModal(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm flex-shrink-0">
                      💳
                    </span>
                    <div>
                      <p className="font-semibold text-emerald-400">Cobrar / Link de Pago</p>
                      <p className="text-[10px] text-wa-secondary">Yape, Plin, Tarjeta, Stripe</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowCartModal(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm flex-shrink-0">
                      🛒
                    </span>
                    <div>
                      <p className="font-semibold text-indigo-400">Crear Pedido Comercial</p>
                      <p className="text-[10px] text-wa-secondary">Carrito de compras multi-producto</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowScheduleModal(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm flex-shrink-0">
                      ⏰
                    </span>
                    <div>
                      <p className="font-semibold text-amber-400">Programar Mensaje</p>
                      <p className="text-[10px] text-wa-secondary">Envío automático en fecha/hora</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowCatalog(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-sm flex-shrink-0">
                      🛍️
                    </span>
                    <div>
                      <p className="font-semibold text-teal-400">Catálogo de Productos</p>
                      <p className="text-[10px] text-wa-secondary">Tarjetas de producto interactivas</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowStickerPicker(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm flex-shrink-0">
                      💟
                    </span>
                    <div>
                      <p className="font-semibold text-rose-400">Stickers y Creador</p>
                      <p className="text-[10px] text-wa-secondary">Galería y recortes canvas</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowDocGenerator(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-wa-text hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm flex-shrink-0">
                      📄
                    </span>
                    <div>
                      <p className="font-semibold text-cyan-400">Generar Documento / Contrato</p>
                      <p className="text-[10px] text-wa-secondary">Plantillas, cotizaciones y firma IA</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }} />

            {/* Textarea Principal - Amplio, responsivo, nunca colapsa */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKey}
              onClick={() => { setShowEmoji(false); setShowAttachMenu(false) }}
              placeholder={
                isInternalNoteMode
                  ? "Escribe una nota interna para tu equipo (NUNCA visible para el cliente)..."
                  : isContactSimulatorMode
                  ? `Simulando a ${activeChat?.contactName || 'Contacto'}: escribe aquí para enviar como mensaje entrante en vivo...`
                  : "Escribe un mensaje aquí (o presiona '/' para respuestas rápidas)..."
              }
              rows={1}
              className={`flex-1 min-w-[120px] sm:min-w-[200px] w-full rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 outline-none resize-none text-sm leading-normal transition-all min-h-[46px] max-h-[140px] overflow-y-auto focus:ring-2 focus:ring-emerald-500/50 shadow-inner ${
                isInternalNoteMode
                  ? 'bg-amber-950/25 border-2 border-amber-500/60 text-amber-100 placeholder-amber-400/50 focus:border-amber-400'
                  : isContactSimulatorMode
                  ? 'bg-sky-950/20 border-2 border-sky-500/60 text-sky-100 placeholder-sky-400/60 focus:border-sky-400'
                  : 'bg-white dark:bg-wa-header text-wa-text placeholder-wa-secondary/80 border border-wa-border focus:border-emerald-500/40'
              }`}
            />

            {/* Send / Mic */}
            {isInternalNoteMode ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md flex-shrink-0 ${
                  text.trim()
                    ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer transform hover:scale-105 active:scale-95'
                    : 'bg-amber-500/20 text-amber-200/40 cursor-not-allowed'
                }`}
                title="Guardar nota interna privada"
              >
                <span>🔒</span>
                <span>Guardar Nota</span>
              </button>
            ) : isContactSimulatorMode ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim()}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md flex-shrink-0 ${
                  text.trim()
                    ? 'bg-sky-500 hover:bg-sky-400 text-white cursor-pointer transform hover:scale-105 active:scale-95'
                    : 'bg-sky-500/20 text-sky-200/40 cursor-not-allowed'
                }`}
                title="Enviar como mensaje entrante del contacto (simula su teléfono)"
              >
                <span>👤</span>
                <span>Enviar Contacto</span>
              </button>
            ) : text.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                className="p-2.5 rounded-full bg-wa-green hover:bg-green-600 text-white transition-all transform hover:scale-105 active:scale-95 flex-shrink-0 shadow-md"
                title="Enviar mensaje"
              >
                <SendIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setShowEmoji(false); setShowAttachMenu(false); setShowRecorder(true) }}
                className="p-2.5 rounded-full hover:bg-black/20 text-wa-icon hover:text-wa-green transition-colors flex-shrink-0"
                title="Grabar nota de voz"
              >
                <MicIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Catalog Modal */}
      {showCatalog && (
        <CatalogModal
          onClose={() => setShowCatalog(false)}
          onSendProduct={handleSendProduct}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          chat={activeChat}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <ScheduleMessageModal
          chat={activeChat}
          initialText={text}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => setText('')}
        />
      )}

      {/* Payment Checkout Modal (Yape / Plin / Stripe) */}
      {showPaymentModal && (
        <PaymentModal
          chatId={activeChat?.id}
          customerPhone={activeChat?.contactPhone || ''}
          onClose={() => setShowPaymentModal(false)}
          onPaymentCreated={() => setShowPaymentModal(false)}
        />
      )}

      {/* Shopping Cart / Order Modal (Meta WhatsApp Business) */}
      {showCartModal && (
        <CartModal
          chatId={activeChat?.id}
          onClose={() => setShowCartModal(false)}
          onOrderCreated={(orderMsg) => {
            setShowCartModal(false)
            if (orderMsg && activeChat?.id) {
              addMessage(activeChat.id, orderMsg)
            }
          }}
        />
      )}

      {/* Save Unsaved Number to Contacts */}
      {showSaveContact && (
        <SaveContactModal
          chat={activeChat}
          onClose={() => setShowSaveContact(false)}
        />
      )}

      {/* Smart Document & Contract Studio Modal */}
      {showDocGenerator && (
        <DocumentGenerator
          activeChat={activeChat}
          onClose={() => setShowDocGenerator(false)}
        />
      )}

      {/* Multi-Agent AI Routing & Specialists Hub Modal */}
      {showAiAgentsHub && (
        <AiAgentsHub
          onClose={() => setShowAiAgentsHub(false)}
        />
      )}
    </div>
  )
}
