'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { FintechEntity } from '@/lib/types';
import { useConsortiumStore } from '@/lib/store';

interface DashboardKPIsProps {
  stats: any;
  tenants?: FintechEntity[];
  onNavigateTab: (tab: string) => void;
}

export default function DashboardKPIs({ stats, tenants, onNavigateTab }: DashboardKPIsProps) {
  const store = useConsortiumStore();
  const graphEdges = store?.graphEdges || [];
  const auditLogs = store?.auditLogs || [];

  // ── KPI 1: % de Datos Fraudulentos ────────────────────────────
  // Fórmula: (cantidad de datos reportados como fraude / cantidad de datos totales reportados) * 100
  const dynamicFraudEdges = graphEdges.filter(e => !e.isFalsePositive && e.incidentCategory !== 'SUSPICIOUS').length;
  const dynamicTotalEdges = graphEdges.length;

  const totalReportedData = dynamicTotalEdges;
  const fraudReportedData = dynamicFraudEdges;
  const fraudPercentage = totalReportedData > 0
    ? ((fraudReportedData / totalReportedData) * 100).toFixed(1)
    : '0.0';

  // ── KPI 2: Consultas Procesadas Hoy ───────────────────────────
  const lookupLogs = auditLogs.filter(l => l.action === 'LOOKUP' || l.action === 'BATCH_LOOKUP');
  const totalQueries = lookupLogs.length;

  // ── KPI 3: Tasa Crítica (Alerta Diaria) ────────────────────────
  const criticalRate = totalQueries > 0
    ? Number(((fraudReportedData / totalQueries) * 100).toFixed(1))
    : (totalReportedData > 0 ? Number(((fraudReportedData / totalReportedData) * 100).toFixed(1)) : 0.0);

  const chartDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const todayIdx = (new Date().getDay() + 6) % 7; // Lunes=0, Domingo=6
  const queriesData = chartDays.map((_, idx) => (idx === todayIdx ? totalQueries : 0));
  const alertsData = chartDays.map((_, idx) => (idx === todayIdx ? fraudReportedData : 0));

  const maxQuery = Math.max(...queriesData, 1);
  const maxAlert = Math.max(...alertsData, 1);

  const isGreen = criticalRate < 30;
  const isYellow = criticalRate >= 30 && criticalRate <= 60;
  const isRed = criticalRate > 60;

  const alertConfig = isRed
    ? {
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/50 hover:border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.18)]',
        bgColor: 'bg-rose-500/10',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        tag: 'ALERTA CRÍTICA (> 60%)',
        statusText: 'Ataque masivo de fraude en el día',
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
        tag: 'ALERTA MODERADA (30% - 60%)',
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
        tag: 'ESTADO NOMINAL (< 30%)',
        statusText: 'Flujo seguro verificado en el día',
        recommendation: 'Recomendación: Monitoreo Normal',
        icon: ShieldCheck,
        pulse: false,
      };

  const detectedToday = fraudReportedData;

  return (
    <div className="space-y-6">
      {/* 3 Main KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* KPI 1: % de Datos Fraudulentos */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">% de Datos Fraudulentos</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {fraudPercentage}%
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
              <span className="font-mono text-cyan-300 font-semibold">{fraudReportedData.toLocaleString('es-AR')}</span>
              <span className="text-slate-400">datos fraude de</span>
              <span className="font-mono text-slate-200">{totalReportedData.toLocaleString('es-AR')}</span>
              <span className="text-slate-400">reportados</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Fórmula: (Fraude / Totales) × 100</span>
            <span className="text-emerald-400/90 font-medium">Tiempo real activo</span>
          </div>
        </div>

        {/* KPI 2: Consultas Procesadas Hoy */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Consultas Procesadas Hoy</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {totalQueries.toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              <span>{totalQueries > 0 ? 'Conexión activa en vivo' : 'Sistema listo desde 0'}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Latencia promedio: <strong className="text-cyan-400 font-mono">11ms</strong> (&lt;50ms)
          </div>
        </div>

        {/* KPI 3: Tasa Crítica (Alerta Diaria con Color Dinámico: Verde <30%, Amarillo 30-60%, Rojo >60%) */}
        <div
          className={`glass-panel relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${alertConfig.bgColor} border ${alertConfig.borderColor} group`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-300">Tasa Crítica</span>
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
                {criticalRate.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({detectedToday} transacciones detectadas hoy)
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

      {/* Main Charts Row */}
      <div className="w-full">
        {/* Daily Queries vs High-Risk Detections SVG Line Chart */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Evolución Diaria: Consultas vs. Detecciones Críticas</h3>
              <p className="text-xs text-slate-400">Volumen de consultas procesadas e incidentes de alto riesgo detectados en los últimos 7 días</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" /> Consultas Totales
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Detecciones de Riesgo Alto
              </span>
            </div>
          </div>

          {/* SVG Line / Bar visualization */}
          <div className="mt-6 h-60 w-full">
            <div className="flex h-48 items-end gap-2 sm:gap-6 border-b border-white/10 pb-2">
              {chartDays.map((day, idx) => {
                const qHeight = (queriesData[idx] / maxQuery) * 100;
                const aHeight = (alertsData[idx] / maxAlert) * 70;

                return (
                  <div key={day} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 border border-white/10 rounded-lg px-2 py-1 shadow-xl text-[10px] text-white whitespace-nowrap">
                      <span>{queriesData[idx].toLocaleString()} consultas</span>
                      <span className="text-rose-400 font-semibold">{alertsData[idx].toLocaleString()} detecciones críticas</span>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {/* Query bar */}
                      <div
                        style={{ height: `${qHeight}%` }}
                        className="w-1/2 rounded-t-md bg-indigo-500/40 transition-all duration-300 group-hover:bg-indigo-500"
                      />
                      {/* Alert bar */}
                      <div
                        style={{ height: `${aHeight}%` }}
                        className="w-1/2 rounded-t-md bg-rose-500/60 transition-all duration-300 group-hover:bg-rose-500"
                      />
                    </div>
                    <span className="mt-2 text-[11px] font-medium text-slate-400">{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-slate-500">
              <span>SLA Red: 99.998% Uptime</span>
              <span>Filtrado automático de colisiones criptográficas</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

