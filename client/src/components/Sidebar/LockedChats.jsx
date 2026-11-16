import React, { useState, useEffect } from 'react'
import { formatChatTime, getAvatarGradient, getInitials } from '../../utils/formatters'

export default function LockedChats({
  allChats = [],
  activeChat,
  onSelectChat,
  onUnlockChat,
  lockedChatIds = [],
  onRefreshLocks
}) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showChangePinModal, setShowChangePinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Change PIN states
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [changePinError, setChangePinError] = useState('')
  const [changePinSuccess, setChangePinSuccess] = useState('')

  const lockedChats = allChats.filter((c) => lockedChatIds.includes(c.id))

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit
      setPin(nextPin)
      setPinError(false)
      if (nextPin.length === 4) {
        verifyPin(nextPin)
      }
    }
  }

  const handleDeleteDigit = () => {
    setPin(prev => prev.slice(0, -1))
    setPinError(false)
  }

  const verifyPin = async (inputPin) => {
    setVerifying(true)
    try {
      const res = await fetch('http://localhost:3001/api/locked-chats/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: inputPin })
      })
      const data = await res.json()
      if (data.valid) {
        setIsUnlocked(true)
        setShowPinModal(false)
        setPin('')
      } else {
        setPinError(true)
        setTimeout(() => setPin(''), 600)
      }
    } catch (err) {
      console.error('Error verifying PIN:', err)
      setPinError(true)
    } finally {
      setVerifying(false)
    }
  }

  const handleChangePin = async (e) => {
    e.preventDefault()
    setChangePinError('')
    setChangePinSuccess('')
    try {
      const res = await fetch('http://localhost:3001/api/locked-chats/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      })
      const data = await res.json()
      if (res.ok) {
        setChangePinSuccess('¡PIN actualizado correctamente!')
        setTimeout(() => {
          setShowChangePinModal(false)
          setCurrentPin('')
          setNewPin('')
          setChangePinSuccess('')
        }, 1200)
      } else {
        setChangePinError(data.error || 'Error al cambiar PIN')
      }
    } catch (err) {
      setChangePinError('Error de red al actualizar PIN')
    }
  }

  if (lockedChats.length === 0 && !isUnlocked) {
    return null
  }

  return (
    <div className="border-b border-white/5 bg-wa-header/40 transition-all">
      {/* Locked Folder Banner */}
      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer group">
        <div
          onClick={() => {
            if (isUnlocked) {
              setIsUnlocked(false)
            } else {
              setShowPinModal(true)
              setPin('')
              setPinError(false)
            }
          }}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
            isUnlocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-wa-input text-wa-icon group-hover:text-emerald-400'
          }`}>
            {isUnlocked ? '🔓' : '🔒'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-wa-text">Chats bloqueados</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {lockedChats.length}
              </span>
            </div>
            <p className="text-[11px] text-wa-secondary">
              {isUnlocked ? 'Carpeta secreta abierta' : 'Toca para desbloquear con PIN'}
            </p>
          </div>
        </div>

        {isUnlocked && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowChangePinModal(true)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-wa-secondary hover:text-wa-text text-xs"
              title="Cambiar PIN"
            >
              🔑
            </button>
            <button
              onClick={() => setIsUnlocked(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-wa-secondary hover:text-emerald-400 text-xs font-semibold"
              title="Bloquear carpeta ahora"
            >
              🔒 Bloquear
            </button>
          </div>
        )}
      </div>

      {/* Unlocked List View */}
      {isUnlocked && (
        <div className="bg-wa-sidebar/60 border-t border-white/5 divide-y divide-white/5 animate-fade-in">
          {lockedChats.map((chat) => {
            const name = chat.groupName || chat.contactName || 'Chat'
            const avatar = chat.groupAvatar || chat.contactAvatar
            const isOnline = chat.contactIsOnline === 1
            const isActive = activeChat?.id === chat.id

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center justify-between px-3 py-2.5 hover:bg-white/5 cursor-pointer transition-colors ${
                  isActive ? 'bg-wa-input' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className={`w-9 h-9 rounded-full ${getAvatarGradient(name)} flex items-center justify-center font-semibold text-white text-xs`}>
                        {getInitials(name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-wa-green rounded-full border border-wa-sidebar" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-wa-text truncate">{name}</span>
                      <span className="text-[10px] text-wa-secondary">{formatChatTime(chat.lastMessageTime)}</span>
                    </div>
                    <p className="text-xs text-wa-secondary truncate">{chat.lastMessage || 'Chat bloqueado'}</p>
                  </div>
                </div>

                {/* Unlock Chat Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnlockChat(chat.id)
                  }}
                  className="p-1.5 ml-2 rounded-lg hover:bg-red-500/20 text-wa-secondary hover:text-red-400 transition-colors text-xs flex-shrink-0"
                  title="Desbloquear este chat y devolverlo a la lista principal"
                >
                  🔓 Desbloquear
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* PIN Unlock Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-wa-header border border-gray-700/60 rounded-3xl w-full max-w-xs shadow-2xl p-6 text-center space-y-5 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 text-3xl mx-auto flex items-center justify-center border border-emerald-500/30">
              🔒
            </div>

            <div>
              <h3 className="text-base font-bold text-wa-text">Chats Bloqueados</h3>
              <p className="text-xs text-wa-secondary mt-1">Introduce tu PIN de 4 dígitos (predeterminado: 1234)</p>
            </div>

            {/* PIN Circles Display */}
            <div className={`flex items-center justify-center gap-3 py-2 ${pinError ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    pin.length > i
                      ? pinError ? 'bg-red-500 border-red-500' : 'bg-emerald-500 border-emerald-500 scale-110'
                      : 'border-gray-600 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-red-400 font-semibold animate-pulse">
                PIN incorrecto. Inténtalo de nuevo.
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDigit(digit)}
                  className="h-12 rounded-2xl bg-wa-input hover:bg-white/10 active:scale-95 text-wa-text font-bold text-lg transition-all flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setPin('')}
                className="h-12 rounded-2xl bg-transparent hover:bg-white/5 text-wa-secondary text-xs font-semibold flex items-center justify-center"
              >
                Limpiar
              </button>
              <button
                onClick={() => handleDigit('0')}
                className="h-12 rounded-2xl bg-wa-input hover:bg-white/10 active:scale-95 text-wa-text font-bold text-lg transition-all flex items-center justify-center"
              >
                0
              </button>
              <button
                onClick={handleDeleteDigit}
                className="h-12 rounded-2xl bg-transparent hover:bg-white/5 text-wa-secondary text-lg flex items-center justify-center"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={() => { setShowPinModal(false); setPin('') }}
              className="w-full py-2 text-xs text-wa-secondary hover:text-wa-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleChangePin}
            className="bg-wa-header border border-gray-700/60 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-700/50 pb-3">
              <h3 className="text-base font-bold text-wa-text flex items-center gap-2">
                <span>🔑</span>
                <span>Cambiar PIN de Bloqueo</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="p-1 text-wa-secondary hover:text-wa-text"
              >
                ✕
              </button>
            </div>

            {changePinError && (
              <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {changePinError}
              </div>
            )}

            {changePinSuccess && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                {changePinSuccess}
              </div>
            )}

            <div className="space-y-1 text-left">
              <label className="text-xs text-wa-secondary font-medium">PIN actual:</label>
              <input
                type="password"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Ej. 1234"
                className="w-full px-3 py-2 bg-wa-input border border-gray-700/60 rounded-xl text-xs text-wa-text outline-none focus:border-emerald-500 text-center tracking-widest text-base"
                required
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs text-wa-secondary font-medium">Nuevo PIN (4 a 6 dígitos):</label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Nuevo PIN"
                className="w-full px-3 py-2 bg-wa-input border border-gray-700/60 rounded-xl text-xs text-wa-text outline-none focus:border-emerald-500 text-center tracking-widest text-base"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="px-4 py-2 text-xs text-wa-secondary hover:text-wa-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Guardar nuevo PIN
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
