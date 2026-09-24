'use client';

import React from 'react';
import {
  Layers,
  ShieldAlert,
  Clock,
  Building,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Network,
  ThumbsUp,
} from 'lucide-react';
import { RiskMatrixFactors, RiskTier } from '@/lib/types';

interface RiskMatrixBreakdownProps {
  matrix?: RiskMatrixFactors;
  riskMatrix?: RiskMatrixFactors;
  riskScore?: number;
  killSwitchTriggered?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Tier config helpers
// ─────────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<RiskTier, {
  label: string; range: string; action: string;
  color: string; bg: string; border: string; dot: string;
}> = {
  CONFIABLE:   { label: 'Confiable',   range: '0 – 20',   action: 'Aprobar',           color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  ALERTA:      { label: 'Alerta',      range: '21 – 50',  action: 'Step-up 2FA',       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   dot: 'bg-amber-400' },
  ALTO_RIESGO: { label: 'Alto Riesgo', range: '51 – 75',  action: 'Revisión Manual',   color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  dot: 'bg-orange-400' },
  CRITICO:     { label: 'Crítico',     range: '76 – 100', action: 'Bloqueo Automático', color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    dot: 'bg-rose-500' },
};

function getTierFromScore(score: number): RiskTier {
  if (score >= 76) return 'CRITICO';
  if (score >= 51) return 'ALTO_RIESGO';
  if (score >= 21) return 'ALERTA';
  return 'CONFIABLE';
}

// ─────────────────────────────────────────────────────────────────
// SEVERITY WEIGHT TABLE (reference data)
// ─────────────────────────────────────────────────────────────────
const SEVERITY_TABLE = [
  { label: 'Robo de Identidad',      weight: 90,  halfLife: '90 días', nature: 'Fraude crítico, daño deliberado grave',         color: 'text-rose-400' },
  { label: 'Cuenta Mula',            weight: 85,  halfLife: '90 días', nature: 'Estructura de lavado / movimiento ilícito',      color: 'text-rose-400' },
  { label: 'Phishing',               weight: 70,  halfLife: '60 días', nature: 'Vector de ataque activo verificado',             color: 'text-orange-400' },
  { label: 'Contracargo (Chargeback)',weight: 40,  halfLife: '30 días', nature: 'Puede ser fraude amistoso o disputa legítima',   color: 'text-amber-400' },
  { label: 'Actividad Sospechosa',   weight: 20,  halfLife: '30 días', nature: 'Alerta temprana, anomalía comportamental',       color: 'text-slate-300' },
  { label: 'Reporte OK (Legítimo)',   weight: -35, halfLife: '30 días', nature: 'Mitigación / validación cruzada comunitaria',    color: 'text-emerald-400' },
];

export default function RiskMatrixBreakdown({
  matrix,
  riskMatrix,
  riskScore = 0,
  killSwitchTriggered,
}: RiskMatrixBreakdownProps) {
  const activeMatrix = matrix || riskMatrix;
  if (!activeMatrix) return null;

  const score       = activeMatrix.totalWeightedScore ?? riskScore;
  const tier        = (activeMatrix.riskTier as RiskTier | undefined) ?? getTierFromScore(score);
  const tierCfg     = TIER_CONFIG[tier];
  const Mred        = activeMatrix.networkMultiplier ?? 1.0;
  const fraudDecayed = activeMatrix.fraudImpactDecayed ?? activeMatrix.severityScore ?? 0;
  const okAtten     = activeMatrix.okAttenuation ?? 0;
  const halfLife    = activeMatrix.halfLifeDays ?? 30;
  const decayFactor = activeMatrix.recencyScore ?? 100; // 0-100%

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Modelo Probabilístico Dinámico — Desglose del Score
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Scoring con pesos por tipología · Decaimiento exponencial (half-life) · Multiplicador de red · Votos OK
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border px-3 py-1.5 text-center ${tierCfg.bg} ${tierCfg.border}`}>
            <div className={`text-2xl font-black font-mono ${tierCfg.color}`}>{score}</div>
            <div className={`text-[10px] font-bold uppercase ${tierCfg.color}`}>{tierCfg.label}</div>
          </div>
        </div>
      </div>

      {/* ── Kill-switch ─────────────────────────────────────────── */}
      {(killSwitchTriggered || score >= 90) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <div>
              <strong className="text-white block">KILL-SWITCH ACTIVADO — Score ≥ 90 · CRÍTICO</strong>
              <span>Retención temporal de fondos &lt;15ms · Requiere validación biométrica o revisión humana.</span>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-1 rounded">&lt;15ms</span>
        </div>
      )}

      {/* ── Fórmula visual ──────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-black/40 p-4 font-mono text-xs">
        <p className="text-slate-500 text-[11px] font-sans mb-2 font-semibold uppercase tracking-wider">Fórmula del Modelo v2</p>
        <p className="text-slate-300 leading-loose">
          <span className="text-cyan-400">S</span>
          {' = min(100, max(0, '}
          <span className="text-amber-400">Σ(ImpactoDecaído × M<sub>red</sub>)</span>
          {' − '}
          <span className="text-emerald-400">Σ(AtenuaciónOK)</span>
          {'))'}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <div className="text-amber-400 font-bold">ImpactoDecaído</div>
            <div className="text-slate-400 mt-0.5 font-sans">PesoBase × e<sup>−λt</sup></div>
            <div className="text-slate-500 font-sans mt-0.5">= {fraudDecayed.toFixed(1)} pts</div>
          </div>
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
            <div className="text-indigo-400 font-bold">M<sub>red</sub></div>
            <div className="text-slate-400 mt-0.5 font-sans">1 + 0.2 × (n − 1)</div>
            <div className="text-slate-500 font-sans mt-0.5">= ×{Mred.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <div className="text-emerald-400 font-bold">AtenuaciónOK</div>
            <div className="text-slate-400 mt-0.5 font-sans">35 × e<sup>−λt</sup> por voto</div>
            <div className="text-slate-500 font-sans mt-0.5">= −{okAtten.toFixed(1)} pts</div>
          </div>
        </div>
      </div>

      {/* ── Factors Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Factor 1: Severidad */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/40 bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-white">Peso por Severidad</span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">{activeMatrix.severityScore}</div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${activeMatrix.severityScore}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">Peso base ΔS según tipología reportada</p>
        </div>

        {/* Factor 2: Decaimiento temporal */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/40 bg-amber-500/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-white">Decaimiento e<sup>−λt</sup></span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{decayFactor}%</div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${decayFactor}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">Half-life: {halfLife} días · λ = ln(2)/{halfLife}</p>
        </div>

        {/* Factor 3: Multiplicador de red */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/40 bg-indigo-500/10 text-indigo-400">
              <Network className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-white">M<sub>red</sub> Consenso</span>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-400">×{Mred.toFixed(2)}</div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (Mred - 1) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">
            {activeMatrix.consensusScore > 0
              ? `${Math.round(activeMatrix.consensusScore / 25)} entidad(es) · 1 + 0.2×(n−1)`
              : '1 entidad · sin amplificación'}
          </p>
        </div>

        {/* Factor 4: Votos OK */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/40 bg-emerald-500/10 text-emerald-400">
              <ThumbsUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-white">Votos OK</span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {okAtten > 0 ? `−${okAtten.toFixed(0)}` : '—'}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (okAtten / 35) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">
            {okAtten > 0
              ? 'Reporte marcado OK — score atenuado (tag Disputado activo)'
              : 'Sin votos de atenuación comunitaria'}
          </p>
        </div>
      </div>

      {/* ── Tabla de pesos de referencia ────────────────────────── */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          Tabla de Pesos Base (ΔS) por Tipología
        </h4>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 border-b border-white/8 text-[11px] text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Evento / Categoría</th>
                <th className="px-4 py-2.5 text-center">ΔS</th>
                <th className="px-4 py-2.5 text-center">Half-life</th>
                <th className="px-4 py-2.5 text-left hidden sm:table-cell">Naturaleza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {SEVERITY_TABLE.map(row => (
                <tr key={row.label} className="hover:bg-white/[0.02] transition">
                  <td className={`px-4 py-2.5 font-semibold ${row.color}`}>{row.label}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-white">
                    {row.weight > 0 ? `+${row.weight}` : row.weight}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-400 font-mono text-[11px]">{row.halfLife}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-[11px] hidden sm:table-cell">{row.nature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Clasificación de 4 Niveles ──────────────────────────── */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
          Niveles de Riesgo Accionables
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(Object.entries(TIER_CONFIG) as [RiskTier, typeof TIER_CONFIG[RiskTier]][]).map(([key, cfg]) => (
            <div
              key={key}
              className={`rounded-xl border p-3 transition ${cfg.bg} ${cfg.border} ${
                tier === key ? 'ring-2 ring-offset-1 ring-offset-slate-900 ring-current opacity-100' : 'opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">{cfg.range}</div>
              <div className={`text-[11px] font-semibold mt-0.5 ${cfg.color}`}>→ {cfg.action}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Regla de conflicto comunitario ──────────────────────── */}
      <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] px-4 py-3 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
          <Building className="h-3.5 w-3.5" />
          Reglas de Conflicto Comunitario (Asimetría del Riesgo)
        </div>
        <p>• 1 entidad reporta → Advertencia (Score ≈ 40-60 según tipología + decay)</p>
        <p>• 2+ entidades distintas → M<sub>red</sub> = 1.2 o superior → Score sube a Crítico (≥76) de forma automática</p>
        <p>• El voto OK atenúa −35 pts (decaído) pero <strong className="text-white">no borra el historial</strong>: queda tag "Disputado / Conflicto comunitario"</p>
        <p>• Para neutralizar un reporte de Cuenta Mula (85pts) se necesitan ≥3 votos OK de entidades distintas</p>
      </div>

    </div>
  );
}
