'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  Lock,
  Calendar,
  Database,
  Star,
  AlertCircle,
  ArrowUpDown,
  Users,
} from 'lucide-react';
import { Tenant } from '@/lib/types';

interface DashboardKPIsProps {
  stats: any;
  tenants: Tenant[];
  onNavigateTab: (tab: string) => void;
}

const generateDailyData = () => {
  const days: { date: Date; label: string; total: number; fraud: number; uploaded: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const total = Math.floor(85000 + Math.random() * 70000);
    const fraudRate = 0.018 + Math.random() * 0.025;
    const fraud = Math.floor(total * fraudRate);
    const uploaded = Math.floor(800 + Math.random() * 3200);
    days.push({
      date: d,
      label: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      total,
      fraud,
      uploaded,
    });
  }
  return days;
};

const ALL_DATA = generateDailyData();

function TrustGauge({ value, color }: { value: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="48" y="44" textAnchor="middle" fontSize="16" fontWeight="bold" fontFamily="monospace" fill={color}>{value}</text>
      <text x="48" y="58" textAnchor="middle" fontSize="9" fill="#64748b">/ 100</text>
    </svg>
  );
}

export default function DashboardKPIs({ stats, tenants, onNavigateTab }: DashboardKPIsProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rangeMode, setRangeMode] = useState<'7d' | '14d' | 'custom'>('7d');

  const filteredData = useMemo(() => {
    if (rangeMode === 'custom' && selectedDate) {
      return ALL_DATA.filter(d => d.date.toISOString().slice(0, 10) === selectedDate);
    }
    const days = rangeMode === '7d' ? 7 : 14;
    return ALL_DATA.slice(-days);
  }, [rangeMode, selectedDate]);

  const totalConsultas = filteredData.reduce((s, d) => s + d.total, 0);
  const totalFraud = filteredData.reduce((s, d) => s + d.fraud, 0);
  const fraudPct = totalConsultas > 0 ? ((totalFraud / totalConsultas) * 100).toFixed(2) : '0.00';
  const totalUploaded = filteredData.reduce((s, d) => s + d.uploaded, 0);
  const chartMax = Math.max(...filteredData.map(d => d.total), 1);

  const trustScore = 98.5;
  const qualityScore = 94.2;
  const falsePositiveRate = 2.1;
  const queriesContributed = 142850;
  const reportsContributed = 847;
  const reciprocityRatio = (reportsContributed / (queriesContributed / 1000)).toFixed(2);
  const trustColor = trustScore >= 90 ? '#34d399' : trustScore >= 70 ? '#fbbf24' : '#f87171';
  const qualityColor = qualityScore >= 90 ? '#34d399' : qualityScore >= 70 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-6">

      {/* Quick Action Buttons */}
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

      {/* Date Filter Bar */}
      <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-300">Filtrar período:</span>
        <div className="flex items-center gap-1.5">
          {(['7d', '14d'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => { setRangeMode(opt); setSelectedDate(''); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                rangeMode === opt && !selectedDate
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                  : 'border border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt === '7d' ? 'Últimos 7 días' : 'Últimos 14 días'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Fecha exacta:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setRangeMode('custom'); }}
            max={new Date().toISOString().slice(0, 10)}
            className="rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition font-mono [color-scheme:dark]"
          />
          {selectedDate && (
            <button
              onClick={() => { setSelectedDate(''); setRangeMode('7d'); }}
              className="text-xs text-slate-500 hover:text-rose-400 transition px-2 py-1 rounded-lg border border-white/10 hover:border-rose-500/30"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* KPI 1: % Consultas Fraudulentas */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-rose-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">% Consultas Fraudulentas</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight font-mono">
              {fraudPct}<span className="text-base font-normal text-slate-400">%</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{totalFraud.toLocaleString('es-AR')} / {totalConsultas.toLocaleString('es-AR')}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Consultas fraudulentas / total × entidad
          </div>
        </div>

        {/* KPI 2: Consultas Procesadas */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Consultas Procesadas</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {totalConsultas.toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              <span>{filteredData.length > 0 ? Math.round(totalConsultas / filteredData.length).toLocaleString('es-AR') : '–'} / día prom.</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Latencia promedio: <strong className="text-cyan-400 font-mono">11ms</strong> (&lt;50ms)
          </div>
        </div>

        {/* KPI 3: Datos subidos */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 transition hover:border-indigo-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Datos Subidos (período)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {totalUploaded.toLocaleString('es-AR')}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>registros en el período</span>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
            Hoy: <strong className="text-indigo-400 font-mono">{(ALL_DATA[ALL_DATA.length - 1]?.uploaded || 0).toLocaleString('es-AR')}</strong> registros
          </div>
        </div>

        {/* KPI 4: Fraudes Evitados */}
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
      </div>

      {/* Comparative Bar Chart */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm font-bold text-white">Consultas Totales vs. Consultas con Fraude</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparativa diaria en el período seleccionado</p>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300"><span className="h-3 w-3 rounded-sm bg-indigo-500/60 inline-block" /> Sin fraude</span>
            <span className="flex items-center gap-1.5 text-slate-300"><span className="h-3 w-3 rounded-sm bg-rose-500/80 inline-block" /> Con fraude</span>
            <span className="flex items-center gap-1.5 text-slate-300"><span className="h-3 w-3 rounded-sm border border-rose-500/40 bg-rose-600/30 inline-block" /> Fraude aislado</span>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
            <Calendar className="h-8 w-8 opacity-40" />
            <p className="text-sm">No hay datos para la fecha seleccionada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-2 pb-2 border-b border-white/10"
              style={{ minWidth: filteredData.length > 7 ? `${filteredData.length * 56}px` : '100%', height: '220px' }}
            >
              {filteredData.map((day, idx) => {
                const totalH = (day.total / chartMax) * 85;
                const fraudH = (day.fraud / chartMax) * 85;
                const pct = ((day.fraud / day.total) * 100).toFixed(1);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative" style={{ minWidth: '44px' }}>
                    <div className="absolute bottom-full mb-2 z-20 hidden group-hover:flex flex-col items-start bg-slate-900 border border-white/10 rounded-xl px-3 py-2 shadow-xl text-[10px] text-white whitespace-nowrap gap-0.5 pointer-events-none">
                      <span className="font-bold text-white mb-0.5">{day.label}</span>
                      <span className="text-indigo-300">Total: {day.total.toLocaleString()}</span>
                      <span className="text-rose-300">Fraude: {day.fraud.toLocaleString()} ({pct}%)</span>
                      <span className="text-emerald-300">Limpio: {(day.total - day.fraud).toLocaleString()}</span>
                    </div>
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {/* Stacked bar: clean (bottom) + fraud (top) */}
                      <div className="w-5/12 flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: `${totalH}%` }}>
                        <div className="w-full bg-rose-500/90" style={{ height: `${(day.fraud / day.total) * 100}%` }} />
                        <div className="w-full bg-indigo-500/50" style={{ height: `${((day.total - day.fraud) / day.total) * 100}%` }} />
                      </div>
                      {/* Fraud-only bar */}
                      <div
                        className="w-4/12 rounded-t-lg bg-rose-600/35 border border-rose-500/30 transition-all duration-500 group-hover:bg-rose-600/65"
                        style={{ height: `${fraudH}%` }}
                      />
                    </div>
                    <span className="mt-2 text-[10px] font-medium text-slate-500 group-hover:text-slate-300 transition">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-indigo-500/[0.06] border border-indigo-500/15 px-4 py-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Total consultas</div>
            <div className="text-lg font-bold text-white font-mono">{totalConsultas.toLocaleString('es-AR')}</div>
          </div>
          <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/15 px-4 py-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Con fraude</div>
            <div className="text-lg font-bold text-rose-300 font-mono">{totalFraud.toLocaleString('es-AR')} <span className="text-xs text-rose-500">({fraudPct}%)</span></div>
          </div>
          <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 px-4 py-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Sin fraude</div>
            <div className="text-lg font-bold text-emerald-300 font-mono">{(totalConsultas - totalFraud).toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Node Health + Latency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Node Health Widget */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Salud y Reputación del Nodo</h3>
              <p className="text-xs text-slate-400">Nivel de Confianza Comunitaria en la red federada</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-400">Nodo Confiable</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Score de Confianza */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 flex flex-col items-center gap-2">
              <TrustGauge value={Math.round(trustScore)} color={trustColor} />
              <div className="text-center">
                <div className="text-sm font-bold text-white">Reputación: {trustScore}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Score de confianza en la red</div>
              </div>
              <div className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-center">
                <span className="text-[11px] font-semibold text-emerald-400">Nodo de Alta Confianza</span>
              </div>
            </div>

            {/* Calidad de Reportes */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Calidad de Reportes</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Confirmados por la red</span>
                  <span className="font-mono font-bold text-emerald-400">{qualityScore}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${qualityScore}%`, background: qualityColor }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Tasa de falsos positivos</span>
                  <span className="font-mono font-bold text-rose-400">{falsePositiveRate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-500 transition-all duration-700" style={{ width: `${falsePositiveRate}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-800/50 px-3 py-2 text-[11px] text-slate-400">
                Tus reportes son <strong className="text-emerald-400">altamente precisos</strong> y fortalecen la red comunitaria.
              </div>
            </div>

            {/* Ratio de Reciprocidad */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">Ratio de Reciprocidad</span>
              </div>
              <div className="text-center py-2">
                <div className="text-3xl font-bold font-mono text-cyan-400">{reciprocityRatio}</div>
                <div className="text-[11px] text-slate-500 mt-1">reportes por cada 1.000 consultas</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400"><Activity className="h-3.5 w-3.5 text-indigo-400" /> Consultas realizadas</span>
                  <span className="font-mono font-bold text-white">{queriesContributed.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400"><Users className="h-3.5 w-3.5 text-rose-400" /> Reportes aportados</span>
                  <span className="font-mono font-bold text-white">{reportsContributed.toLocaleString('es-AR')}</span>
                </div>
              </div>
              <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 px-3 py-1.5 text-center">
                <span className="text-[11px] font-semibold text-cyan-400">Contribuidor Activo ✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Latency Panel */}
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
