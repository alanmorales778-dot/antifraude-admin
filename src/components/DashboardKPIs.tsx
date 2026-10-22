'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Wifi,
} from 'lucide-react';
import { FintechEntity } from '@/lib/types';
import { useConsortiumStore } from '@/lib/store';
import { testSupabaseConnection } from '@/lib/supabaseClient';

interface DashboardKPIsProps {
  stats: any;
  tenants?: FintechEntity[];
  onNavigateTab: (tab: string) => void;
}

export default function DashboardKPIs({ stats, tenants, onNavigateTab }: DashboardKPIsProps) {
  const store = useConsortiumStore();
  const graphEdges = store?.graphEdges || [];
  const auditLogs = store?.auditLogs || [];
  const scoringConfig = store?.scoringConfig;

  const [measuredLatency, setMeasuredLatency] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Health check real para medir latencia hacia Supabase
  useEffect(() => {
    let isMounted = true;
    const runPing = async () => {
      try {
        const res = await testSupabaseConnection();
        if (isMounted) {
          setMeasuredLatency(res.latencyMs);
          setIsConnected(res.success);
        }
      } catch {
        if (isMounted) {
          setIsConnected(false);
          setMeasuredLatency(null);
        }
      }
    };

    runPing();
    const timer = setInterval(runPing, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const isInternal = store?.activeService === 'INTERNAL';
  const currentEntityId = store?.activeFintechId;
  const currentEntity = store?.fintechs?.find(f => f.id === currentEntityId);
  const currentEntityName = currentEntity?.name || currentEntityId;

  // Segregación Estricta por Entorno
  const scopedLookupLogs = isInternal
    ? auditLogs.filter(l =>
        (l.action === 'LOOKUP' || l.action === 'BATCH_LOOKUP') &&
        (l.actor === currentEntityName || l.actor === currentEntityId || (l.details && currentEntityId && l.details.includes(currentEntityId)))
      )
    : auditLogs.filter(l => l.action === 'LOOKUP' || l.action === 'BATCH_LOOKUP');

  // Clasificación de consultas según resultado
  const isBlocked = (l: any) =>
    Boolean(
      l.details &&
        (l.details.includes('[BLOCK]') ||
          l.details.includes('(ALTO)') ||
          l.details.includes('Riesgo Crítico') ||
          /Score:\s*(7[5-9]|[8-9][0-9]|100)\b/.test(l.details))
    );

  const isReview = (l: any) =>
    Boolean(
      l.details &&
        (l.details.includes('[REVIEW]') ||
          l.details.includes('(MEDIO)') ||
          /Score:\s*(3[5-9]|[4-6][0-9]|7[0-4])\b/.test(l.details))
    );

  const isAllow = (l: any) =>
    Boolean(
      l.details &&
        (l.details.includes('[ALLOW]') ||
          l.details.includes('(BAJO)') ||
          /Score:\s*([0-9]|[1-2][0-9]|3[0-4])\b/.test(l.details))
    ) || (!isBlocked(l) && !isReview(l));

  // ── FILTRO ESTRICTO DEL DÍA ACTUAL ────────────────────────────
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const isLogFromToday = (ts?: string) => {
    if (!ts) return false;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    const logYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return logYMD === todayYMD;
  };

  const todayLookups = scopedLookupLogs.filter(l => isLogFromToday(l.timestamp));
  const totalQueriesToday = todayLookups.length;

  const todayApproved = todayLookups.filter(isAllow).length;
  const todayReview = todayLookups.filter(isReview).length;
  const todayBlocked = todayLookups.filter(isBlocked).length;

  // ── TARJETA 3: TASA CRÍTICA (Mismo período y misma fuente) ──
  // Fórmula: (Consultas Críticas Rechazadas Hoy / Consultas Procesadas Hoy) * 100
  const criticalRate = totalQueriesToday > 0
    ? Math.min(100, Math.max(0, Number(((todayBlocked / totalQueriesToday) * 100).toFixed(1))))
    : null;

  // Umbrales dinámicos desde scoring_config
  const criticalThreshold = scoringConfig?.criticalAlertThreshold ?? 60;
  const mediumThreshold = scoringConfig?.mediumRiskThreshold ?? 35;

  const isRed = criticalRate !== null && criticalRate >= criticalThreshold;
  const isYellow = criticalRate !== null && criticalRate >= mediumThreshold && criticalRate < criticalThreshold;
  const isGreen = criticalRate !== null && criticalRate < mediumThreshold;

  const alertConfig = isRed
    ? {
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/50 hover:border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.18)]',
        bgColor: 'bg-rose-500/10',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        tag: `ALERTA CRÍTICA (≥ ${criticalThreshold}%)`,
        statusText: 'Ataque o volumen crítico de fraude en el día',
        recommendation: 'Recomendación: Bloqueo Automático',
        icon: ShieldAlert,
        pulse: true,
      }
    : isYellow
    ? {
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/50 hover:border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        bgColor: 'bg-amber-500/10',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        tag: `ALERTA MODERADA (${mediumThreshold}% - ${criticalThreshold}%)`,
        statusText: 'Volumen anómalo de fraude en el día',
        recommendation: 'Recomendación: Desafío 2FA Obligatorio',
        icon: AlertTriangle,
        pulse: true,
      }
    : {
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
        bgColor: 'bg-emerald-500/10',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        tag: `ESTADO NOMINAL (< ${mediumThreshold}%)`,
        statusText: totalQueriesToday > 0 ? 'Flujo seguro verificado en el día' : 'Sin consultas registradas hoy',
        recommendation: 'Recomendación: Monitoreo Normal',
        icon: ShieldCheck,
        pulse: false,
      };

  // ── GRÁFICO SEMANAL (7 DÍAS CALENDARIO CONTINUOS) ─────────────
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = `${dayNames[d.getDay()]} ${d.getDate()}`;
    return { ymd, label, isToday: i === 6 };
  });

  const weeklyData = last7Days.map(day => {
    const logsThisDay = scopedLookupLogs.filter(l => {
      if (!l.timestamp) return false;
      const d = new Date(l.timestamp);
      if (isNaN(d.getTime())) return false;
      const logYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return logYMD === day.ymd;
    });

    const queries = logsThisDay.length;
    const criticals = logsThisDay.filter(isBlocked).length;
    return {
      label: day.label,
      isToday: day.isToday,
      queries,
      criticals,
    };
  });

  const maxQueriesInWeek = Math.max(...weeklyData.map(d => d.queries), 1);
  const maxCriticalsInWeek = Math.max(...weeklyData.map(d => d.criticals), 1);

  return (
    <div className="space-y-6">
      {/* 3 Tarjetas Superiores Reales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* TARJETA 1: Consultas por Resultado (Aprobadas / En Revisión / Rechazadas) */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Consultas por Resultado (Hoy)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-3">
            {totalQueriesToday === 0 ? (
              <div className="py-2">
                <span className="text-2xl font-bold text-slate-400">Sin consultas hoy</span>
                <p className="mt-1 text-xs text-slate-500">Esperando transacciones en el entorno actual</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Mini barra de distribución */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 flex">
                  {todayApproved > 0 && (
                    <div
                      style={{ width: `${(todayApproved / totalQueriesToday) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Aprobadas: ${todayApproved}`}
                    />
                  )}
                  {todayReview > 0 && (
                    <div
                      style={{ width: `${(todayReview / totalQueriesToday) * 100}%` }}
                      className="bg-amber-500 h-full transition-all"
                      title={`En Revisión: ${todayReview}`}
                    />
                  )}
                  {todayBlocked > 0 && (
                    <div
                      style={{ width: `${(todayBlocked / totalQueriesToday) * 100}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Rechazadas: ${todayBlocked}`}
                    />
                  )}
                </div>

                {/* Desglose de conteo por resultado */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                    <span className="text-[10px] text-emerald-300 font-medium block">Aprobadas</span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">{todayApproved}</span>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
                    <span className="text-[10px] text-amber-300 font-medium block">En Revisión</span>
                    <span className="text-base font-extrabold text-amber-400 font-mono">{todayReview}</span>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-center">
                    <span className="text-[10px] text-rose-300 font-medium block">Rechazadas</span>
                    <span className="text-base font-extrabold text-rose-400 font-mono">{todayBlocked}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-white/5 pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{totalQueriesToday} transacciones procesadas hoy</span>
            <span className="text-cyan-400/90 font-medium">Clasificación en vivo</span>
          </div>
        </div>

        {/* TARJETA 2: Consultas Procesadas Hoy */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Consultas Procesadas Hoy</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {totalQueriesToday.toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <Zap className={`h-3.5 w-3.5 ${totalQueriesToday > 0 ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className={totalQueriesToday > 0 ? 'text-cyan-300' : 'text-slate-400'}>
                {totalQueriesToday > 0 ? 'Conexión activa en vivo' : 'Sin consultas hoy'}
              </span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Wifi className={`h-3 w-3 ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>{isConnected ? 'Supabase Conectado' : 'Sin conexión'}</span>
            </span>
            {measuredLatency !== null ? (
              <span>
                Latencia: <strong className="text-cyan-400 font-mono">{measuredLatency}ms</strong>
              </span>
            ) : (
              <span className="text-slate-500">Midiendo latencia...</span>
            )}
          </div>
        </div>

        {/* TARJETA 3: Tasa Crítica (Acotada 0-100% y umbrales de scoring_config) */}
        <div
          className={`glass-panel relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${alertConfig.bgColor} border ${alertConfig.borderColor} group`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Tasa Crítica</span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${alertConfig.badgeBg} ${alertConfig.pulse ? 'animate-pulse' : ''}`}>
                {alertConfig.tag}
              </span>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${alertConfig.bgColor} ${alertConfig.textColor}`}>
              <alertConfig.icon className={`h-5 w-5 ${alertConfig.pulse ? 'animate-bounce' : ''}`} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black tracking-tight ${alertConfig.textColor}`}>
                {criticalRate !== null ? `${criticalRate.toFixed(1)}%` : '—'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {totalQueriesToday > 0
                  ? `(${todayBlocked} de ${totalQueriesToday} consultas)`
                  : '(Sin datos en el día)'}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-300 font-medium">
              {alertConfig.statusText}
            </div>
          </div>

          <div className="mt-3 border-t border-white/10 pt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>{alertConfig.recommendation}</span>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('consulta')}
              className={`${alertConfig.textColor} hover:underline font-bold flex items-center gap-1 transition`}
            >
              <span>Ir a consulta ZK</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Gráfico Semanal: 7 Días Calendario Continuos */}
      <div className="w-full">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Evolución Diaria: Consultas vs. Detecciones Críticas</h3>
              <p className="text-xs text-slate-400">
                Últimos 7 días con desglose diario (0 en días sin actividad)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Consultas Totales
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Detecciones Críticas
              </span>
            </div>
          </div>

          {/* Gráfico de barras diarias con escala normalizada */}
          <div className="mt-6 h-60 w-full">
            <div className="flex h-48 items-end gap-2 sm:gap-6 border-b border-white/10 pb-2">
              {weeklyData.map((d, idx) => {
                const qHeight = d.queries > 0 ? Math.max(8, (d.queries / maxQueriesInWeek) * 100) : 0;
                const cHeight = d.criticals > 0 ? Math.max(8, (d.criticals / maxCriticalsInWeek) * 85) : 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip interactivo con datos del día */}
                    <div className="absolute -top-14 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-2xl text-[10px] text-white whitespace-nowrap">
                      <span className="font-bold text-slate-300">{d.label} {d.isToday ? '(Hoy)' : ''}</span>
                      <span className="text-indigo-300 font-mono">{d.queries.toLocaleString()} consultas</span>
                      <span className="text-rose-400 font-mono">{d.criticals.toLocaleString()} críticas</span>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      {/* Barra Consultas Totales */}
                      {d.queries > 0 ? (
                        <div
                          style={{ height: `${qHeight}%` }}
                          className={`w-1/2 rounded-t-md transition-all duration-300 ${
                            d.isToday ? 'bg-indigo-500 group-hover:bg-indigo-400' : 'bg-indigo-500/40 group-hover:bg-indigo-500'
                          }`}
                        />
                      ) : (
                        <div className="w-1/2 h-1 rounded-full bg-slate-800" title="0 consultas" />
                      )}

                      {/* Barra Detecciones Críticas */}
                      {d.criticals > 0 ? (
                        <div
                          style={{ height: `${cHeight}%` }}
                          className={`w-1/2 rounded-t-md transition-all duration-300 ${
                            d.isToday ? 'bg-rose-500 group-hover:bg-rose-400' : 'bg-rose-500/50 group-hover:bg-rose-500'
                          }`}
                        />
                      ) : (
                        <div className="w-1/2 h-1 rounded-full bg-slate-800" title="0 críticas" />
                      )}
                    </div>

                    <span className={`mt-2 text-[11px] font-medium ${d.isToday ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1">
              <span>Monitoreo continuo de transacciones ZK</span>
              <span>Consistencia criptográfica SHA-256 + Salt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
