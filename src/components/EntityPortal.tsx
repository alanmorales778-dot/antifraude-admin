'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  LogOut,
  History,
  Building2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Clock,
  FileCheck,
  ExternalLink,
  ChevronRight,
  Filter,
  Plus,
  X,
  Hash,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Share2,
  Code2,
  Cpu,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { LookupResult, IncidentCategory, SpecGraphEdge } from '@/lib/types';
import { computeHash } from '@/lib/fraudEngine';
import ConsortiumLogo from '@/components/ConsortiumLogo';

interface EntityPortalProps {
  fintechId: string;
  onLogout: () => void;
}

type IdentifierKey = 'DNI' | 'CBU' | 'EMAIL' | 'CUIT' | 'PHONE' | 'IP' | 'DEVICE';

const IDENTIFIER_OPTIONS: { id: IdentifierKey; label: string; placeholder: string; example: string }[] = [
  { id: 'DNI', label: 'DNI', placeholder: 'Ingrese número de DNI (sin puntos)...', example: '30111222' },
  { id: 'CBU', label: 'CBU / CVU', placeholder: 'Ingrese CBU o CVU de 22 dígitos o alias...', example: '0000003100010000000001' },
  { id: 'EMAIL', label: 'Email', placeholder: 'Ingrese correo electrónico...', example: 'cuenta.sospechosa@gmail.com' },
  { id: 'CUIT', label: 'CUIT', placeholder: 'Ingrese CUIT/CUIL de 11 dígitos...', example: '20301112229' },
  { id: 'PHONE', label: 'Teléfono', placeholder: 'Ingrese teléfono con código de área...', example: '+5491122334455' },
  { id: 'IP', label: 'Dirección IP', placeholder: 'Ingrese dirección IPv4 o IPv6...', example: '190.210.45.12' },
  { id: 'DEVICE', label: 'ID Dispositivo', placeholder: 'Ingrese hash de huella de hardware...', example: 'dev_fingerprint_8f9a2' },
];

const TYPOLOGY_LABELS: Record<IncidentCategory, string> = {
  MULE_ACCOUNT: 'Cuenta Mula / Receptora',
  FRAUD_CONFIRMED: 'Fraude Confirmado',
  IDENTITY_THEFT: 'Robo de Identidad / Sintética',
  ACCOUNT_TAKEOVER: 'Toma de Control (ATO)',
  PHISHING: 'Origen de Phishing',
  CHARGEBACK: 'Contracargo Reiterado',
  SUSPICIOUS: 'Operación Sospechosa',
};

