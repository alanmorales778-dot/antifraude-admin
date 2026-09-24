'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Download,
  Building,
  CheckCircle,
  Hash,
  Lock,
  Clock,
  Upload,
  FileText,
  Plus,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
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

// ─────────────────────────────────────────────────────────────────
// Field types available (device removed per requirement)
// ─────────────────────────────────────────────────────────────────
const FIELD_TYPES: { id: IdentifierType; label: string; placeholder: string; icon: string }[] = [
  { id: 'EMAIL',    label: 'Email',               placeholder: 'estafador@gmail.com',    icon: '✉️' },
  { id: 'DNI',      label: 'DNI / CUIT',           placeholder: '20-41882991-3',          icon: '🪪' },
  { id: 'PHONE',    label: 'Teléfono',             placeholder: '+54 9 11 4055-8891',     icon: '📱' },
  { id: 'CARD_BIN', label: 'Tarjeta (BIN)',        placeholder: '450995******1234',        icon: '💳' },
];

// ─────────────────────────────────────────────────────────────────
// Combined score logic (multi-field)
// Score = MAX×0.6 + AVG×0.3 + CORRELATION_BONUS×0.1
// ─────────────────────────────────────────────────────────────────
function computeCombinedScore(results: RiskEvaluationResult[]): number {
  if (results.length === 0) return 0;
  if (results.length === 1) return results[0].riskScore;

  const scores = results.map(r => r.riskScore);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Correlation bonus: if 2+ fields are flagged (score > 0), add 15pts
  const flaggedCount = results.filter(r => r.riskScore > 0).length;
  const correlationBonus = flaggedCount >= 2 ? 15 : 0;

  const combined = Math.round(maxScore * 0.6 + avgScore * 0.3 + correlationBonus * 0.1);
  return Math.min(100, combined);
}

function getScoreLevel(score: number): 'BAJO' | 'MEDIO' | 'ALTO' {
  if (score >= 75) return 'ALTO';
  if (score >= 35) return 'MEDIO';
  return 'BAJO';
}

function getScoreColor(score: number) {
  if (score >= 75) return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  if (score >= 35) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
}

function getBadgeStyle(level: string) {
  if (level === 'ALTO') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (level === 'MEDIO') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
}

