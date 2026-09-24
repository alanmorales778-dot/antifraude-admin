'use client';

import React, { useState } from 'react';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Key,
  Download,
  Building,
  RotateCcw,
  CheckCircle,
  FileCheck,
  Hash,
  ExternalLink,
  Layers,
  ArrowRight,
  Clock,
  Lock,
} from 'lucide-react';
import { IdentifierType, RiskEvaluationResult, UserRole } from '@/lib/types';
import { computeBlindHash } from '@/lib/crypto';
import { SAMPLE_TEST_CASES } from '@/lib/data-seed';
import RiskMatrixBreakdown from '@/components/RiskMatrixBreakdown';
import SaltingInspector from '@/components/SaltingInspector';

interface RiskLookupProps {
  onOpenReportModal: (type: IdentifierType, value: string) => void;
  onOpenRehabilitateModal: (type: IdentifierType, value: string) => void;
  userRole?: UserRole;
}

export default function RiskLookup({
  onOpenReportModal,
  onOpenRehabilitateModal,
  userRole = 'ANALYST_L2',
}: RiskLookupProps) {
  const [selectedType, setSelectedType] = useState<IdentifierType>('EMAIL');
  const [inputValue, setInputValue] = useState('estafador.red@gmail.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskEvaluationResult | null>(null);
  const [showSaltingInspector, setShowSaltingInspector] = useState(false);
  const [liveHashInfo, setLiveHashInfo] = useState<{
    normalized: string;
    blindHash: string;
    consortiumSaltPreview?: string;
    saltPreview?: string;
    tenantSaltUsed?: string;
    intermediateHash?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Update live blind hash preview as the user types
  React.useEffect(() => {
    if (!inputValue) {
      setLiveHashInfo(null);
      return;
    }
    computeBlindHash(selectedType, inputValue).then(info => {
      setLiveHashInfo(info);
    });
  }, [selectedType, inputValue]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier_type: selectedType,
          identifier_value: inputValue.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al consultar la red');
      }

      setResult(data.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la API de evaluación');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadProof = () => {
    if (!result) return;
    const cert = {
      consortium_attestation: 'ARGENTINE_FINTECH_CONSORTIUM_ZERO_KNOWLEDGE_PROOF',
      protocol_version: '2026.1',
      evaluated_identifier_type: result.identifierType,
      blind_hash: result.blindHash,
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      recommendation: result.recommendation,
      distinct_institutions_count: result.distinctInstitutionsCount,
      cryptographic_proof: result.cryptographicProof,
      issued_at: result.timestamp,
      legal_notice: 'Certificado verificable emitido bajo el protocolo de Hashing Ciego sin transferencia de PII (Ley 25.326).',
    };

    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificado_Riesgo_${result.blindHash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setTestCase = (item: (typeof SAMPLE_TEST_CASES)[0]) => {
    setSelectedType(item.type as IdentifierType);
    setInputValue(item.value);
    // Ejecutar inmediatamente
    setTimeout(() => {
      fetch('/api/v1/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier_type: item.type,
          identifier_value: item.value,
        }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.data) setResult(d.data);
        });
    }, 50);
  };

  // Colores dinámicos según el puntaje de riesgo
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
    if (score >= 35) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'ALTO':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MEDIO':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const formatRecency = (isoString?: string): string => {
    if (!isoString) return 'Sin registros previos';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `Hace ${Math.max(1, diffMins)} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays < 30) return `Hace ${diffDays} días`;
    const diffMonths = Math.floor(diffDays / 30);
    return `Hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Buscador Manual de Riesgo (Consulta Ciega)
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Ingresa un Email, DNI/CUIT o Teléfono para evaluar su historial de fraude comunitario. El dato es convertido localmente a un Hash Ciego SHA-256 irreversible con Salt para preservar la confidencialidad total de los usuarios (Ley 25.326).
        </p>
      </div>

      {/* Quick Test Chips */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400">
          <Zap className="h-3.5 w-3.5 text-indigo-400" />
          <span>Casos de Prueba Precargados (Haz clic para probar):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEST_CASES.map((tc, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTestCase(tc)}
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-indigo-500/40 hover:bg-slate-800 hover:text-white active:scale-95"
            >
              {tc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Box */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl shadow-black/40">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Identifier Type Selector */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'EMAIL', label: 'Email' },
              { id: 'DNI', label: 'DNI / CUIT' },
              { id: 'PHONE', label: 'Teléfono Móvil' },
              { id: 'IP', label: 'Dirección IP' },
              { id: 'CARD_BIN', label: 'Tarjeta (BIN 6 + Últimos 4)' },
            ].map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id as IdentifierType)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedType === type.id
                    ? 'theme-btn-primary shadow-md'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Main Input Field */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="h-5 w-5 text-[var(--accent-primary)]" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={
                selectedType === 'EMAIL'
                  ? 'ejemplo: estafador.red@gmail.com'
                  : selectedType === 'DNI'
                  ? 'ejemplo: 20-41882991-3 o 41882991'
                  : selectedType === 'PHONE'
                  ? 'ejemplo: +54 9 11 4055-8891'
                  : selectedType === 'IP'
                  ? 'ejemplo: 190.191.200.45'
                  : 'ejemplo: 450995******1234'
              }
              className="w-full rounded-2xl border border-white/10 bg-black/40 py-3.5 pl-12 pr-36 text-sm text-white placeholder-slate-500 shadow-inner focus:border-[var(--accent-primary)] focus:outline-none"
              required
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl theme-btn-primary px-5 py-2 text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Consultando...
                  </span>
                ) : (
                  <>
                    <Zap className="h-4 w-4" /> Evaluar Riesgo
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Live Blind Hashing Visualizer */}
        {liveHashInfo && (
          <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-black/40 p-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[11px] text-[var(--accent-primary)] font-semibold">
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Pipeline de Hashing Ciego en Tiempo Real
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Zero-Knowledge Guarantee</span>
                <button
                  type="button"
                  onClick={() => setShowSaltingInspector(!showSaltingInspector)}
                  className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition"
                >
                  {showSaltingInspector ? 'Ocultar Inspector de Salt' : '🔬 Personalizar Salting & Token'}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500">1. Normalizado:</span>
                <div className="text-slate-300 truncate mt-0.5 font-sans bg-white/5 px-2 py-1 rounded">
                  {liveHashInfo.normalized || '—'}
                </div>
              </div>

              <div>
                <span className="text-slate-500">2. Salt Secreta Consorcio:</span>
                <div className="text-[var(--accent-primary)] truncate mt-0.5 bg-white/5 px-2 py-1 rounded">
                  {liveHashInfo.consortiumSaltPreview || liveHashInfo.saltPreview}
                </div>
              </div>

              <div>
                <span className="text-slate-500">3. Blind Hash SHA-256 (64 hex):</span>
                <div className="text-emerald-400 truncate mt-0.5 bg-white/5 px-2 py-1 rounded" title={liveHashInfo.blindHash}>
                  {liveHashInfo.blindHash.slice(0, 16)}...{liveHashInfo.blindHash.slice(-8)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Salting Inspector */}
        {showSaltingInspector && (
          <div className="mt-5 animate-fade-in">
            <SaltingInspector />
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Risk Evaluation Result Card */}
      {result && (
        <div className="glass-panel overflow-hidden rounded-2xl p-6 border-l-4 border-l-[var(--accent-primary)] shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${getScoreColor(
                  result.riskScore
                )}`}
              >
                <div className="text-center">
                  <span className="text-2xl font-black">{result.riskScore}</span>
                  <span className="block text-[9px] font-medium uppercase opacity-75">Score</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getBadgeStyle(
                      result.riskLevel
                    )}`}
                  >
                    RIESGO {result.riskLevel}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    Latencia: <strong className="text-cyan-400 font-mono">{result.latencyMs} ms</strong>
                  </span>
                  {result.cached && (
                    <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400">
                      ⚡ Caché Redis Hit
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-bold text-white">
                  Recomendación:{' '}
                  {result.recommendation === 'BLOQUEAR' && (
                    <span className="text-rose-400 font-extrabold">BLOQUEO INMEDIATO</span>
                  )}
                  {result.recommendation === 'DESAFIO_2FA' && (
                    <span className="text-amber-400 font-extrabold">EXIGIR VALIDACIÓN 2FA O BIOMÉTRICA</span>
                  )}
                  {result.recommendation === 'APROBAR' && (
                    <span className="text-emerald-400 font-extrabold">APROBAR OPERACIÓN</span>
                  )}
                </h3>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onOpenReportModal(selectedType, inputValue)}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition"
              >
                <ShieldAlert className="h-4 w-4" /> Reportar Fraude Confirmado
              </button>

              <button
                onClick={() => {
                  if (userRole === 'ANALYST_L1') {
                    alert('Permiso denegado: El rol Analista L1 tiene permisos exclusivamente para consultas individuales. La gestión de falsos positivos y rehabilitaciones requiere rol Analista L2 o Admin Tenant.');
                    return;
                  }
                  onOpenRehabilitateModal(selectedType, inputValue);
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  userRole === 'ANALYST_L1'
                    ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed opacity-60'
                    : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                }`}
                title={userRole === 'ANALYST_L1' ? 'Requiere rol Analista L2 para gestionar falsos positivos' : undefined}
              >
                <CheckCircle className="h-4 w-4" /> Marcar Falso Positivo {userRole === 'ANALYST_L1' && '(L2 Requerido)'}
              </button>

              <button
                onClick={handleDownloadProof}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                <Download className="h-4 w-4" /> Certificado Criptográfico
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
              <span className="text-slate-400">Coincidencia Comunitaria:</span>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                <Building className="h-4 w-4 text-cyan-400" />
                {result.distinctInstitutionsCount > 0 ? (
                  <span>
                    Detectado en <strong className="text-cyan-300">{result.distinctInstitutionsCount}</strong> entidades independientes
                  </span>
                ) : (
                  <span className="text-emerald-400">0 entidades reportaron</span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Reportes acumulados en red: {result.networkMatches}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
              <span className="text-slate-400">Tipología Principal:</span>
              <div className="mt-1 text-sm font-bold text-white">
                {result.primaryReason ? (
                  <span className="text-amber-300">{result.primaryReason.replace(/_/g, ' ')}</span>
                ) : (
                  <span className="text-emerald-400">Sin antecedentes</span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Severidad declarada: {result.severity}/5
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
              <span className="text-slate-400">Antigüedad del Reporte:</span>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                <Clock className="h-4 w-4 text-amber-400" />
                {result.lastReportedAt ? (
                  <span>{formatRecency(result.lastReportedAt)}</span>
                ) : (
                  <span className="text-emerald-400">Sin registros</span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {result.lastReportedAt ? `Fecha: ${new Date(result.lastReportedAt).toLocaleDateString('es-AR')}` : 'Identificador limpio'}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
              <span className="text-slate-400">Estado de Rehabilitación:</span>
              <div className="mt-1 text-sm font-bold">
                {result.rehabilitated ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Falso Positivo Resuelto
                  </span>
                ) : (
                  <span className="text-slate-300">Activo en Red</span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-500 truncate" title={result.rehabilitationReason}>
                {result.rehabilitationReason || 'Sin solicitudes'}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
              <span className="text-slate-400">Atestación Ed25519:</span>
              <div className="mt-1 font-mono text-[11px] text-cyan-400 truncate">
                {result.cryptographicProof}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Firma inalterable de red
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-2">
            <Lock className="h-3.5 w-3.5 text-cyan-400/80 shrink-0" />
            <span>Zero-Knowledge: la entidad accede a métricas de riesgo únicamente bajo consulta activa. No se revelan nombres de comercios, entidades ni datos personales.</span>
          </div>

          {/* Kill-Switch Auto-Pause Alert (If triggered or score >= 90) */}
          {(result.killSwitchTriggered || result.riskScore >= 90) && (
            <div className="mt-5 rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-red-900/40 to-black/80 p-4 text-white shadow-xl shadow-rose-950/50 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white font-black text-2xl shadow-lg">
                    🚨
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black tracking-wider text-rose-300 uppercase">
                        Kill-Switch Activado • Intercepción &lt;15ms
                      </span>
                      <span className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-black">
                        RIESGO CRÍTICO {result.riskScore}/100
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-rose-200/90 leading-relaxed">
                      <strong>Auto-pausa preventiva de salida de fondos:</strong> La transacción o egreso hacia esta cuenta/destino se encuentra retenida preventivamente durante <strong>45 segundos</strong>. Se requiere validación biométrica forzosa o revisión humana de analista de riesgo antes de liberar la operación.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[10px] uppercase font-mono text-rose-400">Latencia Intercepción</span>
                  <span className="text-base font-black font-mono text-emerald-400">&lt; 15 ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Matrix 4-Factor Breakdown */}
          {result.riskMatrix && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <RiskMatrixBreakdown
                riskMatrix={result.riskMatrix}
                riskScore={result.riskScore}
                killSwitchTriggered={result.killSwitchTriggered}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

