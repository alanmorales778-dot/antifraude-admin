'use client';

import React from 'react';
import { Layers, CheckCircle, AlertTriangle, ShieldAlert, Clock, Activity, Building, Zap } from 'lucide-react';
import { RiskMatrixFactors } from '@/lib/types';

interface RiskMatrixBreakdownProps {
  matrix?: RiskMatrixFactors;
  riskMatrix?: RiskMatrixFactors;
  riskScore?: number;
  killSwitchTriggered?: boolean;
}

export default function RiskMatrixBreakdown({
  matrix,
  riskMatrix,
  riskScore,
  killSwitchTriggered,
}: RiskMatrixBreakdownProps) {
  const activeMatrix = matrix || riskMatrix;
  if (!activeMatrix) return null;

  const factors = [
    {
      name: 'Factor Consenso Comunitario',
      weight: '40%',
      rawScore: activeMatrix.consensusScore,
      weightedContribution: Math.round(activeMatrix.consensusScore * 0.4),
      icon: Building,
      color: 'bg-indigo-500 text-indigo-400',
      description: 'Pondera la cantidad de entidades financieras independientes que reportaron el identificador.',
    },
    {
      name: 'Factor Frecuencia / Velocidad',
      weight: '25%',
      rawScore: activeMatrix.velocityScore,
      weightedContribution: Math.round(activeMatrix.velocityScore * 0.25),
      icon: Zap,
      color: 'bg-cyan-500 text-cyan-400',
      description: 'Volumen de intentos de transacción u onboarding detectados en la red en las últimas 24h.',
    },
    {
      name: 'Factor Gravedad del Evento',
      weight: '25%',
      rawScore: activeMatrix.severityScore,
      weightedContribution: Math.round(activeMatrix.severityScore * 0.25),
      icon: ShieldAlert,
      color: 'bg-rose-500 text-rose-400',
      description: 'Severidad del delito (ej. Cuentas Mula y Robo de Cuenta computan mayor peso que abuso promocional).',
    },
    {
      name: 'Factor Recencia / Decaimiento',
      weight: '10%',
      rawScore: activeMatrix.recencyScore,
      weightedContribution: Math.round(activeMatrix.recencyScore * 0.1),
      icon: Clock,
      color: 'bg-amber-500 text-amber-400',
      description: 'Atenuación temporal automática a medida que transcurren semanas sin nuevos incidentes.',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Composición Ponderada del Risk Score (Risk Matrix)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Desglose matemático transparente de las 4 variables constitutivas del puntaje de riesgo final.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Puntaje Consolidado:</span>
          <span className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1 text-base font-black text-white font-mono">
            {activeMatrix.totalWeightedScore} / 100
          </span>
        </div>
      </div>

      {killSwitchTriggered && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <div>
              <strong className="text-white block">CONDICIÓN DE KILL-SWITCH ACTIVADA (SCORE &gt;= 90)</strong>
              <span>Se recomienda activar retención temporal de fondos de 30 a 60 segundos antes de liberar salida.</span>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-1 rounded">
            &lt; 15ms Intercept
          </span>
        </div>
      )}

      {/* 4 Factor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {factors.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.name} className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg bg-black/40 ${f.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">{f.name}</span>
                </div>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-white/10">
                  Peso: {f.weight}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Puntaje Bruto del Factor:</span>
                  <span className="font-mono font-bold text-white">{f.rawScore} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${f.color.split(' ')[0]} rounded-full transition-all duration-500`}
                    style={{ width: `${f.rawScore}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                <span className="text-slate-500 text-[10px]">{f.description}</span>
                <span className="font-mono font-bold text-cyan-400 text-xs whitespace-nowrap ml-2">
                  +{f.weightedContribution} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sum explanation */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
        <span>
          Fórmula: (Consenso × 0.40) + (Velocidad × 0.25) + (Gravedad × 0.25) + (Recencia × 0.10)
        </span>
        <span className="text-[var(--accent-primary)] font-bold">
          = {activeMatrix.totalWeightedScore} pts Ponderados
        </span>
      </div>
    </div>
  );
}