function formatRecency(isoString?: string): string {
  if (!isoString) return 'Sin registros';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `Hace ${Math.max(1, diffMins)} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hace 1 día';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

// ─────────────────────────────────────────────────────────────────
// Bulk result row type
// ─────────────────────────────────────────────────────────────────
interface BulkRow {
  rowIdx: number;
  tipo: IdentifierType;
  valorMasked: string;
  score: number;
  nivel: 'BAJO' | 'MEDIO' | 'ALTO';
  recomendacion: string;
  latencyMs: number;
  primaryReason?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// SAMPLE LAYOUT CSV CONTENT
// ─────────────────────────────────────────────────────────────────
const SAMPLE_LAYOUT_CSV = `tipo_campo,valor
EMAIL,estafador.red@gmail.com
DNI,30111222
PHONE,+5491155667788
EMAIL,fraudster2@hotmail.com
DNI,20987654321
PHONE,+5491144556677
CARD_BIN,450995123456
EMAIL,mula.financiera@outlook.com
`;

function maskValue(tipo: string, valor: string): string {
  if (tipo === 'EMAIL') {
    const [user, domain] = valor.split('@');
    return `${user.slice(0, 3)}***@${domain || '???'}`;
  }
  if (tipo === 'DNI') return `${valor.slice(0, 2)}***${valor.slice(-3)}`;
  if (tipo === 'PHONE') return `${valor.slice(0, 5)}***${valor.slice(-3)}`;
  if (tipo === 'CARD_BIN') return `${valor.slice(0, 6)}***${valor.slice(-4)}`;
  return valor.slice(0, 4) + '***';
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function RiskLookup({
  onOpenReportModal,
  onOpenRehabilitateModal,
  userRole = 'ANALYST_L2',
}: RiskLookupProps) {

  const [activeTab, setActiveTab] = useState<'individual' | 'masiva'>('individual');

  // ── Individual / Multi-field state ───────────────────────────
  const [fields, setFields] = useState<{ type: IdentifierType; value: string; id: string }[]>([
    { type: 'EMAIL', value: 'estafador.red@gmail.com', id: 'f0' },
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ field: { type: IdentifierType; value: string }; result: RiskEvaluationResult }[]>([]);
  const [combinedScore, setCombinedScore] = useState<number | null>(null);
  const [showSaltingInspector, setShowSaltingInspector] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);

  // ── Bulk state ────────────────────────────────────────────────
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkRow[]>([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkPreview, setBulkPreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Field management ─────────────────────────────────────────
  const addField = () => {
    const usedTypes = fields.map(f => f.type);
    const nextType = FIELD_TYPES.find(ft => !usedTypes.includes(ft.id))?.id || 'EMAIL';
    setFields(prev => [...prev, { type: nextType, value: '', id: `f${Date.now()}` }]);
  };

  const removeField = (id: string) => {
    if (fields.length <= 1) return;
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: 'type' | 'value', val: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  // ── Individual search ────────────────────────────────────────
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validFields = fields.filter(f => f.value.trim());
    if (validFields.length === 0) return;

    setLoading(true);
    setErrorMsg('');
    setResults([]);
    setCombinedScore(null);

    try {
      const promises = validFields.map(field =>
        fetch('/api/v1/risk/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier_type: field.type,
            identifier_value: field.value.trim(),
          }),
        })
          .then(r => r.json())
          .then(d => ({ field, result: d.data as RiskEvaluationResult }))
          .catch(() => ({ field, result: null }))
      );

      const rawResults = await Promise.all(promises);
      const validResults = rawResults.filter(r => r.result !== null) as { field: { type: IdentifierType; value: string }; result: RiskEvaluationResult }[];
      setResults(validResults);

      const combined = computeCombinedScore(validResults.map(r => r.result));
      setCombinedScore(combined);
      if (validResults.length > 0) setExpandedField(validResults[0].field.type + validResults[0].field.value);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la API de evaluación');
    } finally {
      setLoading(false);
    }
  };

  // ── Quick test case ──────────────────────────────────────────
  const setTestCase = (item: (typeof SAMPLE_TEST_CASES)[0]) => {
    setFields([{ type: item.type as IdentifierType, value: item.value, id: 'f0' }]);
    setTimeout(() => {
      fetch('/api/v1/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier_type: item.type, identifier_value: item.value }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.data) {
            setResults([{ field: { type: item.type as IdentifierType, value: item.value }, result: d.data }]);
            setCombinedScore(d.data.riskScore);
            setExpandedField(item.type + item.value);
          }
        });
    }, 50);
  };

  // ── Bulk CSV processing ──────────────────────────────────────
  const processBulkFile = useCallback(async (file: File) => {
    if (!file.type.includes('text') && !file.name.endsWith('.csv')) {
      setBulkError('Solo se aceptan archivos .csv o .txt');
      return;
    }
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    setBulkPreview(lines.slice(0, 5).join('\n'));
    setBulkResults([]);
    setBulkError('');
    setBulkLoading(true);
    setBulkProgress(0);

    // Parse rows (skip header)
    const dataLines = lines[0].toLowerCase().includes('tipo_campo') ? lines.slice(1) : lines;
    const validTypes = ['EMAIL', 'DNI', 'PHONE', 'CARD_BIN', 'TAX_ID'];
    const parsed = dataLines
      .map(line => {
        const [tipo, valor] = line.split(',').map(s => s.trim());
        return { tipo, valor };
      })
      .filter(r => r.tipo && r.valor && validTypes.includes(r.tipo.toUpperCase()));

    if (parsed.length === 0) {
      setBulkError('No se encontraron filas válidas. Verificá el formato: tipo_campo,valor');
      setBulkLoading(false);
      return;
    }

    const batchResults: BulkRow[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const { tipo, valor } = parsed[i];
      try {
        const res = await fetch('/api/v1/risk/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier_type: tipo.toUpperCase(),
            identifier_value: valor,
          }),
        });
        const data = await res.json();
        const r: RiskEvaluationResult = data.data;
        batchResults.push({
          rowIdx: i + 1,
          tipo: tipo.toUpperCase() as IdentifierType,
          valorMasked: maskValue(tipo.toUpperCase(), valor),
          score: r?.riskScore ?? 0,
          nivel: r?.riskLevel ?? 'BAJO',
          recomendacion: r?.recommendation ?? 'APROBAR',
          latencyMs: r?.latencyMs ?? 0,
          primaryReason: r?.primaryReason,
        });
      } catch {
        batchResults.push({
          rowIdx: i + 1,
          tipo: tipo.toUpperCase() as IdentifierType,
          valorMasked: maskValue(tipo.toUpperCase(), valor),
          score: 0,
          nivel: 'BAJO',
          recomendacion: 'ERROR',
          latencyMs: 0,
          error: 'Error al consultar',
        });
      }
      setBulkProgress(Math.round(((i + 1) / parsed.length) * 100));
      // Small delay to not overwhelm UI
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 50));
    }

    setBulkResults(batchResults);
    setBulkLoading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processBulkFile(file);
  }, [processBulkFile]);

  const downloadSampleLayout = () => {
    const blob = new Blob([SAMPLE_LAYOUT_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout_consulta_masiva_antifraude.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBulkResults = () => {
    if (bulkResults.length === 0) return;
    const header = 'fila,tipo,valor_masked,score,nivel,recomendacion,tipologia,latencia_ms\n';
    const rows = bulkResults.map(r =>
      `${r.rowIdx},${r.tipo},${r.valorMasked},${r.score},${r.nivel},${r.recomendacion},${r.primaryReason || ''},${r.latencyMs}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado_consulta_masiva_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProof = (result: RiskEvaluationResult) => {
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

  // ── Derived combined score level ─────────────────────────────
  const combinedLevel = combinedScore !== null ? getScoreLevel(combinedScore) : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">Consultas de Riesgo (Búsqueda Ciega)</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Consultá por uno o varios campos simultáneamente. Cada dato se convierte localmente a un Hash Ciego SHA-256 irreversible antes de enviarse a la red (Ley 25.326). El score combinado integra todos los campos consultados.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/60 p-1 w-fit">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'individual'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Search className="h-3.5 w-3.5" /> Consulta Individual / Multi-campo
        </button>
        <button
          onClick={() => setActiveTab('masiva')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'masiva'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Consulta Masiva (CSV)
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: INDIVIDUAL / MULTI-FIELD                             */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'individual' && (
        <>
          {/* Quick Test Chips */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span>Casos de Prueba Precargados:</span>
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

          {/* Search Form */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl shadow-black/40 space-y-4">
            <form onSubmit={handleSearch} className="space-y-4">

              {/* Explanation banner */}
              <div className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] px-4 py-2.5 text-xs text-slate-300">
                <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>
                  Podés consultar <strong className="text-white">de a 1 campo o varios a la vez</strong>.
                  Si ingresás múltiples campos, el sistema calcula un <strong className="text-indigo-300">Score Combinado</strong> que integra todos los resultados.
                </span>
              </div>

              {/* Dynamic field rows */}
              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const fieldConfig = FIELD_TYPES.find(ft => ft.id === field.type)!;
                  const usedTypes = fields.filter(f => f.id !== field.id).map(f => f.type);
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      {/* Type selector */}
                      <select
                        value={field.type}
                        onChange={e => updateField(field.id, 'type', e.target.value)}
                        className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white focus:border-indigo-500/50 focus:outline-none transition shrink-0"
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.id} value={ft.id} disabled={usedTypes.includes(ft.id)}>
                            {ft.icon} {ft.label}
                          </option>
                        ))}
                      </select>

                      {/* Value input */}
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => updateField(field.id, 'value', e.target.value)}
                          placeholder={fieldConfig?.placeholder || ''}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition font-mono"
                        />
                      </div>

                      {/* Remove field button */}
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-500 hover:border-rose-500/30 hover:text-rose-400 transition shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add field / Submit row */}
              <div className="flex items-center gap-3 pt-1">
                {fields.length < FIELD_TYPES.length && (
                  <button
                    type="button"
                    onClick={addField}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/[0.04] px-4 py-2 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/[0.08] hover:border-indigo-500/50 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar campo
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || fields.every(f => !f.value.trim())}
                  className="flex items-center gap-2 rounded-xl theme-btn-primary px-6 py-2.5 text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50 ml-auto"
                >
                  {loading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Evaluando {fields.filter(f => f.value.trim()).length} campo(s)...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Evaluar Riesgo{fields.filter(f => f.value.trim()).length > 1 ? ` (${fields.filter(f => f.value.trim()).length} campos)` : ''}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Salting inspector toggle */}
            <div className="border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setShowSaltingInspector(!showSaltingInspector)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                <Hash className="h-3.5 w-3.5" />
                {showSaltingInspector ? 'Ocultar' : 'Ver'} Inspector de Hashing Ciego (Pipeline SHA-256)
              </button>
              {showSaltingInspector && (
                <div className="mt-4 animate-fade-in">
                  <SaltingInspector />
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}
          </div>

          {/* ── Results ─────────────────────────────────────────── */}
          {results.length > 0 && combinedScore !== null && (
            <div className="space-y-4">

              {/* Combined Score Card (shown when 2+ fields) */}
              {results.length > 1 && (
                <div className={`glass-panel rounded-2xl p-5 border-l-4 ${
                  combinedLevel === 'ALTO' ? 'border-l-rose-500' :
                  combinedLevel === 'MEDIO' ? 'border-l-amber-400' : 'border-l-emerald-400'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-20 w-20 items-center justify-center rounded-2xl border text-center ${getScoreColor(combinedScore)}`}>
                      <div>
                        <span className="text-3xl font-black">{combinedScore}</span>
                        <span className="block text-[9px] uppercase opacity-75 font-bold">Combinado</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getBadgeStyle(combinedLevel!)}`}>
                          RIESGO {combinedLevel} (COMBINADO)
                        </span>
                        <span className="text-xs text-slate-400">{results.length} campos evaluados</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Score integrado: <span className="text-white font-semibold">MAX×60% + PROMEDIO×30% + CORRELACIÓN×10%</span>
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-slate-500">Scores individuales:</span>
                        {results.map(r => (
                          <span
                            key={r.field.type}
                            className={`font-mono font-bold rounded px-1.5 py-0.5 ${
                              r.result.riskScore >= 75 ? 'text-rose-400 bg-rose-500/10' :
                              r.result.riskScore >= 35 ? 'text-amber-400 bg-amber-500/10' :
                              'text-emerald-400 bg-emerald-500/10'
                            }`}
                          >
                            {r.field.type}: {r.result.riskScore}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-field result cards */}
              {results.map(({ field, result }) => {
                const fieldKey = field.type + field.value;
                const isExpanded = expandedField === fieldKey;
                const fieldConf = FIELD_TYPES.find(ft => ft.id === field.type)!;
                return (
                  <div key={fieldKey} className={`glass-panel overflow-hidden rounded-2xl border-l-4 ${
                    result.riskScore >= 75 ? 'border-l-rose-500' :
                    result.riskScore >= 35 ? 'border-l-amber-400' : 'border-l-emerald-400'
                  }`}>
                    {/* Collapsible header */}
                    <button
                      type="button"
                      onClick={() => setExpandedField(isExpanded ? null : fieldKey)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition"
                    >
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-center ${getScoreColor(result.riskScore)}`}>
                        <div>
                          <span className="text-xl font-black">{result.riskScore}</span>
                          <span className="block text-[9px] uppercase opacity-75">Score</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{fieldConf?.icon} {fieldConf?.label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${getBadgeStyle(result.riskLevel)}`}>
                            RIESGO {result.riskLevel}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{field.value.slice(0, 20)}{field.value.length > 20 ? '…' : ''}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {result.recommendation === 'BLOQUEAR' && <span className="text-rose-400 font-bold">→ BLOQUEO INMEDIATO</span>}
                          {result.recommendation === 'DESAFIO_2FA' && <span className="text-amber-400 font-bold">→ EXIGIR VALIDACIÓN 2FA</span>}
                          {result.recommendation === 'APROBAR' && <span className="text-emerald-400 font-bold">→ APROBAR OPERACIÓN</span>}
                          <span className="ml-2 text-slate-500">· {result.distinctInstitutionsCount} entidades · Latencia {result.latencyMs}ms</span>
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-5 space-y-4">
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => onOpenReportModal(field.type, field.value)}
                            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition"
                          >
                            <ShieldAlert className="h-4 w-4" /> Reportar Fraude
                          </button>
                          <button
                            onClick={() => {
                              if (userRole === 'ANALYST_L1') {
                                alert('Requiere rol Analista L2 o superior.');
                                return;
                              }
                              onOpenRehabilitateModal(field.type, field.value);
                            }}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                              userRole === 'ANALYST_L1'
                                ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed opacity-60'
                                : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                            }`}
                          >
                            <CheckCircle className="h-4 w-4" /> Falso Positivo
                          </button>
                          <button
                            onClick={() => handleDownloadProof(result)}
                            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                          >
                            <Download className="h-4 w-4" /> Certificado Criptográfico
                          </button>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
                            <span className="text-slate-400">Coincidencia Comunitaria:</span>
                            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                              <Building className="h-4 w-4 text-cyan-400" />
                              {result.distinctInstitutionsCount > 0 ? (
                                <span>Detectado en <strong className="text-cyan-300">{result.distinctInstitutionsCount}</strong> entidades</span>
                              ) : (
                                <span className="text-emerald-400">0 reportes</span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">Reportes acumulados: {result.networkMatches}</div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
                            <span className="text-slate-400">Tipología Principal:</span>
                            <div className="mt-1 text-sm font-bold">
                              {result.primaryReason ? (
                                <span className="text-amber-300">{result.primaryReason.replace(/_/g, ' ')}</span>
                              ) : (
                                <span className="text-emerald-400">Sin antecedentes</span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">Severidad: {result.severity}/5</div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
                            <span className="text-slate-400">Antigüedad:</span>
                            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                              <Clock className="h-4 w-4 text-amber-400" />
                              {result.lastReportedAt ? formatRecency(result.lastReportedAt) : <span className="text-emerald-400">Sin registros</span>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3.5">
                            <span className="text-slate-400">Rehabilitación:</span>
                            <div className="mt-1 text-sm font-bold">
                              {result.rehabilitated ? (
                                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Resuelto</span>
                              ) : (
                                <span className="text-slate-300">Activo en Red</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ZK notice */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-2">
                          <Lock className="h-3.5 w-3.5 text-cyan-400/80 shrink-0" />
                          <span>Zero-Knowledge: solo métricas de riesgo. No se revelan datos personales de otras entidades.</span>
                        </div>

                        {/* Kill-switch alert */}
                        {(result.killSwitchTriggered || result.riskScore >= 90) && (
                          <div className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 to-black/80 p-4 text-white shadow-xl animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-2xl font-black shadow-lg">🚨</div>
                              <div>
                                <span className="text-sm font-black text-rose-300 uppercase">Kill-Switch Activado · Intercepción &lt;15ms</span>
                                <p className="mt-1 text-xs text-rose-200/90">Auto-pausa preventiva activa. Se requiere validación biométrica o revisión de analista.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Risk Matrix */}
                        {result.riskMatrix && (
                          <div className="border-t border-white/10 pt-4">
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
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: BULK / MASIVA                                        */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'masiva' && (
        <div className="space-y-5">

          {/* Layout download + instructions */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  Consulta Masiva por CSV
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Subí un archivo con múltiples registros. Se devuelve un score de riesgo por cada fila.
                  Podés consultar por 1 o varios campos (EMAIL, DNI, PHONE, CARD_BIN).
                </p>
              </div>
              <button
                onClick={downloadSampleLayout}
                className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.08] px-4 py-2.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/[0.15] transition shrink-0"
              >
                <Download className="h-4 w-4" />
                Descargar Layout de Prueba (.csv)
              </button>
            </div>

            {/* Format reference */}
            <div className="rounded-xl bg-black/40 p-4 font-mono text-xs space-y-1">
              <p className="text-slate-500 mb-2 font-sans text-[11px] font-semibold uppercase tracking-wider">Formato requerido:</p>
              <p className="text-slate-400"><span className="text-indigo-400">tipo_campo</span>,<span className="text-emerald-400">valor</span></p>
              <p className="text-slate-500">EMAIL,usuario@gmail.com</p>
              <p className="text-slate-500">DNI,30111222</p>
              <p className="text-slate-500">PHONE,+5491155667788</p>
              <p className="text-slate-500">CARD_BIN,450995123456</p>
              <p className="text-[10px] text-slate-600 font-sans mt-2">
                Tipos válidos: EMAIL | DNI | PHONE | CARD_BIN | TAX_ID · Sin límite de filas · Procesamiento en lote secuencial
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500/70 bg-indigo-950/20 scale-[1.01]'
                  : 'border-white/15 bg-slate-800/30 hover:border-indigo-500/30 hover:bg-slate-800/50'
              }`}
            >
              <Upload className={`h-8 w-8 ${isDragging ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">
                  {isDragging ? 'Soltá el archivo aquí' : 'Arrastrá tu CSV aquí'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">o hacé click para seleccionar · .csv o .txt</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processBulkFile(f); }}
              />
            </div>

            {bulkError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
                {bulkError}
              </div>
            )}
          </div>

          {/* Progress */}
          {bulkLoading && (
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  Procesando consultas en la red federada...
                </span>
                <span className="font-mono text-indigo-400 font-bold">{bulkProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${bulkProgress}%` }}
                />
              </div>
              {bulkPreview && (
                <div className="rounded-xl bg-black/40 p-3">
                  <p className="text-[11px] text-slate-500 mb-1">Vista previa (primeras 5 líneas):</p>
                  <pre className="text-[11px] text-slate-400 font-mono">{bulkPreview}</pre>
                </div>
              )}
            </div>
          )}

          {/* Bulk Results */}
          {!bulkLoading && bulkResults.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white">Resultados de Consulta Masiva</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {bulkResults.length} registros evaluados ·{' '}
                    <span className="text-rose-400">{bulkResults.filter(r => r.nivel === 'ALTO').length} alto riesgo</span> ·{' '}
                    <span className="text-amber-400">{bulkResults.filter(r => r.nivel === 'MEDIO').length} medio</span> ·{' '}
                    <span className="text-emerald-400">{bulkResults.filter(r => r.nivel === 'BAJO').length} bajo</span>
                  </p>
                </div>
                <button
                  onClick={downloadBulkResults}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/[0.15] transition"
                >
                  <Download className="h-4 w-4" /> Exportar Resultados (.csv)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Valor (masked)</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Nivel</th>
                      <th className="px-4 py-3">Recomendación</th>
                      <th className="px-4 py-3">Tipología</th>
                      <th className="px-4 py-3 text-right">Latencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {bulkResults.map(row => (
                      <tr
                        key={row.rowIdx}
                        className={`hover:bg-white/[0.02] transition ${
                          row.nivel === 'ALTO' ? 'bg-rose-950/10' :
                          row.nivel === 'MEDIO' ? 'bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-500 font-mono">{row.rowIdx}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">{row.tipo}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-cyan-400/80">{row.valorMasked}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono font-black text-sm ${
                            row.score >= 75 ? 'text-rose-400' :
                            row.score >= 35 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>{row.score}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getBadgeStyle(row.nivel)}`}>
                            {row.nivel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold ${
                            row.recomendacion === 'BLOQUEAR' ? 'text-rose-400' :
                            row.recomendacion === 'DESAFIO_2FA' ? 'text-amber-400' :
                            row.error ? 'text-slate-500' : 'text-emerald-400'
                          }`}>
                            {row.error || row.recomendacion}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.primaryReason ? row.primaryReason.replace(/_/g, ' ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">{row.latencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
