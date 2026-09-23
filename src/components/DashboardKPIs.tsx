'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingUp,
  DollarSign,
  Activity,
  Server,
  ArrowUpRight,
  Sparkles,
  Network,
  Lock,
} from 'lucide-react';
import { Tenant } from '@/lib/types';

interface DashboardKPIsProps {
  stats: any;
  tenants: Tenant[];
  onNavigateTab: (tab: string) => void;
}

export default function DashboardKPIs({ stats, tenants, onNavigateTab }: DashboardKPIsProps) {
  const chartDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const queriesData = [112000, 128000, 134000, 142850, 139200, 95000, 89000];
  const alertsData = [2450, 2890, 3120, 3420, 3100, 1980, 1850];

  const maxQuery = Math.max(...queriesData);
  const maxAlert = Math.max(...alertsData);

  const formattedARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(stats?.estimatedMoneySavedARS || 842500000);

  const formattedUSD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(stats?.estimatedMoneySavedUSD || 720000);

  return (
    <div className="space-y-6">

      {/* Botones de acción rápida (sin banner) */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() => onNavigateTab('consulta')}
          className="flex items-center gap-2 rounded-xl theme-btn-primary px-4 py-2 text-xs font-bold shadow-lg transition active:scale-95"
        >
          <Zap className="h-3.5 w-3.5" /> Búsqueda Ciega de Riesgo
        </button>
        <button
          onClick={() => onNavigateTab('csv')}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Carga Masiva (CSV)
        </button>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Fraudes Evitados */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Fraudes Evitados (Mes)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {(stats?.fraudAvoidedMonth || 1248).toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+18.4% vs mes anterior</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Detección cruzada comunitaria
          </div>
        </div>

        {/* KPI 2: Volumen de Consultas Hoy */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Consultas Procesadas Hoy</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {(stats?.totalQueriesProcessed || 142850).toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              <span>98.6 consultas / segundo</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Latencia promedio: <strong className="text-cyan-400 font-mono">11ms</strong> (&lt;50ms)
          </div>
        </div>

        {/* KPI 3: Consultas de Alto Riesgo */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('consulta')}
          className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-rose-500/40 hover:bg-rose-500/[0.03] cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 group-hover:text-rose-300 transition">Tasa de Riesgo Crítico</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              2.4% <span className="text-sm font-normal text-slate-400">({(stats?.highRiskCount || 14)} detectadas)</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-400">
              <span>89.2% de coincidencia multientidad</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Recomendación: Bloqueo</span>
            <span className="text-rose-400/80 group-hover:text-rose-400 font-medium">Ir a consulta ZK →</span>
          </div>
        </div>


      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Daily Queries vs High-Risk Detections SVG Line Chart */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
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

        {/* Latency & Consortium Performance Panel */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Rendimiento en el Borde (Edge)</h3>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                &lt; 50ms GARANTIZADO
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Distribución de latencia de respuesta del clúster de caché en memoria y Postgres
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">P50 (Mediana)</span>
                  <span className="font-mono text-emerald-400 font-semibold">6 ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '12%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">P90</span>
                  <span className="font-mono text-cyan-400 font-semibold">11 ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: '22%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">P99 (Peor caso)</span>
                  <span className="font-mono text-indigo-400 font-semibold">14 ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '28%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Lock className="h-4 w-4 text-indigo-400" />
              <span>Garantía de Privacidad Ciega</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Ninguna entidad conoce los clientes de las demás. Los cruces se producen exclusivamente en el espacio de hashes SHA-256 irreversibles.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
