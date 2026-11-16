import React, { useState, useEffect } from 'react'
import useTenantStore from '../../store/useTenantStore'

export default function SubscriptionBillingModal({ onClose, embedded = false }) {
  const {
    activeTenant,
    subscription,
    invoices,
    plans,
    fetchCurrentTenant,
    fetchPlans,
    activateLicense
  } = useTenantStore()

  const [licenseInput, setLicenseInput] = useState('')
  const [activating, setActivating] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [renewCycle, setRenewCycle] = useState('yearly')
  const [renewing, setRenewing] = useState(false)
  const [showPlansCompare, setShowPlansCompare] = useState(false)

  useEffect(() => {
    fetchCurrentTenant()
    fetchPlans()
  }, [])

  const handleActivateKey = async (e) => {
    e.preventDefault()
    if (!licenseInput.trim()) return
    setActivating(true)
    setErrorMsg('')
    setSuccessMsg('')

    const res = await activateLicense(licenseInput.trim())
    setActivating(false)

    if (res.success) {
      setSuccessMsg(res.message || '¡Licencia activada con éxito!')
      setLicenseInput('')
      await fetchCurrentTenant()
    } else {
      setErrorMsg(res.error || 'Clave de activación inválida o ya canjeada.')
    }
  }

  const handleRenew = async (targetPlanId) => {
    setRenewing(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/saas/subscription/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: targetPlanId || activeTenant?.planId,
          billingCycle: renewCycle
        })
      }).then(r => r.json())

      if (res.success) {
        setSuccessMsg(res.message || 'Suscripción renovada exitosamente.')
        await fetchCurrentTenant()
        setShowPlansCompare(false)
      } else {
        setErrorMsg(res.error || 'Error al renovar suscripción.')
      }
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setRenewing(false)
    }
  }

  const handleDownloadInvoice = (inv) => {
    // Generate simulated printable receipt
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo ${inv.invoiceNumber || 'INV-2026'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-b: 2px solid #00a884; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; color: #00a884; }
          .meta { font-size: 13px; color: #64748b; }
          .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          .table th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; }
          .table td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .total { text-align: right; font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 20px; }
          .badge { display: inline-block; padding: 4px 10px; background: #dcfce7; color: #15803d; border-radius: 9999px; font-weight: bold; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">CHASKYAPP Enterprise</div>
            <div class="meta">Comprobante Oficial de Suscripción SaaS</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; font-size: 16px;">${inv.invoiceNumber || 'INV-2026-001'}</div>
            <div class="meta">Fecha: ${new Date(inv.lastPaymentDate || inv.createdAt).toLocaleDateString()}</div>
            <div class="badge">PAGADO</div>
          </div>
        </div>

        <div>
          <strong>Organización Inquilina:</strong> ${activeTenant?.name || 'Cliente CHASKYAPP'}<br>
          <strong>Titular:</strong> ${activeTenant?.ownerName || 'Administrador'}<br>
          <strong>Plan:</strong> ${activeTenant?.planName || 'Plan Pro'}<br>
          <strong>Periodo:</strong> ${new Date(inv.currentPeriodStart).toLocaleDateString()} al ${new Date(inv.currentPeriodEnd).toLocaleDateString()}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Ciclo</th>
              <th>Método</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Suscripción CHASKYAPP (${activeTenant?.planName || 'Plan Pro'})</td>
              <td>${inv.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}</td>
              <td>${inv.paymentMethod === 'license_key' ? 'Clave de Licencia' : 'Facturación en Línea'}</td>
              <td style="text-align: right; font-weight: bold;">$${Number(inv.amount || 0).toFixed(2)} USD</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          Total Pagado: $${Number(inv.amount || 0).toFixed(2)} USD
        </div>

        <div style="margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center;">
          Documento generado automáticamente por el núcleo de facturación de CHASKYAPP Enterprise.
        </div>
      </body>
      </html>
    `
    printWindow.document.write(invoiceHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 250)
  }

  const content = (
    <div className="space-y-6 animate-fade-in text-wa-text">

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="bg-emerald-600/90 text-white text-xs px-4 py-3 rounded-xl flex items-center justify-between font-medium shadow-sm animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-white hover:text-gray-200">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-600/90 text-white text-xs px-4 py-3 rounded-xl flex items-center justify-between font-medium shadow-sm animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-white hover:text-gray-200">✕</button>
        </div>
      )}

      {/* Plan Summary Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-wa-sidebar to-wa-header p-5 rounded-2xl border border-emerald-500/30 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/40 shadow-inner">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{activeTenant?.planName || 'Plan Chasky Pro'}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeTenant?.status === 'active' ? '🟢 Suscripción Activa' : '🔴 Suspendido'}
                </span>
              </div>
              <p className="text-xs text-wa-secondary mt-0.5">
                Organización: <strong>{activeTenant?.name || 'CHASKYAPP Global HQ'}</strong> ({activeTenant?.billingCycle === 'yearly' ? 'Facturación Anual' : 'Facturación Mensual'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowPlansCompare(!showPlansCompare)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <span>⭐</span>
              <span>{showPlansCompare ? 'Ocultar Planes' : 'Mejorar / Cambiar Plan'}</span>
            </button>
          </div>
        </div>

        {/* Expiration and Cycle Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <span className="text-[10px] text-wa-secondary block uppercase">Próximo Corte / Renovación</span>
            <span className="font-bold text-white font-mono">
              {activeTenant?.expiresAt ? new Date(activeTenant.expiresAt).toLocaleDateString() : 'Indefinido'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-wa-secondary block uppercase">Días Restantes</span>
            <span className="font-bold text-emerald-400 font-mono">
              {activeTenant?.daysRemaining || 30} días
            </span>
          </div>
          <div>
            <span className="text-[10px] text-wa-secondary block uppercase">Costo del Ciclo</span>
            <span className="font-bold text-white font-mono">
              ${subscription?.amount || 79.0} {subscription?.currency || 'USD'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-wa-secondary block uppercase">Método Registrado</span>
            <span className="font-bold text-teal-400 font-mono">
              {subscription?.paymentMethod === 'license_key' ? 'Clave de Licencia' : 'Facturación Digital'}
            </span>
          </div>
        </div>
      </div>

      {/* Quotas & Usage Progress */}
      <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-4">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider text-wa-secondary">
          Consumo Actual de Recursos y Cuotas del Plan
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Agents */}
          <div className="bg-wa-header/70 p-4 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-wa-secondary font-medium">👥 Agentes de Atención</span>
              <span className="font-bold text-white font-mono">
                {activeTenant?.usage?.agents?.current || 1} / {activeTenant?.usage?.agents?.limit || 5}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${activeTenant?.usage?.agents?.percentage || 20}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-wa-secondary">
              <span>{activeTenant?.usage?.agents?.percentage || 20}% utilizado</span>
              <span>{(activeTenant?.usage?.agents?.limit || 5) - (activeTenant?.usage?.agents?.current || 1)} disponibles</span>
            </div>
          </div>

          {/* Monthly Chats */}
          <div className="bg-wa-header/70 p-4 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-wa-secondary font-medium">💬 Chats Mensuales</span>
              <span className="font-bold text-white font-mono">
                {activeTenant?.usage?.chats?.current || 0} / {activeTenant?.usage?.chats?.limit || 1000}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${activeTenant?.usage?.chats?.percentage || 5}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-wa-secondary">
              <span>{activeTenant?.usage?.chats?.percentage || 5}% de la cuota mensual</span>
              <span>Reinicio: 1er día del mes</span>
            </div>
          </div>

          {/* Cloud Storage */}
          <div className="bg-wa-header/70 p-4 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-wa-secondary font-medium">💾 Almacenamiento</span>
              <span className="font-bold text-white font-mono">
                {Math.round((activeTenant?.usage?.storage?.current || 120) / 1024 * 10) / 10} GB / {Math.round((activeTenant?.usage?.storage?.limit || 5120) / 1024)} GB
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${activeTenant?.usage?.storage?.percentage || 10}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-wa-secondary">
              <span>{activeTenant?.usage?.storage?.percentage || 10}% utilizado</span>
              <span>Multimedia y archivos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Section (Toggleable) */}
      {showPlansCompare && (
        <div className="bg-wa-sidebar/90 p-5 rounded-2xl border border-emerald-500/40 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Selecciona tu Nuevo Plan de Suscripción</h4>
              <p className="text-xs text-wa-secondary">Al renovar o cambiar de plan tus cuotas se actualizarán de forma inmediata.</p>
            </div>
            <div className="flex items-center bg-wa-header p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setRenewCycle('monthly')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  renewCycle === 'monthly' ? 'bg-emerald-600 text-white' : 'text-wa-secondary'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setRenewCycle('yearly')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  renewCycle === 'yearly' ? 'bg-emerald-600 text-white' : 'text-wa-secondary'
                }`}
              >
                Anual (Ahorra 17%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => {
              const price = renewCycle === 'yearly' ? p.priceYearly : p.priceMonthly
              const isCurrent = activeTenant?.planId === p.id

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isCurrent ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-wa-header/60 border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{p.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          Actual
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-extrabold text-white font-mono mt-2">
                      ${price} <span className="text-[10px] font-normal text-wa-secondary">USD/{renewCycle === 'yearly' ? 'año' : 'mes'}</span>
                    </div>
                    <ul className="text-[11px] text-wa-secondary space-y-1 mt-3">
                      <li>• {p.maxAgents} Agentes simultáneos</li>
                      <li>• {p.maxMonthlyChats} Chats mensuales</li>
                      <li>• {Math.round(p.maxStorageMb/1024)} GB Almacenamiento</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => handleRenew(p.id)}
                    disabled={renewing}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition mt-4 ${
                      isCurrent
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    }`}
                  >
                    {isCurrent ? 'Extender 1 Periodo' : 'Actualizar a este Plan'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* License Key Redemption Box */}
      <div className="bg-wa-sidebar/70 p-5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎟️</span>
          <div>
            <h4 className="text-sm font-bold text-white">Activar Licencia mediante Clave (License Key)</h4>
            <p className="text-xs text-wa-secondary">
              Ingresa el código alfanumérico proporcionado por CHASKYAPP o tu distribuidor oficial para activar o extender tu suscripción.
            </p>
          </div>
        </div>

        <form onSubmit={handleActivateKey} className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <input
            type="text"
            placeholder="Ej. CHASKY-PRO-2026-X881"
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
            className="w-full sm:flex-1 bg-wa-header px-4 py-2.5 text-xs sm:text-sm font-mono tracking-wider rounded-xl border border-white/10 text-emerald-400 placeholder:text-wa-secondary outline-none focus:border-emerald-500 uppercase font-bold"
            required
          />
          <button
            type="submit"
            disabled={activating || !licenseInput.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {activating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Validar y Activar Licencia</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Invoices History Table */}
      <div className="bg-wa-sidebar/70 rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 bg-wa-header/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🧾</span>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Historial de Facturación y Recibos</h4>
          </div>
          <span className="text-[11px] text-wa-secondary">{invoices.length} comprobantes registrados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 text-wa-secondary uppercase text-[10px] tracking-wider border-b border-white/10">
                <th className="py-2.5 px-4">Comprobante #</th>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">Ciclo</th>
                <th className="py-2.5 px-4">Monto</th>
                <th className="py-2.5 px-4">Método</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4 text-right">Recibo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-wa-text">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-wa-secondary">
                    No hay facturas registradas para esta organización.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">{inv.invoiceNumber || 'INV-2026-001'}</td>
                    <td className="py-3 px-4 text-wa-secondary font-mono">{new Date(inv.lastPaymentDate || inv.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 capitalize">{inv.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">${Number(inv.amount || 0).toFixed(2)} USD</td>
                    <td className="py-3 px-4 text-wa-secondary">{inv.paymentMethod === 'license_key' ? 'Clave Licencia' : 'En Línea'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ✓ Pagado
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-wa-text rounded-lg text-[11px] font-semibold transition"
                        title="Imprimir / Ver comprobante"
                      >
                        📄 Ver Recibo
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-wa-dark border border-gray-700/60 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="bg-wa-header px-6 py-4 border-b border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-lg">
              💳
            </div>
            <div>
              <h2 className="text-wa-text font-bold text-lg">Suscripción, Licenciamiento y Facturación</h2>
              <p className="text-xs text-wa-secondary">Gestiona tu plan, cuotas activas y canje de claves de activación.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-wa-secondary hover:text-wa-text transition"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {content}
        </div>
      </div>
    </div>
  )
}
