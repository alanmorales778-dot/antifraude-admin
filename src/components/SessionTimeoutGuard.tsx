'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ShieldAlert, Clock, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

// ── Configuración Estándar de Inactividad Bancaria ─────────────────────────────
// 15 minutos totales de inactividad permitidos
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 900,000 ms (15 min)

// 2 minutos de aviso previo flotante antes de la desconexión definitiva
export const DEFAULT_WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 120,000 ms (2 min)

// Clave de sincronización multi-pestaña
const ACTIVITY_STORAGE_KEY = 'antifraude_last_activity_ts';
const THROTTLE_INTERVAL_MS = 1000; // Máximo 1 actualización por segundo

interface SessionTimeoutGuardProps {
  timeoutMs?: number;
  warningThresholdMs?: number;
}

let activeGuardCount = 0;

export default function SessionTimeoutGuard({
  timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  warningThresholdMs = DEFAULT_WARNING_THRESHOLD_MS,
}: SessionTimeoutGuardProps) {
  const { adminSession, partnerSession, handleInactivityTimeout } = useConsortiumStore();

  const isAuthenticated = Boolean(adminSession?.isAuthenticated || partnerSession?.isAuthenticated);
  const activeUserEmail = adminSession?.email || partnerSession?.operatorEmail || 'Usuario';
  const activeEntityName = partnerSession?.entityName || (adminSession ? 'Gobernanza Central' : 'Entidad');

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(Math.floor(warningThresholdMs / 1000));

  const isPrimaryInstanceRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  // Garantizar que solo una instancia en todo el árbol de componentes esté activa
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeGuardCount > 0 && !isPrimaryInstanceRef.current) {
      return;
    }
    activeGuardCount++;
    isPrimaryInstanceRef.current = true;

    return () => {
      if (isPrimaryInstanceRef.current) {
        activeGuardCount = Math.max(0, activeGuardCount - 1);
        isPrimaryInstanceRef.current = false;
      }
    };
  }, [isAuthenticated]);

  // ── Registrar Actividad del Usuario (Throttled a 1s) ──────────────────────
  const recordActivity = useCallback(() => {
    if (!isAuthenticated || !isPrimaryInstanceRef.current || isLoggingOutRef.current) return;

    const now = Date.now();
    // Evitar sobrecarga por eventos de alta frecuencia (mousemove, scroll)
    if (now - lastThrottleRef.current < THROTTLE_INTERVAL_MS) return;

    lastThrottleRef.current = now;
    lastActivityRef.current = now;

    // Si el modal de advertencia estaba visible y el usuario realiza una acción consciente,
    // ocultar la advertencia
    setShowWarning(prev => {
      if (prev) {
        setSecondsRemaining(Math.floor(warningThresholdMs / 1000));
        return false;
      }
      return false;
    });

    // Sincronizar en localStorage para que otras pestañas abiertas reconozcan la actividad
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    } catch {}
  }, [isAuthenticated, warningThresholdMs]);

  // ── Mantener Sesión Activa (Acción Explícita del Botón) ────────────────────
  const handleKeepAlive = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleRef.current = now;
    setShowWarning(false);
    setSecondsRemaining(Math.floor(warningThresholdMs / 1000));
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    } catch {}
  };

  // ── Cerrar Sesión Inmediatamente (Acción Voluntaria del Modal) ────────────
  const handleManualLogout = () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowWarning(false);
    handleInactivityTimeout(
      'Has cerrado la sesión de forma segura por inactividad. Puedes volver a ingresar con tus credenciales.'
    );
  };

  // ── Listener de Eventos de Interacción del Usuario ─────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    // Inicializar timestamp al montar o cambiar de sesión
    const now = Date.now();
    lastActivityRef.current = now;
    isLoggingOutRef.current = false;
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    } catch {}

    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    const onUserAction = () => recordActivity();

    // Sincronización multi-pestaña mediante evento 'storage'
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        const remoteTimestamp = parseInt(e.newValue, 10);
        if (!isNaN(remoteTimestamp) && remoteTimestamp > lastActivityRef.current) {
          lastActivityRef.current = remoteTimestamp;
          setShowWarning(false);
          setSecondsRemaining(Math.floor(warningThresholdMs / 1000));
        }
      }
    };

    events.forEach(eventName => {
      window.addEventListener(eventName, onUserAction, { passive: true });
    });
    window.addEventListener('storage', onStorageChange);

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, onUserAction);
      });
      window.removeEventListener('storage', onStorageChange);
    };
  }, [isAuthenticated, recordActivity, warningThresholdMs]);

  // ── Loop de Verificación de Inactividad (Cada 1 segundo) ───────────────────
  useEffect(() => {
    if (!isAuthenticated || !isPrimaryInstanceRef.current) {
      setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      if (isLoggingOutRef.current || !isPrimaryInstanceRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const remainingMs = timeoutMs - elapsed;

      // Caso 1: Expiración definitiva
      if (remainingMs <= 0) {
        isLoggingOutRef.current = true;
        clearInterval(interval);
        setShowWarning(false);
        handleInactivityTimeout(
          'Tu sesión ha expirado por inactividad (15 min). Por motivos de seguridad bancaria, vuelve a iniciar sesión.'
        );
        return;
      }

      // Caso 2: Entró en ventana de advertencia (últimos minutos)
      if (remainingMs <= warningThresholdMs) {
        setShowWarning(true);
        const secs = Math.max(0, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(secs);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, timeoutMs, warningThresholdMs, handleInactivityTimeout]);

  // Si no está autenticado, no es la instancia primaria o la advertencia no está activa, no renderizar nada
  if (!isAuthenticated || !isPrimaryInstanceRef.current || !showWarning) {
    return null;
  }

  // Formato mm:ss
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedCountdown = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isUrgent = secondsRemaining <= 30;

  // Porcentaje restante del aviso previo para barra de progreso
  const totalWarningSeconds = Math.max(1, Math.floor(warningThresholdMs / 1000));
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / totalWarningSeconds) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-md bg-gradient-to-b from-[#111927] to-[#0a0f1d] border border-amber-500/40 rounded-2xl p-6 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-slate-100 relative overflow-hidden">
        {/* Glow de seguridad bancaria superior */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl pointer-events-none transition-colors ${
            isUrgent ? 'bg-rose-600/30' : 'bg-amber-500/20'
          }`}
        />

        {/* Header con Badge de Seguridad */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border flex items-center justify-center ${
                isUrgent
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
            >
              {isUrgent ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                Protocolo de Seguridad
              </span>
              <h2 id="inactivity-dialog-title" className="text-base font-bold text-white">
                Inactividad Detectada
              </h2>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
            BCRA Sec.
          </span>
        </div>

        {/* Mensaje descriptivo */}
        <div className="space-y-2 mb-6 text-sm text-slate-300 leading-relaxed">
          <p>
            Por estrictas normas de protección de datos confidenciales y auditoría institucional en{' '}
            <strong className="text-white font-semibold">{activeEntityName}</strong>, la sesión activa de{' '}
            <span className="font-mono text-cyan-300 text-xs">{activeUserEmail}</span> se cerrará automáticamente si no se detecta actividad.
          </p>
        </div>

        {/* Tarjeta de Contador Regresivo */}
        <div
          className={`rounded-xl p-5 mb-6 text-center border transition-all ${
            isUrgent
              ? 'bg-rose-950/30 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
              : 'bg-amber-950/20 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-mono mb-2">
            <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
            <span>Tiempo restante de sesión:</span>
          </div>

          <div
            className={`font-mono text-5xl font-extrabold tracking-tight tabular-nums my-1 ${
              isUrgent ? 'text-rose-400 animate-pulse' : 'text-amber-400'
            }`}
          >
            {formattedCountdown}
          </div>

          <span className="text-[11px] text-slate-400 block mt-1">
            {isUrgent ? '⚠️ Cierre de sesión inminente' : 'Presiona el botón para mantener tu sesión activa'}
          </span>

          {/* Barra de Progreso Dinámica */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                isUrgent ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleKeepAlive}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 group cursor-pointer active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
            <span>Mantener Sesión Activa</span>
          </button>

          <button
            type="button"
            onClick={handleManualLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/80 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión Ahora</span>
          </button>
        </div>
      </div>
    </div>
  );
}
