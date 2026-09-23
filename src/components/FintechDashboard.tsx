'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  Hash,
  Users,
  Building,
  Lock,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { LookupResult, SpecGraphEdge, IncidentCategory } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: IncidentCategory; label: string; color: string }[] = [
  { value: 'MULE_ACCOUNT', label: 'Cuenta Mula', color: 'text-rose-400' },
  { value: 'IDENTITY_THEFT', label: 'Robo de Identidad', color: 'text-orange-400' },
  { value: 'CHARGEBACK', label: 'Contracargo', color: 'text-amber-400' },
  { value: 'PHISHING', label: 'Phishing', color: 'text-yellow-400' },
  { value: 'SUSPICIOUS', label: 'Actividad Sospechosa', color: 'text-slate-400' },
];

function riskBadgeClass(level: 'BAJO' | 'MEDIO' | 'ALTO') {
  if (level === 'ALTO') return 'bg-rose-500/20 border-rose-500/40 text-rose-300';
  if (level === 'MEDIO') return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
  return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
}

function scoreColor(score: number) {
  if (score >= 70) return '#f87171'; // rose-400
  if (score >= 30) return '#fbbf24'; // amber-400
  return '#34d399'; // emerald-400
}

function formatTimeAgo(timestamp: number | string | null): string {
  if (!timestamp) return 'Sin registros';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `hace ${Math.max(1, diffMins)} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'hace 1 día';
  if (diffDays < 30) return `hace ${diffDays} días`;
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
}

// ─────────────────────────────────────────────────────────────────
// GAUGE SVG ANIMADO
// ─────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = Math.PI * radius; // semicírculo
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Fondo */}
        <path
          d="M 14 76 A 56 56 0 0 1 126 76"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progreso */}
        <path
          d="M 14 76 A 56 56 0 0 1 126 76"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        {/* Score */}
        <text
          x="70"
          y="68"
          textAnchor="middle"
          fontSize="22"
          fontWeight="bold"
          fontFamily="monospace"
          fill={color}
          style={{ transition: 'fill 0.4s ease' }}
        >
          {score}
        </text>
      </svg>
      <span className="text-[11px] font-mono text-slate-500 -mt-1">Score de Riesgo (0-100)</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 1: LOOKUP UNITARIO
// ─────────────────────────────────────────────────────────────────

function LookupModule() {
  const { lookupIdentity, activeFintechId, fintechs, lastLookupResult } = useConsortiumStore();
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [device, setDevice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResult | null>(lastLookupResult);
  const [showHashes, setShowHashes] = useState(false);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni && !email && !phone && !ip) {
      setError('Ingresá al menos un identificador para consultar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await lookupIdentity({
        dni: dni || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });
      setResult(res);
    } catch (err) {
      setError('Error al evaluar el riesgo. Intentá nuevamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">Consulta Unitaria de Riesgo</h3>
        {activeFintech && (
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            Como: <span className="text-slate-300">{activeFintech.name}</span>
          </span>
        )}
      </div>

      <form onSubmit={handleLookup} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">DNI / CUIL</label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value)}
              placeholder="30111222"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@gmail.com"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+5491122334455"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
        </div>

        {/* Segunda fila: IP y Dispositivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Dirección IP
              <span className="ml-1.5 text-[10px] text-slate-600">(IPv4 / IPv6)</span>
            </label>
            <input
              type="text"
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="192.168.1.100 ó 2001:db8::1"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Dispositivo / Device Fingerprint
              <span className="ml-1.5 text-[10px] text-slate-600">(User-Agent o hash de dispositivo)</span>
            </label>
            <input
              type="text"
              value={device}
              onChange={e => setDevice(e.target.value)}
              placeholder="Mozilla/5.0 ... ó device-hash"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-cyan-900/30"
        >
          {loading ? (
            <>
              <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
              Evaluando...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Consultar Riesgo
            </>
          )}
        </button>
      </form>

      {/* Resultado */}
      {result && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Gauge */}
            <ScoreGauge score={result.breakdown.finalScore} />

            {/* Badge + desglose */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold ${riskBadgeClass(
                    result.breakdown.riskLevel
                  )}`}
                >
                  {result.breakdown.riskLevel === 'ALTO' ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : result.breakdown.riskLevel === 'MEDIO' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {result.breakdown.riskLevel === 'ALTO'
                    ? 'ALTO RIESGO — BLOQUEAR'
                    : result.breakdown.riskLevel === 'MEDIO'
                    ? 'RIESGO MEDIO — REVISIÓN MANUAL'
                    : 'RIESGO BAJO — APROBAR'}
                </span>
              </div>

              {/* Factores de scoring */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reportes históricos</span>
                  <span className="font-mono font-bold text-slate-200">
                    +{result.breakdown.historicalReportsScore} pts
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${result.breakdown.mismatchDetected ? 'text-rose-400' : 'text-slate-500'}`}>
                    {result.breakdown.mismatchDetected ? <AlertTriangle className="h-3 w-3" /> : null}
                    Identity Mismatch
                    {result.breakdown.mismatchDetected && (
                      <span className="ml-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                        DETECTADO
                      </span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${result.breakdown.mismatchDetected ? 'text-rose-400' : 'text-slate-600'}`}>
                    +{result.breakdown.mismatchPenalty} pts
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${result.breakdown.velocityTriggered ? 'text-amber-400' : 'text-slate-500'}`}>
                    {result.breakdown.velocityTriggered ? <Zap className="h-3 w-3" /> : null}
                    Velocity (ráfaga consultas)
                    {result.breakdown.velocityTriggered && (
                      <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                        ACTIVO
                      </span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${result.breakdown.velocityTriggered ? 'text-amber-400' : 'text-slate-600'}`}>
                    +{result.breakdown.velocityPenalty} pts
                  </span>
                </div>
                <div className="border-t border-white/10 pt-1.5 flex items-center justify-between font-bold">
                  <span className="text-white">Score Final</span>
                  <span
                    className="font-mono text-sm"
                    style={{ color: scoreColor(result.breakdown.finalScore) }}
                  >
                    {result.breakdown.finalScore} / 100
                  </span>
                </div>
              </div>

              {/* Resumen Zero-Knowledge: Score, Cantidad de entidades, Recencia, Tipologías */}
              {(() => {
                const edges = result.breakdown.matchingEdges || [];
                const distinctEntitiesCount = new Set(edges.map(e => e.reportedByEntityId)).size;
                const mostRecentTimestamp = edges.length > 0
                  ? Math.max(...edges.map(e => new Date(e.timestamp).getTime()))
                  : null;

                return (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Entidades donde apareció */}
                      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-2.5">
                        <span className="text-[11px] text-slate-400 block">Aparición en la Red:</span>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                          <Building className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          {distinctEntitiesCount > 0 ? (
                            <span>
                              Apareció en <strong className="text-cyan-300">{distinctEntitiesCount}</strong> {distinctEntitiesCount === 1 ? 'entidad independiente' : 'entidades independientes'}
                            </span>
                          ) : (
                            <span className="text-emerald-400">0 apariciones en la red</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {edges.length > 0 ? `${edges.length} reporte(s) acumulados` : 'Identificador limpio'}
                        </span>
                      </div>

                      {/* Recencia / Antigüedad */}
                      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-2.5">
                        <span className="text-[11px] text-slate-400 block">Antigüedad del Reporte:</span>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          {mostRecentTimestamp ? (
                            <span>{formatTimeAgo(mostRecentTimestamp)}</span>
                          ) : (
                            <span className="text-emerald-400">Sin antecedentes</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {mostRecentTimestamp ? `Fecha: ${new Date(mostRecentTimestamp).toLocaleDateString('es-AR')}` : 'Sin marcas temporales'}
                        </span>
                      </div>
                    </div>

                    {/* Tipologías detectadas si hay reportes */}
                    {edges.length > 0 && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-300">Tipologías reportadas:</span>
                          <span className="text-[10px] text-slate-500 font-mono">Consenso Ciego ZK</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {Array.from(new Set(edges.map(e => e.incidentCategory))).map(cat => (
                            <span key={cat} className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                              {cat.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/[0.03]">
                      <Lock className="h-3 w-3 text-cyan-400/70 shrink-0" />
                      <span>Zero-Knowledge: solo se accede a métricas al consultar. No se revelan nombres de comercios, bancos ni datos personales.</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Hashes generados */}
          <button
            onClick={() => setShowHashes(!showHashes)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 transition py-1"
          >
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              Ver hashes ciegos generados
            </span>
            {showHashes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showHashes && (
            <div className="rounded-xl bg-black/40 p-3 space-y-1.5 font-mono text-[11px]">
              {result.dniHash && (
                <div className="flex gap-2">
                  <span className="text-slate-600 shrink-0">DNI:</span>
                  <span className="text-cyan-400 break-all">{result.dniHash}</span>
                </div>
              )}
              {result.emailHash && (
                <div className="flex gap-2">
                  <span className="text-slate-600 shrink-0">EMAIL:</span>
                  <span className="text-cyan-400 break-all">{result.emailHash}</span>
                </div>
              )}
              {result.phoneHash && (
                <div className="flex gap-2">
                  <span className="text-slate-600 shrink-0">PHONE:</span>
                  <span className="text-cyan-400 break-all">{result.phoneHash}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 2: REPORTE DE FRAUDE
// ─────────────────────────────────────────────────────────────────

function ReportFraudModule() {
  const { reportFraud, activeFintechId, fintechs } = useConsortiumStore();
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('MULE_ACCOUNT');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni && !email && !phone) {
      setError('Ingresá al menos un identificador para reportar.');
      return;
    }
    setError('');
    setLoading(true);
    setSuccess(false);
    try {
      await reportFraud({
        dni: dni || undefined,
        email: email || undefined,
        phone: phone || undefined,
        incidentCategory: category,
      });
      setSuccess(true);
      setDni('');
      setEmail('');
      setPhone('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el reporte.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-rose-400" />
        <h3 className="text-sm font-bold text-white">Registrar Fraude Confirmado</h3>
        {activeFintech && (
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            Como: <span className="text-slate-300">{activeFintech.name}</span>
          </span>
        )}
      </div>

      {activeFintech?.status === 'SUSPENDED' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          Entidad suspendida. Contactá al SuperAdmin para reactivar.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">DNI</label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value)}
              placeholder="30111222"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="estafador@gmail.com"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+5491122334455"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition font-mono"
            />
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Categoría del Incidente</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  category === cat.value
                    ? 'border-rose-500/50 bg-rose-500/20 text-white'
                    : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            ¡Fraude registrado en la red! Los hashes se crearon y las aristas del grafo se actualizaron.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || activeFintech?.status === 'SUSPENDED'}
          className="w-full sm:w-auto flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-rose-900/30"
        >
          {loading ? (
            <>
              <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
              Registrando...
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4" />
              Registrar en Red
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 3: INGESTA MASIVA CSV
// ─────────────────────────────────────────────────────────────────

function CSVImportModule() {
  const { importCSV, activeFintechId, fintechs } = useConsortiumStore();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);
  const [preview, setPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.includes('text') && !file.name.endsWith('.csv')) {
        setResult({ imported: 0, errors: 1 });
        return;
      }
      const text = await file.text();
      const lines = text.split('\n').slice(0, 5);
      setPreview(lines.join('\n'));
      setLoading(true);
      try {
        const res = await importCSV(text);
        setResult(res);
      } finally {
        setLoading(false);
      }
    },
    [importCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">Ingesta Masiva CSV</h3>
        {activeFintech && (
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            Como: <span className="text-slate-300">{activeFintech.name}</span>
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Formato: <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded">dni,email,phone,categoria</code> — una tupla por línea. Categorías válidas: MULE_ACCOUNT, IDENTITY_THEFT, CHARGEBACK, PHISHING, SUSPICIOUS.
      </p>

      {/* Zona Drag & Drop */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500/70 bg-indigo-950/20 scale-[1.01]'
            : 'border-white/15 bg-slate-800/30 hover:border-white/25 hover:bg-slate-800/50'
        }`}
      >
        <Upload className={`h-8 w-8 ${isDragging ? 'text-indigo-400' : 'text-slate-500'}`} />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">
            {isDragging ? 'Soltá el archivo aquí' : 'Arrastrá tu CSV aquí'}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">o hacé click para seleccionar</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-xs text-indigo-300">
          <span className="animate-spin h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          Procesando registros y generando hashes...
        </div>
      )}

      {preview && !loading && (
        <div className="rounded-xl bg-black/40 p-3">
          <p className="text-xs text-slate-500 mb-2">Vista previa (primeras 5 líneas):</p>
          <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">{preview}</pre>
        </div>
      )}

      {result && !loading && (
        <div className={`rounded-xl border p-4 space-y-1 ${
          result.errors === 0
            ? 'border-emerald-500/30 bg-emerald-950/20'
            : 'border-amber-500/30 bg-amber-950/20'
        }`}>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            {result.errors === 0
              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
              : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            Importación completada
          </div>
          <p className="text-xs text-emerald-300">✓ {result.imported} registros ingresados exitosamente</p>
          {result.errors > 0 && (
            <p className="text-xs text-rose-400">✗ {result.errors} líneas con error de formato</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 4: HISTORIAL + FALSO POSITIVO
// ─────────────────────────────────────────────────────────────────

function ReportHistoryModule() {
  const { graphEdges, markFalsePositive, activeFintechId, fintechs } = useConsortiumStore();

  const activeFintech = fintechs.find(f => f.id === activeFintechId);
  const myEdges = graphEdges
    .filter(e => e.reportedByEntityId === activeFintechId)
    .slice()
    .reverse();

  const handleMarkFP = (edgeId: string) => {
    if (!confirm('¿Confirmar falso positivo? Esto revertirá el impacto de este reporte en el score de la red.')) return;
    markFalsePositive(edgeId);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-400" />
        <h3 className="text-sm font-bold text-white">Historial de Reportes</h3>
        {activeFintech && (
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            {myEdges.length} reporte(s) de{' '}
            <span className="text-slate-300">{activeFintech.name}</span>
          </span>
        )}
      </div>

      {myEdges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/30 py-10 text-center">
          <Shield className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No hay reportes registrados por esta entidad.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 border-b border-white/10 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Hash Origen</th>
                <th className="px-4 py-3">Hash Destino</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {myEdges.map(edge => (
                <tr
                  key={edge.id}
                  className={edge.isFalsePositive ? 'opacity-50 bg-amber-950/10' : 'hover:bg-white/5 transition'}
                >
                  <td className="px-4 py-3 font-mono text-cyan-400/80">
                    {edge.sourceHash.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-cyan-400/80">
                    {edge.targetHash.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                      edge.incidentCategory === 'MULE_ACCOUNT'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : edge.incidentCategory === 'IDENTITY_THEFT'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : edge.incidentCategory === 'CHARGEBACK'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : edge.incidentCategory === 'PHISHING'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                      {edge.incidentCategory}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 tabular-nums">
                    {new Date(edge.timestamp).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {edge.isFalsePositive ? (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                        FALSO POSITIVO
                      </span>
                    ) : (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                        ACTIVO
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!edge.isFalsePositive && (
                      <button
                        onClick={() => handleMarkFP(edge.id)}
                        className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 active:scale-95 transition"
                      >
                        Falso Positivo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FINTECH SELECTOR (para simular perspectivas distintas)
// ─────────────────────────────────────────────────────────────────

function FintechSelector() {
  const { fintechs, activeFintechId, setActiveFintechId } = useConsortiumStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        Actuando como:
      </span>
      {fintechs.map(f => (
        <button
          key={f.id}
          onClick={() => setActiveFintechId(f.id)}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
            activeFintechId === f.id
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/30'
              : 'border border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20 hover:text-slate-200'
          } ${f.status === 'SUSPENDED' ? 'opacity-50' : ''}`}
        >
          {f.name}
          {f.status === 'SUSPENDED' && (
            <span className="ml-1.5 text-rose-400 text-[10px]">SUSP</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: FintechDashboard
// ─────────────────────────────────────────────────────────────────

type FintechModule = 'lookup' | 'report' | 'csv' | 'history';

export default function FintechDashboard({
  activeModule,
}: {
  activeModule?: FintechModule;
}) {
  // Si se especifica un módulo, mostrar solo ese. Si no, mostrar todos.
  const showAll = !activeModule;

  return (
    <div className="space-y-6">
      {(showAll || activeModule === 'lookup') && <LookupModule />}
      {(showAll || activeModule === 'report') && <ReportFraudModule />}
      {(showAll || activeModule === 'csv') && <CSVImportModule />}
      {(showAll || activeModule === 'history') && <ReportHistoryModule />}
    </div>
  );
}
