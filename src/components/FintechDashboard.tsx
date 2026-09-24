'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Zap,
  Clock,
  Users,
  Building,
  Lock,
  FileSpreadsheet,
  Download,
  ThumbsUp,
  Globe,
  Mail,
  Send,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { LookupResult, IncidentCategory } from '@/lib/types';
import { simulateSendVerificationEmail } from '@/lib/emailVerifier';

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
// MÓDULO 1: CONSULTA DE RIESGO (UNITARIA - DNI, EMAIL, TEL, IP)
// ─────────────────────────────────────────────────────────────────

function SingleLookupView() {
  const { lookupIdentity, markFalsePositive, activeFintechId, fintechs, lastLookupResult } = useConsortiumStore();
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResult | null>(lastLookupResult);
  const [okLoading, setOkLoading] = useState(false);
  const [okDone, setOkDone] = useState(false);

  // Estado para la prueba de envío / verificación de correo
  const [emailPingLoading, setEmailPingLoading] = useState(false);
  const [emailPingResult, setEmailPingResult] = useState<{
    success: boolean;
    message: string;
    otpCode?: string;
    bounceCode?: string;
  } | null>(null);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() && !email.trim() && !phone.trim() && !ip.trim()) {
      setError('Ingresá al menos un identificador (DNI, Email, Teléfono o IP) para consultar.');
      return;
    }
    setError('');
    setOkDone(false);
    setEmailPingResult(null);
    setLoading(true);
    try {
      const res = await lookupIdentity({
        dni: dni.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        ip: ip.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError('Error al evaluar el riesgo en la red federada.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Voto OK / Atenuación (−35 pts por reporte de la red)
  const handleMarkOK = async () => {
    if (!result) return;
    const activeEdges = (result.breakdown.matchingEdges || []).filter(e => !e.isFalsePositive);
    
    if (activeEdges.length === 0) {
      setOkLoading(true);
      setTimeout(() => {
        setOkDone(true);
        setOkLoading(false);
      }, 300);
      return;
    }

    if (!confirm(`¿Confirmar voto OK para este identificador? Esto atenuará el score comunitario (−35 pts por reporte).`)) return;
    
    setOkLoading(true);
    for (const edge of activeEdges) {
      markFalsePositive(edge.id);
    }
    setOkDone(true);
    setOkLoading(false);

    // Re-evaluar automáticamente para mostrar el score reducido en vivo
    setTimeout(async () => {
      const refreshed = await lookupIdentity({
        dni: dni.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        ip: ip.trim() || undefined,
      });
      setResult(refreshed);
    }, 250);
  };

  // Función para enviar correo de verificación / probar rebote
  const handleSendEmailVerification = async () => {
    const targetEmail = email.trim() || result?.breakdown.emailVerification?.email;
    if (!targetEmail) return;
    setEmailPingLoading(true);
    setEmailPingResult(null);
    const res = await simulateSendVerificationEmail(targetEmail);
    setEmailPingResult(res);
    setEmailPingLoading(false);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleLookup} className="space-y-4">
        {/* DNI, Email, Teléfono e IP — SIN Device Fingerprint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              DNI / CUIL
            </label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value)}
              placeholder="Ej: 30111222"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Ej: estafador@gmail.com o usuario@noexiste.com"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Teléfono Móvil
            </label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej: +5491122334455"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-cyan-400" /> Dirección IP
            </label>
            <input
              type="text"
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="Ej: 190.191.200.45"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition font-mono"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          💡 Podés consultar <strong>1 solo campo</strong> o <strong>varios campos combinados</strong> (DNI, Email, Teléfono, IP). La plataforma valida automáticamente la <strong>existencia del email</strong> e identifica dominios sin registros MX o descartables.
        </p>

        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-950/30 border border-rose-500/30 rounded-xl p-2.5">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-cyan-950/40"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                Evaluando en red federada...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Consultar Riesgo
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── RESULTADO DE CONSULTA (SIN HASHES VISIBLES) ──────────────────── */}
      {result && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 animate-fade-in shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Gauge */}
            <ScoreGauge score={result.breakdown.finalScore} />

            {/* Badge + Controles de Acción */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center flex-wrap gap-2.5">
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

                {/* ── BOTÓN OK PARA ATENUAR SCORE ─────────── */}
                <button
                  type="button"
                  onClick={handleMarkOK}
                  disabled={okLoading || okDone}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition active:scale-95 shadow-md ${
                    okDone
                      ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 cursor-default'
                      : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/60 hover:text-white'
                  }`}
                  title="Atenúa el score de riesgo restando −35 pts por reporte comunitario"
                >
                  {okDone ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      Voto OK Registrado (−35 pts aplicados)
                    </>
                  ) : okLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                      Aplicando atenuación...
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                      Marcar como OK (−35 pts / Bajar Riesgo)
                    </>
                  )}
                </button>
              </div>

              {okDone && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Voto de legitimidad computado. El score de riesgo fue atenuado en tiempo real en la red federada.</span>
                </div>
              )}

              {/* ── ALERTA DE EXISTENCIA DE EMAIL ────────────────────────── */}
              {result.breakdown.emailVerification && (
                <div className="space-y-2 pt-1">
                  {result.breakdown.emailVerification.status === 'NON_EXISTENT' && (
                    <div className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-red-950/50 to-slate-900 p-4 text-white shadow-xl shadow-rose-950/40 animate-pulse">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white font-black text-xl shadow-lg">
                            ⚠️
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black tracking-wider text-rose-300 uppercase">
                                ALERTA CRÍTICA: EL CORREO NO EXISTE
                              </span>
                              <span className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-black">
                                +35 PTS RIESGO
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-rose-200/90 leading-relaxed">
                              El correo <strong>{result.breakdown.emailVerification.email}</strong> no posee registros DNS MX o el buzón fue rechazado por el servidor (550 Mailbox not found). Alta probabilidad de <strong>identidad sintética o cuenta ficticia para estafas</strong>.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendEmailVerification}
                          disabled={emailPingLoading}
                          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-600/30 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-600/60 active:scale-95 transition whitespace-nowrap self-start sm:self-auto"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {emailPingLoading ? 'Comprobando entrega...' : 'Probar Envío / Ver Rebote'}
                        </button>
                      </div>
                    </div>
                  )}

                  {result.breakdown.emailVerification.status === 'DISPOSABLE' && (
                    <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="font-bold text-amber-300">Proveedor de Correo Temporal / Descartable detectado:</span>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">El dominio @{result.breakdown.emailVerification.domain} es un servicio descartable (10-minute mail). (+25 pts de penalidad).</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendEmailVerification}
                        disabled={emailPingLoading}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition whitespace-nowrap self-start sm:self-auto"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {emailPingLoading ? 'Enviando...' : 'Probar Envío'}
                      </button>
                    </div>
                  )}

                  {result.breakdown.emailVerification.status === 'EXISTING' && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Buzón verificado: <strong>{result.breakdown.emailVerification.email}</strong> existe y posee servidores MX activos.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendEmailVerification}
                        disabled={emailPingLoading}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition whitespace-nowrap self-start sm:self-auto"
                      >
                        <Mail className="h-3 w-3" />
                        {emailPingLoading ? 'Enviando OTP...' : 'Enviar Desafío OTP de Prueba'}
                      </button>
                    </div>
                  )}

                  {/* Feedback del Ping / Envío */}
                  {emailPingResult && (
                    <div
                      className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 transition animate-fade-in ${
                        emailPingResult.success
                          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                          : 'border-rose-500/50 bg-rose-950/50 text-rose-200'
                      }`}
                    >
                      {emailPingResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{emailPingResult.message}</p>
                        {emailPingResult.otpCode && (
                          <p className="text-[11px] text-emerald-400 font-mono mt-1">
                            Código emitido para el titular: <strong>{emailPingResult.otpCode}</strong> (válido por 10 min)
                          </p>
                        )}
                        {emailPingResult.bounceCode && (
                          <p className="text-[11px] text-rose-300 font-mono mt-1">
                            Respuesta del Host Remoto: <code>{emailPingResult.bounceCode}</code>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Factores del Modelo Probabilístico */}
              <div className="space-y-1.5 text-xs bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reportes acumulados (Decaimiento exponencial Half-life)</span>
                  <span className="font-mono font-bold text-slate-200">
                    +{result.breakdown.historicalReportsScore} pts
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${result.breakdown.mismatchDetected ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                    {result.breakdown.mismatchDetected ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                    Discrepancia de Identidad (Mismatch)
                    {result.breakdown.mismatchDetected && (
                      <span className="ml-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">DETECTADO</span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${result.breakdown.mismatchDetected ? 'text-rose-400' : 'text-slate-600'}`}>
                    +{result.breakdown.mismatchPenalty} pts
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${result.breakdown.velocityTriggered ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                    {result.breakdown.velocityTriggered ? <Zap className="h-3.5 w-3.5" /> : null}
                    Velocidad de ataque (Ráfaga &lt;24h)
                    {result.breakdown.velocityTriggered && (
                      <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">ACTIVO</span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${result.breakdown.velocityTriggered ? 'text-amber-400' : 'text-slate-600'}`}>
                    +{result.breakdown.velocityPenalty} pts
                  </span>
                </div>

                {/* Penalidad de Email si aplica */}
                {result.breakdown.emailPenalty ? (
                  <div className="flex items-center justify-between text-rose-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Penalidad por Correo ({result.breakdown.emailVerification?.badgeText})
                    </span>
                    <span className="font-mono font-bold">
                      +{result.breakdown.emailPenalty} pts
                    </span>
                  </div>
                ) : null}

                <div className="border-t border-white/10 pt-2 flex items-center justify-between font-bold">
                  <span className="text-white">Score Final Computado</span>
                  <span className="font-mono text-sm" style={{ color: scoreColor(result.breakdown.finalScore) }}>
                    {result.breakdown.finalScore} / 100
                  </span>
                </div>
              </div>

              {/* Resumen Comunitario ZK (SIN HASHES) */}
              {(() => {
                const edges = result.breakdown.matchingEdges || [];
                const distinctEntitiesCount = new Set(edges.map(e => e.reportedByEntityId)).size;
                const mostRecentTimestamp = edges.length > 0
                  ? Math.max(...edges.map(e => new Date(e.timestamp).getTime()))
                  : null;
                return (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
                        <span className="text-[11px] text-slate-400 block">Consenso en la Red:</span>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                          <Building className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          {distinctEntitiesCount > 0 ? (
                            <span>Reportado en <strong className="text-cyan-300">{distinctEntitiesCount}</strong> {distinctEntitiesCount === 1 ? 'entidad' : 'entidades'}</span>
                          ) : (
                            <span className="text-emerald-400">0 entidades reportaron</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{edges.length} reporte(s) en historial</span>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
                        <span className="text-[11px] text-slate-400 block">Antigüedad del incidente:</span>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          {mostRecentTimestamp ? <span>{formatTimeAgo(mostRecentTimestamp)}</span> : <span className="text-emerald-400">Sin registros</span>}
                        </div>
                      </div>
                    </div>

                    {edges.length > 0 && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-2.5">
                        <span className="text-[11px] font-bold text-rose-300 block mb-1.5">Tipologías de fraude registradas:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(new Set(edges.map(e => e.incidentCategory))).map(cat => (
                            <span key={cat} className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                              {cat.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/[0.02] rounded-xl px-3 py-2 border border-white/5">
                      <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span>Zero-Knowledge: La consulta evalúa datos anonimizados sin exponer hashes ni PII confidencial.</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 1B: CONSULTA MASIVA CSV (DNI, EMAIL, TEL, IP)
// ─────────────────────────────────────────────────────────────────

const SAMPLE_BULK_CSV = `dni,email,phone,ip
30111222,estafador@gmail.com,+5491122334455,190.191.200.45
40999888,usuario_falso@noexiste.com,,181.44.120.10
,,+5491155667788,
20123456789,burner@yopmail.com,+5491188990011,200.45.12.89
`;

function maskField(val?: string) {
  if (!val) return '—';
  if (val.includes('@')) {
    const [u, d] = val.split('@');
    return `${u.slice(0, 3)}***@${d || '?'}`;
  }
  if (val.includes('.')) {
    // Es IP: ej 190.191.200.45 -> 190.191.***.45
    const parts = val.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
  }
  if (val.length <= 4) return `${val.slice(0, 1)}***`;
  return `${val.slice(0, 2)}***${val.slice(-3)}`;
}

interface BulkRowResult {
  row: number;
  dniMasked: string;
  emailMasked: string;
  phoneMasked: string;
  ipMasked: string;
  emailStatus: 'EXISTING' | 'NON_EXISTENT' | 'DISPOSABLE' | 'NONE';
  score: number;
  level: 'BAJO' | 'MEDIO' | 'ALTO' | 'ERROR';
  tipologia: string;
}

function BulkLookupView() {
  const { lookupIdentity, activeFintechId, fintechs } = useConsortiumStore();
  const [isDragging, setIsDragging] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkRowResult[]>([]);
  const [bulkError, setBulkError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // Descarga del Layout de Prueba
  const downloadSampleLayout = () => {
    const blob = new Blob([SAMPLE_BULK_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout_consulta_masiva_antifraude.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Descarga de resultados procesados
  const downloadResults = () => {
    if (!bulkResults.length) return;
    const csv =
      'fila,dni_masked,email_masked,phone_masked,ip_masked,estado_email,score,nivel,tipologia\n' +
      bulkResults
        .map(
          r =>
            `${r.row},"${r.dniMasked}","${r.emailMasked}","${r.phoneMasked}","${r.ipMasked}","${r.emailStatus}",${r.score},${r.level},"${r.tipologia}"`
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados_evaluacion_masiva_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processLookupFile = useCallback(
    async (file: File) => {
      setBulkError('');
      setBulkResults([]);
      setBulkLoading(true);
      setBulkProgress(0);

      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setBulkError('El archivo CSV debe contener un encabezado y al menos 1 fila de datos.');
        setBulkLoading(false);
        return;
      }

      const header = lines[0].toLowerCase();
      const dataLines = lines.slice(1);

      // Soportar formato columna: dni,email,phone,ip O formato tipo,valor
      const isTipoValor = header.includes('tipo') && header.includes('valor');

      const itemsToQuery: { dni?: string; email?: string; phone?: string; ip?: string }[] = [];

      if (isTipoValor) {
        for (const line of dataLines) {
          const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          const tipo = parts[0]?.toUpperCase();
          const val = parts[1];
          if (!val) continue;
          if (tipo === 'DNI') itemsToQuery.push({ dni: val });
          else if (tipo === 'EMAIL') itemsToQuery.push({ email: val });
          else if (tipo === 'PHONE') itemsToQuery.push({ phone: val });
          else if (tipo === 'IP') itemsToQuery.push({ ip: val });
        }
      } else {
        // Formato columnas: dni,email,phone,ip (en cualquier orden de header)
        const cols = header.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const dniIdx = cols.findIndex(c => c.includes('dni') || c.includes('cuil') || c.includes('cuit'));
        const emailIdx = cols.findIndex(c => c.includes('email') || c.includes('correo'));
        const phoneIdx = cols.findIndex(c => c.includes('phone') || c.includes('tel') || c.includes('cel'));
        const ipIdx = cols.findIndex(c => c.includes('ip') || c.includes('ip_address'));

        for (const line of dataLines) {
          const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          const rowDni = dniIdx >= 0 ? parts[dniIdx] : undefined;
          const rowEmail = emailIdx >= 0 ? parts[emailIdx] : undefined;
          const rowPhone = phoneIdx >= 0 ? parts[phoneIdx] : undefined;
          const rowIp = ipIdx >= 0 ? parts[ipIdx] : undefined;

          if (rowDni || rowEmail || rowPhone || rowIp) {
            itemsToQuery.push({
              dni: rowDni || undefined,
              email: rowEmail || undefined,
              phone: rowPhone || undefined,
              ip: rowIp || undefined,
            });
          }
        }
      }

      if (!itemsToQuery.length) {
        setBulkError('No se encontraron filas con datos válidos en el archivo. Descargá el layout de prueba para ver el formato.');
        setBulkLoading(false);
        return;
      }

      const results: BulkRowResult[] = [];
      for (let i = 0; i < itemsToQuery.length; i++) {
        const item = itemsToQuery[i];
        try {
          const res = await lookupIdentity(item);
          const edges = res.breakdown.matchingEdges || [];
          const topTipologia =
            edges.length > 0
              ? Array.from(new Set(edges.map(e => e.incidentCategory)))[0]
              : 'Sin antecedentes';

          const emailVerification = res.breakdown.emailVerification;
          const emailStatus = !item.email
            ? 'NONE'
            : emailVerification?.status || 'EXISTING';

          results.push({
            row: i + 1,
            dniMasked: maskField(item.dni),
            emailMasked: maskField(item.email),
            phoneMasked: maskField(item.phone),
            ipMasked: maskField(item.ip),
            emailStatus,
            score: res.breakdown.finalScore,
            level: res.breakdown.riskLevel,
            tipologia: topTipologia,
          });
        } catch {
          results.push({
            row: i + 1,
            dniMasked: maskField(item.dni),
            emailMasked: maskField(item.email),
            phoneMasked: maskField(item.phone),
            ipMasked: maskField(item.ip),
            emailStatus: 'NONE',
            score: 0,
            level: 'ERROR',
            tipologia: 'Error en consulta',
          });
        }
        setBulkProgress(Math.round(((i + 1) / itemsToQuery.length) * 100));
      }

      setBulkResults(results);
      setBulkLoading(false);
    },
    [lookupIdentity]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processLookupFile(f);
    },
    [processLookupFile]
  );

  return (
    <div className="space-y-5">
      {/* Apartado de Consultas Masivas con ambos botones: Descargar y Subir */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/25 rounded-2xl p-5 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
              Apartado de Consultas Masivas (CSV)
            </h4>
          </div>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Evaluá múltiples identidades en simultáneo (DNI, Email, Teléfono, IP). Descargá el layout de prueba para verificar el formato de columnas o subí directamente tu archivo para calcular el score individual de cada registro.
          </p>
        </div>

        {/* Los dos botones de Consultas Masivas juntos */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={downloadSampleLayout}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 hover:text-white active:scale-95 transition shadow-md"
            title="Descargar archivo CSV de prueba con las columnas preparadas"
          >
            <Download className="h-4 w-4" />
            <span>Descargar Layout de Prueba</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl theme-btn-primary px-4 py-2.5 text-xs font-bold shadow-lg shadow-cyan-950/50 transition active:scale-95"
            title="Seleccionar y subir archivo CSV para consultar"
          >
            <Upload className="h-4 w-4" />
            <span>Subir Archivo CSV</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-black/40 p-3 font-mono text-xs border border-white/5">
        <p className="text-slate-400 font-sans text-[11px] mb-1 font-semibold">Formato admitido (uno o varios campos por fila):</p>
        <p className="text-cyan-400">dni,email,phone,ip</p>
        <p className="text-slate-500">30111222,estafador@gmail.com,+5491122334455,190.191.200.45</p>
        <p className="text-slate-500">40999888,usuario_falso@noexiste.com,,181.44.120.10</p>
        <p className="text-slate-500">,,+5491155667788,</p>
      </div>

      {/* Zona de Drop */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-9 cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-500/70 bg-cyan-950/20 scale-[1.01]'
            : 'border-white/15 bg-slate-900/40 hover:border-white/30 hover:bg-slate-900/70'
        }`}
      >
        <Upload className={`h-8 w-8 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">
            {isDragging ? 'Soltá el archivo aquí' : 'Arrastrá tu archivo CSV aquí'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">o hacé clic para seleccionar desde tu computadora (.csv o .txt)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processLookupFile(f);
          }}
        />
      </div>

      {/* Barra de progreso */}
      {bulkLoading && (
        <div className="space-y-2 rounded-xl bg-black/40 p-4 border border-white/5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              Evaluando registros y verificando existencia de correos...
            </span>
            <span className="font-mono text-cyan-400 font-bold">{bulkProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${bulkProgress}%` }}
            />
          </div>
        </div>
      )}

      {bulkError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {bulkError}
        </div>
      )}

      {/* Tabla de Resultados Masivos (SIN HASHES) */}
      {!bulkLoading && bulkResults.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/90">
            <div>
              <p className="text-sm font-bold text-white">{bulkResults.length} registros evaluados</p>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="text-rose-400 font-semibold">
                  {bulkResults.filter(r => r.level === 'ALTO').length} Alto Riesgo
                </span>{' '}
                ·{' '}
                <span className="text-amber-400 font-semibold">
                  {bulkResults.filter(r => r.level === 'MEDIO').length} Medio
                </span>{' '}
                ·{' '}
                <span className="text-emerald-400 font-semibold">
                  {bulkResults.filter(r => r.level === 'BAJO').length} Bajo
                </span>
              </p>
            </div>
            <button
              onClick={downloadResults}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition"
            >
              <FileText className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 border-b border-white/10 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">DNI (masked)</th>
                  <th className="px-4 py-3">Email (masked)</th>
                  <th className="px-4 py-3">Estado Email</th>
                  <th className="px-4 py-3">Teléfono (masked)</th>
                  <th className="px-4 py-3">IP (masked)</th>
                  <th className="px-4 py-3 text-center">Score (0-100)</th>
                  <th className="px-4 py-3 text-center">Nivel</th>
                  <th className="px-4 py-3">Tipología Principal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {bulkResults.map(r => (
                  <tr
                    key={r.row}
                    className={
                      r.level === 'ALTO'
                        ? 'bg-rose-950/15'
                        : r.level === 'MEDIO'
                        ? 'bg-amber-950/15'
                        : 'hover:bg-white/[0.02]'
                    }
                  >
                    <td className="px-4 py-3 text-slate-500 font-mono">{r.row}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{r.dniMasked}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{r.emailMasked}</td>
                    <td className="px-4 py-3">
                      {r.emailStatus === 'NON_EXISTENT' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          <XCircle className="h-3 w-3" /> Inexistente
                        </span>
                      ) : r.emailStatus === 'DISPOSABLE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> Descartable
                        </span>
                      ) : r.emailStatus === 'EXISTING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <CheckCircle className="h-3 w-3" /> Existente
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{r.phoneMasked}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400/90">{r.ipMasked}</td>
                    <td
                      className="px-4 py-3 text-center font-mono font-black text-sm"
                      style={{ color: scoreColor(r.score) }}
                    >
                      {r.score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          r.level === 'ALTO'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : r.level === 'MEDIO'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {r.tipologia.replace(/_/g, ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CONTENEDOR PRINCIPAL DE CONSULTA (UNITARIA + MASIVA TOGGLE)
// ─────────────────────────────────────────────────────────────────

function LookupModule({ initialSubTab = 'single' }: { initialSubTab?: 'single' | 'bulk' }) {
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'bulk'>(initialSubTab);
  const { activeFintechId, fintechs } = useConsortiumStore();
  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  React.useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header con Tabs de Selección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          {activeSubTab === 'bulk' ? (
            <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
          ) : (
            <Search className="h-5 w-5 text-cyan-400" />
          )}
          <h3 className="text-base font-bold text-white">
            {activeSubTab === 'bulk' ? 'Consultas Masivas' : 'Consulta de Riesgo'}
          </h3>
          {activeFintech && (
            <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
              Entidad: <strong className="text-slate-200">{activeFintech.name}</strong>
            </span>
          )}
        </div>

        {/* Toggle Unitaria vs Masiva */}
        <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('single')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'single'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Consulta Unitaria (DNI, Email, Tel, IP)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bulk')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'bulk'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Consulta Masiva (CSV)
          </button>
        </div>
      </div>

      {/* Renderizado de la vista elegida */}
      {activeSubTab === 'single' ? <SingleLookupView /> : <BulkLookupView />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 2: REPORTE DE FRAUDE (DNI, EMAIL, TEL, IP)
// ─────────────────────────────────────────────────────────────────

function ReportFraudModule() {
  const { reportFraud, activeFintechId, fintechs } = useConsortiumStore();
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('MULE_ACCOUNT');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni && !email && !phone && !ip) {
      setError('Ingresá al menos un identificador (DNI, Email, Teléfono o IP) para reportar.');
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
        ip: ip || undefined,
        incidentCategory: category,
      });
      setSuccess(true);
      setDni('');
      setEmail('');
      setPhone('');
      setIp('');
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">DNI / CUIL</label>
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
          <div>
            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Globe className="h-3 w-3 text-cyan-400" /> Dirección IP
            </label>
            <input
              type="text"
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="190.191.200.45"
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
            ¡Fraude registrado en la red federada exitosamente!
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
// MÓDULO 3: INGESTA MASIVA CSV (REPORTES DE FRAUDE CON IP)
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

  const downloadSampleLayout = () => {
    const csv = `dni,email,phone,ip,categoria
30111222,estafador@gmail.com,+5491122334455,190.191.200.45,MULE_ACCOUNT
40999888,victima@hotmail.com,,,IDENTITY_THEFT
,,+5491155667788,,PHISHING
20123456789,otro@empresa.com,,200.45.12.89,SUSPICIOUS
`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout_ingesta_reportes_fraude.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Upload className="h-5 w-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">Ingesta Masiva CSV — Reportes de Fraude</h3>
        {activeFintech && (
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            Como: <span className="text-slate-300">{activeFintech.name}</span>
          </span>
        )}
        <button
          onClick={downloadSampleLayout}
          className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.08] px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/[0.15] transition"
        >
          <FileText className="h-3.5 w-3.5" /> Descargar Layout de Reportes
        </button>
      </div>

      <div className="rounded-xl bg-black/40 p-3 font-mono text-xs">
        <p className="text-slate-500 font-sans text-[11px] mb-1 font-semibold">Formato requerido:</p>
        <p className="text-slate-400">dni,email,phone,ip,categoria</p>
        <p className="text-slate-600">30111222,estafador@gmail.com,+54911...,190.191.200.45,MULE_ACCOUNT</p>
        <p className="text-[10px] text-slate-600 font-sans mt-1">Categorías: MULE_ACCOUNT · IDENTITY_THEFT · CHARGEBACK · PHISHING · SUSPICIOUS</p>
      </div>

      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
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
            {isDragging ? 'Soltá el archivo aquí' : 'Arrastrá tu CSV de reportes aquí'}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">o hacé clic para seleccionar · .csv o .txt</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-xs text-indigo-300">
          <span className="animate-spin h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          Procesando registros e integrando en el grafo comunitario...
        </div>
      )}
      {preview && !loading && (
        <div className="rounded-xl bg-black/40 p-3">
          <p className="text-xs text-slate-500 mb-2">Vista previa (primeras 5 líneas):</p>
          <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">{preview}</pre>
        </div>
      )}
      {result && !loading && (
        <div
          className={`rounded-xl border p-4 space-y-1 ${
            result.errors === 0
              ? 'border-emerald-500/30 bg-emerald-950/20'
              : 'border-amber-500/30 bg-amber-950/20'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            {result.errors === 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            )}
            Importación completada
          </div>
          <p className="text-xs text-emerald-300">✓ {result.imported} registros ingresados exitosamente</p>
          {result.errors > 0 && <p className="text-xs text-rose-400">✗ {result.errors} líneas con error de formato</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 4: HISTORIAL DE REPORTES DE FRAUDE POR ENTIDAD (AUDITORÍA COMPLETA)
// ─────────────────────────────────────────────────────────────────

const CATEGORY_TRANSLATIONS: Record<IncidentCategory, { label: string; color: string }> = {
  MULE_ACCOUNT: { label: 'Cuenta Mula', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  IDENTITY_THEFT: { label: 'Robo de Identidad', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  CHARGEBACK: { label: 'Contracargo Comercial', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  PHISHING: { label: 'Phishing Bancario', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  SUSPICIOUS: { label: 'Actividad Sospechosa', color: 'bg-slate-700/60 text-slate-300 border-slate-600' },
};

function ReportHistoryModule() {
  const { graphEdges, markFalsePositive, activeFintechId, fintechs } = useConsortiumStore();
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>(activeFintechId);
  const [searchTerm, setSearchTerm] = useState('');

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // Sincronizar filtro con entidad activa por defecto
  React.useEffect(() => {
    if (selectedEntityFilter !== 'ALL' && !fintechs.some(f => f.id === selectedEntityFilter)) {
      setSelectedEntityFilter(activeFintechId);
    }
  }, [activeFintechId, fintechs, selectedEntityFilter]);

  const filteredEdges = graphEdges
    .filter(e => {
      if (selectedEntityFilter !== 'ALL' && e.reportedByEntityId !== selectedEntityFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cat = (e.incidentCategory || '').toLowerCase();
        const catLabel = (CATEGORY_TRANSLATIONS[e.incidentCategory]?.label || '').toLowerCase();
        const fields = (e.uploadedFields || '').toLowerCase();
        const entity = (e.entityName || '').toLowerCase();
        return cat.includes(term) || catLabel.includes(term) || fields.includes(term) || entity.includes(term);
      }
      return true;
    })
    .slice()
    .reverse();

  const handleMarkFP = (edgeId: string) => {
    if (!confirm('¿Confirmar que este reporte fue un falso positivo? Esto revertirá su impacto en el score de red.')) return;
    markFalsePositive(edgeId);
  };

  const getEntityName = (id: string, storedName?: string) => {
    if (storedName) return storedName;
    const f = fintechs.find(item => item.id === id);
    return f ? f.name : id;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      {/* Header con título y controles de filtro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Historial de Reportes por Banco / Fintech</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro detallado y auditable de todo lo que cada entidad financiera subió a la red comunitaria.
          </p>
        </div>

        {/* Filtro por entidad */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Building className="h-3.5 w-3.5 text-cyan-400" />
            Ver reportes de:
          </span>
          <select
            value={selectedEntityFilter}
            onChange={e => setSelectedEntityFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-medium"
          >
            <option value={activeFintechId}>
              {activeFintech ? `Mi Entidad (${activeFintech.name})` : 'Mi Entidad'}
            </option>
            <option value="ALL">🌐 Todas las entidades del Consorcio</option>
            {fintechs
              .filter(f => f.id !== activeFintechId)
              .map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Buscador de registros y contador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por DNI, email, IP, tipología o banco..."
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Mostrando <strong className="text-white">{filteredEdges.length}</strong> registro(s)
          {selectedEntityFilter !== 'ALL' && activeFintech && (
            <span> de <strong className="text-cyan-300">{getEntityName(selectedEntityFilter)}</strong></span>
          )}
        </div>
      </div>

      {filteredEdges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/30 py-12 text-center space-y-2">
          <Shield className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-400">No hay reportes registrados para el filtro seleccionado.</p>
          <p className="text-xs text-slate-500">
            Podés cargar nuevos reportes desde «Reportar Fraude» o mediante «Importación CSV».
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 shadow-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 border-b border-white/10 text-[11px] uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3"># Registro</th>
                <th className="px-4 py-3">Entidad Emisora</th>
                <th className="px-4 py-3">Datos e Identificadores Subidos</th>
                <th className="px-4 py-3">Canal de Carga</th>
                <th className="px-4 py-3">Categoría de Fraude</th>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3 text-center">Estado de Red</th>
                <th className="px-4 py-3 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredEdges.map((edge, idx) => {
                const catConfig = CATEGORY_TRANSLATIONS[edge.incidentCategory] || {
                  label: edge.incidentCategory,
                  color: 'bg-slate-800 text-slate-300 border-slate-700',
                };
                const entityName = getEntityName(edge.reportedByEntityId, edge.entityName);
                const isMyEntity = edge.reportedByEntityId === activeFintechId;

                return (
                  <tr
                    key={edge.id}
                    className={
                      edge.isFalsePositive
                        ? 'opacity-50 bg-amber-950/10'
                        : isMyEntity
                        ? 'bg-cyan-950/10 hover:bg-cyan-950/20 transition'
                        : 'hover:bg-white/5 transition'
                    }
                  >
                    {/* ID Registro */}
                    <td className="px-4 py-3 font-mono text-slate-400 font-bold whitespace-nowrap">
                      REP-{String(filteredEdges.length - idx).padStart(3, '0')}
                    </td>

                    {/* Entidad Emisora */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                        isMyEntity
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                          : 'bg-slate-800 border-white/10 text-slate-300'
                      }`}>
                        <Building className="h-3 w-3 text-cyan-400" />
                        {entityName}
                      </span>
                    </td>

                    {/* Datos Subidos (Enmascarados) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-slate-200 font-medium">
                          {edge.uploadedFields || 'DNI: 30.***.222 · Email: estafador.red@***'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block pl-5 mt-0.5">
                        Protección Zero-Knowledge (Hash Blindado en Red)
                      </span>
                    </td>

                    {/* Canal de Carga */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {edge.uploadMethod === 'CSV_BULK' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          <FileSpreadsheet className="h-3 w-3" /> Carga Masiva CSV
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <Upload className="h-3 w-3" /> Carga Unitaria
                        </span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${catConfig.color}`}>
                        {catConfig.label}
                      </span>
                    </td>

                    {/* Fecha y Hora */}
                    <td className="px-4 py-3 text-slate-400 tabular-nums whitespace-nowrap font-medium">
                      {new Date(edge.timestamp).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} hs
                    </td>

                    {/* Estado de Red */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {edge.isFalsePositive ? (
                        <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                          FALSO POSITIVO (Revertido)
                        </span>
                      ) : (
                        <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                          ACTIVO EN RED
                        </span>
                      )}
                    </td>

                    {/* Gestión */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!edge.isFalsePositive ? (
                        <button
                          onClick={() => handleMarkFP(edge.id)}
                          className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 hover:text-white active:scale-95 transition"
                          title="Desactivar y atenuar este reporte si fue resuelto o es un cliente legítimo"
                        >
                          Falso Positivo
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Revertido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SELECTOR DE FINTECH
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

type FintechModule = 'lookup' | 'bulk_lookup' | 'report' | 'csv' | 'history';

export default function FintechDashboard({
  activeModule,
}: {
  activeModule?: FintechModule;
}) {
  const showAll = !activeModule;

  return (
    <div className="space-y-6">
      {(showAll || activeModule === 'lookup') && <LookupModule initialSubTab="single" />}
      {(showAll || activeModule === 'bulk_lookup') && <LookupModule initialSubTab="bulk" />}
      {(showAll || activeModule === 'report') && <ReportFraudModule />}
      {(showAll || activeModule === 'csv') && <CSVImportModule />}
      {(showAll || activeModule === 'history') && <ReportHistoryModule />}
    </div>
  );
}
