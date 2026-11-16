import React from 'react'

export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-wa-chat select-none">
      {/* WhatsApp-style lock icon */}
      <div className="mb-8">
        <div className="w-56 h-56 rounded-full bg-wa-header/40 flex items-center justify-center">
          <svg viewBox="0 0 212 212" className="w-36 h-36 text-wa-green opacity-80" fill="currentColor">
            <path d="M106.3 10C53.4 10 10.1 53.3 10.1 106.2c0 17.1 4.5 33.9 13.1 48.7L10 202l48.1-12.6c14.3 7.8 30.4 11.9 46.2 11.9h0c52.9 0 96.2-43.3 96.2-96.2 0-25.7-10-49.8-28.2-68C154.2 20 131 10 106.3 10zm56.9 149.2c-2.4 6.8-14.1 13-19.4 13.8-5.3.8-10.7 1.1-17.2-1.1-3.9-1.3-9-3.1-15.5-6-27.3-11.8-45.1-39.3-46.5-41.1-1.4-1.9-11.4-15.1-11.4-28.8 0-13.7 7.2-20.5 9.7-23.3 2.6-2.8 5.6-3.5 7.5-3.5 1.9 0 3.8 0 5.4.1 1.7.1 4 -.6 6.3 4.8 2.4 5.6 8.1 19.3 8.8 20.7.7 1.4 1.2 3 .2 4.9-1 1.9-1.4 3-2.8 4.7-1.4 1.7-2.9 3.7-4.2 5-1.4 1.4-2.8 2.8-1.2 5.6 1.6 2.8 7.2 11.9 15.5 19.2 10.7 9.5 19.6 12.5 22.4 13.9 2.8 1.4 4.4 1.2 6-0.7 1.6-1.9 7-8.1 8.9-10.9 1.9-2.8 3.7-2.3 6.3-1.4 2.6.9 16.3 7.7 19.1 9.1 2.8 1.4 4.6 2.1 5.3 3.3.7 1.1.7 6.6-1.7 13.4z"/>
          </svg>
        </div>
      </div>

      <h2 className="text-wa-text text-3xl font-light mb-3">CHASKYAPP</h2>
      <p className="text-wa-secondary text-sm text-center max-w-sm mb-8">
        Plataforma integral de mensajería empresarial y omnicanal inteligente. Conecta WhatsApp, Telegram y Web en tiempo real.
      </p>

      <div className="flex items-center gap-2 text-wa-secondary text-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
        <span>Tus mensajes personales están cifrados de extremo a extremo</span>
      </div>
    </div>
  )
}
