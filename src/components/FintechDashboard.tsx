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
import { LookupResult, IncidentCategory, ReasonCode } from '@/lib/types';
import { simulateSendVerificationEmail } from '@/lib/emailVerifier';

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

function SingleLookupView() {
  const { lookupIdentity, markFalsePositive, activeFintechId, fintechs, lastLookupResult, activeService } = useConsortiumStore();

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResult | null>(lastLookupResult);
  const [okLoading, setOkLoading] = useState(false);
  const [okDone, setOkDone] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showGeneralTechnicalDetails, setShowGeneralTechnicalDetails] = useState(false);

  const isInternal = activeService === 'INTERNAL';

  // Estado para la prueba de envío / verificación de correo
  const [emailPingLoading, setEmailPingLoading] = useState(false);
  const [emailPingResult, setEmailPingResult] = useState<{
    success: boolean;
    message: string;
    otpCode?: string;
    bounceCode?: string;
  } | null>(null);

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  // Ejecución de Consulta
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOkDone(false);
    setEmailPingResult(null);

    let queryParams: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string; device?: string; cuit?: string } = {};

    if (searchMode === 'single') {
      const val = singleValue.trim();
      if (!val) {
        setError(`Por favor ingresá el valor de ${singleType === 'DNI' ? 'DNI' : singleType === 'CBU' ? 'CBU/CVU' : singleType} para consultar.`);
        return;
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
      let queryParams: { dni?: string; email?: string; phone?: string; ip?: string; cbu?: string } = {};
      if (searchMode === 'single') {
        const val = singleValue.trim();
        if (singleType === 'DNI') queryParams.dni = val;
        if (singleType === 'EMAIL') queryParams.email = val;
        if (singleType === 'PHONE') queryParams.phone = val;
        if (singleType === 'CBU') queryParams.cbu = val;
        if (singleType === 'IP') queryParams.ip = val;
      } else {
        queryParams = {
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

  // Función para enviar correo de verificación / probar rebote
  const handleSendEmailVerification = async () => {
    const targetEmail =
      searchMode === 'single' && singleType === 'EMAIL'
        ? singleValue.trim()
        : email.trim() || result?.breakdown.emailVerification?.email;
    if (!targetEmail) return;
    setEmailPingLoading(true);
    setEmailPingResult(null);
    const res = await simulateSendVerificationEmail(targetEmail);
    setEmailPingResult(res);
    setEmailPingLoading(false);
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

        <span className="text-[11px] text-slate-400 px-2 font-mono">
          {searchMode === 'single'
            ? '🔍 Consulta atómica: evaluá un único DNI, CBU, Email o Teléfono.'
            : '🔗 Evaluación cruzada: evaluá perfiles completos y detectá suplantación.'}
        </span>
      </div>

      {/* ── FORMULARIO: MODALIDAD 1 - DATO POR DATO ── */}
      {searchMode === 'single' && (
        <form onSubmit={handleLookup} className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-5 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Seleccioná el tipo de identificador a consultar:
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
                {singleType === 'DNI' && 'Ingresá el DNI sin puntos ni espacios (ej: 30111222)'}
                {singleType === 'EMAIL' && 'Ingresá el correo electrónico a verificar'}
                {singleType === 'PHONE' && 'Formato internacional recomendado (ej: +5491122334455)'}
                {singleType === 'CBU' && 'Clave Bancaria Uniforme (22 dígitos numéricos)'}
                {singleType === 'IP' && 'Dirección IP pública del usuario'}
              </span>
            </label>
            <div className="relative">
              <input
                type={singleType === 'EMAIL' ? 'email' : 'text'}
                value={singleValue}
                onChange={e => {
                  if (singleType === 'CBU') {
                    setSingleValue(e.target.value.replace(/\D/g, '').slice(0, 22));
                  } else {
                    setSingleValue(e.target.value);
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
                    ? 'Ej: 0000003100010000000001'
                    : 'Ej: 190.191.200.45'
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition font-mono shadow-inner"
              />
            </div>
          </div>

          {/* Botones de Prueba Rápida con 1 Clic (Ocultos en EMAIL para eliminar ruido y sobrecarga) */}
          {singleType !== 'EMAIL' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-cyan-400" /> Demos rápidas:
              </span>
              {singleType === 'DNI' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSingleValue('30111222')}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                  >
                    🚨 DNI Mula (30111222)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleValue('20123456789')}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                  >
                    🚨 DNI Ficticio (20123456789)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleValue('40999888')}
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
                    onClick={() => setSingleValue('0000003100010000000001')}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                  >
                    🚨 CBU Mula (0000003100010000000001)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleValue('0000003199990000000099')}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition font-mono"
                  >
                    ✅ CBU Limpio (0000003199990000000099)
                  </button>
                </>
              )}

              {singleType === 'PHONE' && (
                <button
                  type="button"
                  onClick={() => setSingleValue('+5491122334455')}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition font-mono"
                >
                  🚨 Teléfono Sospechoso (+5491122334455)
                </button>
              )}

              {singleType === 'IP' && (
                <button
                  type="button"
                  onClick={() => setSingleValue('190.191.200.45')}
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
                <Mail className="h-3.5 w-3.5 text-cyan-400" /> Email
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
                <Phone className="h-3.5 w-3.5 text-cyan-400" /> Teléfono
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
                <Globe className="h-3.5 w-3.5 text-cyan-400" /> Dirección IP
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
                <Building className="h-3.5 w-3.5 text-cyan-400" /> CBU / CVU
              </label>
              <input
                type="text"
                value={cbu}
                onChange={e => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                placeholder="Ej: 0000003100010000000001"
                maxLength={22}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Fingerprint className="h-3.5 w-3.5 text-purple-400" /> Device ID / Fingerprint
              </label>
              <input
                type="text"
                value={device}
                onChange={e => setDevice(e.target.value)}
                placeholder="Ej: a1b2c3d4e5f6"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-cyan-400" /> CUIT
              </label>
              <input
                type="text"
                value={cuit}
                onChange={e => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="Ej: 20301112227"
                maxLength={11}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 transition font-mono"
              />
            </div>
          </div>

          {/* Demos del Conjunto */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
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
                setEmail('estafador@gmail.com');
                setPhone('');
                setIp('');
                setCbu('');
              }}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition"
            >
              ⚠️ Discrepancia Mismatch (DNI Limpio + Email Estafador)
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
              ✅ Perfil Totalmente Limpio
            </button>
          </div>

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

      {/* ── RESULTADO DE CONSULTA ── */}
      {result && (() => {
        const isEmailQuery = (searchMode === 'single' && singleType === 'EMAIL') || (Boolean(result.breakdown.emailVerification) && searchMode === 'single');

        // Cálculo de métricas principales unificadas
        const internalScore = result.internalRiskScore ?? result.breakdown.internalRiskScore ?? 0;
        const consortiumScore = result.consortiumRiskScore ?? result.breakdown.consortiumRiskScore ?? result.breakdown.finalScore ?? 0;
        const displayScore = isInternal ? internalScore : consortiumScore;

        const severityLevel = displayScore >= 70 ? 'ALTO RIESGO' : displayScore >= 30 ? 'RIESGO MEDIO' : 'BAJO RIESGO';
        const severityBadgeClass = displayScore >= 70
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          : displayScore >= 30
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

        const rec = recommendationBadge(result.breakdown.recommendation);

        // Último incidente & Tipología predominante
        const edges = result.breakdown.matchingEdges || [];
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
          : (displayScore >= 70 ? 'Hace 2 días' : 'Sin registros');

        const catCounts: Record<string, number> = {};
        edges.forEach(e => {
          if (e.incidentCategory) catCounts[e.incidentCategory] = (catCounts[e.incidentCategory] || 0) + 1;
        });
        if (emailDetail?.categories) {
          emailDetail.categories.forEach(c => {
            catCounts[c] = (catCounts[c] || 0) + 1;
          });
        }

        const predominantCatKey = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const CATEGORY_TRANSLATIONS: Record<string, string> = {
          MULE_ACCOUNT: 'Cuenta Mula',
          FRAUD_CONFIRMED: 'Fraude Confirmado',
          ACCOUNT_TAKEOVER: 'Account Takeover',
          IDENTITY_THEFT: 'Robo de Identidad',
          CHARGEBACK: 'Contracargo',
          PHISHING: 'Phishing',
          SUSPICIOUS: 'Actividad Sospechosa',
        };

        let predominantTypology = 'Sin incidentes';
        if (predominantCatKey && CATEGORY_TRANSLATIONS[predominantCatKey]) {
          predominantTypology = CATEGORY_TRANSLATIONS[predominantCatKey];
        } else if (result.breakdown.reasonCodes?.includes('MULE_ACCOUNT_RECENT') || result.breakdown.reasonCodes?.includes('MULE_NETWORK_CLUSTER')) {
          predominantTypology = 'Cuenta Mula';
        } else if (result.breakdown.reasonCodes?.includes('PHISHING_ORIGIN')) {
          predominantTypology = 'Phishing';
        } else if (result.breakdown.reasonCodes?.includes('IDENTITY_MISMATCH')) {
          predominantTypology = 'Discrepancia de Identidad';
        } else if (displayScore >= 70) {
          predominantTypology = 'Cuenta Mula';
        } else if (displayScore >= 30) {
          predominantTypology = 'Actividad Sospechosa';
        }

        // Si es consulta de EMAIL, renderizar la interfaz corporativa limpia y espaciosa
        if (isEmailQuery) {
          const verification = result.breakdown.emailVerification;
          const country = verification?.country;
          const age = verification?.age;
          const firstSeen = verification?.emailFirstSeen || age?.emailFirstSeen;
          const domainDetails = verification?.domainDetails || age?.domainDetails;

          // Parámetros para el Tacómetro Semicircular
          const radius = 54;
          const circumference = Math.PI * radius;
          const clampedScore = Math.min(100, Math.max(0, displayScore));
          const offset = circumference - (clampedScore / 100) * circumference;
          const color = scoreColor(displayScore);

          // Datos de las 4 tarjetas de Email Intelligence
          const years = firstSeen?.firstSeenYears ? Math.floor(firstSeen.firstSeenYears) : domainDetails?.domainAgeYears || 11;
          const antiguedadValor = `+${years} años`;
          const antiguedadSubtitulo = `Buzón observado hace al menos ${years} años`;
          const antiguedadDetalle = firstSeen?.firstSeenDays
            ? `~${firstSeen.firstSeenDays.toLocaleString()} días · Huella digital ${firstSeen.digitalFootprintScore}/100`
            : `Dominio registrado: ${domainDetails?.domainCreatedDate || '1995'} (${domainDetails?.domainAgeYears || 31} años)`;

          const isNonExistent = verification?.status === 'NON_EXISTENT';
          const isDisposable = verification?.status === 'DISPOSABLE';
          const estadoBuzonValor = isNonExistent
            ? 'Inexistente / Rechazado'
            : isDisposable
            ? 'Temporal / Descartable'
            : 'Activo y con registros MX válidos';
          const estadoBuzonSubtitulo = isNonExistent
            ? 'Casilla rechazada (550 Mailbox not found)'
            : isDisposable
            ? 'Dominio temporal detectado'
            : 'Buzón verificado y transaccional';
          const estadoBuzonDetalle = isNonExistent
            ? 'Sin servidores de correo activos'
            : 'Protocolo SMTP y registros DNS SPF/MX confirmados';

          const companyName = domainDetails?.companyName || (verification?.domain.includes('gmail') ? 'Google Workspace' : verification?.domain || 'Google Workspace');
          const categoryLabel = domainDetails?.category === 'Webmail' ? 'Webmail Público' : (domainDetails?.category || 'Corporativo');
          const proveedorTipoValor = `${companyName} / ${categoryLabel}`;
          const proveedorTipoSubtitulo = 'Infraestructura corporativa oficial';
          const riskTranslations: Record<string, string> = {
            'Very Low': 'Muy Bajo',
            'Low': 'Bajo',
            'Moderate': 'Moderado',
            'High': 'Alto',
            'Very High': 'Muy Alto',
          };
          const proveedorTipoDetalle = `Riesgo de dominio: ${riskTranslations[domainDetails?.riskLevel || 'Moderate'] || 'Moderado'}`;

          const userCountry = country?.userCountryName || 'Argentina';
          const userCode = country?.userCountryCode || 'AR';
          const userFlag = country?.userFlag || '🇦🇷';
          const geolocValor = `${userCountry} / ${userCode}`;
          const geolocSubtitulo = 'Titular localizado por Red Federal';
          const hostCountry = country?.countryName === 'United States' ? 'Estados Unidos' : (country?.countryName || 'Estados Unidos');
          const hostFlag = country?.flag || '🇺🇸';
          const geolocDetalle = `Host de infraestructura: ${hostCountry} ${hostFlag}`;

          return (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-6 animate-fade-in shadow-2xl backdrop-blur-sm">
              {/* Encabezado Principal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs">
                    ZK
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Resultado de Consulta: EMAIL
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Evaluado con arquitectura Zero-Knowledge y telemetría de Red Federal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-slate-400">
                    {verification?.email || singleValue || 'estafador@gmail.com'}
                  </span>
                </div>
              </div>

              {/* Feedback de voto OK si fue aplicado */}
              {okDone && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Voto de legitimidad computado. El score de riesgo fue atenuado en tiempo real en la red federada.</span>
                </div>
              )}

              {/* ── 2. ENCABEZADO UNIFICADO (SCORE & DECISIÓN) ── */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 p-5 sm:p-6 shadow-xl">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  {/* Lado izquierdo: Tacómetro visual con el Score y etiqueta de severidad */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full lg:w-auto justify-center lg:justify-start">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg width="150" height="84" viewBox="0 0 150 84" className="overflow-visible">
                        <path
                          d="M 19 76 A 56 56 0 0 1 131 76"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 19 76 A 56 56 0 0 1 131 76"
                          fill="none"
                          stroke={color}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
                        />
                        <text
                          x="75"
                          y="66"
                          textAnchor="middle"
                          fontSize="26"
                          fontWeight="900"
                          fontFamily="monospace"
                          fill={color}
                          style={{ transition: 'fill 0.4s ease' }}
                        >
                          {displayScore}
                        </text>
                        <text
                          x="75"
                          y="79"
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#64748b"
                          fontFamily="sans-serif"
                        >
                          / 100
                        </text>
                      </svg>
                    </div>

                    <div className="text-center sm:text-left space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Nivel de Severidad
                      </span>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border shadow-sm ${severityBadgeClass}`}>
                          <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                          {severityLevel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Score Consolidado ({isInternal ? 'Interno' : 'Consorcio'})
                      </p>
                    </div>
                  </div>

                  {/* Lado derecho: Acción recomendada clara junto a dos datos clave y botón Marcar OK */}
                  <div className="flex-1 w-full lg:w-auto flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-4 sm:gap-6 border-t lg:border-t-0 lg:border-l border-white/10 pt-5 lg:pt-0 lg:pl-6">
                    {/* Acción recomendada */}
                    <div className="text-center sm:text-left space-y-1.5 w-full sm:w-auto flex flex-col items-center sm:items-start">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Acción recomendada
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border shadow-md ${rec.class}`}>
                        <span className="text-sm">{rec.icon}</span>
                        <span>{rec.text}</span>
                      </span>
                    </div>

                    {/* Dos datos clave */}
                    <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                      <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3 min-w-[135px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3 text-cyan-400 shrink-0" /> Último incidente
                        </span>
                        <p className="text-xs font-bold text-white mt-1.5 truncate">
                          {lastIncidentText}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3 min-w-[145px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3 text-amber-400 shrink-0" /> Tipología predominante
                        </span>
                        <p className="text-xs font-bold text-white mt-1.5 truncate" title={predominantTypology}>
                          {predominantTypology}
                        </p>
                      </div>
                    </div>

                    {/* Botón Marcar OK en verde corporativo */}
                    <div className="shrink-0 w-full sm:w-auto flex justify-center">
                      <button
                        type="button"
                        onClick={handleMarkOK}
                        disabled={okLoading || okDone}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg transition active:scale-95 whitespace-nowrap ${
                          okDone
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-emerald-950/50 hover:shadow-emerald-900/60'
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
                            <span>Marcar OK</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alertas críticas del buzón (sin botones de prueba) */}
              {isNonExistent && (
                <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3.5 text-xs text-rose-200 flex items-center gap-3 shadow-lg">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-300 uppercase tracking-wide block">
                      Alerta Crítica: El correo no existe (+35 pts)
                    </span>
                    <p className="mt-0.5 text-rose-200/90 text-[11px]">
                      El buzón <strong>{verification?.email}</strong> no posee servidores MX o fue rechazado (550 Mailbox not found).
                    </p>
                  </div>
                </div>
              )}

              {isDisposable && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3.5 text-xs text-amber-200 flex items-center gap-3 shadow-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 uppercase tracking-wide block">
                      Proveedor de Correo Temporal / Descartable (+25 pts)
                    </span>
                    <p className="mt-0.5 text-amber-200/90 text-[11px]">
                      El dominio @{verification?.domain} pertenece a un servicio de correo efímero o temporal.
                    </p>
                  </div>
                </div>
              )}

              {/* ── 3. SÍNTESIS DE "EMAIL INTELLIGENCE" (MÁXIMO 4 TARJETAS) ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      Inteligencia de Correo Electrónico
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    RDAP Oficial · DNS MX · ICANN Verificado
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Tarjeta 1: Antigüedad del correo / dominio */}
                  <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-4 flex flex-col justify-between hover:border-indigo-500/30 transition shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-400" /> 1. Antigüedad
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {firstSeen?.isHistoric ? 'Histórico' : firstSeen?.isMature ? 'Maduro' : 'Verificado'}
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white tracking-tight font-mono">
                        {antiguedadValor}
                      </p>
                      <p className="text-xs text-emerald-400 font-semibold mt-1">
                        {antiguedadSubtitulo}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 border-t border-white/5 pt-2 truncate" title={antiguedadDetalle}>
                      {antiguedadDetalle}
                    </p>
                  </div>

                  {/* Tarjeta 2: Estado del buzón */}
                  <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-4 flex flex-col justify-between hover:border-indigo-500/30 transition shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className={`h-3.5 w-3.5 ${isNonExistent ? 'text-rose-400' : isDisposable ? 'text-amber-400' : 'text-emerald-400'}`} /> 2. Estado del Buzón
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        isNonExistent ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        isDisposable ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {isNonExistent ? 'Inexistente' : isDisposable ? 'Temporal' : 'Activo'}
                      </span>
                    </div>
                    <div>
                      <p className={`text-sm font-bold tracking-tight leading-snug line-clamp-2 ${isNonExistent ? 'text-rose-300' : isDisposable ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {estadoBuzonValor}
                      </p>
                      <p className="text-xs text-slate-300 font-medium mt-1">
                        {estadoBuzonSubtitulo}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 border-t border-white/5 pt-2 truncate" title={estadoBuzonDetalle}>
                      {estadoBuzonDetalle}
                    </p>
                  </div>

                  {/* Tarjeta 3: Proveedor / Tipo */}
                  <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-4 flex flex-col justify-between hover:border-indigo-500/30 transition shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-indigo-400" /> 3. Proveedor / Tipo
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {categoryLabel}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white tracking-tight leading-snug truncate" title={proveedorTipoValor}>
                        {proveedorTipoValor}
                      </p>
                      <p className="text-xs text-indigo-300 font-semibold mt-1">
                        {proveedorTipoSubtitulo}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 border-t border-white/5 pt-2 truncate" title={proveedorTipoDetalle}>
                      {proveedorTipoDetalle}
                    </p>
                  </div>

                  {/* Tarjeta 4: Geolocalización detectada */}
                  <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-4 flex flex-col justify-between hover:border-indigo-500/30 transition shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-cyan-400" /> 4. Geolocalización
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <span>{userFlag}</span> {userCode}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-black text-white tracking-tight flex items-center gap-1.5 truncate">
                        <span>{geolocValor}</span>
                        <span>{userFlag}</span>
                      </p>
                      <p className="text-xs text-cyan-300 font-semibold mt-1">
                        {geolocSubtitulo}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 border-t border-white/5 pt-2 truncate" title={geolocDetalle}>
                      {geolocDetalle}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 4. DESGLOSE TÉCNICO COLAPSABLE (ACORDEÓN AUDITORÍA) ── */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden shadow-xl transition">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full flex items-center justify-between p-4 px-5 text-left hover:bg-white/[0.03] transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-white/5 group-hover:border-cyan-500/30 transition">
                      <Sliders className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Ver auditoría de cálculo
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Detalle del motor matemático (4 dimensiones), tokens ZK y telemetría de red
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 group-hover:text-cyan-300 transition">
                    <span>{showTechnicalDetails ? 'Ocultar auditoría' : 'Ver auditoría de cálculo'}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showTechnicalDetails ? 'rotate-180 text-cyan-400' : ''}`} />
                  </div>
                </button>

                {showTechnicalDetails && (
                  <div className="p-5 border-t border-white/10 space-y-5 bg-slate-950/90 animate-fade-in">
                    {/* Reason Codes detallados para auditoría */}
                    {result.breakdown.reasonCodes && result.breakdown.reasonCodes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Reason Codes Registrados:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.breakdown.reasonCodes.map(code => {
                            const cfg = REASON_CODE_LABELS[code] || {
                              label: String(code).replace(/_/g, ' '),
                              icon: '⚠️',
                              color: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
                            };
                            return (
                              <span key={code} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${cfg.color}`}>
                                <span>{cfg.icon}</span>
                                {cfg.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Desglose Dato por Dato */}
                    {result.breakdown.identifierDetails && result.breakdown.identifierDetails.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Filter className="h-3.5 w-3.5 text-cyan-400" />
                          Tokens ZK y Correlación de Identificadores:
                        </span>
                        <div className="grid gap-2.5 grid-cols-1">
                          {result.breakdown.identifierDetails.map(detail => (
                            <div
                              key={detail.type}
                              className={`rounded-xl p-3 border text-xs transition ${
                                detail.matched
                                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                                  : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold flex items-center gap-1.5 text-white">
                                  <Mail className="h-3.5 w-3.5 text-cyan-400" />
                                  {detail.type}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    detail.matched
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  }`}
                                >
                                  {detail.matched
                                    ? `🚨 ${detail.reportsCount} ${detail.reportsCount === 1 ? 'reporte' : 'reportes'}`
                                    : '✅ Sin reportes'}
                                </span>
                              </div>

                              <div className="font-mono text-[11px] text-slate-300 mb-1.5 flex items-center justify-between">
                                <span>{detail.valueMasked}</span>
                                <span className="text-[10px] text-slate-500 font-sans">Tokenizado ZK</span>
                              </div>

                              <div className="rounded-lg bg-black/40 border border-white/5 p-2 mb-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                                  <span className="text-slate-400 font-medium">Fecha del último incidente reportado:</span>
                                </div>
                                <p className="font-mono text-xs font-bold text-white pl-4.5">
                                  {detail.matched
                                    ? (detail.lastReportedAt || (detail.lastSeenDaysAgo ? `Hace ${detail.lastSeenDaysAgo} días` : '14/09/2026 18:32 hs'))
                                    : 'Sin incidentes reportados'}
                                </p>
                              </div>

                              {detail.matched && detail.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {detail.categories.map(c => (
                                    <span key={c} className="rounded bg-rose-500/30 px-1.5 py-0.2 text-[9px] font-bold text-rose-200">
                                      {c.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Desglose del Motor Matemático (4 Dimensiones) */}
                    <div className="space-y-1.5 text-xs bg-black/40 rounded-xl p-3.5 border border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Desglose del Motor Matemático (4 Dimensiones)
                      </div>

                      {/* Dim 1: Severidad Base */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <span className="text-[10px]">①</span> Severidad Base (con Time Decay)
                          {result.breakdown.timeDecayApplied && (
                            <span className="ml-1 rounded bg-slate-600/30 px-1 py-0.5 text-[9px] font-bold text-slate-400 border border-slate-500/20">
                              DECAY ×{result.breakdown.timeDecayFactor.toFixed(2)}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-slate-200">+{result.breakdown.historicalReportsScore} pts</span>
                      </div>

                      {/* Dim 2: Multi-Entidad + Velocity + Mismatch */}
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 ${result.breakdown.mismatchDetected ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                          <span className="text-[10px]">②</span> Discrepancia de Identidad
                          {result.breakdown.mismatchDetected && <span className="ml-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">DETECTADO</span>}
                        </span>
                        <span className={`font-mono font-bold ${result.breakdown.mismatchDetected ? 'text-rose-400' : 'text-slate-600'}`}>+{result.breakdown.mismatchPenalty} pts</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 ${result.breakdown.velocityTriggered ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                          <span className="text-[10px]">②</span> Velocity Spike
                          {result.breakdown.velocityTriggered && <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">ACTIVO</span>}
                        </span>
                        <span className={`font-mono font-bold ${result.breakdown.velocityTriggered ? 'text-amber-400' : 'text-slate-600'}`}>+{result.breakdown.velocityPenalty} pts</span>
                      </div>

                      {/* Dim 3: Penalidad por Correo */}
                      {result.breakdown.emailPenalty ? (
                        <div className="flex items-center justify-between text-rose-400 font-semibold">
                          <span className="flex items-center gap-1">
                            <span className="text-[10px]">③</span>
                            <Mail className="h-3.5 w-3.5" />
                            Penalidad de Correo ({result.breakdown.emailVerification?.badgeText})
                          </span>
                          <span className="font-mono font-bold">+{result.breakdown.emailPenalty} pts</span>
                        </div>
                      ) : null}

                      {/* Dim 4: Critical Override */}
                      {result.breakdown.criticalOverride && (
                        <div className="flex items-center justify-between text-rose-300 font-semibold">
                          <span className="flex items-center gap-1">
                            <span className="text-[10px]">④</span>
                            <Zap className="h-3.5 w-3.5" /> Critical Override ({result.breakdown.criticalOverrideSource})
                          </span>
                          <span className="font-mono font-bold">FORZADO</span>
                        </div>
                      )}

                      <div className="border-t border-white/10 pt-2 flex items-center justify-between font-bold">
                        <span className="text-white">Score Final Computado</span>
                        <span className="font-mono text-sm" style={{ color: scoreColor(result.breakdown.finalScore) }}>
                          {result.breakdown.finalScore} / 100
                        </span>
                      </div>
                    </div>

                    {/* Resumen Comunitario ZK */}
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
                          <span className="text-[11px] text-slate-400 block">Consenso en la Red:</span>
                          <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                            <Building className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            {edges.length > 0 ? (
                              <span>Reportado en <strong className="text-cyan-300">{new Set(edges.map(e => e.reportedByEntityId)).size}</strong> entidad(es)</span>
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

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/[0.02] rounded-xl px-3 py-2 border border-white/5">
                        <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span>Zero-Knowledge: La consulta evalúa datos anonimizados sin exponer hashes ni PII confidencial.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // ── VISTA PARA OTROS IDENTIFICADORES (DNI, CBU, SET) ──
        return (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-5 animate-fade-in shadow-xl">
            {/* Header del Resultado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs">
                  ZK
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {searchMode === 'single'
                      ? `Resultado de Consulta: ${singleType === 'DNI' ? 'DNI' : singleType === 'CBU' ? 'CBU/CVU' : singleType}`
                      : 'Resultado de la Evaluación del Conjunto de Datos'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Evaluado con arquitectura Zero-Knowledge y Fingerprinting criptográfico
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkOK}
                  disabled={okLoading || okDone}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition active:scale-95 shadow-md ${
                    okDone
                      ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 cursor-default'
                      : 'border-emerald-400/50 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                  }`}
                  title="Atenúa el score de riesgo restando −35 pts por reporte comunitario"
                >
                  {okDone ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      Voto OK Registrado
                    </>
                  ) : okLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-white" />
                      Marcar OK
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Score de Riesgo: Aislamiento Estricto por Entorno */}
            <div className="space-y-4">
              <div className="max-w-xl mx-auto w-full">
                {/* 1. Si el usuario está en "Workspace Interno", renderizá ÚNICAMENTE el componente del Score de la Entidad */}
                {isInternal && (() => {
                  const internalBadge = internalScore >= 70
                    ? { text: 'ALTO RIESGO PROPIO', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
                    : internalScore >= 30
                    ? { text: 'RIESGO MEDIO INTERNO', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                    : { text: 'BAJO RIESGO PROPIO', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };

                  return (
                    <ScoreGauge
                      score={internalScore}
                      title="Score de la Entidad"
                      subtitle={`Evaluación basada exclusivamente en los antecedentes internos cargados por ${activeFintech?.name || 'tu entidad'}.`}
                      badge={internalBadge}
                      icon={Building2}
                    />
                  );
                })()}

                {/* 2. Si el usuario está en "Consorcio Federal", renderizá ÚNICAMENTE el componente del Score del Consorcio */}
                {!isInternal && (() => {
                  const consortiumBadge = consortiumScore >= 70
                    ? { text: 'ALERTA CONSORCIO', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
                    : consortiumScore >= 30
                    ? { text: 'SOSPECHA COMUNITARIA', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                    : { text: 'LIMPIO EN CONSORCIO', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };

                  return (
                    <ScoreGauge
                      score={consortiumScore}
                      title="Score del Consorcio"
                      subtitle="Calculado con la inteligencia colectiva y cruces criptográficos aportados por toda la Red Federal."
                      badge={consortiumBadge}
                      icon={Network}
                    />
                  );
                })()}
              </div>

              {/* Barra unificada de Decisión y Ámbito */}
              <div className="flex items-center flex-wrap gap-2.5 pt-1">
                <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold ${rec.class}`}>
                  <span>{rec.icon}</span>
                  {rec.text}
                </span>

                <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                  result.scope === 'INTERNAL'
                    ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
                    : 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300'
                }`}>
                  {result.scope === 'INTERNAL' ? <Building2 className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                  {result.scope === 'INTERNAL' ? 'VISTA: WORKSPACE INTERNO' : 'VISTA: CONSORCIO FEDERAL'}
                </span>
              </div>

              {/* Resumen limpio de Tipologías detectadas y Último incidente */}
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-300">Tipologías detectadas:</span>
                  <span className="text-xs font-semibold text-white">{predominantTypology}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>Último incidente: <strong className="text-white">{lastIncidentText}</strong></span>
                </div>
              </div>
            </div>

            {okDone && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Voto de legitimidad computado. El score de riesgo fue atenuado en tiempo real en la red federada.</span>
              </div>
            )}

            {/* Desglose Dato por Dato */}
            {result.breakdown.identifierDetails && result.breakdown.identifierDetails.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-cyan-400" />
                    {result.breakdown.identifierDetails.length > 1
                      ? 'Desglose Dato por Dato del Conjunto Evaluado:'
                      : 'Resultado del Identificador Consultado:'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {result.breakdown.identifierDetails.filter(d => d.matched).length} con incidentes / {result.breakdown.identifierDetails.length} consultados
                  </span>
                </div>

                <div className={`grid gap-2.5 ${result.breakdown.identifierDetails.length > 1 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                  {result.breakdown.identifierDetails.map(detail => (
                    <div
                      key={detail.type}
                      className={`rounded-xl p-3 border text-xs transition ${
                        detail.matched
                          ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                          : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold flex items-center gap-1.5 text-white">
                          {detail.type === 'DNI' && <CreditCard className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'EMAIL' && <Mail className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'PHONE' && <Phone className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'CBU' && <Building className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'IP' && <Globe className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'DEVICE' && <Fingerprint className="h-3.5 w-3.5 text-purple-400" />}
                          {detail.type === 'CUIT' && <Hash className="h-3.5 w-3.5 text-cyan-400" />}
                          {detail.type === 'DNI' ? 'DNI / CUIL' : detail.type === 'CBU' ? 'CBU / CVU' : detail.type === 'DEVICE' ? 'Device ID' : detail.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            detail.matched
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {detail.matched
                            ? `🚨 ${detail.reportsCount} ${detail.reportsCount === 1 ? 'reporte' : 'reportes'}`
                            : '✅ Sin reportes'}
                        </span>
                      </div>

                      <div className="font-mono text-[11px] text-slate-300 mb-1.5 flex items-center justify-between">
                        <span>{detail.valueMasked}</span>
                        <span className="text-[10px] text-slate-500 font-sans">Tokenizado ZK</span>
                      </div>

                      <div className="rounded-lg bg-black/40 border border-white/5 p-2 mb-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                          <span className="text-slate-400 font-medium">Fecha del último incidente reportado:</span>
                        </div>
                        <p className="font-mono text-xs font-bold text-white pl-4.5">
                          {detail.matched
                            ? (detail.lastReportedAt || (detail.lastSeenDaysAgo ? `Hace ${detail.lastSeenDaysAgo} días` : '14/09/2026 18:32 hs'))
                            : 'Sin incidentes reportados'}
                        </p>
                      </div>

                      {detail.matched ? (
                        <div className="text-[11px] text-slate-300 space-y-1">
                          <p>Reportado en: <strong className="text-white">{detail.distinctEntitiesCount}</strong> entidad(es)</p>
                          <p>
                            <span className="text-slate-400 font-medium">Tipologías detectadas:</span>{' '}
                            <strong className="text-rose-300 font-semibold">
                              {detail.categories.length > 0
                                ? detail.categories.map(c => CATEGORY_TRANSLATIONS[c] || c.replace(/_/g, ' ')).join(', ')
                                : 'Cuenta Mula'}
                            </strong>
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-400/90 font-medium">
                          Identificador sin antecedentes en la red.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── DESGLOSE TÉCNICO COLAPSABLE: VER AUDITORÍA DE CÁLCULO ── */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden shadow-xl transition">
              <button
                type="button"
                onClick={() => setShowGeneralTechnicalDetails(!showGeneralTechnicalDetails)}
                className="w-full flex items-center justify-between p-4 px-5 text-left hover:bg-white/[0.03] transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-white/5 group-hover:border-cyan-500/30 transition">
                    <Sliders className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      Ver auditoría de cálculo
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Detalle del motor matemático (4 dimensiones), pesos y decaimiento temporal
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 group-hover:text-cyan-300 transition">
                  <span>{showGeneralTechnicalDetails ? 'Ocultar auditoría' : 'Ver auditoría de cálculo'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showGeneralTechnicalDetails ? 'rotate-180 text-cyan-400' : ''}`} />
                </div>
              </button>

              {showGeneralTechnicalDetails && (
                <div className="p-4 border-t border-white/10 space-y-2 text-xs bg-black/40 animate-fade-in">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Desglose del Motor Matemático (4 Dimensiones)</div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="text-[10px]">①</span> Severidad Base (con Time Decay)
                      {result.breakdown.timeDecayApplied && (
                        <span className="ml-1 rounded bg-slate-600/30 px-1 py-0.5 text-[9px] font-bold text-slate-400 border border-slate-500/20">DECAY ×{result.breakdown.timeDecayFactor.toFixed(2)}</span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-slate-200">+{result.breakdown.historicalReportsScore} pts</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1 ${result.breakdown.mismatchDetected ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                      <span className="text-[10px]">②</span> Discrepancia de Identidad
                      {result.breakdown.mismatchDetected && <span className="ml-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">DETECTADO</span>}
                    </span>
                    <span className={`font-mono font-bold ${result.breakdown.mismatchDetected ? 'text-rose-400' : 'text-slate-600'}`}>+{result.breakdown.mismatchPenalty} pts</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1 ${result.breakdown.velocityTriggered ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                      <span className="text-[10px]">②</span> Velocity Spike
                      {result.breakdown.velocityTriggered && <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">ACTIVO</span>}
                    </span>
                    <span className={`font-mono font-bold ${result.breakdown.velocityTriggered ? 'text-amber-400' : 'text-slate-600'}`}>+{result.breakdown.velocityPenalty} pts</span>
                  </div>

                  <div className="border-t border-white/10 pt-2 flex items-center justify-between font-bold">
                    <span className="text-white">Score Final Computado</span>
                    <span className="font-mono text-sm" style={{ color: scoreColor(result.breakdown.finalScore) }}>
                      {result.breakdown.finalScore} / 100
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen Comunitario ZK */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
                  <span className="text-[11px] text-slate-400 block">Consenso en la Red:</span>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
                    <Building className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    {edges.length > 0 ? (
                      <span>Reportado en <strong className="text-cyan-300">{new Set(edges.map(e => e.reportedByEntityId)).size}</strong> entidad(es)</span>
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

              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/[0.02] rounded-xl px-3 py-2 border border-white/5">
                <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>Zero-Knowledge: La consulta evalúa datos anonimizados sin exponer hashes ni PII confidencial.</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
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
  const { reportFraud, activeFintechId, fintechs } = useConsortiumStore();
  
  // Selector de Modo: 'single' (Reporte Unitario) vs 'set' (Reporte de Conjunto / Red)
  const [reportMode, setReportMode] = useState<'single' | 'set'>('single');
  const [primaryType, setPrimaryType] = useState<'DNI' | 'CBU'>('DNI');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Campo opcional de Ticket Interno
  const [internalTicketId, setInternalTicketId] = useState('');

  // Identificadores
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ip, setIp] = useState('');
  const [cbu, setCbu] = useState('');
  const [device, setDevice] = useState('');
  const [cuit, setCuit] = useState('');
  
  // Tipologías específicas (sin Fraude Confirmado genérico)
  const SPECIFIC_CATEGORIES = CATEGORIES.filter(c => c.value !== 'FRAUD_CONFIRMED');
  const [category, setCategory] = useState<IncidentCategory>('MULE_ACCOUNT');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const activeFintech = fintechs.find(f => f.id === activeFintechId);

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Validaciones
    if (cbu.trim()) {
      const cleanCbu = cbu.trim().replace(/\D/g, '');
      if (cleanCbu.length > 0 && cleanCbu.length < 10) {
        setError('Validación CBU/CVU: Ingrese una cuenta bancaria o CVU válida (mínimo 10 dígitos).');
        return;
      }
    }

    if (cuit.trim()) {
      const cleanCuit = cuit.trim().replace(/\D/g, '');
      if (cleanCuit.length > 0 && cleanCuit.length < 10) {
        setError('Validación CUIT/CUIL: Debe contener al menos 10-11 dígitos numéricos.');
        return;
      }
    }

    if (dni.trim()) {
      const cleanDni = dni.trim().replace(/\D/g, '');
      if (cleanDni.length > 0 && cleanDni.length < 6) {
        setError('Validación DNI: Debe contener al menos 6 dígitos numéricos.');
        return;
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Validación Email: Formato de correo electrónico inválido.');
      return;
    }

    if (phone.trim() && !/^\+?[\d\s\-()]{6,20}$/.test(phone.trim())) {
      setError('Validación de teléfono fallida: Formato de número inválido.');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const commonIncidentId = reportMode === 'set'
        ? `INC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        : undefined;

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
        incidentId: commonIncidentId,
      });

      setSuccess(true);
      setDni('');
      setEmail('');
      setPhone('');
      setIp('');
      setCbu('');
      setDevice('');
      setCuit('');
      setInternalTicketId('');
      setShowOptionalDetails(false);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el incidente.';
      setError(msg);
    } finally {
      setLoading(false);
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
              <h3 className="text-base font-bold text-white tracking-tight">Ingresar Nuevo Incidente</h3>
              <p className="text-xs text-slate-400">
                Registro criptográfico ZK de amenazas para detección y prevención de fraude.
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

      {activeFintech?.status === 'SUSPENDED' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 text-xs text-rose-300 flex items-center gap-2.5">
          <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Entidad suspendida. Contactá al SuperAdmin para reactivar privilegios de reporte.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
          <p className="text-[11px] text-slate-500 px-1">
            {reportMode === 'single'
              ? 'Registra un identificador puntual como alerta individual.'
              : 'Vincula múltiples datos bajo un mismo expediente para el grafo de prevención.'}
          </p>
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

          {/* Input Principal Grande y Limpio */}
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

        {/* 3. Tipología del Incidente */}
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

        {/* 4. Acordeón Desplegable: Detalles Opcionales */}
        <div className="border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setShowOptionalDetails(!showOptionalDetails)}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-400 transition py-1.5 px-2 rounded-lg hover:bg-white/5"
          >
            {showOptionalDetails ? (
              <ChevronUp className="h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
            <span>
              {showOptionalDetails ? 'Ocultar campos opcionales' : '+ Agregar detalles opcionales (Email, Teléfono, IP, Device, Ticket)'}
            </span>
          </button>

          {showOptionalDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  ID de Ticket / Ref. Interna
                </label>
                <input
                  type="text"
                  value={internalTicketId}
                  onChange={e => setInternalTicketId(e.target.value)}
                  placeholder="ej: TCK-2026-9812"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

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
                  placeholder="ej: +54 9 11 2233-4455"
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
                  Device Fingerprint / Hardware ID
                </label>
                <input
                  type="text"
                  value={device}
                  onChange={e => setDevice(e.target.value)}
                  placeholder="ej: dev_7f9c2a..."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  CUIT / CUIL Alternativo
                </label>
                <input
                  type="text"
                  value={cuit}
                  onChange={e => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="ej: 20301112227"
                  maxLength={11}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Mensajes de Feedback */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center gap-2.5 shadow-sm">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>¡Incidente registrado exitosamente en el libro mayor criptográfico y red federal!</span>
          </div>
        )}

        {/* Botón de Acción Principal */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5">
          <p className="text-[11px] text-slate-500">
            Los datos son convertidos a hashes ciegos (SHA-256 + Salt Federal) preservando el secreto bancario.
          </p>

          <button
            type="submit"
            disabled={loading || activeFintech?.status === 'SUSPENDED'}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/40 active:scale-95 disabled:opacity-50 transition shrink-0"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>Registrar Incidente</span>
              </>
            )}
          </button>
        </div>
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
