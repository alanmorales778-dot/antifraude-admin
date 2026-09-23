'use client';

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Lock,
  Plus,
  Sliders,
  Power,
  PowerOff,
  Activity,
  Network,
  Shield,
  FileText,
  X,
  Check,
  TrendingUp,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { FintechEntity } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────
// MODAL: Nueva Fintech
// ─────────────────────────────────────────────────────────────────

function NewFintechModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    onConfirm(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" />
            Dar de Alta Nueva Entidad Financiera
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-white/10 transition text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Nombre de la institución
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Ej: Banco Nación Argentina"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
            />
            {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-800/50 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-slate-300">Configuración inicial automática:</p>
            <p className="text-xs text-slate-500">• Trust Weight: 0.70 (editable desde el panel)</p>
            <p className="text-xs text-slate-500">• Estado: ACTIVE</p>
            <p className="text-xs text-slate-500">• API Key: generada automáticamente</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              Registrar Entidad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: AdminView
// ─────────────────────────────────────────────────────────────────

export default function AdminView({ onNavigateToUsers }: { onNavigateToUsers?: () => void } = {}) {
  const {
    fintechs,
    graphEdges,
    identityNodes,
    auditLogs,
    addFintech,
    updateTrustWeight,
    toggleFintechStatus,
  } = useConsortiumStore();

  const [isNewFintechModalOpen, setIsNewFintechModalOpen] = useState(false);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // Inicializar sliders con los valores actuales de trustWeight
  useEffect(() => {
    const initial: Record<string, number> = {};
    fintechs.forEach(f => {
      initial[f.id] = f.trustWeight;
    });
    setSliderValues(initial);
  }, [fintechs]);

  // ── Métricas ────────────────────────────────────────────────────
  const totalHashes = identityNodes.length;
  const totalEdges = graphEdges.filter(e => !e.isFalsePositive).length;
  const totalQueries = fintechs.reduce((s, f) => s + f.queriesCount, 0);
  const totalFP = fintechs.reduce((s, f) => s + f.falsePositivesCount, 0);
  const totalReports = fintechs.reduce((s, f) => s + f.reportsCount, 0);
  const fpPercent = totalReports > 0 ? ((totalFP / totalReports) * 100).toFixed(1) : '0.0';

  const handleSliderChange = (id: string, value: number) => {
    setSliderValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSliderCommit = (id: string) => {
    const value = sliderValues[id] ?? 0.7;
    updateTrustWeight(id, value);
  };

  const handleAddFintech = (name: string) => {
    const newF = addFintech(name);
    setJustAdded(newF.id);
    setTimeout(() => setJustAdded(null), 3000);
    setIsNewFintechModalOpen(false);
  };

  const trustColor = (tw: number) => {
    if (tw >= 0.85) return 'text-emerald-400';
    if (tw >= 0.6) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* ── Banner SuperAdmin ──────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-black p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
              Portal SuperAdmin / Owner (admin.antifraude.com)
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Panel de Control del Consorcio Antifraude ZK
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión de entidades federadas, trust weights y supervisión del grafo de identidad Zero-Knowledge.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-amber-300">
          <Lock className="h-3.5 w-3.5" />
          Sesión Root — 2FA Activo
        </span>
      </div>

      {/* ── Métricas vivas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Network className="h-4 w-4 text-cyan-400" />
            Hashes en Grafo
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">{totalHashes}</div>
          <p className="text-[11px] text-slate-500">Nodos de identidad únicos</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="h-4 w-4 text-indigo-400" />
            Aristas Activas
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-400">{totalEdges}</div>
          <p className="text-[11px] text-slate-500">Vínculos de fraude en la red</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Queries Totales
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {totalQueries.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Consultas procesadas en el consorcio</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            % Falsos Positivos
          </div>
          <div className={`text-2xl font-bold font-mono ${Number(fpPercent) > 5 ? 'text-rose-400' : 'text-amber-400'}`}>
            {fpPercent}%
          </div>
          <p className="text-[11px] text-slate-500">{totalFP} de {totalReports} reportes</p>
        </div>
      </div>

      {/* ── Panel de Entidades ─────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Entidades Federadas del Consorcio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ajustá el Trust Weight en tiempo real. Afecta inmediatamente el scoring de la red.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToUsers && (
              <button
                onClick={onNavigateToUsers}
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
              >
                <Users className="h-3.5 w-3.5 text-amber-400" />
                Gestionar Usuarios y Roles
              </button>
            )}
            <button
              onClick={() => setIsNewFintechModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-lg shadow-emerald-900/40"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva Fintech
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {fintechs.map((f: FintechEntity) => {
            const sliderVal = sliderValues[f.id] ?? f.trustWeight;
            const isActive = f.status === 'ACTIVE';
            const isNew = justAdded === f.id;

            return (
              <div
                key={f.id}
                className={`rounded-xl border p-4 transition-all ${
                  isNew
                    ? 'border-emerald-500/50 bg-emerald-950/20 shadow-lg shadow-emerald-900/20'
                    : isActive
                    ? 'border-white/10 bg-slate-800/50 hover:bg-slate-800/80'
                    : 'border-rose-500/20 bg-rose-950/10 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info de la fintech */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{f.name}</span>
                      {isNew && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          NUEVA
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      {f.apiKey.slice(0, 18)}•••
                    </p>
                    <div className="flex gap-4 mt-1 text-[11px] text-slate-400">
                      <span>Consultas: <span className="font-mono text-slate-300">{f.queriesCount}</span></span>
                      <span>Reportes: <span className="font-mono text-slate-300">{f.reportsCount}</span></span>
                      <span>FP: <span className="font-mono text-slate-300">{f.falsePositivesCount}</span></span>
                    </div>
                  </div>

                  {/* Slider de Trust Weight */}
                  <div className="flex-1 max-w-xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Sliders className="h-3 w-3" /> Trust Weight
                      </span>
                      <span className={`font-mono font-bold text-sm ${trustColor(sliderVal)}`}>
                        {sliderVal.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={sliderVal}
                      onChange={e => handleSliderChange(f.id, parseFloat(e.target.value))}
                      onMouseUp={() => handleSliderCommit(f.id)}
                      onTouchEnd={() => handleSliderCommit(f.id)}
                      disabled={!isActive}
                      className="w-full h-1.5 appearance-none rounded-full bg-slate-700 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>0.00</span>
                      <span>0.50</span>
                      <span>1.00</span>
                    </div>
                  </div>

                  {/* Toggle de estado */}
                  <button
                    onClick={() => toggleFintechStatus(f.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                      isActive
                        ? 'border border-rose-500/30 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5" />
                        Suspender
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5" />
                        Reactivar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Log de Auditoría en vivo ──────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              Log de Auditoría en Vivo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro inmutable de todas las acciones del consorcio.
            </p>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-0 rounded-xl border border-white/5 bg-black/30">
          {auditLogs.slice(0, 50).map((log, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 border-b border-white/5 px-4 py-2.5 text-xs last:border-0 hover:bg-white/5 transition"
            >
              <span className="font-mono text-slate-600 shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className={`shrink-0 font-mono font-bold text-[10px] rounded px-1.5 py-0.5 uppercase ${
                log.action.includes('FRAUD') ? 'bg-rose-500/20 text-rose-400' :
                log.action.includes('FALSE') ? 'bg-amber-500/20 text-amber-400' :
                log.action.includes('TRUST') ? 'bg-cyan-500/20 text-cyan-400' :
                log.action.includes('CSV') ? 'bg-indigo-500/20 text-indigo-400' :
                'bg-slate-700 text-slate-400'
              }`}>
                {log.action}
              </span>
              <span className="text-emerald-400 font-semibold shrink-0">{log.actor}</span>
              <span className="text-slate-400 min-w-0 truncate">{log.details}</span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-600">
              Sin actividad registrada aún.
            </p>
          )}
        </div>
      </div>

      {/* ── Modal nueva fintech ──────────────────────────────── */}
      {isNewFintechModalOpen && (
        <NewFintechModal
          onClose={() => setIsNewFintechModalOpen(false)}
          onConfirm={handleAddFintech}
        />
      )}
    </div>
  );
}
