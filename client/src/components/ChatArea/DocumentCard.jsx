import React, { useState } from 'react'
import DigitalSignatureModal from '../Documents/DigitalSignatureModal'

export default function DocumentCard({ message, chatId }) {
  const [showSignModal, setShowSignModal] = useState(false)
  const [docState, setDocState] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  let docData = {}
  try {
    docData = typeof message.content === 'object' ? message.content : JSON.parse(message.content)
  } catch (e) {
    docData = {
      title: message.fileName || 'Documento Oficial',
      category: 'contract',
      pdfPath: message.filePath || '/uploads/doc.pdf',
      pdfSize: message.fileSize || 45000,
      status: 'sent',
      amount: 0,
      currency: 'PEN'
    }
  }

  const effectiveStatus = docState?.status || docData.status || 'sent'
  const isSigned = effectiveStatus === 'signed'

  const {
    documentId = docData.documentId || `doc-${message.id}`,
    title = docData.title || message.fileName || 'Documento Oficial CHASKYAPP',
    category = docData.category || 'contract',
    amount = docData.amount || 0,
    currency = docData.currency || 'PEN',
    pdfPath = docData.pdfPath || message.filePath || '/uploads/doc.pdf',
    pdfSize = docData.pdfSize || message.fileSize || 45000,
    clientName = docData.clientName || 'Cliente',
    issueDate = docData.issueDate || '15/11/2026'
  } = { ...docData, ...docState }

  const formatSize = (bytes) => {
    if (!bytes) return '45 KB'
    const kb = Math.round(bytes / 1024)
    if (kb < 1024) return `${kb} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const categoryLabel = {
    contract: 'Contrato de Servicios',
    quote: 'Cotización Comercial',
    nda: 'Acuerdo Confidencialidad',
    education: 'Unidad de Aprendizaje',
    receipt: 'Comprobante de Pago'
  }[category] || 'Documento Oficial'

  return (
    <div className="w-full max-w-sm my-1 rounded-2xl bg-gradient-to-br from-[#0c1317] to-[#111b21] border border-emerald-500/30 shadow-xl overflow-hidden font-sans text-wa-text text-xs animate-fade-in">
      {/* Top Banner */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/90 to-zinc-900 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-base shadow-inner">
            📄
          </div>
          <div>
            <span className="font-bold text-white text-xs block truncate max-w-[180px]">
              {categoryLabel}
            </span>
            <span className="text-[10px] text-zinc-400">PDF Oficial • {formatSize(pdfSize)}</span>
          </div>
        </div>

        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase border ${
          isSigned
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {isSigned ? '✓ Firmado' : '⏳ Pend. Firma'}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <h4 className="font-bold text-white text-xs leading-snug line-clamp-2">
            {title}
          </h4>
          <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
            <span>Para: {clientName}</span>
            <span>{issueDate}</span>
          </div>
        </div>

        {/* Amount Box if applicable */}
        {amount > 0 && (
          <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">Monto Acordado:</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {currency} {Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="py-1.5 px-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
          >
            <span>👁️</span> Previsualizar
          </button>

          <a
            href={pdfPath}
            download={title.endsWith('.pdf') ? title : `${title}.pdf`}
            className="py-1.5 px-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
          >
            <span>📥</span> Descargar PDF
          </a>
        </div>

        {/* Digital Signature Trigger */}
        {!isSigned && (
          <button
            onClick={() => setShowSignModal(true)}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            <span>✍️</span> Firmar y Aceptar Documento
          </button>
        )}
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <DigitalSignatureModal
          document={{ ...docData, id: documentId, title, amount, currency }}
          onClose={() => setShowSignModal(false)}
          onSigned={(updated) => {
            setDocState(updated)
            setShowSignModal(false)
          }}
        />
      )}

      {/* Interactive Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-wa-header border border-emerald-500/40 rounded-3xl w-full max-w-3xl h-[85vh] shadow-2xl overflow-hidden flex flex-col font-sans">
            <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950 to-zinc-900 border-b border-white/10 flex items-center justify-between">
              <span className="font-bold text-white text-xs">{title}</span>
              <button onClick={() => setShowPreviewModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 bg-zinc-900 p-2 overflow-hidden">
              <iframe
                src={`${pdfPath}#toolbar=0`}
                className="w-full h-full rounded-2xl border border-white/10"
                title={title}
              />
            </div>
            <div className="p-3 bg-black/50 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-400 text-[10px]">Documento protegido por CHASKYAPP</span>
              <a
                href={pdfPath}
                download
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
              >
                Descargar Archivo Oficial
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
