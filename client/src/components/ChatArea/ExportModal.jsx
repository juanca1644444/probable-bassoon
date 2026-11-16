import React, { useState } from 'react'

export default function ExportModal({ chat, onClose }) {
  const [format, setFormat] = useState('pdf')
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  if (!chat) return null

  const chatTitle = chat.type === 'group'
    ? (chat.groupName || 'Grupo')
    : (chat.contactName || 'Contacto')

  const formats = [
    {
      id: 'pdf',
      name: 'Documento PDF',
      icon: '📄',
      ext: '.pdf',
      badge: 'Visual & Oficial',
      description: 'Historial formateado con diseño oficial de WhatsApp, burbujas de mensaje, remitentes y horas listo para imprimir o guardar en PDF.'
    },
    {
      id: 'csv',
      name: 'Hoja de Cálculo CSV',
      icon: '📊',
      ext: '.csv',
      badge: 'Excel / Sheets',
      description: 'Estructura tabular con columnas separadas para Fecha, Hora, Emisor, Tipo, Contenido y Enlaces multimedia.'
    },
    {
      id: 'json',
      name: 'Datos JSON',
      icon: '💾',
      ext: '.json',
      badge: 'Backup & Dev',
      description: 'Exportación técnica completa con metadatos de chat y matriz de mensajes para integraciones o copias de seguridad.'
    }
  ]

  const handleExport = async () => {
    setDownloading(true)
    setDownloadSuccess(false)
    try {
      if (format === 'pdf') {
        // Open the styled printable page in new window which triggers browser print / save to PDF
        window.open(`http://localhost:3001/api/chats/${chat.id}/export?format=pdf`, '_blank')
        setDownloading(false)
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 3500)
        return
      }

      // CSV or JSON download via fetch and blob
      const res = await fetch(`http://localhost:3001/api/chats/${chat.id}/export?format=${format}`)
      if (!res.ok) throw new Error('Error al generar la exportación')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chat-${chatTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 3500)
    } catch (err) {
      console.error('Export error:', err)
      alert('Hubo un error al exportar la conversación.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-wa-header border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-wa-sidebar/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl">
              📤
            </div>
            <div>
              <h3 className="font-semibold text-base text-wa-text">Exportar historial de chat</h3>
              <p className="text-xs text-wa-secondary">{chatTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-wa-secondary hover:text-wa-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-wa-secondary">
            Selecciona el formato en el que deseas descargar la conversación completa, incluyendo marcas de tiempo y nombres de participantes:
          </p>

          <div className="space-y-3">
            {formats.map((fmt) => (
              <div
                key={fmt.id}
                onClick={() => setFormat(fmt.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  format === fmt.id
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                    : 'border-gray-700/50 hover:border-gray-600 bg-wa-input/40'
                }`}
              >
                <span className="text-2xl mt-0.5">{fmt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-wa-text">{fmt.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/30 text-emerald-400 border border-emerald-500/30">
                      {fmt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-wa-secondary leading-relaxed">{fmt.description}</p>
                </div>
                <div className="mt-1">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      format === fmt.id
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-gray-600 bg-transparent'
                    }`}
                  >
                    {format === fmt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {downloadSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-scale-in">
              <span>✅</span>
              <span>¡Archivo generado con éxito! La descarga ha comenzado.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-wa-sidebar/80 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-wa-secondary hover:text-wa-text transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={downloading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md transform active:scale-95"
          >
            {downloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Descargar en {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
