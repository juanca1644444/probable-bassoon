import React, { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

export default function SessionLockOverlay({ onUnlock }) {
  const { addToast } = useAppStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  // Handle digit press
  const handleDigit = (digit) => {
    if (loading) return
    setError(false)
    if (pin.length < 4) {
      const nextPin = pin + digit
      setPin(nextPin)
      if (nextPin.length === 4) {
        verifyPin(nextPin)
      }
    }
  }

  // Handle backspace / clear
  const handleBackspace = () => {
    if (loading) return
    setError(false)
    setPin((p) => p.slice(0, -1))
  }

  // Handle clear all
  const handleClear = () => {
    if (loading) return
    setError(false)
    setPin('')
  }

  // Verify PIN via REST
  const verifyPin = async (pinToVerify) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        addToast({
          id: `toast-${Date.now()}`,
          name: 'Seguridad',
          message: 'Sesión desbloqueada con éxito',
          avatar: '',
        })
        onUnlock()
      } else {
        triggerError(data.error || 'PIN incorrecto')
      }
    } catch (err) {
      console.error('Error verifying pin:', err)
      triggerError('Error al contactar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const triggerError = (msg) => {
    setError(true)
    setErrorMessage(msg)
    setShake(true)
    setTimeout(() => setShake(false), 600)
    setPin('')
  }

  // Keyboard event listener for physical typing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        handleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pin, loading])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 animate-fade-in select-none">
      <div
        className={`w-full max-w-sm bg-wa-header/90 border border-emerald-500/30 rounded-3xl p-7 shadow-2xl flex flex-col items-center text-center transition-all ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Brand Shield Logo */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/20">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-wa-header rounded-full flex items-center justify-center text-[10px] text-black font-bold">
            🔒
          </span>
        </div>

        {/* Title & Description */}
        <h2 className="text-xl font-black text-wa-text tracking-wide">
          CHASKYAPP
        </h2>
        <p className="text-xs font-semibold text-emerald-400 mt-0.5">
          Bloqueo de Seguridad / Inactividad
        </p>
        <p className="text-[11px] text-wa-secondary mt-2 px-2 leading-relaxed">
          Ingresa tu PIN de seguridad de 4 dígitos para continuar en la plataforma.
        </p>

        {/* PIN Indicators (4 Dots) */}
        <div className="flex items-center gap-4 my-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-emerald-400 scale-125 shadow-md shadow-emerald-400/50'
                    : 'bg-white/15 border border-white/20'
                } ${error ? 'bg-red-400 border-red-500' : ''}`}
              />
            )
          })}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-400 font-semibold mb-3 animate-pulse">
            ⚠️ {errorMessage}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(String(num))}
              className="w-16 h-16 mx-auto rounded-2xl bg-white/5 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-wa-text hover:text-emerald-300 font-bold text-xl flex items-center justify-center transition-all border border-white/5 hover:border-emerald-500/40 shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="w-16 h-16 mx-auto rounded-2xl bg-white/5 hover:bg-red-500/20 text-wa-secondary hover:text-red-300 font-bold text-sm flex items-center justify-center transition-all border border-white/5"
            title="Borrar todo"
          >
            C
          </button>

          {/* Zero */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit('0')}
            className="w-16 h-16 mx-auto rounded-2xl bg-white/5 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-wa-text hover:text-emerald-300 font-bold text-xl flex items-center justify-center transition-all border border-white/5 hover:border-emerald-500/40 shadow-sm"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleBackspace}
            className="w-16 h-16 mx-auto rounded-2xl bg-white/5 hover:bg-white/10 text-wa-secondary hover:text-white flex items-center justify-center transition-all border border-white/5"
            title="Borrar dígito"
          >
            ⌫
          </button>
        </div>

        {/* Footer Hint */}
        <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-center text-[10px] text-wa-secondary">
          <span>🔒 PIN por defecto: </span>
          <span className="font-mono text-emerald-400 font-bold ml-1">1234</span>
        </div>
      </div>
    </div>
  )
}
