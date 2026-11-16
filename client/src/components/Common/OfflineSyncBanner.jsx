import React, { useState, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { subscribeSyncState, processOutboxSync } from '../../services/syncManager';
import { getOutboxQueue } from '../../services/localDb';

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check initial outbox count
    getOutboxQueue().then(queue => setPendingCount(queue.length)).catch(() => {});

    // Listen to sync manager updates
    const unsubscribe = subscribeSyncState((state) => {
      if (typeof state.isOnline === 'boolean') setIsOnline(state.isOnline);
      if (typeof state.isSyncing === 'boolean') setIsSyncing(state.isSyncing);
      if (typeof state.pendingCount === 'number') setPendingCount(state.pendingCount);

      if (state.syncedCount && state.syncedCount > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3500);
      }
    });

    // PWA Install prompt listener
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleManualSync = () => {
    processOutboxSync(useAppStore);
  };

  // If online, not syncing, no pending items, and not just synced:
  // show optional PWA install bar if installable, or nothing
  if (isOnline && !isSyncing && pendingCount === 0 && !justSynced) {
    if (deferredPrompt && !isInstalled) {
      return (
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-4 py-1.5 flex items-center justify-between text-xs font-medium z-50 border-b border-emerald-600/30">
          <div className="flex items-center gap-2">
            <span className="text-base">📲</span>
            <span>Instala <strong>CHASKYAPP</strong> en tu ordenador o móvil para acceso instantáneo y soporte offline total.</span>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 bg-white text-emerald-800 hover:bg-emerald-50 rounded font-semibold text-xs transition shadow-sm"
          >
            Instalar PWA
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`transition-all duration-300 z-50 text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-between shadow-md ${
      !isOnline 
        ? 'bg-amber-600/95 text-amber-50 border-b border-amber-500/50' 
        : isSyncing 
          ? 'bg-emerald-600/95 text-white border-b border-emerald-500/50' 
          : 'bg-teal-600/90 text-white border-b border-teal-500/50'
    }`}>
      <div className="flex items-center gap-2.5">
        {!isOnline ? (
          <>
            <span className="text-base animate-pulse">📡❌</span>
            <span>
              <strong>Modo Sin Conexión</strong> — CHASKYAPP está operando en modo local. Tus mensajes y cambios se guardan de forma segura en IndexedDB.
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 bg-amber-800/60 px-2 py-0.5 rounded-full text-amber-200 text-xs">
                  🕒 {pendingCount} {pendingCount === 1 ? 'acción pendiente' : 'acciones pendientes'} en cola
                </span>
              )}
            </span>
          </>
        ) : isSyncing ? (
          <>
            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>
              <strong>Sincronizando datos...</strong> Transfiriendo cola Outbox y reconciliando cambios con el servidor CHASKYAPP.
            </span>
          </>
        ) : (
          <>
            <span className="text-emerald-300 font-bold">✓</span>
            <span>
              <strong>Sincronización completada.</strong> Todos los datos locales están al día con el servidor.
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isOnline && (
          <button
            data-testid="banner-sim-online"
            onClick={() => window.dispatchEvent(new Event('online'))}
            className="px-2.5 py-1 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded text-xs transition font-semibold shadow-sm"
            title="Restablecer conexión a internet"
          >
            🟢 Reconectar Online
          </button>
        )}
        <button
          data-testid="sync-now-button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="px-2.5 py-1 bg-black/25 hover:bg-black/40 text-white rounded text-xs transition border border-white/20 disabled:opacity-50"
          title="Forzar comprobación y sincronización de Outbox"
        >
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar'}
        </button>
      </div>
    </div>
  );
}
