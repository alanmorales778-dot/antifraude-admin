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
  Layers,
  Phone,
  CreditCard,
  Sparkles,
  Filter,
  Fingerprint,
  Hash,
  Network,
  Building2,
  Timer,
  Gauge,
  MoreVertical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Info,
  MapPin,
  Activity,
  Sliders,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { LookupResult, IncidentCategory, ReasonCode, QueryReason } from '@/lib/types';
import { simulateSendVerificationEmail } from '@/lib/emailVerifier';
import {
  validateCbuChecksum,
  validateCuitChecksum,
  validateDniFormat,
  validateEmailFormat,
  validatePhoneFormat,
  detectIdentifierType,
  computeHMACBlindHash,
} from '@/lib/crypto';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: IncidentCategory; label: string; color: string }[] = [
  { value: 'FRAUD_CONFIRMED', label: 'Fraude Confirmado', color: 'text-red-400' },
  { value: 'MULE_ACCOUNT', label: 'Cuenta Mula', color: 'text-rose-400' },
  { value: 'ACCOUNT_TAKEOVER', label: 'Account Takeover', color: 'text-purple-400' },
  { value: 'IDENTITY_THEFT', label: 'Robo de Identidad', color: 'text-orange-400' },
  { value: 'CHARGEBACK', label: 'Contracargo', color: 'text-amber-400' },
  { value: 'PHISHING', label: 'Phishing', color: 'text-yellow-400' },
  { value: 'SUSPICIOUS', label: 'Actividad Sospechosa', color: 'text-slate-400' },
];

