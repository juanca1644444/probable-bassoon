import React from 'react'

export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-wa-dark dark:bg-wa-chat select-none border-b-[6px] border-wa-green transition-colors">
      {/* CHASKYAPP Brand Emblem */}
      <div className="mb-8">
        <div className="w-56 h-56 rounded-full bg-black/5 dark:bg-wa-header/40 flex items-center justify-center transition-colors">
          <div className="w-36 h-36 rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-2xl text-white">
            <svg viewBox="0 0 24 24" className="w-20 h-20 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="text-wa-text text-3xl font-light mb-3">CHASKYAPP</h2>
      <p className="text-wa-secondary text-sm text-center max-w-sm mb-8">
        Red privada de mensajería empresarial e institucional. Comunicación cifrada en tiempo real, videollamadas P2P y asistencia inteligente con IA.
      </p>

      <div className="flex items-center gap-2 text-wa-secondary text-xs">
        <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
        <span>Red cerrada protegida y cifrada en tu propio servidor</span>
      </div>
    </div>
  )
}
