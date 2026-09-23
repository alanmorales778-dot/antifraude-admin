'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Copy,
  Check,
  Download,
  Fingerprint,
  Smartphone,
  Globe,
  Radio,
  ExternalLink,
  ChevronRight,
  X,
  FileCheck,
  AlertOctagon,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import {
  NetworkAlert,
  AlertSeverity,
  AlertStatus,
  IncidentCategory,
  BlindAlertIdentifier,
} from '@/lib/types';

interface EntityAlertsPanelProps {
  onNavigateTab?: (tabId: string) => void;
}

const CATEGORY_LABELS: Record<IncidentCategory, { label: string; color: string }> = {
  MULE_ACCOUNT: { label: 'Cuenta Mula', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  IDENTITY_THEFT: { label: 'Robo de Identidad', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  CHARGEBACK: { label: 'Contracargo Comercial', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  PHISHING: { label: 'Phishing / Smishing', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  SUSPICIOUS: { label: 'Actividad Sospechosa', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
};

const SEVERITY_BADGES: Record<AlertSeverity, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: 'CRÍTICA', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  HIGH: { label: 'ALTA', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  MEDIUM: { label: 'MEDIA', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  LOW: { label: 'BAJA', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

const STATUS_BADGES: Record<AlertStatus, { label: string; bg: string; text: string; border: string }> = {
  PENDING_REVIEW: { label: 'Pendiente de Acción', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25' },
  IN_ANALYSIS: { label: 'En Análisis', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/25' },
  CONFIRMED_BLOCKED: { label: 'Bloqueo Confirmado', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/25' },
  CHALLENGED_2FA: { label: 'Desafío 2FA Aplicado', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/25' },
  DISMISSED_FP: { label: 'Falso Positivo Descartado', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25' },
};

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `Hace ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} días`;
  } catch {
    return 'Reciente';
  }
}

export default function EntityAlertsPanel({ onNavigateTab }: EntityAlertsPanelProps) {
  const {
    networkAlerts,
    confirmAndBlockAlert,
    challengeAlert2FA,
    dismissAlertAsFP,
    updateAlertStatus,
    fintechs,
    activeFintechId,
  } = useConsortiumStore();

  const activeEntity = fintechs.find(f => f.id === activeFintechId) || fintechs[0];

  // Estado de filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Estado del modal de inspección detallada ("Chequear lo que se les alerta")
  const [inspectingAlert, setInspectingAlert] = useState<NetworkAlert | null>(null);

  // Estado del modal de confirmación de falso positivo
  const [fpModalAlert, setFpModalAlert] = useState<NetworkAlert | null>(null);
  const [fpReason, setFpReason] = useState('');

  // Estado de feedback de copiado
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Mantener actualizado el alert seleccionado si cambia en el store
  const currentActiveAlert = useMemo(() => {
    if (!inspectingAlert) return null;
    return networkAlerts.find(a => a.id === inspectingAlert.id) || inspectingAlert;
  }, [inspectingAlert, networkAlerts]);

  // Alertas filtradas
  const filteredAlerts = useMemo(() => {
    return networkAlerts.filter(alert => {
      // Búsqueda textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = alert.code.toLowerCase().includes(query);
        const matchesTitle = alert.title.toLowerCase().includes(query);
        const matchesRule = alert.triggerRule.ruleName.toLowerCase().includes(query);
        const matchesNotes = alert.communityNotes.toLowerCase().includes(query);
        const matchesIdentifier = alert.blindIdentifiers.some(
          id =>
            id.maskedPreview.toLowerCase().includes(query) ||
            id.hash.toLowerCase().includes(query)
        );
        if (!matchesCode && !matchesTitle && !matchesRule && !matchesNotes && !matchesIdentifier) {
          return false;
        }
      }

      // Severidad
      if (selectedSeverity !== 'ALL' && alert.severity !== selectedSeverity) {
        return false;
      }

      // Estado
      if (selectedStatus !== 'ALL' && alert.status !== selectedStatus) {
        return false;
      }

      // Categoría
      if (selectedCategory !== 'ALL' && alert.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [networkAlerts, searchQuery, selectedSeverity, selectedStatus, selectedCategory]);

  // Métricas rápidas
  const totalAlerts = networkAlerts.length;
  const criticalCount = networkAlerts.filter(a => a.severity === 'CRITICAL').length;
  const pendingCount = networkAlerts.filter(a => a.status === 'PENDING_REVIEW').length;
  const blockedCount = networkAlerts.filter(a => a.status === 'CONFIRMED_BLOCKED').length;
  const fpCount = networkAlerts.filter(a => a.status === 'DISMISSED_FP').length;

  const handleDownloadProof = (alert: NetworkAlert) => {
    const proofData = {
      consorcio: 'Consorcio Antifraude Federal Zero-Knowledge',
      alerta_id: alert.id,
      codigo: alert.code,
      titulo: alert.title,
      categoria: alert.category,
      severidad: alert.severity,
      risk_score: alert.riskScore,
      consenso_entidades: alert.reportingEntitiesNames,
      hashes_anonimizados_sha256: alert.blindIdentifiers.map(i => ({
        tipo: i.type,
        hash_zk: i.hash,
        indicador: i.maskedPreview,
      })),
      disparador_regla: alert.triggerRule,
      telemetria: alert.telemetry,
      timestamp_emision: new Date().toISOString(),
      estado_actual: alert.status,
      resolucion: alert.resolution || null,
      validador_criptografico: 'SHA256_SALT_ZERO_KNOWLEDGE_VERIFIED',
    };

    const blob = new Blob([JSON.stringify(proofData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Acta_Auditoria_${alert.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── ENCABEZADO Y CONTEXTO ───────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Bandeja de Alertas de Red
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              {pendingCount} Pendientes de Acción
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Threat Intelligence Feed en tiempo real. Consulte todas las alertas emitidas por el consorcio, inspeccione los indicadores criptográficos ZK y ejecute medidas preventivas directas.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Entidad Activa</p>
            <p className="text-xs font-semibold text-cyan-400 font-mono">{activeEntity.name}</p>
          </div>
        </div>
      </div>

      {/* ── KPIS RESUMEN ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 backdrop-blur-sm p-4">
          <p className="text-[11px] text-slate-400 font-medium">Total de Alertas</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-white">{totalAlerts}</span>
            <Radio className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Histórico en red consorciada</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
          <p className="text-[11px] text-rose-400 font-medium">Alertas Críticas</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-rose-400">{criticalCount}</span>
            <Flame className="h-4 w-4 text-rose-400" />
          </div>
          <p className="text-[10px] text-rose-400/70 mt-1">Score &gt; 80 / Multientidad</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <p className="text-[11px] text-amber-400 font-medium">Pendientes de Acción</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-amber-400">{pendingCount}</span>
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <p className="text-[10px] text-amber-400/70 mt-1">Requieren decisión de analista</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4">
          <p className="text-[11px] text-slate-400 font-medium">Bloqueos Aplicados</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-cyan-400">{blockedCount}</span>
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Mitigación preventiva activa</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4">
          <p className="text-[11px] text-slate-400 font-medium">Falsos Positivos</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">{fpCount}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Rehabilitados y auditados</p>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ───────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input de búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por código (ej: ALT-2026), DNI, email, hash SHA-256, regla o notas..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros rápidos por botones */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severidad */}
            <select
              value={selectedSeverity}
              onChange={e => setSelectedSeverity(e.target.value)}
              aria-label="Filtrar por severidad"
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="ALL">Todas las Severidades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>

            {/* Estado */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              aria-label="Filtrar por estado"
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING_REVIEW">Pendiente de Acción</option>
              <option value="IN_ANALYSIS">En Análisis</option>
              <option value="CONFIRMED_BLOCKED">Bloqueo Confirmado</option>
              <option value="CHALLENGED_2FA">Desafío 2FA</option>
              <option value="DISMISSED_FP">Falso Positivo</option>
            </select>

            {/* Categoría */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Filtrar por categoría"
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="ALL">Todas las Categorías</option>
              <option value="MULE_ACCOUNT">Cuenta Mula</option>
              <option value="IDENTITY_THEFT">Robo de Identidad</option>
              <option value="PHISHING">Phishing / Smishing</option>
              <option value="SUSPICIOUS">Actividad Sospechosa</option>
              <option value="CHARGEBACK">Contracargo</option>
            </select>
          </div>
        </div>

        {/* Contadores de resultados activos */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Mostrando <strong className="text-slate-300">{filteredAlerts.length}</strong> de{' '}
            <strong className="text-slate-300">{totalAlerts}</strong> alertas disponibles
          </span>
          {(searchQuery || selectedSeverity !== 'ALL' || selectedStatus !== 'ALL' || selectedCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSeverity('ALL');
                setSelectedStatus('ALL');
                setSelectedCategory('ALL');
              }}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── LISTADO DE ALERTAS ─────────────────────────────────── */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/40 p-12 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No se encontraron alertas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay incidentes de red que coincidan con los filtros aplicados en este momento.
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const severity = SEVERITY_BADGES[alert.severity];
            const status = STATUS_BADGES[alert.status];
            const cat = CATEGORY_LABELS[alert.category];

            return (
              <div
                key={alert.id}
                className={`rounded-2xl border transition-all duration-200 bg-[#0c1222]/90 hover:bg-[#0f172a] ${
                  alert.severity === 'CRITICAL'
                    ? 'border-rose-500/25 hover:border-rose-500/40 shadow-lg shadow-rose-950/10'
                    : 'border-white/[0.07] hover:border-white/[0.15]'
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Columna Izquierda: Identificador, Título y Badges */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Código de alerta */}
                        <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                          {alert.code}
                        </span>

                        {/* Severidad */}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${severity.bg} ${severity.text} ${severity.border}`}
                        >
                          {severity.label}
                        </span>

                        {/* Estado */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}
                        >
                          {status.label}
                        </span>

                        {/* Categoría */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cat.color}`}>
                          {cat.label}
                        </span>

                        {/* Timestamp relativo */}
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(alert.createdAt)}
                        </span>
                      </div>

                      {/* Título de la alerta */}
                      <h3 className="text-sm font-semibold text-white tracking-tight">
                        {alert.title}
                      </h3>

                      {/* Disparador y Regla */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="text-amber-400 font-mono text-[11px]">
                          ⚡ {alert.triggerRule.ruleName}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 truncate text-[11px]">
                          {alert.triggerRule.conditionHit}
                        </span>
                      </div>

                      {/* Identificadores ciegos / Tags resumidos */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {alert.blindIdentifiers.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/40 border border-white/[0.05] text-[11px] font-mono text-slate-300"
                          >
                            <span className="text-[9px] uppercase font-bold text-cyan-400">
                              {item.type}:
                            </span>
                            <span>{item.maskedPreview}</span>
                          </div>
                        ))}

                        {/* Consenso de entidades ciego */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-mono">
                          <Building2 className="h-3 w-3" />
                          <span>Apareció en {alert.reportingEntitiesCount} entidades de la red</span>
                        </div>
                      </div>
                    </div>

                    {/* Columna Derecha: Score y Botón "Chequear lo que se les alerta" */}
                    <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 border-t lg:border-t-0 border-white/[0.06] pt-3 lg:pt-0">
                      {/* Score gauge mini */}
                      <div className="text-center px-3">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                          Risk Score
                        </p>
                        <div
                          className={`text-2xl font-black font-mono tracking-tight ${
                            alert.riskScore >= 80
                              ? 'text-rose-400'
                              : alert.riskScore >= 50
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {alert.riskScore}
                          <span className="text-xs font-normal text-slate-500">/100</span>
                        </div>
                      </div>

                      {/* Botón de inspección exhaustiva */}
                      <button
                        onClick={() => setInspectingAlert(alert)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-500/50 text-xs font-semibold text-cyan-300 hover:text-white transition shadow-sm hover:shadow-cyan-500/10 active:scale-95"
                      >
                        <Eye className="h-4 w-4 text-cyan-400" />
                        <span>Chequear Alerta</span>
                        <ChevronRight className="h-3.5 w-3.5 text-cyan-400/60" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL DE INSPECCIÓN PROFUNDA ("CHEQUEAR LO QUE SE LES ALERTA") ── */}
      {currentActiveAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-[#090f20] border border-white/[0.12] shadow-2xl shadow-black/80 overflow-hidden my-8">
            {/* Header del modal */}
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    {currentActiveAlert.code}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      SEVERITY_BADGES[currentActiveAlert.severity].bg
                    } ${SEVERITY_BADGES[currentActiveAlert.severity].text} ${
                      SEVERITY_BADGES[currentActiveAlert.severity].border
                    }`}
                  >
                    {SEVERITY_BADGES[currentActiveAlert.severity].label}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      STATUS_BADGES[currentActiveAlert.status].bg
                    } ${STATUS_BADGES[currentActiveAlert.status].text} ${
                      STATUS_BADGES[currentActiveAlert.status].border
                    }`}
                  >
                    {STATUS_BADGES[currentActiveAlert.status].label}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Detectado: {new Date(currentActiveAlert.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight pt-1">
                  {currentActiveAlert.title}
                </h2>
              </div>

              <button
                onClick={() => setInspectingAlert(null)}
                className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Sección 1: Dictamen del Consorcio y Score */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wide">
                    <Radio className="h-3.5 w-3.5 text-cyan-400" />
                    ¿Qué se le alerta a su entidad?
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentActiveAlert.communityNotes}
                  </p>
                  <div className="pt-2 border-t border-white/[0.05] space-y-1">
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-amber-400">Regla Activada:</strong>{' '}
                      {currentActiveAlert.triggerRule.ruleName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {currentActiveAlert.triggerRule.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-black/40 border border-white/[0.08] p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Nivel de Riesgo Calculado</span>
                  <div
                    className={`text-4xl font-black font-mono my-1 ${
                      currentActiveAlert.riskScore >= 80
                        ? 'text-rose-400'
                        : currentActiveAlert.riskScore >= 50
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentActiveAlert.riskScore}
                    <span className="text-sm font-normal text-slate-600">/100</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    Recomendación:{' '}
                    <span className="text-rose-400 uppercase font-mono">
                      {currentActiveAlert.recommendation === 'AUTO_BLOCK'
                        ? 'Bloqueo Inmediato'
                        : currentActiveAlert.recommendation === 'REQUIRE_BIOMETRICS'
                        ? 'Validación 2FA'
                        : currentActiveAlert.recommendation === 'DELAY_FUNDS'
                        ? 'Pausa 45s Fondos'
                        : 'Revisión Analista'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Consenso de {currentActiveAlert.reportingEntitiesCount} entidades</span>
                </div>
              </div>

              {/* Sección 2: Consenso Ciego de Red (Sin datos de otras entidades) */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                    Consenso de Red Comunitario (Zero-Knowledge)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Atestación Ciega Verificada
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-black/40 p-3 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block font-mono">Entidades donde apareció</span>
                    <span className="text-base font-bold font-mono text-indigo-300">
                      {currentActiveAlert.reportingEntitiesCount} instituciones
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Corroboraron la amenaza</span>
                  </div>

                  <div className="rounded-xl bg-black/40 p-3 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block font-mono">Última actividad de red</span>
                    <span className="text-base font-bold font-mono text-amber-300">
                      {formatRelativeTime(currentActiveAlert.lastActivityAt)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Evento más reciente</span>
                  </div>

                  <div className="rounded-xl bg-black/40 p-3 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block font-mono">Primer registro en red</span>
                    <span className="text-base font-bold font-mono text-slate-300">
                      {formatRelativeTime(currentActiveAlert.createdAt)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Ingreso al consorcio</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg border border-white/[0.04]">
                  🔒 <strong className="text-slate-300">Garantía Zero-Knowledge (Ley 25.326):</strong> Ninguna entidad participante puede ver la identidad de otras instituciones financieras ni datos en texto plano de clientes. Su entidad accede únicamente al score consolidado, la cantidad de apariciones y la antigüedad del incidente.
                </p>
              </div>

              {/* Sección 3: Identificadores Ciegos y Hashes ZK */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-cyan-400" />
                    Identificadores Ciegos y Hashes Criptográficos (Zero-Knowledge)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Ley 25.326 — Ningún PII en texto plano
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-[10px] font-mono uppercase text-slate-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="px-4 py-2.5">Tipo</th>
                        <th className="px-4 py-2.5">Indicador Ofuscado</th>
                        <th className="px-4 py-2.5">Hash SHA-256 (Salt Consorcio)</th>
                        <th className="px-4 py-2.5 text-center">Consultas 24h</th>
                        <th className="px-4 py-2.5 text-center">Velocidad</th>
                        <th className="px-4 py-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {currentActiveAlert.blindIdentifiers.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition">
                          <td className="px-4 py-3 font-mono font-bold text-cyan-400">
                            {item.type}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            {item.maskedPreview}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 max-w-[200px] truncate">
                            {item.hash}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-300">
                            {item.lookupsCount24h}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                                item.velocityScore >= 80
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {item.velocityScore}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleCopy(item.hash)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-slate-300 transition"
                              title="Copiar Hash ZK"
                            >
                              {copiedHash === item.hash ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400 font-mono">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-slate-400" />
                                  <span>Copiar Hash</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección 4: Telemetría Técnica y Dispositivo */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-cyan-400" />
                  Telemetría de Red y Huella Digital de Dispositivo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-black/40 p-2.5 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block">Subred IP / ASN</span>
                    <span className="font-mono text-slate-200">{currentActiveAlert.telemetry.ipSubnet || 'No especificada'}</span>
                  </div>
                  <div className="rounded-lg bg-black/40 p-2.5 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block">Proveedor ISP</span>
                    <span className="font-medium text-slate-200">{currentActiveAlert.telemetry.asnName || 'Telecom Argentina'}</span>
                  </div>
                  <div className="rounded-lg bg-black/40 p-2.5 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block">Granja de Dispositivos / Emulador</span>
                    <span
                      className={`font-semibold ${
                        currentActiveAlert.telemetry.deviceFarmSuspect
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {currentActiveAlert.telemetry.deviceFarmSuspect
                        ? '🚨 Sospechoso (Device Farm)'
                        : '✅ Dispositivo Individual'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/40 p-2.5 border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 uppercase block">Velocidad Cruzada</span>
                    <span className="font-mono text-amber-400">
                      {currentActiveAlert.telemetry.crossEntityVelocity || 'Normal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 5: Historial de Resolución (si la hubo) */}
              {currentActiveAlert.resolution && (
                <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4" />
                      Resolución Registrada
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(currentActiveAlert.resolution.resolvedAt).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    {currentActiveAlert.resolution.actionTaken}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Responsable: <strong className="text-slate-300">{currentActiveAlert.resolution.resolvedByRole}</strong>
                    {currentActiveAlert.resolution.notes && (
                      <span> — Nota: {currentActiveAlert.resolution.notes}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Footer con Acciones Interactivas */}
            <div className="p-5 sm:p-6 border-t border-white/[0.08] bg-black/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Botón Descargar Acta Criptográfica */}
                <button
                  onClick={() => handleDownloadProof(currentActiveAlert)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar Acta ZK
                </button>

                {/* Botón Investigar en Consulta ZK */}
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      setInspectingAlert(null);
                      onNavigateTab('consulta');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-xs font-medium text-cyan-300 hover:text-white transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir en Consulta ZK
                  </button>
                )}
              </div>

              {/* Botones de mitigación activa de la entidad */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Marcar Falso Positivo */}
                <button
                  onClick={() => setFpModalAlert(currentActiveAlert)}
                  disabled={currentActiveAlert.status === 'DISMISSED_FP'}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Marcar Falso Positivo
                </button>

                {/* Exigir Biometría 2FA */}
                <button
                  onClick={() => challengeAlert2FA(currentActiveAlert.id)}
                  disabled={currentActiveAlert.status === 'CHALLENGED_2FA' || currentActiveAlert.status === 'CONFIRMED_BLOCKED'}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition shadow-sm"
                >
                  Exigir Biometría 2FA
                </button>

                {/* Confirmar Fraude & Bloqueo */}
                <button
                  onClick={() => confirmAndBlockAlert(currentActiveAlert.id)}
                  disabled={currentActiveAlert.status === 'CONFIRMED_BLOCKED'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition shadow-md shadow-rose-950/40"
                >
                  <AlertOctagon className="h-4 w-4" />
                  {currentActiveAlert.status === 'CONFIRMED_BLOCKED'
                    ? 'Bloqueo Ya Confirmado'
                    : 'Confirmar & Bloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PARA DESCARTAR / JUSTIFICAR FALSO POSITIVO ── */}
      {fpModalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#090f20] border border-white/[0.12] p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Descartar Alerta como Falso Positivo
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Alerta: <strong className="text-cyan-400 font-mono">{fpModalAlert.code}</strong>
                </p>
              </div>
              <button
                onClick={() => setFpModalAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Motivo / Justificación de la Rehabilitación:
              </label>
              <textarea
                value={fpReason}
                onChange={e => setFpReason(e.target.value)}
                placeholder="Ej: Se contactó al cliente por canal presencial. Presentó factura y comprobante de titularidad verificado..."
                rows={3}
                className="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFpModalAlert(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  dismissAlertAsFP(fpModalAlert.id, fpReason || 'Aclarado tras revisión del analista.');
                  setFpModalAlert(null);
                  setFpReason('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
              >
                Confirmar Rehabilitación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
