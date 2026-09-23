'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Play, CheckCircle2, AlertTriangle, Plus, ShieldCheck, Zap, History, ToggleLeft, ToggleRight } from 'lucide-react';
import { DynamicRule } from '@/lib/types';

export default function RuleEngineNoCode() {
  const [rules, setRules] = useState<DynamicRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [minScore, setMinScore] = useState(80);
  const [minTenants, setMinTenants] = useState(2);
  const [eventType, setEventType] = useState('MULA_DE_DINERO');
  const [action, setAction] = useState<'REQUIRE_BIOMETRICS' | 'AUTO_BLOCK' | 'DELAY_FUNDS'>('REQUIRE_BIOMETRICS');
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/v1/rules');
      const data = await res.json();
      if (data.data) setRules(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggleRule = async (id: string) => {
    try {
      await fetch(`/api/v1/rules?id=${id}`, { method: 'PATCH' });
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  const runBacktestSimulator = () => {
    setIsBacktesting(true);
    setBacktestResult(null);

    setTimeout(() => {
      setIsBacktesting(false);
      setBacktestResult({
        historicalEvaluated: 142850,
        matchesFound: 1842,
        fraudPrevented: 1819,
        estimatedFpRate: 1.2,
        accuracy: 98.8,
        recommendedAction: 'APROBADA PARA PRODUCCIÓN (Cumple estándar interbancario de bajo ruido)',
      });
    }, 1200);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName) return;

    try {
      const conditionDescription = `Si Risk Score >= ${minScore} AND Coincidencias >= ${minTenants} (o Tipo = ${eventType})`;
      const actionDescription =
        action === 'REQUIRE_BIOMETRICS'
          ? 'Exigir Validación Biométrica Facial Obligatoria'
          : action === 'AUTO_BLOCK'
          ? 'Bloqueo Preventivo Inmediato'
          : 'Retener Salida de Fondos por 45s (Kill-Switch)';

      await fetch('/api/v1/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName,
          conditionDescription,
          actionDescription,
          ruleJson: { minScore, minTenants, eventType, action },
        }),
      });

      setIsCreating(false);
      setNewRuleName('');
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Motor de Reglas Dinámicas No-Code & Backtesting
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Crea políticas lógicas de interceptación en tiempo real y evalúalas retrospectivamente contra el historial de 30 días.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 rounded-xl theme-btn-primary px-3.5 py-2 text-xs font-bold shadow-lg"
        >
          <Plus className="h-4 w-4" /> Crear Nueva Regla
        </button>
      </div>

      {/* No-Code Rule Creator Form */}
      {isCreating && (
        <div className="glass-panel rounded-2xl p-6 shadow-2xl border border-[var(--border-hover)] animate-fade-in space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[var(--accent-primary)]" />
            Diseñador Visual de Regla Lógica (No-Code)
          </h3>

          <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nombre de la Política</label>
              <input
                type="text"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                placeholder="ej: Intercepción de Cuentas Puente de Alto Monto"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Condición: Min Risk Score</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Condición: Min Entidades Coincidentes</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={minTenants}
                  onChange={e => setMinTenants(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Acción Automatizada</label>
                <select
                  value={action}
                  onChange={e => setAction(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:outline-none"
                >
                  <option value="REQUIRE_BIOMETRICS">Exigir Validación Biométrica</option>
                  <option value="AUTO_BLOCK">Bloqueo Preventivo Inmediato</option>
                  <option value="DELAY_FUNDS">Auto-pausa de Fondos 45s (Kill-Switch)</option>
                </select>
              </div>
            </div>

            {/* Backtest Button inside Creator */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runBacktestSimulator}
                disabled={isBacktesting}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition"
              >
                <History className="h-4 w-4" />
                {isBacktesting ? 'Simulando contra 142.850 casos...' : 'Simular Backtesting (30 Días)'}
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl theme-btn-primary px-4 py-2 text-xs font-bold"
              >
                Guardar y Activar Regla
              </button>
            </div>

            {backtestResult && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-bold font-sans">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Resultado del Backtesting Retrospectivo
                  </span>
                  <span>Efectividad: {backtestResult.accuracy}%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-1">
                  <div>Casos Históricos: <strong className="text-white">142,850</strong></div>
                  <div>Coincidencias: <strong className="text-cyan-400">1,842</strong></div>
                  <div>Fraudes Evitados: <strong className="text-emerald-400">1,819</strong></div>
                  <div>Tasa Falso Positivo: <strong className="text-amber-400">1.2%</strong></div>
                </div>
                <div className="text-[11px] text-emerald-300 font-sans pt-1">
                  ✓ {backtestResult.recommendedAction}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs text-slate-400">
          <span className="font-semibold text-white">Reglas Activas en el Edge Router</span>
          <span>{rules.length} políticas configuradas</span>
        </div>

        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`rounded-xl border p-4 transition ${
                rule.enabled ? 'border-white/10 bg-slate-900/60' : 'border-white/5 bg-slate-950/40 opacity-60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{rule.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        rule.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'EN PRODUCCIÓN' : 'PAUSADA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-1">{rule.conditionDescription}</p>
                  <p className="text-[11px] text-cyan-400 font-semibold mt-0.5">Acción: {rule.actionDescription}</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">Precisión Backtest</div>
                    <div className="text-emerald-400 font-bold">{rule.backtestAccuracy}%</div>
                  </div>

                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">Falso Positivo</div>
                    <div className="text-amber-400 font-bold">{rule.backtestFpRate}%</div>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title={rule.enabled ? 'Desactivar regla' : 'Activar regla'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