const REASON_CODE_LABELS: Record<ReasonCode, { label: string; icon: string; color: string }> = {
  CLEAN_RECORD: { label: 'Sin Antecedentes', icon: '✅', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  MULE_ACCOUNT_RECENT: { label: 'Cuenta Mula Reciente', icon: '🏦', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  FRAUD_CONFIRMED_HIT: { label: 'Fraude Confirmado', icon: '🚨', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  MULTI_BANK_HIT: { label: 'Multi-Entidad', icon: '🏛️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  MULTI_IDENTITY_DEVICE_FARM: { label: 'Granja de Dispositivos', icon: '📱', color: 'bg-red-600/20 text-red-200 border-red-500/30' },
  AGED_INCIDENT_DECAYED: { label: 'Incidente Envejecido', icon: '⏳', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  CRITICAL_OVERRIDE: { label: 'Override Crítico', icon: '⚡', color: 'bg-rose-600/20 text-rose-200 border-rose-500/40' },
  VELOCITY_SPIKE: { label: 'Pico de Velocidad', icon: '⚡', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  IDENTITY_MISMATCH: { label: 'Discrepancia de Identidad', icon: '🔀', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  ACCOUNT_TAKEOVER_FLAG: { label: 'Account Takeover', icon: '🔓', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  PHISHING_ORIGIN: { label: 'Origen Phishing', icon: '🎣', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  CHARGEBACK_HISTORY: { label: 'Historial Contracargos', icon: '💳', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  DEVICE_LINKED_FRAUD: { label: 'Device Vinculado a Fraude', icon: '📱', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  INTERNAL_RECURRENCE: { label: 'Recurrencia Interna', icon: '🔁', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  MULE_NETWORK_CLUSTER: { label: 'Cluster Red de Mulas', icon: '🕸️', color: 'bg-purple-600/20 text-purple-200 border-purple-500/30' },
  SHARED_DEVICE_FARM: { label: 'Dispositivo Compartido (Granja)', icon: '📱', color: 'bg-rose-600/20 text-rose-200 border-rose-500/30' },
};

function recommendationBadge(rec: 'ALLOW' | 'REVIEW' | 'BLOCK') {
  if (rec === 'BLOCK') return { text: 'Marcar Riesgo Interno', class: 'bg-rose-500/20 border-rose-500/40 text-rose-300', icon: '🛑' };
  if (rec === 'REVIEW') return { text: 'REVISIÓN MANUAL', class: 'bg-amber-500/20 border-amber-500/40 text-amber-300', icon: '⚠️' };
  return { text: 'APROBAR', class: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', icon: '✅' };
}

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

function ScoreGauge({
  score,
  title = 'Score de Riesgo',
  subtitle = 'Puntaje ponderado (0-100)',
  badge = { text: 'ESTADO', color: 'bg-slate-800 text-slate-300 border-white/10' },
  icon: Icon,
}: {
  score: number;
  title?: string;
  subtitle?: string;
  badge?: { text: string; color: string };
  icon?: any;
}) {
  const radius = 48;
  const circumference = Math.PI * radius; // semicírculo
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-slate-950/70 border border-white/10 shadow-lg min-w-[200px] flex-1">
      <div className="w-full flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
          <span className="text-xs font-bold text-slate-200">{title}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
          {badge.text}
        </span>
      </div>

      <svg width="130" height="74" viewBox="0 0 130 74" className="my-1">
        {/* Fondo */}
        <path
          d="M 17 68 A 48 48 0 0 1 113 68"
          fill="none"
          stroke="#1e293b"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {/* Progreso */}
        <path
          d="M 17 68 A 48 48 0 0 1 113 68"
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        {/* Score */}
        <text
          x="65"
          y="62"
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

      <span className="text-[10px] text-center text-slate-400 font-mono line-clamp-2">
        {subtitle}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MÓDULO 1: CONSULTA DE RIESGO (UNITARIA - DNI, EMAIL, TEL, IP, CBU)
// ─────────────────────────────────────────────────────────────────

const QUERY_REASON_OPTIONS = [
  { value: 'EVALUACION_TRANSFERENCIA', label: 'Evaluación de Transferencia (Inmediata / Debin)', icon: '💸' },
  { value: 'ALTA_ONBOARDING', label: 'Alta / Onboarding de Cliente', icon: '👤' },
  { value: 'INVESTIGACION_INTERNA', label: 'Investigación de Fraude / Alerta Interna', icon: '🔍' },
  { value: 'AUDITORIA_COMPLIANCE', label: 'Auditoría Regulatoria y Compliance', icon: '⚖️' },
  { value: 'MONITOREO_TRANSACCIONAL', label: 'Monitoreo Transaccional Continuo', icon: '🛡️' },
];

function SingleLookupView() {
  const { lookupIdentity, markFalsePositive, activeFintechId, fintechs, activeService } = useConsortiumStore();

  // Selector de Modo: 'single' (Dato por Dato) | 'set' (Conjunto de Datos)
  const [searchMode, setSearchMode] = useState<'single' | 'set'>('single');

  // Modo Dato por Dato
  const [singleType, setSingleType] = useState<'DNI' | 'EMAIL' | 'PHONE' | 'CBU' | 'IP' | 'DEVICE' | 'CUIT'>('DNI');
  const [singleValue, setSingleValue] = useState('');

  // Modo Conjunto de Datos
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [cbu, setCbu] = useState('');
  const [device, setDevice] = useState('');
  const [cuit, setCuit] = useState('');

  // Motivo de consulta obligatorio para cumplimiento y trazabilidad
  const [queryReason, setQueryReason] = useState<string>('EVALUACION_TRANSFERENCIA');

  // Toggle de modo demostración (apagado por defecto)
  const [showDemoButtons, setShowDemoButtons] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Estado inicial siempre en NULL para no mostrar scores previos ni 0 ficticios
  const [result, setResult] = useState<LookupResult | null>(null);
  const [okLoading, setOkLoading] = useState(false);
  const [okDone, setOkDone] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const isInternal = activeService === 'INTERNAL';
  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // Autodetección de identificador al tipear o pegar
  const handleSingleValueChange = (val: string) => {
    setSingleValue(val);
    const detected = detectIdentifierType(val);
    if (detected && detected !== singleType) {
      setSingleType(detected);
    }
  };

  // Validación sintáctica en vivo del campo unitario
  const getSingleValidationState = (): { valid: boolean; message?: string } | null => {
    const val = singleValue.trim();
    if (!val) return null;

    if (singleType === 'CBU') {
      const res = validateCbuChecksum(val);
      return { valid: res.valid, message: res.valid ? 'CBU/CVU verificado (Módulo 10 BCRA)' : res.reason };
    }
    if (singleType === 'CUIT') {
      const res = validateCuitChecksum(val);
      return { valid: res.valid, message: res.valid ? 'CUIT verificado (Módulo 11 AFIP/BCRA)' : res.reason };
    }
    if (singleType === 'DNI') {
      const res = validateDniFormat(val);
      return { valid: res.valid, message: res.valid ? 'DNI con longitud válida' : res.reason };
    }
    if (singleType === 'EMAIL') {
      const res = validateEmailFormat(val);
      return { valid: res.valid, message: res.valid ? 'Formato de correo válido' : res.reason };
    }
    if (singleType === 'PHONE') {
      const res = validatePhoneFormat(val);
      return { valid: res.valid, message: res.valid ? 'Teléfono válido' : res.reason };
    }
    return null;
  };

  const validationState = getSingleValidationState();

  // Ejecución de Consulta
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setOkDone(false);

    let queryParams: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string; device?: string; cuit?: string; reason?: string } = {
      reason: queryReason,
    };

    if (searchMode === 'single') {
      const val = singleValue.trim();
      if (!val) {
        setError(`Por favor ingresá el valor de ${singleType === 'DNI' ? 'DNI' : singleType === 'CBU' ? 'CBU/CVU' : singleType} para consultar.`);
        return;
      }

      // Validar si es CBU o CUIT antes de consultar
      if (singleType === 'CBU' && val.length === 22) {
        const cbuCheck = validateCbuChecksum(val);
        if (!cbuCheck.valid) {
          setError(`Aviso de validación: ${cbuCheck.reason}`);
          // Permitir continuar si el usuario fuerza la búsqueda
        }
      }

      if (singleType === 'DNI') queryParams.dni = val;
      if (singleType === 'EMAIL') queryParams.email = val;
      if (singleType === 'PHONE') queryParams.phone = val;
      if (singleType === 'CBU') queryParams.cbu = val;
      if (singleType === 'IP') queryParams.ip = val;
      if (singleType === 'DEVICE') queryParams.device = val;
      if (singleType === 'CUIT') queryParams.cuit = val;
    } else {
      if (!dni.trim() && !email.trim() && !phone.trim() && !ip.trim() && !cbu.trim() && !device.trim() && !cuit.trim()) {
        setError('Ingresá al menos un identificador (o varios combinados) para evaluar el conjunto.');
        return;
      }
      queryParams = {
        ...queryParams,
        dni: dni.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        ip: ip.trim() || undefined,
        cbu: cbu.trim() || undefined,
        device: device.trim() || undefined,
        cuit: cuit.trim() || undefined,
      };
    }

    setLoading(true);
    try {
      const res = await lookupIdentity(queryParams);
      setResult(res);
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      setError(
        isInternal
          ? `Error al evaluar el riesgo en el workspace interno${detail}`
          : `Error al evaluar el riesgo en la red federada del consorcio${detail}`
      );
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

    if (!confirm('¿Confirmar voto OK para este identificador? Esto atenuará el score comunitario (−35 pts por reporte).')) return;

    setOkLoading(true);
    for (const edge of activeEdges) {
      markFalsePositive(edge.id);
    }
    setOkDone(true);
    setOkLoading(false);

    // Re-evaluar automáticamente para mostrar el score reducido en vivo
    setTimeout(async () => {
      let queryParams: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string; reason?: string } = {
        reason: queryReason,
      };
      if (searchMode === 'single') {
        const val = singleValue.trim();
        if (singleType === 'DNI') queryParams.dni = val;
        if (singleType === 'EMAIL') queryParams.email = val;
        if (singleType === 'PHONE') queryParams.phone = val;
        if (singleType === 'CBU') queryParams.cbu = val;
        if (singleType === 'IP') queryParams.ip = val;
      } else {
        queryParams = {
          ...queryParams,
          dni: dni.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          ip: ip.trim() || undefined,
          cbu: cbu.trim() || undefined,
        };
      }
      const refreshed = await lookupIdentity(queryParams);
      setResult(refreshed);
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* ── SELECTOR DE MODALIDAD: DATO POR DATO vs CONJUNTO DE DATOS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => {
              setSearchMode('single');
              setError('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
              searchMode === 'single'
                ? 'bg-cyan-600 text-white shadow-cyan-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>1. Buscar Dato por Dato</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchMode('set');
              setError('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
              searchMode === 'set'
                ? 'bg-indigo-600 text-white shadow-indigo-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>2. Buscar por Conjunto de Datos</span>
          </button>
        </div>

        {/* Toggle para Modo Demostración */}
        <div className="flex items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => setShowDemoButtons(!showDemoButtons)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              showDemoButtons
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Muestra u oculta los botones de datos de prueba preconfigurados"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{showDemoButtons ? 'Modo Demo Activo' : 'Modo Demo'}</span>
          </button>
        </div>
      </div>

      {/* ── SELECTOR DE MOTIVO DE CONSULTA (OBLIGATORIO AUDITORÍA BANCARIA) ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
          <div>
            <label className="text-xs font-bold text-white block">
              Motivo de Consulta (Auditoría Inmutable / Cumplimiento BCRA):
            </label>
            <p className="text-[11px] text-slate-400">
              Quedará asentado en el log inmutable con firma de analista según comunicación BCRA.
            </p>
          </div>
        </div>

        <select
          value={queryReason}
          onChange={e => setQueryReason(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none transition shadow-inner"
        >
          {QUERY_REASON_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── FORMULARIO: MODALIDAD 1 - DATO POR DATO ── */}
      {searchMode === 'single' && (
        <form onSubmit={handleLookup} className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-5 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>Seleccioná el tipo de identificador a consultar:</span>
              <span className="text-[11px] text-slate-500">Detecta automáticamente al pegar</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { type: 'DNI' as const, icon: CreditCard, label: 'DNI / CUIL' },
                { type: 'EMAIL' as const, icon: Mail, label: 'Email' },
                { type: 'PHONE' as const, icon: Phone, label: 'Teléfono' },
                { type: 'CBU' as const, icon: Building, label: 'CBU / CVU' },
                { type: 'IP' as const, icon: Globe, label: 'IP' },
                { type: 'DEVICE' as const, icon: Fingerprint, label: 'Device ID' },
                { type: 'CUIT' as const, icon: Hash, label: 'CUIT' },
              ].map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSingleType(type);
                    setSingleValue('');
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                    singleType === type
                      ? (isInternal ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200 shadow-sm' : 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-sm')
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${singleType === type ? (isInternal ? 'text-indigo-400' : 'text-cyan-400') : 'text-slate-500'}`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Valor de {singleType === 'DNI' ? 'DNI / CUIL' : singleType === 'CBU' ? 'CBU / CVU' : singleType}</span>
              <span className="text-[11px] text-slate-500 font-mono">
                Presioná Enter ↵ para consultar
              </span>
            </label>
            <div className="relative">
              <input
                type={singleType === 'EMAIL' ? 'email' : 'text'}
                value={singleValue}
                onChange={e => {
                  if (singleType === 'CBU') {
                    handleSingleValueChange(e.target.value.replace(/\D/g, '').slice(0, 22));
                  } else {
                    handleSingleValueChange(e.target.value);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookup();
                  }
                }}
                placeholder={
                  singleType === 'DNI'
                    ? 'Ej: 30111222'
                    : singleType === 'EMAIL'
                    ? 'Ej: estafador@gmail.com'
                    : singleType === 'PHONE'
                    ? 'Ej: +5491122334455'
                    : singleType === 'CBU'
                    ? 'Ej: 0000003100010000000001 (22 dígitos)'
                    : singleType === 'CUIT'
                    ? 'Ej: 20301112227'
                    : 'Ej: 190.191.200.45'
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition font-mono shadow-inner"
              />
            </div>

            {/* Feedback de Validación en Vivo */}
            {validationState && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {validationState.valid ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    {validationState.message}
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    {validationState.message}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botones de Prueba Rápida con 1 Clic (Solo visibles si se activa Modo Demo) */}
          {showDemoButtons && (
            <div className="flex flex-wrap items-center gap-2 pt-1 p-3 bg-slate-950/50 rounded-xl border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" /> Demos:
              </span>
              {singleType === 'DNI' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setSingleValue('30111222'); }}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                  >
                    🚨 DNI Mula (30111222)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSingleValue('40999888'); }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition font-mono"
                  >
                    ✅ DNI Limpio (40999888)
                  </button>
                </>
              )}
              {singleType === 'CBU' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setSingleValue('0000003100010000000001'); }}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                  >
                    🚨 CBU Mula (0000003100010000000001)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSingleValue('0000003199990000000099'); }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition font-mono"
                  >
                    ✅ CBU Limpio (0000003199990000000099)
                  </button>
                </>
              )}
              {singleType === 'PHONE' && (
                <button
                  type="button"
                  onClick={() => { setSingleValue('+5491122334455'); }}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                >
                  🚨 Teléfono Sospechoso (+5491122334455)
                </button>
              )}
              {singleType === 'IP' && (
                <button
                  type="button"
                  onClick={() => { setSingleValue('190.191.200.45'); }}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                >
                  🚨 IP Botnet (190.191.200.45)
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-950/30 border border-rose-500/30 rounded-xl p-2.5">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-cyan-950/40"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                  Consultando {singleType}...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Consultar {singleType} en Red
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── FORMULARIO: MODALIDAD 2 - POR CONJUNTO DE DATOS ── */}
      {searchMode === 'set' && (
        <form onSubmit={handleLookup} className="rounded-2xl border border-indigo-500/25 bg-slate-900/60 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-400" />
                Evaluación Combinada y Detección de Discrepancias (Identity Mismatch)
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ingresá los datos conocidos del perfil. El motor evaluará cada dato y además verificará si existen cruces ilícitos entre ellos (ej: un mismo email o CBU asociado a distintos DNIs).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-cyan-400" /> DNI / CUIL
              </label>
              <input
                type="text"
                value={dni}
                onChange={e => setDni(e.target.value)}
                placeholder="Ej: 30111222"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-indigo-400" /> Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Ej: estafador@gmail.com"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-emerald-400" /> Teléfono Celular
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ej: +5491122334455"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-amber-400" /> CBU / CVU Destino
              </label>
              <input
                type="text"
                value={cbu}
                onChange={e => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                placeholder="22 dígitos numéricos"
                maxLength={22}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-sky-400" /> IP de Conexión
              </label>
              <input
                type="text"
                value={ip}
                onChange={e => setIp(e.target.value)}
                placeholder="Ej: 190.191.200.45"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Fingerprint className="h-3.5 w-3.5 text-purple-400" /> Device Fingerprint ID
              </label>
              <input
                type="text"
                value={device}
                onChange={e => setDevice(e.target.value)}
                placeholder="Ej: dev_7f9c2a..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-rose-400" /> CUIT / CUIL Vinculado
              </label>
              <input
                type="text"
                value={cuit}
                onChange={e => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="11 dígitos"
                maxLength={11}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>
          </div>

          {showDemoButtons && (
            <div className="flex flex-wrap items-center gap-2 pt-1 p-3 bg-slate-950/50 rounded-xl border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Demos de Conjunto:
              </span>
              <button
                type="button"
                onClick={() => {
                  setDni('30111222');
                  setEmail('estafador@gmail.com');
                  setPhone('+5491122334455');
                  setIp('190.191.200.45');
                  setCbu('0000003100010000000001');
                }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
              >
                🚨 Perfil de Fraude Completo (Mula)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDni('40999888');
                  setEmail('juan.perez@empresa.com');
                  setPhone('+5491199887766');
                  setIp('181.44.120.10');
                  setCbu('0000003199990000000099');
                }}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                ✅ Perfil Limpio
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-950/30 border border-rose-500/30 rounded-xl p-2.5">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-950/40"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                  Evaluando correlación en red...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Evaluar Conjunto de Datos
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── 1. ESTADO INICIAL VACÍO (SIN CONSULTAS AÚN Y SIN ERROR) ── */}
      {!result && !error && !loading && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center space-y-4 shadow-lg animate-fade-in">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Shield className="h-7 w-7" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h4 className="text-base font-bold text-white tracking-tight">
              Plataforma Federal de Prevención y Consulta de Riesgo
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ingresá un identificador (DNI, CBU/CVU, CUIT, Email o Teléfono) arriba para evaluar antecedentes en tiempo real contra la red de consorcio interbancario.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 max-w-4xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block flex items-center gap-1">
                <Lock className="h-3 w-3" /> Tokenización Ciega
              </span>
              <p className="text-[11px] text-slate-300 font-medium">HMAC-SHA256 con Pepper KMS</p>
              <p className="text-[10px] text-slate-500">Matemáticamente irreversible para terceros y auditorías.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Secreto Bancario
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Ley 25.326 & BCRA Com. A 7724</p>
              <p className="text-[10px] text-slate-500">Ningún dato en claro viaja fuera del perímetro de la entidad.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <Network className="h-3 w-3" /> Detección de Mulas
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Grafo Interbancario a 3 Saltos</p>
              <p className="text-[10px] text-slate-500">Identifica clusters de triangulación y granjas de dispositivos.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block flex items-center gap-1">
                <Activity className="h-3 w-3" /> Explicabilidad Real
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Score 0 a 100 con Motivos</p>
              <p className="text-[10px] text-slate-500">Recomendaciones operativas claras: Aprobar, Revisar o Bloquear.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. ESTADO DE ERROR VISIBLE Y REINTENTABLE ── */}
      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-center space-y-3 shadow-xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-200">No se pudo completar la consulta de riesgo</h4>
            <p className="text-xs text-rose-300/80 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => handleLookup()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reintentar Consulta</span>
          </button>
        </div>
      )}

      {/* ── 3. RESULTADO DE CONSULTA (2 COLUMNAS LADO A LADO) ── */}
      {result && (() => {
        // Cálculo de métricas principales unificadas
        const internalScore = result.internalRiskScore ?? result.breakdown.internalRiskScore ?? 0;
        const consortiumScore = result.consortiumRiskScore ?? result.breakdown.consortiumRiskScore ?? result.breakdown.finalScore ?? 0;

        const rec = recommendationBadge(result.breakdown.recommendation);
        const edges = result.breakdown.matchingEdges || [];

        // Cantidad de entidades distintas que reportaron
        const distinctEntities = new Set(edges.map(e => e.reportedByEntityId));
        const reportingEntitiesCount = distinctEntities.size;

        // Cantidad de reportes de mi entidad
        const myEntityReportsCount = edges.filter(e => e.reportedByEntityId === activeFintechId).length;

        // Último incidente & Tipología predominante
        const mostRecentTimestamp = edges.length > 0
          ? Math.max(...edges.map(e => new Date(e.timestamp).getTime()))
          : null;

        const emailDetail = result.breakdown.identifierDetails?.find(d => d.type === 'EMAIL');
        const lastIncidentText = mostRecentTimestamp
          ? formatTimeAgo(mostRecentTimestamp)
          : emailDetail?.lastSeenDaysAgo
          ? `Hace ${emailDetail.lastSeenDaysAgo} días`
          : emailDetail?.lastReportedAt
          ? emailDetail.lastReportedAt
          : (consortiumScore >= 70 ? 'Reciente (< 48 hs)' : 'Sin incidentes');

        const catCounts: Record<string, number> = {};
        edges.forEach(e => {
          if (e.incidentCategory) catCounts[e.incidentCategory] = (catCounts[e.incidentCategory] || 0) + 1;
        });

        const CATEGORY_TRANSLATIONS: Record<string, string> = {
          MULE_ACCOUNT: 'Cuenta Mula',
          FRAUD_CONFIRMED: 'Fraude Confirmado',
          ACCOUNT_TAKEOVER: 'Account Takeover',
          IDENTITY_THEFT: 'Robo de Identidad',
          CHARGEBACK: 'Contracargo',
          PHISHING: 'Phishing',
          SUSPICIOUS: 'Actividad Sospechosa',
        };

        const predominantCatKey = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        let predominantTypology = 'Sin incidentes reportados';
        if (predominantCatKey && CATEGORY_TRANSLATIONS[predominantCatKey]) {
          predominantTypology = CATEGORY_TRANSLATIONS[predominantCatKey];
        } else if (consortiumScore >= 70) {
          predominantTypology = 'Cuenta Mula';
        } else if (consortiumScore >= 30) {
          predominantTypology = 'Actividad Sospechosa';
        }

        // Nivel de Confianza de la recomendación
        const confidenceBadge = reportingEntitiesCount >= 2 || consortiumScore >= 75
          ? { text: 'CONFIANZA ALTA', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
          : reportingEntitiesCount === 1 || consortiumScore >= 30
          ? { text: 'CONFIANZA MEDIA', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
          : { text: 'CONFIANZA ALTA (Sin Alertas)', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };

        return (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-6 animate-fade-in shadow-xl">
            {/* Header del Resultado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      {searchMode === 'single'
                        ? `Evaluación de Riesgo: ${singleType === 'DNI' ? 'DNI / CUIL' : singleType === 'CBU' ? 'CBU / CVU' : singleType}`
                        : 'Evaluación del Conjunto de Identificadores'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                      Token Ciego HMAC
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Motivo: <strong className="text-slate-200">{QUERY_REASON_OPTIONS.find(o => o.value === queryReason)?.label}</strong>
                  </p>
                </div>
              </div>

              {/* Botón de Voto OK / Atenuación */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkOK}
                  disabled={okLoading || okDone}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-md ${
                    okDone
                      ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 cursor-default'
                      : 'border-emerald-400/50 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                  }`}
                  title="Atenúa el score de riesgo restando −35 pts por reporte comunitario"
                >
                  {okDone ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      <span>Voto OK Registrado</span>
                    </>
                  ) : okLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Aplicando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Marcar OK / Atenuar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── SEPARACIÓN VISUAL ESTRICTA: RIESGO PROPIO vs RIESGO EN RED ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* COLUMNA 1: RIESGO PROPIO (MI ENTIDAD) */}
              <div className="rounded-2xl border border-indigo-500/25 bg-slate-950/70 p-5 flex flex-col justify-between space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-400" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      Riesgo Propio ({activeFintech?.name || 'Mi Entidad'})
                    </h5>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    internalScore >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                    internalScore >= 30 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {internalScore >= 70 ? 'ALTO RIESGO PROPIO' : internalScore >= 30 ? 'RIESGO MEDIO PROPIO' : 'LIMPIO INTERNAMENTE'}
                  </span>
                </div>

                <ScoreGauge
                  score={internalScore}
                  title="Score de Mi Entidad"
                  subtitle="Antecedentes y transacciones previas registradas en tu propio workspace."
                  badge={{
                    text: internalScore >= 70 ? 'ALERTA LOCAL' : internalScore >= 30 ? 'SOSPECHA LOCAL' : 'SIN REPORTES PROPIOS',
                    color: internalScore >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : internalScore >= 30 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  }}
                  icon={Building2}
                />

                <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Reportes originados por tu entidad:</span>
                    <strong className="text-white font-mono">{myEntityReportsCount} incidente(s)</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Estado en política interna:</span>
                    <span className={internalScore >= 70 ? 'text-rose-400 font-bold' : internalScore >= 30 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {internalScore >= 70 ? 'Bloqueo Interno Recomendado' : internalScore >= 30 ? 'Desafío 2FA Obligatorio' : 'Habilitado sin fricción'}
                    </span>
                  </div>
                </div>
              </div>

              {/* COLUMNA 2: RIESGO EN RED (CONSORCIO FEDERAL) */}
              <div className="rounded-2xl border border-cyan-500/25 bg-slate-950/70 p-5 flex flex-col justify-between space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-cyan-400" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      Riesgo en Red (Consorcio Federal)
                    </h5>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    consortiumScore >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                    consortiumScore >= 30 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {consortiumScore >= 70 ? 'ALERTA CONSORCIO' : consortiumScore >= 30 ? 'SOSPECHA EN RED' : 'LIMPIO EN RED'}
                  </span>
                </div>

                <ScoreGauge
                  score={consortiumScore}
                  title="Score Consolidado de Red"
                  subtitle="Cruces determinísticos sobre los nodos ciegos del consorcio interbancario."
                  badge={{
                    text: consortiumScore >= 70 ? 'RIESGO CRÍTICO' : consortiumScore >= 30 ? 'RIESGO MODERADO' : 'BAJO RIESGO',
                    color: consortiumScore >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : consortiumScore >= 30 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  }}
                  icon={Network}
                />

                <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Recomendación de Red:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${rec.class}`}>
                      {rec.icon} {rec.text}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Entidades que reportaron:</span>
                    <strong className="text-cyan-300 font-mono">
                      {reportingEntitiesCount > 0 ? `${reportingEntitiesCount} entidad(es) financiera(s) anónima(s)` : '0 entidades'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Nivel de Confianza:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${confidenceBadge.color}`}>
                      {confidenceBadge.text}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Tipología predominante:</span>
                    <strong className="text-white">{predominantTypology}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Recencia del reporte:</span>
                    <strong className="text-white">{lastIncidentText}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Motivos del Score (Explicabilidad) */}
            <div className="rounded-xl bg-slate-950/70 border border-white/10 p-4 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Motivos Determinantes del Score de Riesgo:
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {(result.breakdown.reasonCodes && result.breakdown.reasonCodes.length > 0) ? (
                  result.breakdown.reasonCodes.map(code => {
                    const info = REASON_CODE_LABELS[code] || { label: code, icon: '⚠️', color: 'bg-slate-700 text-slate-200 border-white/10' };
                    return (
                      <span key={code} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${info.color}`}>
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </span>
                    );
                  })
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    ✅ Sin antecedentes ni factores de riesgo detectados en la red
                  </span>
                )}
              </div>
            </div>

            {/* Acordeón de Detalles Técnicos Criptográficos */}
            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition"
              >
                {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{showTechnicalDetails ? 'Ocultar detalles técnicos' : 'Ver desglose matemático y tokens ciegos'}</span>
              </button>

              {showTechnicalDetails && (
                <div className="mt-3 space-y-3 p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 font-mono">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Algoritmo de Blind Indexing:</span>
                    <span className="text-cyan-400 font-bold">HMAC-SHA256 con Pepper KMS & Domain Separation</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Time Decay Aplicado:</span>
                    <span>{result.breakdown.timeDecayApplied ? `Sí (Factor ×${result.breakdown.timeDecayFactor.toFixed(2)})` : 'No'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Aristas en Grafo de Red:</span>
                    <span>{edges.length} arista(s) vinculada(s)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


// MÓDULO 1B: CONSULTA MASIVA CSV (DNI, EMAIL, TEL, IP, CBU)
// ─────────────────────────────────────────────────────────────────

const SAMPLE_BULK_CSV = `dni,email,phone,ip,cbu
30111222,estafador@gmail.com,+5491122334455,190.191.200.45,0000003100010000000001
40999888,usuario_falso@noexiste.com,,181.44.120.10,0000003100020000000002
,,+5491155667788,,0000003100030000000003
20123456789,burner@yopmail.com,+5491188990011,200.45.12.89,0000003100040000000004
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
  if (val.length === 22) {
    // CBU / CVU: 22 dígitos numéricos
    return `${val.slice(0, 4)}***${val.slice(-4)}`;
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
  cbuMasked: string;
  emailStatus: 'EXISTING' | 'NON_EXISTENT' | 'DISPOSABLE' | 'NONE';
  emailCountry: string;    // "🇺🇸 Estados Unidos" o "—"
  emailAge: string;        // "Creado hace 22 años" o "—"
  emailMaturity: 'NUEVO' | 'JOVEN' | 'INTERMEDIO' | 'MADURO' | 'NONE';
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
  const [pendingBatch, setPendingBatch] = useState<{
    fileName: string;
    totalLines: number;
    validCount: number;
    errorCount: number;
    itemsToQuery: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string }[];
    previewRows: {
      row: number;
      dniMasked: string;
      emailMasked: string;
      phoneMasked: string;
      ipMasked: string;
      cbuMasked: string;
      isValid: boolean;
      note: string;
    }[];
  } | null>(null);

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
      'fila,dni_masked,email_masked,phone_masked,ip_masked,cbu_masked,estado_email,pais_email,antiguedad_email,madurez_email,score,nivel,tipologia\n' +
      bulkResults
        .map(
          r =>
            `${r.row},"${r.dniMasked}","${r.emailMasked}","${r.phoneMasked}","${r.ipMasked}","${r.cbuMasked}","${r.emailStatus}","${r.emailCountry}","${r.emailAge}","${r.emailMaturity}",${r.score},${r.level},"${r.tipologia}"`
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

  // Pre-visualización de archivo antes de consultar la base de datos
  const previewLookupFile = useCallback(
    async (file: File) => {
      setBulkError('');
      setBulkResults([]);
      setPendingBatch(null);

      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setBulkError('El archivo CSV debe contener un encabezado y al menos 1 fila de datos.');
        return;
      }

      const header = lines[0].toLowerCase();
      const dataLines = lines.slice(1);

      const isTipoValor = header.includes('tipo') && header.includes('valor');
      const itemsToQuery: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string }[] = [];
      const previewRows: {
        row: number;
        dniMasked: string;
        emailMasked: string;
        phoneMasked: string;
        ipMasked: string;
        cbuMasked: string;
        isValid: boolean;
        note: string;
      }[] = [];
      let validCount = 0;
      let errorCount = 0;

      if (isTipoValor) {
        dataLines.forEach((line, idx) => {
          const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          const tipo = parts[0]?.toUpperCase();
          const val = parts[1];
          if (!val || !tipo) {
            errorCount++;
            if (previewRows.length < 6) {
              previewRows.push({
                row: idx + 1,
                dniMasked: '—',
                emailMasked: '—',
                phoneMasked: '—',
                ipMasked: '—',
                cbuMasked: '—',
                isValid: false,
                note: 'Fila vacía o sin campos',
              });
            }
            return;
          }

          const item: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string } = {};
          if (tipo === 'DNI') item.dni = val;
          else if (tipo === 'EMAIL') item.email = val;
          else if (tipo === 'PHONE') item.phone = val;
          else if (tipo === 'IP') item.ip = val;
          else if (tipo === 'CBU' || tipo === 'CVU') item.cbu = val;
          else {
            errorCount++;
            if (previewRows.length < 6) {
              previewRows.push({
                row: idx + 1,
                dniMasked: '—',
                emailMasked: '—',
                phoneMasked: '—',
                ipMasked: '—',
                cbuMasked: '—',
                isValid: false,
                note: `Tipo desconocido: ${tipo}`,
              });
            }
            return;
          }

          validCount++;
          itemsToQuery.push(item);
          if (previewRows.length < 6) {
            previewRows.push({
              row: idx + 1,
              dniMasked: maskField(item.dni),
              emailMasked: maskField(item.email),
              phoneMasked: maskField(item.phone),
              ipMasked: maskField(item.ip),
              cbuMasked: maskField(item.cbu),
              isValid: true,
              note: 'Formato válido',
            });
          }
        });
      } else {
        const cols = header.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const dniIdx = cols.findIndex(c => c.includes('dni') || c.includes('cuil') || c.includes('cuit'));
        const emailIdx = cols.findIndex(c => c.includes('email') || c.includes('correo'));
        const phoneIdx = cols.findIndex(c => c.includes('phone') || c.includes('tel') || c.includes('cel'));
        const ipIdx = cols.findIndex(c => c.includes('ip') || c.includes('ip_address'));
        const cbuIdx = cols.findIndex(c => c.includes('cbu') || c.includes('cvu') || c.includes('cuenta'));

        dataLines.forEach((line, idx) => {
          const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          const rowDni = dniIdx >= 0 ? parts[dniIdx] : undefined;
          const rowEmail = emailIdx >= 0 ? parts[emailIdx] : undefined;
          const rowPhone = phoneIdx >= 0 ? parts[phoneIdx] : undefined;
          const rowIp = ipIdx >= 0 ? parts[ipIdx] : undefined;
          const rowCbu = cbuIdx >= 0 ? parts[cbuIdx] : undefined;

          if (rowDni || rowEmail || rowPhone || rowIp || rowCbu) {
            validCount++;
            const item = {
              dni: rowDni || undefined,
              email: rowEmail || undefined,
              phone: rowPhone || undefined,
              ip: rowIp || undefined,
              cbu: rowCbu || undefined,
            };
            itemsToQuery.push(item);
            if (previewRows.length < 6) {
              previewRows.push({
                row: idx + 1,
                dniMasked: maskField(item.dni),
                emailMasked: maskField(item.email),
                phoneMasked: maskField(item.phone),
                ipMasked: maskField(item.ip),
                cbuMasked: maskField(item.cbu),
                isValid: true,
                note: 'Formato válido',
              });
            }
          } else {
            errorCount++;
            if (previewRows.length < 6) {
              previewRows.push({
                row: idx + 1,
                dniMasked: '—',
                emailMasked: '—',
                phoneMasked: '—',
                ipMasked: '—',
                cbuMasked: '—',
                isValid: false,
                note: 'Sin identificadores reconocibles',
              });
            }
          }
        });
      }

      if (itemsToQuery.length === 0) {
        setBulkError('No se encontraron filas con datos válidos en el archivo. Descargá el layout de prueba para ver el formato.');
        return;
      }

      setPendingBatch({
        fileName: file.name,
        totalLines: dataLines.length,
        validCount,
        errorCount,
        itemsToQuery,
        previewRows,
      });
    },
    []
  );

  // Ejecución confirmada de la consulta
  const confirmBatchProcessing = async () => {
    if (!pendingBatch || pendingBatch.itemsToQuery.length === 0) return;
    const items = pendingBatch.itemsToQuery;
    setPendingBatch(null);
    setBulkLoading(true);
    setBulkProgress(0);

    const results: BulkRowResult[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
          cbuMasked: maskField(item.cbu),
          emailStatus,
          emailCountry: emailVerification?.country
            ? `${emailVerification.country.flag} ${emailVerification.country.countryName}`
            : '—',
          emailAge: emailVerification?.age
            ? emailVerification.age.ageLabel
            : '—',
          emailMaturity: emailVerification?.age?.maturityLevel || 'NONE',
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
          cbuMasked: maskField(item.cbu),
          emailStatus: 'NONE',
          emailCountry: '—',
          emailAge: '—',
          emailMaturity: 'NONE',
          score: 0,
          level: 'ERROR',
          tipologia: 'Error en consulta',
        });
      }
      setBulkProgress(Math.round(((i + 1) / items.length) * 100));
    }

    setBulkResults(results);
    setBulkLoading(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) previewLookupFile(f);
    },
    [previewLookupFile]
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
            Evaluá múltiples identidades en simultáneo (DNI, Email, Teléfono, IP, CBU/CVU). Descargá el layout de prueba para verificar el formato de columnas o subí directamente tu archivo para calcular el score individual de cada registro.
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
        <p className="text-cyan-400">dni,email,phone,ip,cbu</p>
        <p className="text-slate-500">30111222,estafador@gmail.com,+5491122334455,190.191.200.45,0000003100010000000001</p>
        <p className="text-slate-500">40999888,usuario_falso@noexiste.com,,181.44.120.10,0000003100020000000002</p>
        <p className="text-slate-500">,,+5491155667788,,0000003100030000000003</p>
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
            if (f) previewLookupFile(f);
          }}
        />
      </div>

      {/* Pre-visualización de Lote CSV antes de procesar en base de datos */}
      {pendingBatch && !bulkLoading && (
        <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Pre-visualización de Archivo: {pendingBatch.fileName}</h4>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Revisá el resumen de validación sintáctica antes de consultar la base de datos de riesgo.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <CheckCircle className="h-4 w-4" />
                {pendingBatch.validCount} filas válidas
              </span>
              {pendingBatch.errorCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {pendingBatch.errorCount} errores de formato
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
                  0 errores de formato
                </span>
              )}
            </div>
          </div>

          {/* Muestra previa de primeras filas con máscara Zero-Trust */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Muestra de registros detectados (primeras {pendingBatch.previewRows.length} filas):
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-white/10">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">DNI / CUIL (masked)</th>
                    <th className="px-3 py-2">Email (masked)</th>
                    <th className="px-3 py-2">Teléfono (masked)</th>
                    <th className="px-3 py-2">IP (masked)</th>
                    <th className="px-3 py-2">CBU / CVU (masked)</th>
                    <th className="px-3 py-2">Validación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-300 text-[11px]">
                  {pendingBatch.previewRows.map(pr => (
                    <tr key={pr.row} className={pr.isValid ? 'hover:bg-white/[0.02]' : 'bg-rose-950/20'}>
                      <td className="px-3 py-2 text-slate-500 font-bold">{pr.row}</td>
                      <td className="px-3 py-2">{pr.dniMasked}</td>
                      <td className="px-3 py-2">{pr.emailMasked}</td>
                      <td className="px-3 py-2">{pr.phoneMasked}</td>
                      <td className="px-3 py-2 text-cyan-400">{pr.ipMasked}</td>
                      <td className="px-3 py-2 text-cyan-300">{pr.cbuMasked}</td>
                      <td className="px-3 py-2">
                        {pr.isValid ? (
                          <span className="text-emerald-400 font-sans font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Válida
                          </span>
                        ) : (
                          <span className="text-rose-400 font-sans font-bold text-[10px] inline-flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {pr.note}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPendingBatch(null)}
              className="rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700/60 transition"
            >
              Descartar Archivo
            </button>
            <button
              type="button"
              onClick={confirmBatchProcessing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-950/60 active:scale-95 transition"
            >
              <Zap className="h-4 w-4" />
              Confirmar Procesamiento ({pendingBatch.validCount} filas)
            </button>
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3">País Email</th>
                  <th className="px-4 py-3">Antigüedad Dominio</th>
                  <th className="px-4 py-3">Teléfono (masked)</th>
                  <th className="px-4 py-3">IP (masked)</th>
                  <th className="px-4 py-3">CBU / CVU (masked)</th>
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
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {r.emailCountry !== '—' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {r.emailCountry}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.emailAge !== '—' ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.emailMaturity === 'NUEVO'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : r.emailMaturity === 'JOVEN'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {r.emailAge}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{r.phoneMasked}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400/90">{r.ipMasked}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300/90">{r.cbuMasked}</td>
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
            Consulta Unitaria (DNI, Email, Tel, IP, CBU)
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
// ─────────────────────────────────────────────────────────────────
// MÓDULO 2: REPORTE DE FRAUDE (DNI, EMAIL, TEL, IP, CBU)
// ─────────────────────────────────────────────────────────────────

function ReportFraudModule() {
  const { reportFraud, retractFraudReport, activeFintechId, fintechs } = useConsortiumStore();
  
  // Selector de Modo: 'single' (Reporte Unitario) vs 'set' (Reporte de Conjunto / Red)
  const [reportMode, setReportMode] = useState<'single' | 'set'>('single');
  const [primaryType, setPrimaryType] = useState<'DNI' | 'CBU'>('DNI');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Metadatos Bancarios
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [certaintyLevel, setCertaintyLevel] = useState<'CONFIRMED' | 'SUSPECTED'>('CONFIRMED');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [internalTicketId, setInternalTicketId] = useState('');

  // Identificadores
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [cbu, setCbu] = useState('');
  const [device, setDevice] = useState('');
  const [cuit, setCuit] = useState('');
  
  // Tipologías específicas
  const SPECIFIC_CATEGORIES = CATEGORIES.filter(c => c.value !== 'FRAUD_CONFIRMED');
  const [category, setCategory] = useState<IncidentCategory>('MULE_ACCOUNT');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal de confirmación en 2 pasos
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Pantalla de éxito post-reporte
  const [successReport, setSuccessReport] = useState<{
    incidentId: string;
    ticketId?: string;
    timestamp: string;
    category: IncidentCategory;
    summary: string;
  } | null>(null);

  const [retractLoading, setRetractLoading] = useState(false);
  const [retractedDone, setRetractedDone] = useState(false);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // Validaciones en vivo
  const cbuValidation = cbu.trim() ? validateCbuChecksum(cbu.trim()) : null;
  const cuitValidation = cuit.trim() ? validateCuitChecksum(cuit.trim()) : null;
  const dniValidation = dni.trim() ? validateDniFormat(dni.trim()) : null;
  const emailValidation = email.trim() ? validateEmailFormat(email.trim()) : null;
  const phoneValidation = phone.trim() ? validatePhoneFormat(phone.trim()) : null;

  // Paso 1: Validar y abrir modal de previsualización
  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hasAnyIdentifier = Boolean(
      dni.trim() || email.trim() || phone.trim() || ip.trim() || cbu.trim() || device.trim() || cuit.trim()
    );

    if (!hasAnyIdentifier) {
      setError(
        primaryType === 'DNI'
          ? 'Debe ingresar el número de DNI o CUIL a reportar.'
          : 'Debe ingresar la cuenta bancaria CBU o CVU a reportar.'
      );
      return;
    }

    if (cbu.trim() && cbuValidation && !cbuValidation.valid) {
      setError(`Validación de CBU/CVU: ${cbuValidation.reason}`);
      return;
    }

    if (cuit.trim() && cuitValidation && !cuitValidation.valid) {
      setError(`Validación de CUIT/CUIL: ${cuitValidation.reason}`);
      return;
    }

    if (dni.trim() && dniValidation && !dniValidation.valid) {
      setError(`Validación de DNI: ${dniValidation.reason}`);
      return;
    }

    if (email.trim() && emailValidation && !emailValidation.valid) {
      setError(`Validación de Email: ${emailValidation.reason}`);
      return;
    }

    if (phone.trim() && phoneValidation && !phoneValidation.valid) {
      setError(`Validación de Teléfono: ${phoneValidation.reason}`);
      return;
    }

    setConfirmModalOpen(true);
  };

  // Paso 2: Confirmar y persistir reporte en red federal
  const handleConfirmAndSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const generatedIncidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      await reportFraud({
        dni: dni.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        ip: ip.trim() || undefined,
        cbu: cbu.trim() || undefined,
        device: device.trim() || undefined,
        cuit: cuit.trim() || undefined,
        incidentCategory: category,
        internalTicketId: internalTicketId.trim() || undefined,
        incidentId: generatedIncidentId,
        incidentDate,
        certaintyLevel,
        amount: amount.trim() ? parseFloat(amount) : undefined,
        currency,
      });

      const summaryTokens = [
        dni.trim() ? `DNI: ${dni.slice(0, 2)}***${dni.slice(-3)}` : null,
        cbu.trim() ? `CBU: ${cbu.slice(0, 4)}***${cbu.slice(-4)}` : null,
        email.trim() ? `Email: ${email.slice(0, 2)}***@...` : null,
      ].filter(Boolean).join(' · ');

      setSuccessReport({
        incidentId: generatedIncidentId,
        ticketId: internalTicketId.trim() || undefined,
        timestamp: new Date().toISOString(),
        category,
        summary: summaryTokens || 'Identificador tokenizado',
      });

      // Limpiar formulario
      setDni('');
      setEmail('');
      setPhone('');
      setIp('');
      setCbu('');
      setDevice('');
      setCuit('');
      setInternalTicketId('');
      setAmount('');
      setConfirmModalOpen(false);
      setRetractedDone(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el incidente.';
      setError(msg);
      setConfirmModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Rectificación / Retiro voluntario inmediato
  const handleRetractReport = async () => {
    if (!successReport) return;
    if (!confirm('¿Confirma la rectificación y retiro de este reporte? Se asentará en auditoría como rectificado por la entidad emisora.')) return;

    setRetractLoading(true);
    try {
      await retractFraudReport(successReport.incidentId, 'Rectificación inmediata por analista emisor');
      setRetractedDone(true);
    } catch (err) {
      console.error(err);
    } finally {
      setRetractLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Reporte de Fraude y Lista de Riesgo</h3>
              <p className="text-xs text-slate-400">
                Transmisión criptográfica ciega (HMAC-SHA256) preservando el secreto bancario.
              </p>
            </div>
          </div>
        </div>

        {activeFintech && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 self-start sm:self-auto">
            <Building className="h-3.5 w-3.5 text-cyan-400" />
            <span>Entidad: <strong className="text-white font-medium">{activeFintech.name}</strong></span>
          </span>
        )}
      </div>

      {/* Pantalla de Éxito Post-Reporte */}
      {successReport && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-6 space-y-4 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-emerald-200">Incidente Registrado Exitosamente en la Red</h4>
                <p className="text-xs text-emerald-300/80">Código de Incidente: <strong className="font-mono text-white">{successReport.incidentId}</strong></p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {successReport.category}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Datos Transmitidos:</span>
              <p className="text-white font-medium mt-0.5">{successReport.summary}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Ref. / Ticket Interno:</span>
              <p className="text-white font-mono mt-0.5">{successReport.ticketId || 'Sin ticket'}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase">Estado en Red:</span>
              <p className="text-emerald-400 font-bold mt-0.5">{retractedDone ? 'Rectificado / Retirado' : 'Activo en Blacklist'}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
            <p className="text-[11px] text-emerald-300/80">
              ¿Error en la carga? Podés retirar o rectificar el reporte de inmediato.
            </p>
            {!retractedDone ? (
              <button
                type="button"
                onClick={handleRetractReport}
                disabled={retractLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30 transition"
              >
                {retractLoading ? 'Rectificando...' : 'Rectificar / Retirar Reporte'}
              </button>
            ) : (
              <span className="text-xs font-bold text-amber-300">✓ Reporte retirado y anotado en auditoría</span>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleOpenConfirmModal} className="space-y-6">
        {/* 1. Modalidad de Carga */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Modalidad de Carga
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/60 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setReportMode('single')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                reportMode === 'single'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Reporte Unitario</span>
            </button>
            <button
              type="button"
              onClick={() => setReportMode('set')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                reportMode === 'set'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Reporte de Conjunto (Red)</span>
            </button>
          </div>
        </div>

        {/* 2. Identificador Principal (DNI o CBU) y Campo de Ingreso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300">
              Identificador Principal <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => setPrimaryType('DNI')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  primaryType === 'DNI'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                DNI / CUIL
              </button>
              <button
                type="button"
                onClick={() => setPrimaryType('CBU')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  primaryType === 'CBU'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CBU / CVU
              </button>
            </div>
          </div>

          {/* Input Principal */}
          {primaryType === 'DNI' ? (
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="text"
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Ingrese el número de DNI o CUIL (ej: 35123456)"
                  maxLength={11}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-rose-500/70 focus:ring-1 focus:ring-rose-500/30 focus:outline-none font-mono transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-500">
                  {dni.length > 0 ? `${dni.length} dígitos` : '7-11 dígitos'}
                </span>
              </div>
              {dniValidation && (
                <p className={`text-[11px] font-medium ${dniValidation.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {dniValidation.valid ? '✓ DNI con formato numérico correcto' : dniValidation.reason}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="text"
                  value={cbu}
                  onChange={e => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                  placeholder="Ingrese CBU o CVU de 22 dígitos (ej: 0000003100010000000001)"
                  maxLength={22}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-rose-500/70 focus:ring-1 focus:ring-rose-500/30 focus:outline-none font-mono transition"
                />
                <span className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono ${
                  cbu.length === 22 ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {cbu.length} / 22 dígitos
                </span>
              </div>
              {cbuValidation && (
                <p className={`text-[11px] font-medium ${cbuValidation.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {cbuValidation.valid ? '✓ CBU/CVU verificado (Algoritmo Módulo 10 BCRA)' : cbuValidation.reason}
                </p>
              )}
            </div>
          )}

          {/* En modo conjunto, mostrar el segundo identificador */}
          {reportMode === 'set' && (
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {primaryType === 'DNI' ? 'CBU / CVU Vinculado' : 'DNI / CUIL Vinculado'}
              </label>
              {primaryType === 'DNI' ? (
                <input
                  type="text"
                  value={cbu}
                  onChange={e => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                  placeholder="CBU / CVU de 22 dígitos vinculado (opcional)"
                  maxLength={22}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500/70 focus:outline-none font-mono transition"
                />
              ) : (
                <input
                  type="text"
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="DNI o CUIL vinculado (opcional)"
                  maxLength={11}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500/70 focus:outline-none font-mono transition"
                />
              )}
            </div>
          )}
        </div>

        {/* 3. Metadatos Bancarios (Fecha, Certeza, Monto, Ticket) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 rounded-xl bg-slate-950/60 border border-white/5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" /> Fecha del Incidente
            </label>
            <input
              type="date"
              value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Nivel de Certeza
            </label>
            <select
              value={certaintyLevel}
              onChange={e => setCertaintyLevel(e.target.value as any)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none font-semibold"
            >
              <option value="CONFIRMED">🚨 Fraude Confirmado / Judicializado</option>
              <option value="SUSPECTED">⚠️ Sospecha Fundada / En Investigación</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Monto Involucrado
            </label>
            <div className="flex items-center gap-1">
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-xs text-white focus:outline-none"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="ej: 150000"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-indigo-400" /> Ref. / Ticket Interno
            </label>
            <input
              type="text"
              value={internalTicketId}
              onChange={e => setInternalTicketId(e.target.value)}
              placeholder="ej: TCK-2026-9812"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* 4. Tipología del Incidente */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-300">
            Tipología del Incidente <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPECIFIC_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition text-left flex items-center justify-between ${
                  category === cat.value
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-200 shadow-sm'
                    : 'border-white/5 bg-slate-900/50 text-slate-400 hover:border-white/15 hover:text-slate-200'
                }`}
              >
                <span className="truncate">{cat.label}</span>
                {category === cat.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0 ml-1.5" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Jerarquía Visual para Campos Opcionales con Incentivo de Red */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
              <p className="text-xs text-cyan-200">
                <strong>Maximizar Red (+78%):</strong> Incluir Email, Teléfono, IP o Dispositivo permite que el grafo interbancario vincule cómplices y bloquee transferencias trianguladas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOptionalDetails(!showOptionalDetails)}
              className="text-xs font-bold text-cyan-300 hover:text-white underline shrink-0"
            >
              {showOptionalDetails ? 'Ocultar campos' : '+ Agregar campos'}
            </button>
          </div>

          {showOptionalDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ej: sospechoso@email.com"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Teléfono / Celular
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="ej: +5491122334455"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Dirección IP
                </label>
                <input
                  type="text"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  placeholder="ej: 190.191.200.45"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Device Fingerprint ID
                </label>
                <input
                  type="text"
                  value={device}
                  onChange={e => setDevice(e.target.value)}
                  placeholder="ej: dev_7f9c2a..."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Botón Principal (Abre Modal de Previsualización) */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5">
          <p className="text-[11px] text-slate-500">
            Los datos son convertidos a hashes ciegos (HMAC-SHA256 con Pepper KMS) preservando el secreto bancario.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/40 active:scale-95 disabled:opacity-50 transition shrink-0"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Revisar y Registrar Incidente</span>
          </button>
        </div>
      </form>

      {/* ── MODAL DE CONFIRMACIÓN EN 2 PASOS ── */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900 p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <h4 className="text-sm font-bold text-white">Confirmar Transmisión a la Red Federal</h4>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Estás por emitir un reporte de riesgo a nombre de <strong>{activeFintech?.name || 'tu entidad'}</strong>. Este evento impactará en el score comunitario del consorcio bancario.
              </p>

              <div className="rounded-xl bg-slate-950 p-4 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tipología:</span>
                  <span className="font-bold text-rose-300">{SPECIFIC_CATEGORIES.find(c => c.value === category)?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nivel de Certeza:</span>
                  <span className="font-semibold text-white">{certaintyLevel === 'CONFIRMED' ? 'Fraude Confirmado' : 'Sospecha Fundada'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fecha del Incidente:</span>
                  <span className="font-mono text-white">{incidentDate}</span>
                </div>
                {amount && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Monto:</span>
                    <span className="font-mono font-bold text-emerald-400">{currency} {amount}</span>
                  </div>
                )}
                {internalTicketId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ticket Interno:</span>
                    <span className="font-mono text-slate-200">{internalTicketId}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-slate-400">Tokenización:</span>
                  <span className="font-mono text-cyan-400 text-[11px]">HMAC-SHA256 (KMS Pepper)</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Esta acción es auditable e inmutable. Podrás rectificarla o retirarla luego si fue involuntaria.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Volver a Editar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition shadow-lg shadow-rose-950/50"
              >
                {loading ? 'Transmitiendo...' : 'Confirmar y Transmitir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


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
    const csv = `dni,email,phone,ip,cbu,categoria
30111222,estafador@gmail.com,+5491122334455,190.191.200.45,0000003100010000000001,MULE_ACCOUNT
40999888,victima@hotmail.com,,,,0000003100020000000002,IDENTITY_THEFT
,,+5491155667788,,,PHISHING
20123456789,otro@empresa.com,,200.45.12.89,,SUSPICIOUS
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
        <p className="text-slate-400">dni,email,phone,ip,cbu,categoria</p>
        <p className="text-slate-600">30111222,estafador@gmail.com,+54911...,190.191.200.45,0000003100010000000001,MULE_ACCOUNT</p>
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
  FRAUD_CONFIRMED: { label: 'Fraude Confirmado', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  MULE_ACCOUNT: { label: 'Cuenta Mula', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  ACCOUNT_TAKEOVER: { label: 'Account Takeover', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  IDENTITY_THEFT: { label: 'Robo de Identidad', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  CHARGEBACK: { label: 'Contracargo Comercial', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  PHISHING: { label: 'Phishing Bancario', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  SUSPICIOUS: { label: 'Actividad Sospechosa', color: 'bg-slate-700/60 text-slate-300 border-slate-600' },
};

function formatZeroTrustToken(edge?: { sourceHash?: string; targetHash?: string; id?: string; uploadedFields?: string } | null): string {
  if (!edge) return 'tok_blind_hash';
  if (edge.sourceHash && edge.targetHash && edge.sourceHash !== edge.targetHash) {
    return `tok_${edge.sourceHash.slice(0, 10)}... ↔ tok_${edge.targetHash.slice(0, 10)}...`;
  }
  if (edge.sourceHash) {
    return `tok_${edge.sourceHash.slice(0, 16)}...${edge.sourceHash.slice(-6)}`;
  }
  if (edge.targetHash) {
    return `tok_${edge.targetHash.slice(0, 16)}...${edge.targetHash.slice(-6)}`;
  }
  if (edge.id) {
    const clean = edge.id.replace(/[^a-zA-Z0-9]/g, '');
    return `tok_${clean.slice(0, 18)}...`;
  }
  return 'tok_blind_hash';
}

function ReportHistoryModule() {
  const { graphEdges, markFalsePositive, activeFintechId, fintechs } = useConsortiumStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  
  // Paginación
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal de revocación (Falso Positivo)
  const [revocationTarget, setRevocationTarget] = useState<any | null>(null);
  const [revocationReason, setRevocationReason] = useState<string>('');
  const [revocationError, setRevocationError] = useState<string>('');

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // 1. Filtrar estricta y únicamente los reportes de la propia entidad del usuario logueado
  const entityEdges = graphEdges.filter(e => e.reportedByEntityId === activeFintechId);

  // 2. Aplicar panel de filtros
  const filteredEdges = entityEdges
    .filter(e => {
      // Filtro texto libre
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cat = (e.incidentCategory || '').toLowerCase();
        const catLabel = (CATEGORY_TRANSLATIONS[e.incidentCategory]?.label || '').toLowerCase();
        const fields = (e.uploadedFields || '').toLowerCase();
        const ticket = (e.internalTicketId || '').toLowerCase();
        const incId = (e.incidentId || '').toLowerCase();
        const matches = cat.includes(term) || catLabel.includes(term) || fields.includes(term) || ticket.includes(term) || incId.includes(term);
        if (!matches) return false;
      }

      // Filtro Categoría
      if (categoryFilter !== 'ALL' && e.incidentCategory !== categoryFilter) {
        return false;
      }

      // Filtro Estado
      if (statusFilter === 'ACTIVE' && e.isFalsePositive) return false;
      if (statusFilter === 'REVOKED' && !e.isFalsePositive) return false;

      // Filtro Rango de Fechas
      if (dateFrom) {
        const dFrom = new Date(dateFrom + 'T00:00:00');
        if (new Date(e.timestamp) < dFrom) return false;
      }
      if (dateTo) {
        const dTo = new Date(dateTo + 'T23:59:59');
        if (new Date(e.timestamp) > dTo) return false;
      }

      return true;
    })
    .slice()
    .reverse();

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, dateFrom, dateTo, pageSize]);

  // Cálculos de paginación
  const totalItems = filteredEdges.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedEdges = filteredEdges.slice(startIndex, startIndex + pageSize);

  // Exportar a CSV (estrictamente tokenizado)
  const exportTokenizedCSV = () => {
    if (!filteredEdges.length) return;
    const headers = [
      'ID_Registro',
      'Identificadores_Tokenizados',
      'Ticket_Interno',
      'Incident_ID',
      'Canal_Carga',
      'Categoria_Fraude',
      'Fecha_Hora',
      'Estado_Red',
      'Motivo_Revocacion',
    ];

    const rows = filteredEdges.map((e, idx) => [
      `REP-${String(filteredEdges.length - idx).padStart(3, '0')}`,
      `"${formatZeroTrustToken(e)}"`,
      `"${(e.internalTicketId || '—').replace(/"/g, '""')}"`,
      `"${(e.incidentId || '—').replace(/"/g, '""')}"`,
      e.uploadMethod === 'CSV_BULK' ? 'Carga Masiva CSV' : 'Carga Unitaria',
      `"${CATEGORY_TRANSLATIONS[e.incidentCategory]?.label || e.incidentCategory}"`,
      `"${new Date(e.timestamp).toISOString()}"`,
      e.isFalsePositive ? 'FALSO POSITIVO (Revertido)' : 'ACTIVO EN RED',
      `"${(e.revocationReason || '—').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_auditoria_tokenizado_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenRevocation = (edge: any) => {
    setRevocationTarget(edge);
    setRevocationReason('');
    setRevocationError('');
  };

  const handleConfirmRevocation = () => {
    if (!revocationReason.trim() || revocationReason.trim().length < 5) {
      setRevocationError('El motivo de revocación es obligatorio para registrar en la auditoría (mínimo 5 caracteres).');
      return;
    }
    if (revocationTarget) {
      markFalsePositive(revocationTarget.id, revocationReason.trim());
      setRevocationTarget(null);
      setRevocationReason('');
    }
  };

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      {/* Header con título privado de la entidad y botón Exportar CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Historial y Auditoría de Incidentes</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro privado y exclusivo de los incidentes gestionados por <strong className="text-slate-200">{activeFintech?.name || 'tu entidad'}</strong>. Datos personales enmascarados bajo estándar Zero-Trust.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeFintech && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 px-3 py-1.5 text-xs font-bold text-cyan-300 shadow-sm">
              <Building className="h-3.5 w-3.5" />
              <span>{activeFintech.name}</span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}

          <button
            type="button"
            onClick={exportTokenizedCSV}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 active:scale-95 transition shadow-md"
            title="Exportar todos los reportes filtrados en formato CSV tokenizado"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar a CSV</span>
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS */}
      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-cyan-400" />
            Filtros de Auditoría
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-cyan-400 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Búsqueda libre */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="DNI, ticket, tipología..."
                className="w-full rounded-lg border border-white/10 bg-slate-900 pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Dropdown Categoría de Fraude */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Categoría de Fraude</label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">Todas las categorías</option>
              {Object.entries(CATEGORY_TRANSLATIONS).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Rango de Fechas (Desde / Hasta) */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Rango de Fechas</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-1/2 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                title="Fecha desde"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-1/2 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                title="Fecha hasta"
              />
            </div>
          </div>

          {/* Dropdown Estado */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Estado en Red</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activo en Red</option>
              <option value="REVOKED">Falso Positivo (Revertido)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contador de registros */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>
          Mostrando <strong className="text-white">{filteredEdges.length}</strong> incidente(s) de <strong className="text-cyan-400">{entityEdges.length}</strong> totales
        </span>
        <div className="flex items-center gap-2">
          <span>Filas por página:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {filteredEdges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/30 py-12 text-center space-y-2">
          <Shield className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-400">No se encontraron reportes con los filtros seleccionados.</p>
          <p className="text-xs text-slate-500">
            Ajustá los filtros o ingresá un nuevo incidente desde el formulario.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 shadow-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 border-b border-white/10 text-[11px] uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3"># Registro</th>
                <th className="px-4 py-3">Identificador Criptográfico (Zero-Trust)</th>
                <th className="px-4 py-3">Ref. Interna / Incidente</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Tipología</th>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3 text-center">Estado de Red</th>
                <th className="px-4 py-3 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {paginatedEdges.map((edge, idx) => {
                const catConfig = CATEGORY_TRANSLATIONS[edge.incidentCategory] || {
                  label: edge.incidentCategory,
                  color: 'bg-slate-800 text-slate-300 border-slate-700',
                };

                return (
                  <tr
                    key={edge.id}
                    className={
                      edge.isFalsePositive
                        ? 'opacity-50 bg-amber-950/10'
                        : 'bg-cyan-950/10 hover:bg-cyan-950/20 transition'
                    }
                  >
                    {/* ID Registro */}
                    <td className="px-4 py-3 font-mono text-slate-400 font-bold whitespace-nowrap">
                      REP-{String(filteredEdges.length - (startIndex + idx)).padStart(3, '0')}
                    </td>

                    {/* Token Criptográfico (Estrictamente Zero-Trust) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-xs text-cyan-300 font-semibold tracking-wider">
                          {formatZeroTrustToken(edge)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block pl-5 mt-0.5 font-mono">
                        Hash Ciego SHA-256 + Salt Federal (Token Irreversible Zero-Trust)
                      </span>
                    </td>

                    {/* Referencia Interna / ID Incidente */}
                    <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                      {edge.internalTicketId ? (
                        <span className="inline-flex items-center gap-1 text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 font-semibold">
                          #{edge.internalTicketId}
                        </span>
                      ) : edge.incidentId ? (
                        <span className="text-slate-400 text-[10px]">{edge.incidentId}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Canal de Carga */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {edge.uploadMethod === 'CSV_BULK' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          <FileSpreadsheet className="h-3 w-3" /> Masivo CSV
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <Upload className="h-3 w-3" /> Unitaria
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
                          FALSO POSITIVO
                        </span>
                      ) : (
                        <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                          ACTIVO EN RED
                        </span>
                      )}
                    </td>

                    {/* Gestión con menú de 3 puntos (⋮) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {!edge.isFalsePositive ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRevocation(edge)}
                          className="p-1.5 rounded-lg border border-white/10 hover:border-amber-400/50 bg-slate-900/60 hover:bg-amber-950/30 text-slate-400 hover:text-amber-300 transition active:scale-95"
                          title="Opciones de registro / Revocar como Falso Positivo"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      ) : (
                        <span
                          className="text-[11px] text-slate-500 italic cursor-help"
                          title={edge.revocationReason ? `Motivo: ${edge.revocationReason}` : 'Reporte revocado'}
                        >
                          Revocado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTROLES DE PAGINACIÓN */}
      {filteredEdges.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs">
          <span className="text-slate-400">
            Mostrando página <strong className="text-white">{safePage}</strong> de <strong className="text-white">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>

            <span className="px-2 font-mono text-cyan-400 font-bold">
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REVOCACIÓN (FALSO POSITIVO) CON MOTIVO OBLIGATORIO */}
      {revocationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Revocar Incidente (Falso Positivo)</h4>
                <p className="text-xs text-slate-400">Esta acción revertirá el impacto del reporte en el score de red.</p>
              </div>
            </div>

            <div className="rounded-xl bg-black/40 p-3 border border-white/5 space-y-1 text-xs font-mono">
              <p className="text-slate-400">
                <span className="text-slate-500">Registro:</span> REP-{revocationTarget.id.slice(0, 8)}
              </p>
              <p className="text-slate-400">
                <span className="text-slate-500">Token Irreversible:</span> <span className="font-mono text-cyan-300 font-semibold">{formatZeroTrustToken(revocationTarget)}</span>
              </p>
              <p className="text-slate-400">
                <span className="text-slate-500">Tipología:</span> {CATEGORY_TRANSLATIONS[revocationTarget.incidentCategory]?.label || revocationTarget.incidentCategory}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                Motivo de revocación <span className="text-rose-400">* (Obligatorio para auditoría regulatoria)</span>
              </label>
              <textarea
                value={revocationReason}
                onChange={e => {
                  setRevocationReason(e.target.value);
                  setRevocationError('');
                }}
                rows={3}
                placeholder="Describí por qué este reporte fue clasificado como falso positivo (ej. Titular acreditó titularidad legítima con DNI físico / Error de digitación)..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {revocationError && (
                <p className="text-rose-400 text-[11px] font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {revocationError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevocationTarget(null)}
                className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevocation}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 px-4 py-2 text-xs font-bold text-white hover:from-amber-400 hover:to-rose-500 transition shadow-lg shadow-amber-950/50"
              >
                Confirmar Revocación
              </button>
            </div>
          </div>
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
  const { initSeedData, seedReady } = useConsortiumStore();

  useEffect(() => {
    if (!seedReady) {
      initSeedData();
    }
  }, [initSeedData, seedReady]);

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