export default function EntityPortal({ fintechId, onLogout }: EntityPortalProps) {
  const {
    fintechs,
    partnerSession,
    lookupIdentity,
    reportFraud,
    markFalsePositive,
    graphEdges,
    auditLogs,
    lastLookupResult,
    setActiveFintechId,
  } = useConsortiumStore();

  const activeFintech = fintechs.find(f => f.id === fintechId) || fintechs[0] || {
    id: fintechId || 'mi-entidad',
    name: partnerSession?.entityName || 'Mi Entidad Financiera',
    apiKey: '',
    trustWeight: 1.0,
    status: 'ACTIVE',
    queriesCount: 0,
    reportsCount: 0,
    falsePositivesCount: 0,
  };

  useEffect(() => {
    setActiveFintechId(activeFintech.id);
  }, [activeFintech.id, setActiveFintechId]);

  // Tab activo: 'lookup' (Consulta ZK) | 'history' (Historial Entidad)
  const [activeTab, setActiveTab] = useState<'lookup' | 'history'>('lookup');

  // ── ESTADO DEL BUSCADOR ZK ──
  const [selectedType, setSelectedType] = useState<IdentifierKey>('DNI');
  const [inputValue, setInputValue] = useState('30111222');
  const [previewHash, setPreviewHash] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<LookupResult | null>(lastLookupResult);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // ── MODAL DE CONSULTA DE GRAFO (CYPHER & SQL CTE) ──
  const [showGraphQueryModal, setShowGraphQueryModal] = useState(false);
  const [activeGraphQueryTab, setActiveGraphQueryTab] = useState<'cypher' | 'sql'>('cypher');

  // ── MODAL DE REPORTE DE INCIDENTE ──
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<IdentifierKey>('DNI');
  const [reportValue, setReportValue] = useState('');
  const [reportCategory, setReportCategory] = useState<IncidentCategory>('MULE_ACCOUNT');
  const [reportTicket, setReportTicket] = useState('');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // ── TOKENIZACIÓN ZERO-KNOWLEDGE EN TIEMPO REAL ──
  useEffect(() => {
    let isCancelled = false;
    const computeLiveHash = async () => {
      const trimmed = inputValue.trim();
      if (!trimmed) {
        setPreviewHash('');
        return;
      }
      try {
        const hash = await computeHash(selectedType, trimmed);
        if (!isCancelled) setPreviewHash(hash);
      } catch {
        if (!isCancelled) setPreviewHash('');
      }
    };
    computeLiveHash();
    return () => {
      isCancelled = true;
    };
  }, [selectedType, inputValue]);

  // ── EJECUTAR CONSULTA ZK ──
  const handleExecuteLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanValue = inputValue.trim();
    if (!cleanValue) {
      setSearchError('Por favor ingrese un valor para evaluar.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const params: any = {};
      if (selectedType === 'DNI') params.dni = cleanValue;
      else if (selectedType === 'CBU') params.cbu = cleanValue;
      else if (selectedType === 'EMAIL') params.email = cleanValue;
      else if (selectedType === 'CUIT') params.cuit = cleanValue;
      else if (selectedType === 'PHONE') params.phone = cleanValue;
      else if (selectedType === 'IP') params.ip = cleanValue;
      else if (selectedType === 'DEVICE') params.device = cleanValue;

      const res = await lookupIdentity(params);
      setSearchResult(res);
    } catch (err: any) {
      setSearchError(err?.message || 'Error consultando la red Zero-Knowledge.');
    } finally {
      setIsSearching(false);
    }
  };

  // ── CONFIRMAR REPORTE DE AMENAZA ──
  const handleConfirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVal = reportValue.trim();
    if (!cleanVal) return;

    try {
      const params: any = {
        incidentCategory: reportCategory,
        internalTicketId: reportTicket.trim() || undefined,
      };
      if (reportType === 'DNI') params.dni = cleanVal;
      else if (reportType === 'CBU') params.cbu = cleanVal;
      else if (reportType === 'EMAIL') params.email = cleanVal;
      else if (reportType === 'CUIT') params.cuit = cleanVal;
      else if (reportType === 'PHONE') params.phone = cleanVal;
      else if (reportType === 'IP') params.ip = cleanVal;
      else if (reportType === 'DEVICE') params.device = cleanVal;

      await reportFraud(params);
      setReportSuccess(`Incidente tokenizado y reportado a la red federada exitosamente.`);
      setTimeout(() => {
        setReportSuccess(null);
        setIsReportModalOpen(false);
        setReportValue('');
        setReportTicket('');
      }, 2500);
    } catch (err: any) {
      alert('Error al registrar reporte: ' + String(err));
    }
  };

  // ── REVOCAR REPORTE (MARCAR FALSO POSITIVO) ──
  const handleRevokeEdge = (edgeId: string) => {
    const reason = prompt('Ingrese el motivo de revocación/falso positivo:', 'Error operativo / Cuenta saneada');
    if (reason) {
      markFalsePositive(edgeId, reason);
      // Refrescar resultado si el reporte afectaba la búsqueda actual
      handleExecuteLookup();
    }
  };

  // ── HISTORIAL DE LA ENTIDAD ──
  const entityHistory = useMemo(() => {
    // Aristas emitidas por esta entidad
    const myEdges = graphEdges.filter(e => e.reportedByEntityId === activeFintech.id);
    return myEdges.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [graphEdges, activeFintech.id]);

  const copyHashToClipboard = () => {
    if (previewHash && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(previewHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const currentOption = IDENTIFIER_OPTIONS.find(o => o.id === selectedType) || IDENTIFIER_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── HEADER MINIMALISTA & BANCARIO ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <ConsortiumLogo size="sm" showGlow={true} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide uppercase">
                  {activeFintech.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#13233e] text-cyan-300 border border-cyan-500/30">
                  Workspace de Riesgo
                </span>
              </div>
              <p className="text-[11px] text-[#60a5fa] font-mono">
                {partnerSession?.operatorEmail || 'analista@consorcio.ar'} · Analista L2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Badge Real-Time Federado */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]" title="Sincronización WebSocket en tiempo real activa">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Real-Time Sync Activo</span>
            </div>

            {/* Badge Zero-Knowledge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Zero-Knowledge Activo · SHA-256</span>
            </div>

            <button
              onClick={() => {
                setReportType(selectedType);
                setReportValue(inputValue);
                setIsReportModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Reportar Amenaza</span>
            </button>

            <button
              onClick={onLogout}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-[#111e33] hover:bg-[#1a2d4c] text-[#94a3b8] hover:text-white border border-[#1e365b] text-xs font-medium transition flex items-center gap-1.5"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── NAVEGACIÓN PRINCIPAL (2 TABS LIMPIOS) ── */}
      <div className="border-b border-[#17253d] bg-[#091120]">
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-8 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('lookup')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'lookup'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-[#7e8c9d] hover:text-[#cbd5e1]'
            }`}
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Consulta de Riesgo ZK</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-[#7e8c9d] hover:text-[#cbd5e1]'
            }`}
          >
            <History className="w-4 h-4 text-blue-400" />
            <span>Historial de mi Entidad ({entityHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL DEL WORKSPACE ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── VISTA 1: CONSULTA DE RIESGO MINIMALISTA ───────────────── */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'lookup' && (
          <div className="space-y-6">
            {/* Tarjeta del Buscador Limpio */}
            <div className="bg-[#0c1628] border border-[#1b3152] rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="mb-4">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Buscador de Amenazas Interbancario
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  Consulta de Identidad con Hashing Ciego
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  El dato ingresado es normalizado y convertido en un hash SHA-256 antes de salir de su navegador. El secreto bancario está garantizado por diseño (Ley 25.326).
                </p>
              </div>

              {/* Selector de Tipo (Pills Minimalistas) */}
              <div className="flex flex-wrap gap-2 mb-4">
                {IDENTIFIER_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(opt.id);
                      setInputValue(opt.example);
                      setSearchError(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedType === opt.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                        : 'bg-[#060c17] text-[#94a3b8] hover:text-white border border-[#17253d]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Barra de Consulta */}
              <form onSubmit={handleExecuteLookup} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={currentOption.placeholder}
                      className="w-full px-4 py-3 bg-[#060c17] border border-[#1e365b] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:border-cyan-500 font-mono transition-all"
                    />
                    <Search className="w-4 h-4 text-[#64748b] absolute right-4 top-3.5 pointer-events-none" />
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching || !inputValue.trim()}
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Consultando red ZK...</span>
                      </>
                    ) : (
                      <>
                        <span>Consultar Riesgo</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Previsualización del Token Zero-Knowledge en Vivo */}
                {previewHash && (
                  <div className="p-3 bg-[#060c17] border border-[#17253d] rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-[#64748b] font-mono text-[11px] shrink-0">SHA-256 Token Ciego:</span>
                      <span className="font-mono text-cyan-300 text-[11px] truncate">{previewHash}</span>
                    </div>

                    <button
                      type="button"
                      onClick={copyHashToClipboard}
                      className="text-[10px] font-mono text-[#94a3b8] hover:text-white px-2 py-0.5 rounded bg-[#0d182e] border border-[#1e365b] transition shrink-0 flex items-center gap-1"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                )}
              </form>

              {searchError && (
                <div className="mt-4 p-3 rounded-xl bg-[#2e0909] border border-[#661616] text-[#fca5a5] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#ef4444]" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* ── RESULTADOS CLAROS (SCORE E HISTORIAL) ── */}
            {searchResult && (
              <div className="space-y-6 animate-fadeIn">
                {/* Panel de Scores Lado a Lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SCORE 1: INTERNO DE LA ENTIDAD */}
                  <div className="p-6 bg-[#0c1628] border-2 border-blue-500/40 rounded-2xl shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[#17253d] pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                            1. Score Interno ({activeFintech.name})
                          </h3>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          searchResult.internalRiskLevel === 'ALTO'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : searchResult.internalRiskLevel === 'MEDIO'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {searchResult.internalRiskLevel} RIESGO
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-2">
                        <span className={`text-5xl font-mono font-black ${
                          searchResult.internalRiskScore >= 70 ? 'text-rose-400' : searchResult.internalRiskScore >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {searchResult.internalRiskScore}
                        </span>
                        <span className="text-xs text-[#64748b] font-mono">/ 100</span>
                      </div>
                      <p className="text-[11px] text-[#94a3b8] mt-1">
                        Calculado con los antecedentes registrados exclusivamente por su entidad bancaria.
                      </p>
                    </div>

                    <div className="w-full bg-[#060c17] rounded-full h-2 overflow-hidden border border-[#1e365b] mt-4">
                      <div
                        className={`h-full rounded-full transition-all ${
                          searchResult.internalRiskScore >= 70 ? 'bg-rose-500' : searchResult.internalRiskScore >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, searchResult.internalRiskScore)}%` }}
                      />
                    </div>
                  </div>

                  {/* SCORE 2: RED FEDERAL CONSORCIO */}
                  <div className="p-6 bg-gradient-to-b from-[#0e1d38] to-[#0a1528] border-2 border-cyan-500/50 rounded-2xl shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[#1e3a6a] pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-cyan-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                            2. Score Red Federal (Consorcio)
                          </h3>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          searchResult.consortiumRiskLevel === 'ALTO'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : searchResult.consortiumRiskLevel === 'MEDIO'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {searchResult.consortiumRiskLevel} RIESGO
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-2">
                        <span className={`text-5xl font-mono font-black ${
                          searchResult.consortiumRiskScore >= 70 ? 'text-rose-400' : searchResult.consortiumRiskScore >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {searchResult.consortiumRiskScore}
                        </span>
                        <span className="text-xs text-[#64748b] font-mono">/ 100</span>
                      </div>
                      <p className="text-[11px] text-cyan-200/70 mt-1">
                        Inteligencia colectiva compartida en tiempo real entre múltiples bancos y billeteras.
                      </p>
                    </div>

                    <div className="w-full bg-[#060c17] rounded-full h-2 overflow-hidden border border-[#1e365b] mt-4">
                      <div
                        className={`h-full rounded-full transition-all ${
                          searchResult.consortiumRiskScore >= 70 ? 'bg-rose-500' : searchResult.consortiumRiskScore >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, searchResult.consortiumRiskScore)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tarjeta de Recomendación Operativa y Detalle */}
                <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748b]">
                      Recomendación Automática del Consorcio
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-xl text-xs font-black border shadow-sm ${
                        searchResult.breakdown.recommendation === 'BLOCK'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : searchResult.breakdown.recommendation === 'REVIEW'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {searchResult.breakdown.recommendation === 'BLOCK' ? 'BLOQUEAR TRANSACCIÓN' : searchResult.breakdown.recommendation === 'REVIEW' ? 'DESAFÍO BIOMÉTRICO / 2FA' : 'APROBAR OPERACIÓN'}
                      </span>

                      <span className="text-xs text-[#94a3b8]">
                        {searchResult.breakdown.matchingEdges.length > 0
                          ? `${searchResult.breakdown.matchingEdges.length} ${searchResult.breakdown.matchingEdges.length === 1 ? 'coincidencia registrada en la red' : 'coincidencias registradas en la red'}`
                          : 'Sin reportes previos de fraude en la red'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setReportType(selectedType);
                        setReportValue(inputValue);
                        setIsReportModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-2"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Reportar Delito</span>
                    </button>
                  </div>
                </div>

                {/* ── CAPA 1: VELOCIDAD EN MEMORIA (<1MS) & CAPA 2: GRAFO RECURSIVO ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Capa 1: Filtro Cuckoo / RedisBloom */}
                  <div className="p-4 bg-[#0a1426] border border-cyan-800/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#14233c] pb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          1. Capa de Velocidad (<span className="text-cyan-300 font-mono">&lt; 1 ms</span>)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                        {searchResult.breakdown.speedLayer?.filterType || 'CuckooFilter'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[#94a3b8]">Estado en Memoria:</span>
                      <span className={`font-mono font-bold ${
                        searchResult.breakdown.speedLayer?.filterHit
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}>
                        {searchResult.breakdown.speedLayer?.filterHit
                          ? 'Hit Positivo (En Lista Negra)'
                          : 'Hit Negativo (Limpio en Filtro)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94a3b8]">Filtro Consultado:</span>
                      <span className="font-mono text-slate-300">
                        {searchResult.breakdown.speedLayer?.filterName || 'cbu_blacklist'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94a3b8]">Latencia de Consulta:</span>
                      <span className="font-mono text-cyan-300 font-bold">
                        ⚡ {searchResult.breakdown.speedLayer?.latencyMs ?? 0.42} ms
                      </span>
                    </div>
                  </div>

                  {/* Capa 2: Inteligencia de Grafos sobre Nodos Ciegos */}
                  <div className="p-4 bg-[#0a1426] border border-purple-800/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#14233c] pb-2">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          2. Inteligencia de Grafo (1-3 Saltos)
                        </span>
                      </div>
                      <button
                        onClick={() => setShowGraphQueryModal(true)}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/50 flex items-center gap-1 transition"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Ver Cypher / CTE</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[#94a3b8]">Saltos de Red Explorados:</span>
                      <span className="font-mono text-purple-300 font-bold">
                        {searchResult.breakdown.graphIntelligence?.maxDepthReached || 1} niveles (k-hop)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94a3b8]">Nodos en el Cluster:</span>
                      <span className="font-mono text-slate-300">
                        {searchResult.breakdown.graphIntelligence?.totalConnectedNodes ?? 0} identidades
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94a3b8]">Ciclo de Mula / Granja:</span>
                      <span className={`font-mono font-bold ${
                        searchResult.breakdown.graphIntelligence?.hasTriangularCycle || (searchResult.breakdown.graphIntelligence?.sharedDevicesCount ?? 0) > 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}>
                        {searchResult.breakdown.graphIntelligence?.hasTriangularCycle
                          ? 'Triangulación Detectada'
                          : (searchResult.breakdown.graphIntelligence?.sharedDevicesCount ?? 0) > 0
                          ? `${searchResult.breakdown.graphIntelligence?.sharedDevicesCount} Disp. Compartidos`
                          : 'Sin Ciclos de Mulas'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal para Inspeccionar Cypher & SQL Recursive CTE */}
                {showGraphQueryModal && searchResult.breakdown.graphIntelligence && (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#0b1526] border border-[#1e3a6a] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-[#17253d] pb-3">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-5 h-5 text-purple-400" />
                          <h3 className="text-sm font-bold text-white">
                            Consultas de Grafo sobre Nodos Ciegos
                          </h3>
                        </div>
                        <button
                          onClick={() => setShowGraphQueryModal(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#13233e]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex gap-2 border-b border-[#17253d] pb-2">
                        <button
                          onClick={() => setActiveGraphQueryTab('cypher')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            activeGraphQueryTab === 'cypher'
                              ? 'bg-purple-600 text-white'
                              : 'bg-[#060c17] text-slate-400 hover:text-white'
                          }`}
                        >
                          Memgraph / Neo4j (Cypher)
                        </button>
                        <button
                          onClick={() => setActiveGraphQueryTab('sql')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            activeGraphQueryTab === 'sql'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-[#060c17] text-slate-400 hover:text-white'
                          }`}
                        >
                          Supabase PostgreSQL (Recursive CTE)
                        </button>
                      </div>

                      <div className="bg-[#050b14] border border-[#14233c] rounded-xl p-4 overflow-x-auto max-h-72">
                        <pre className="font-mono text-xs text-slate-300">
                          {activeGraphQueryTab === 'cypher'
                            ? searchResult.breakdown.graphIntelligence.cypherQuery
                            : searchResult.breakdown.graphIntelligence.sqlRecursiveCTE}
                        </pre>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => setShowGraphQueryModal(false)}
                          className="px-4 py-2 bg-[#17253d] hover:bg-[#203657] text-white text-xs font-bold rounded-xl transition"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coincidencias en la Red (si existen) */}
                {searchResult.breakdown.matchingEdges.length > 0 && (
                  <div className="bg-[#0c1628] border border-[#1e365b] rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-[#17253d] bg-[#091222] flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Historial de Incidentes Correlacionados en la Red
                      </h4>
                      <span className="text-[11px] font-mono text-[#94a3b8]">
                        {searchResult.breakdown.matchingEdges.length} eventos
                      </span>
                    </div>

                    <div className="divide-y divide-[#17253d]">
                      {searchResult.breakdown.matchingEdges.map((edge, idx) => (
                        <div key={edge.id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                {TYPOLOGY_LABELS[edge.incidentCategory] || edge.incidentCategory}
                              </span>
                              {edge.isFalsePositive && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Revocado / Falso Positivo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#64748b]">
                              Reportado por {edge.entityName || edge.reportedByEntityId} · {new Date(edge.timestamp).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {edge.reportedByEntityId === activeFintech.id && !edge.isFalsePositive && (
                              <button
                                onClick={() => handleRevokeEdge(edge.id)}
                                className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition"
                              >
                                Marcar Falso Positivo
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── VISTA 2: HISTORIAL DE MI ENTIDAD (LIMPIO & CLARO) ──────── */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-[#0c1628] border border-[#1b3152] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Registro de Reportes de {activeFintech.name}
                </h3>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Trazabilidad de todos los incidentes emitidos por su entidad hacia la red federal con hashes ciegos.
                </p>
              </div>

              <button
                onClick={() => {
                  setReportType('DNI');
                  setReportValue('');
                  setIsReportModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Reporte</span>
              </button>
            </div>

            {entityHistory.length === 0 ? (
              <div className="p-12 text-center bg-[#0c1628] border border-[#1b3152] rounded-2xl">
                <FileCheck className="w-12 h-12 text-[#475569] mx-auto mb-3" />
                <h4 className="text-sm font-bold text-white">Sin reportes registrados aún</h4>
                <p className="text-xs text-[#94a3b8] max-w-sm mx-auto mt-1">
                  Su institución no ha emitido reportes de amenazas a la red todavía. Cuando reporte un incidente, quedará auditado aquí.
                </p>
              </div>
            ) : (
              <div className="bg-[#0c1628] border border-[#1b3152] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#070e1b] border-b border-[#17253d] text-[#64748b] font-mono text-[11px] uppercase">
                      <tr>
                        <th className="py-3 px-4">Fecha / Hora</th>
                        <th className="py-3 px-4">Tipología</th>
                        <th className="py-3 px-4">Token SHA-256 (Ciego)</th>
                        <th className="py-3 px-4">Detalle / Máscara</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#17253d]">
                      {entityHistory.map(edge => (
                        <tr key={edge.id} className="hover:bg-[#0f1d33]/50 transition">
                          <td className="py-3.5 px-4 font-mono text-[#94a3b8]">
                            {new Date(edge.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {TYPOLOGY_LABELS[edge.incidentCategory] || edge.incidentCategory}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-cyan-300">
                            {edge.targetHash ? `${edge.targetHash.slice(0, 10)}...${edge.targetHash.slice(-6)}` : 'Token hash'}
                          </td>
                          <td className="py-3.5 px-4 text-[#cbd5e1]">
                            {edge.uploadedFields || 'Reporte Manual'}
                          </td>
                          <td className="py-3.5 px-4">
                            {edge.isFalsePositive ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Revocado (FP)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Activo en Red
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {!edge.isFalsePositive ? (
                              <button
                                onClick={() => handleRevokeEdge(edge.id)}
                                className="px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-medium transition"
                              >
                                Revocar
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#64748b]">Revocado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL LIMPIO DE REPORTAR AMENAZA ── */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0c1628] border border-[#1e365b] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-5 right-5 text-[#64748b] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold">
                Reporte de Incidente Federado
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Ingresar Amenaza a la Red ZK
              </h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                El dato personal será convertido a un hash ciego irreversible antes de enviarse.
              </p>
            </div>

            {reportSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#062c1d] border border-[#0f5132] text-[#86efac] text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-[#22c55e]" />
                <span>{reportSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1.5">
                  Tipo de Identificador
                </label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value as any)}
                  className="w-full bg-[#060c17] border border-[#1e365b] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="DNI">DNI (Documento Nacional de Identidad)</option>
                  <option value="CBU">CBU / CVU Bancario</option>
                  <option value="EMAIL">Email Corporativo o Personal</option>
                  <option value="CUIT">CUIT / CUIL</option>
                  <option value="PHONE">Teléfono</option>
                  <option value="IP">Dirección IP</option>
                  <option value="DEVICE">Huella de Dispositivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1.5">
                  Valor a Reportar (se tokeniza localmente)
                </label>
                <input
                  type="text"
                  required
                  value={reportValue}
                  onChange={e => setReportValue(e.target.value)}
                  placeholder="Ingrese el DNI, CBU o Email..."
                  className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1.5">
                  Tipología delictiva detectada
                </label>
                <select
                  value={reportCategory}
                  onChange={e => setReportCategory(e.target.value as any)}
                  className="w-full bg-[#060c17] border border-[#1e365b] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="MULE_ACCOUNT">Cuenta Mula / Receptora (90 pts)</option>
                  <option value="FRAUD_CONFIRMED">Fraude Confirmado (95 pts)</option>
                  <option value="IDENTITY_THEFT">Robo de Identidad / Sintética (75 pts)</option>
                  <option value="ACCOUNT_TAKEOVER">Toma de Control de Cuenta - ATO (80 pts)</option>
                  <option value="PHISHING">Origen de Phishing (55 pts)</option>
                  <option value="CHARGEBACK">Contracargo Reiterado (50 pts)</option>
                  <option value="SUSPICIOUS">Operación Sospechosa (40 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1.5">
                  Número de Ticket Interno (Opcional)
                </label>
                <input
                  type="text"
                  value={reportTicket}
                  onChange={e => setReportTicket(e.target.value)}
                  placeholder="Ej: CRM-9941 o SUM-2026-04"
                  className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#111e33] hover:bg-[#1a2d4c] text-xs font-medium text-[#94a3b8] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-xs shadow-md transition"
                >
                  Confirmar Reporte ZK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FOOTER INSTITUCIONAL ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628]/80 px-6 py-4 text-center text-[11px] text-[#64748b]">
        <p>Consorcio Federal de Prevención de Fraude · Workspace Interno para Mesas de Riesgo & Cumplimiento</p>
      </footer>
    </div>
  );
}
