'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Activity,
  Layers,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  Mail,
  Smartphone,
  Globe,
  Flame,
  ArrowRight,
  RotateCcw,
  Info,
  Zap,
  Target,
  FileCode,
  ShieldAlert,
  Save,
  RefreshCw,
  Check,
  Search,
  SlidersHorizontal,
  Lock,
  Cpu,
  Fingerprint,
  ToggleLeft,
  ToggleRight,
  Play,
  Database,
} from 'lucide-react';
import { SEVERITY_BASE, DECAY_FLOOR } from '@/lib/fraudEngine';
import { IncidentCategory, ScoringConfig, DEFAULT_SCORING_CONFIG, LookupResult } from '@/lib/types';
import { useConsortiumStore } from '@/lib/store';

// Tipologías y sus nombres legibles
const TYPOLOGIES: { id: IncidentCategory; label: string; baseScore: number; desc: string }[] = [
  { id: 'MULE_ACCOUNT', label: 'Cuenta Mula / Receptora', baseScore: 90, desc: 'Cuentas utilizadas para lavado o triangulación de fondos robados' },
  { id: 'FRAUD_CONFIRMED', label: 'Fraude Confirmado', baseScore: 95, desc: 'Caso de estafa penal con sumario formal finalizado' },
  { id: 'IDENTITY_THEFT', label: 'Robo de Identidad / Sintética', baseScore: 75, desc: 'Apertura de cuenta con credenciales de un tercero' },
  { id: 'ACCOUNT_TAKEOVER', label: 'Toma de Control de Cuenta (ATO)', baseScore: 80, desc: 'Acceso no autorizado mediante credenciales filtradas' },
  { id: 'PHISHING', label: 'Origen de Phishing', baseScore: 55, desc: 'Enlace o dato originado en ingeniería social activa' },
  { id: 'CHARGEBACK', label: 'Contracargo Reiterado', baseScore: 50, desc: 'Historial de desconocimientos de consumo fraudulentos' },
  { id: 'SUSPICIOUS', label: 'Operación Sospechosa', baseScore: 40, desc: 'Patrón anómalo sin confirmación penal definitiva' },
];

export default function ScoringLabAdmin() {
  const {
    scoringConfig,
    updateScoringConfig,
    resetScoringConfig,
    applyScoringPreset,
    lookupIdentity,
    fintechs,
    graphEdges,
    reportFraud,
    networkAlerts,
    scoringAuditRecords,
  } = useConsortiumStore();

  // Vista principal del módulo (Monitoreo como vista inicial por defecto)
  const [activeMainTab, setActiveMainTab] = useState<'monitoring' | 'engine-params' | 'simulator' | 'sandbox' | 'algorithms'>('monitoring');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyRiskFilter, setHistoryRiskFilter] = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL');

  // Notificación de guardado
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // ── ESTADO DEL SIMULADOR DINÁMICO (JUGAR CON LOS DOS SCORES) ──
  // 1. Parámetros del Score 1 (Entidad / Interno)
  const [internalReportsCount, setInternalReportsCount] = useState<number>(1);
  const [internalTypology, setInternalTypology] = useState<IncidentCategory>('ACCOUNT_TAKEOVER');
  const [internalDaysAgo, setInternalDaysAgo] = useState<number>(15);

  // 2. Parámetros del Score 2 (Consorcio / Red Federal)
  const [consortiumOtherEntities, setConsortiumOtherEntities] = useState<number>(2);
  const [consortiumTypology, setConsortiumTypology] = useState<IncidentCategory>('MULE_ACCOUNT');
  const [consortiumDaysAgo, setConsortiumDaysAgo] = useState<number>(3);
  const [consortiumAvgTrustWeight, setConsortiumAvgTrustWeight] = useState<number>(0.85);

  // 3. Patrones de Red y Anomalías
  const [mismatchEnabled, setMismatchEnabled] = useState<boolean>(false);
  const [velocityLookups1h, setVelocityLookups1h] = useState<number>(2);
  const [deviceFarmEnabled, setDeviceFarmEnabled] = useState<boolean>(false);
  const [deviceLinkedCuits, setDeviceLinkedCuits] = useState<number>(1);

  // 4. Email Intelligence & Domain Maturity
  const [emailStatus, setEmailStatus] = useState<'EXISTING' | 'NON_EXISTENT' | 'DISPOSABLE'>('EXISTING');
  const [domainAgeDays, setDomainAgeDays] = useState<number>(1200);
  const [emailCountryCode, setEmailCountryCode] = useState<string>('AR');

  // 5. Control de Sobreescritura Manual Directa (Sliders Libres)
  const [manualOverrideActive, setManualOverrideActive] = useState<boolean>(false);
  const [forcedEntityScore, setForcedEntityScore] = useState<number>(35);
  const [forcedConsortiumScore, setForcedConsortiumScore] = useState<number>(85);

  // Estado de edición de parámetros del motor
  const [editingConfig, setEditingConfig] = useState<ScoringConfig>(() => scoringConfig || DEFAULT_SCORING_CONFIG);

  // Mantener sincronizado si cambia en el store
  useEffect(() => {
    if (scoringConfig) {
      setEditingConfig(scoringConfig);
    }
  }, [scoringConfig]);

  // Tab activo de fórmulas
  const [activeAlgorithmTab, setActiveAlgorithmTab] = useState<'decay' | 'consensus' | 'trust' | 'email' | 'override'>('decay');

  // Estado del Sandbox
  const [sandboxIdentifierType, setSandboxIdentifierType] = useState<'EMAIL' | 'DNI' | 'CUIT' | 'CBU'>('EMAIL');
  const [sandboxValue, setSandboxValue] = useState<string>('estafador.red@gmail.com');
  const [sandboxResult, setSandboxResult] = useState<LookupResult | null>(null);
  const [isSandboxRunning, setIsSandboxRunning] = useState<boolean>(false);

  // ── CÁLCULO EN TIEMPO REAL: SCORE 1 (ENTIDAD / INTERNO) ──
  const internalMath = useMemo(() => {
    if (manualOverrideActive) {
      const finalScore = Math.min(100, Math.max(0, forcedEntityScore));
      const level = finalScore >= editingConfig.highRiskThreshold ? 'ALTO' : finalScore >= editingConfig.mediumRiskThreshold ? 'MEDIO' : 'BAJO';
      return {
        baseScore: finalScore,
        decayFactor: 1,
        decayedScore: finalScore,
        emailPenalty: 0,
        rawScore: finalScore,
        finalScore,
        level,
        recommendation: finalScore >= editingConfig.highRiskThreshold ? 'BLOQUEAR' : finalScore >= editingConfig.mediumRiskThreshold ? 'DESAFIO_2FA' : 'APROBAR',
        isManualOverride: true,
      };
    }

    if (internalReportsCount === 0) {
      let emailPen = 0;
      if (emailStatus === 'NON_EXISTENT') emailPen += editingConfig.emailPenalties?.nonExistent ?? 35;
      else if (emailStatus === 'DISPOSABLE') emailPen += editingConfig.emailPenalties?.disposable ?? 40;
      if (domainAgeDays < 30) emailPen += editingConfig.emailPenalties?.newDomain ?? 25;
      else if (domainAgeDays < 365) emailPen += editingConfig.emailPenalties?.mediumDomain ?? 10;

      const raw = emailPen;
      const final = Math.min(100, Math.max(0, Math.round(raw)));
      const level = final >= editingConfig.highRiskThreshold ? 'ALTO' : final >= editingConfig.mediumRiskThreshold ? 'MEDIO' : 'BAJO';
      return {
        baseScore: 0,
        decayFactor: 1,
        decayedScore: 0,
        emailPenalty: emailPen,
        rawScore: raw,
        finalScore: final,
        level,
        recommendation: final >= editingConfig.highRiskThreshold ? 'BLOQUEAR' : final >= editingConfig.mediumRiskThreshold ? 'DESAFIO_2FA' : 'APROBAR',
        isManualOverride: false,
      };
    }

    const base = editingConfig.severityBase?.[internalTypology] ?? SEVERITY_BASE[internalTypology] ?? 40;
    const isSevere = internalTypology === 'MULE_ACCOUNT' || internalTypology === 'FRAUD_CONFIRMED';
    const floor = isSevere ? (editingConfig.decayFloor?.MULE_ACCOUNT ?? 40) / 100 : (editingConfig.decayFloor?.SUSPICIOUS ?? 10) / 100;
    const halfLife = editingConfig.decayHalfLifeDays || 180;
    const decay = Math.max(floor, Math.pow(0.5, internalDaysAgo / halfLife));
    const decayed = (base * 1.0) * decay * internalReportsCount;

    let emailPen = 0;
    if (emailStatus === 'NON_EXISTENT') emailPen += editingConfig.emailPenalties?.nonExistent ?? 35;
    else if (emailStatus === 'DISPOSABLE') emailPen += editingConfig.emailPenalties?.disposable ?? 40;
    if (domainAgeDays < 30) emailPen += editingConfig.emailPenalties?.newDomain ?? 25;
    else if (domainAgeDays < 365) emailPen += editingConfig.emailPenalties?.mediumDomain ?? 10;

    const raw = decayed + emailPen;
    const final = Math.min(100, Math.max(0, Math.round(raw)));
    const level = final >= editingConfig.highRiskThreshold ? 'ALTO' : final >= editingConfig.mediumRiskThreshold ? 'MEDIO' : 'BAJO';

    return {
      baseScore: base,
      decayFactor: decay,
      decayedScore: Math.round(decayed),
      emailPenalty: emailPen,
      rawScore: raw,
      finalScore: final,
      level,
      recommendation: final >= editingConfig.highRiskThreshold ? 'BLOQUEAR' : final >= editingConfig.mediumRiskThreshold ? 'DESAFIO_2FA' : 'APROBAR',
      isManualOverride: false,
    };
  }, [
    manualOverrideActive,
    forcedEntityScore,
    internalReportsCount,
    internalTypology,
    internalDaysAgo,
    emailStatus,
    domainAgeDays,
    editingConfig,
  ]);

  // ── CÁLCULO EN TIEMPO REAL: SCORE 2 (CONSORCIO / RED FEDERAL) ──
  const consortiumMath = useMemo(() => {
    if (manualOverrideActive) {
      const finalScore = Math.min(100, Math.max(0, forcedConsortiumScore));
      const level = finalScore >= editingConfig.highRiskThreshold ? 'ALTO' : finalScore >= editingConfig.mediumRiskThreshold ? 'MEDIO' : 'BAJO';
      return {
        internalContrib: 0,
        otherContrib: finalScore,
        totalEntities: 2,
        multiEntityMultiplier: 1.25,
        mismatchPen: 0,
        velocityPen: 0,
        emailPen: 0,
        deviceFarmTriggered: false,
        criticalOverrideTriggered: false,
        rawScore: finalScore,
        finalScore,
        level,
        recommendation: finalScore >= editingConfig.highRiskThreshold ? 'BLOQUEAR' : finalScore >= editingConfig.mediumRiskThreshold ? 'DESAFIO_2FA' : 'APROBAR',
        isManualOverride: true,
      };
    }

    const internalBase = editingConfig.severityBase?.[internalTypology] ?? SEVERITY_BASE[internalTypology] ?? 40;
    const internalFloor = (internalTypology === 'MULE_ACCOUNT' || internalTypology === 'FRAUD_CONFIRMED')
      ? (editingConfig.decayFloor?.MULE_ACCOUNT ?? 40) / 100
      : (editingConfig.decayFloor?.SUSPICIOUS ?? 10) / 100;
    const halfLife = editingConfig.decayHalfLifeDays || 180;
    const internalDecay = Math.max(internalFloor, Math.pow(0.5, internalDaysAgo / halfLife));
    const internalContrib = internalReportsCount > 0 ? (internalBase * 1.0 * internalDecay * internalReportsCount) : 0;

    const otherBase = editingConfig.severityBase?.[consortiumTypology] ?? SEVERITY_BASE[consortiumTypology] ?? 40;
    const otherFloor = (consortiumTypology === 'MULE_ACCOUNT' || consortiumTypology === 'FRAUD_CONFIRMED')
      ? (editingConfig.decayFloor?.MULE_ACCOUNT ?? 40) / 100
      : (editingConfig.decayFloor?.SUSPICIOUS ?? 10) / 100;
    const otherDecay = Math.max(otherFloor, Math.pow(0.5, consortiumDaysAgo / halfLife));
    const otherContrib = consortiumOtherEntities > 0
      ? (otherBase * consortiumAvgTrustWeight * otherDecay * consortiumOtherEntities)
      : 0;

    const rawHist = internalContrib + otherContrib;

    const totalEntities = (internalReportsCount > 0 ? 1 : 0) + consortiumOtherEntities;
    let multiEntityMultiplier = 1.0;
    if (totalEntities >= 4) multiEntityMultiplier = editingConfig.multiEntityMultipliers?.fourOrMore ?? 1.80;
    else if (totalEntities === 3) multiEntityMultiplier = editingConfig.multiEntityMultipliers?.three ?? 1.50;
    else if (totalEntities === 2) multiEntityMultiplier = editingConfig.multiEntityMultipliers?.two ?? 1.25;

    const mismatchPen = mismatchEnabled ? (editingConfig.mismatchPenalty ?? 45) : 0;

    let velocityPen = 0;
    const velThresh = editingConfig.velocityThreshold ?? 3;
    if (velocityLookups1h >= velThresh * 3) velocityPen = (editingConfig.velocityPenalty ?? 25) * 1.4;
    else if (velocityLookups1h >= velThresh * 2) velocityPen = (editingConfig.velocityPenalty ?? 25) * 1.1;
    else if (velocityLookups1h >= velThresh) velocityPen = editingConfig.velocityPenalty ?? 25;

    let emailPen = 0;
    if (emailStatus === 'NON_EXISTENT') emailPen += editingConfig.emailPenalties?.nonExistent ?? 35;
    else if (emailStatus === 'DISPOSABLE') emailPen += editingConfig.emailPenalties?.disposable ?? 40;
    if (domainAgeDays < 30) emailPen += editingConfig.emailPenalties?.newDomain ?? 25;
    else if (domainAgeDays < 365) emailPen += editingConfig.emailPenalties?.mediumDomain ?? 10;

    let rawScore = rawHist + mismatchPen + velocityPen + emailPen;
    if (totalEntities >= 2 && rawScore > 0) {
      rawScore = Math.min(97, rawScore * multiEntityMultiplier);
    }

    let deviceFarmTriggered = false;
    const farmThreshold = editingConfig.deviceFarmThreshold ?? 3;
    if (deviceFarmEnabled || deviceLinkedCuits >= farmThreshold) {
      deviceFarmTriggered = true;
      rawScore = Math.max(rawScore, editingConfig.deviceFarmFloor ?? 85);
    }

    let criticalOverrideTriggered = false;
    const maxSingleComponent = Math.max(internalContrib, otherContrib, deviceFarmTriggered ? 85 : 0);
    const critThresh = editingConfig.criticalOverrideThreshold ?? 85;
    if (maxSingleComponent >= critThresh) {
      criticalOverrideTriggered = true;
      rawScore = Math.max(rawScore, Math.min(100, maxSingleComponent * 1.05));
    }

    const final = Math.min(100, Math.max(0, Math.round(rawScore)));
    const level = final >= editingConfig.highRiskThreshold ? 'ALTO' : final >= editingConfig.mediumRiskThreshold ? 'MEDIO' : 'BAJO';

    return {
      internalContrib: Math.round(internalContrib),
      otherContrib: Math.round(otherContrib),
      totalEntities,
      multiEntityMultiplier,
      mismatchPen,
      velocityPen,
      emailPen,
      deviceFarmTriggered,
      criticalOverrideTriggered,
      rawScore,
      finalScore: final,
      level,
      recommendation: final >= editingConfig.highRiskThreshold ? 'BLOQUEAR' : final >= editingConfig.mediumRiskThreshold ? 'DESAFIO_2FA' : 'APROBAR',
      isManualOverride: false,
    };
  }, [
    manualOverrideActive,
    forcedConsortiumScore,
    internalReportsCount,
    internalTypology,
    internalDaysAgo,
    consortiumOtherEntities,
    consortiumTypology,
    consortiumDaysAgo,
    consortiumAvgTrustWeight,
    mismatchEnabled,
    velocityLookups1h,
    deviceFarmEnabled,
    deviceLinkedCuits,
    emailStatus,
    domainAgeDays,
    editingConfig,
  ]);

  // Delta de prevención federal
  const deltaScore = consortiumMath.finalScore - internalMath.finalScore;

  // Cargar Presets de Caso de Estudio
  const applyPreset = (presetName: string) => {
    setManualOverrideActive(false);
    if (presetName === 'CLEAN') {
      setInternalReportsCount(0);
      setConsortiumOtherEntities(0);
      setMismatchEnabled(false);
      setVelocityLookups1h(1);
      setDeviceFarmEnabled(false);
      setDeviceLinkedCuits(1);
      setEmailStatus('EXISTING');
      setDomainAgeDays(1400);
      setEmailCountryCode('AR');
    } else if (presetName === 'CROSS_BANK_ATTACK') {
      setInternalReportsCount(0);
      setConsortiumOtherEntities(3);
      setConsortiumTypology('MULE_ACCOUNT');
      setConsortiumDaysAgo(2);
      setConsortiumAvgTrustWeight(0.95);
      setMismatchEnabled(false);
      setVelocityLookups1h(8);
      setDeviceFarmEnabled(false);
      setDeviceLinkedCuits(1);
      setEmailStatus('EXISTING');
      setDomainAgeDays(800);
      setEmailCountryCode('AR');
    } else if (presetName === 'PHISHING_NEW_DOMAIN') {
      setInternalReportsCount(1);
      setInternalTypology('PHISHING');
      setInternalDaysAgo(1);
      setConsortiumOtherEntities(2);
      setConsortiumTypology('PHISHING');
      setConsortiumDaysAgo(1);
      setConsortiumAvgTrustWeight(0.90);
      setMismatchEnabled(true);
      setVelocityLookups1h(15);
      setDeviceFarmEnabled(false);
      setDeviceLinkedCuits(1);
      setEmailStatus('EXISTING');
      setDomainAgeDays(5);
      setEmailCountryCode('BR');
    } else if (presetName === 'DEVICE_FARM') {
      setInternalReportsCount(0);
      setConsortiumOtherEntities(1);
      setConsortiumTypology('IDENTITY_THEFT');
      setConsortiumDaysAgo(10);
      setConsortiumAvgTrustWeight(0.85);
      setMismatchEnabled(true);
      setVelocityLookups1h(25);
      setDeviceFarmEnabled(true);
      setDeviceLinkedCuits(8);
      setEmailStatus('DISPOSABLE');
      setDomainAgeDays(12);
      setEmailCountryCode('US');
    } else if (presetName === 'AGED_MULE') {
      setInternalReportsCount(1);
      setInternalTypology('MULE_ACCOUNT');
      setInternalDaysAgo(300);
      setConsortiumOtherEntities(0);
      setMismatchEnabled(false);
      setVelocityLookups1h(1);
      setDeviceFarmEnabled(false);
      setDeviceLinkedCuits(1);
      setEmailStatus('EXISTING');
      setDomainAgeDays(2000);
      setEmailCountryCode('AR');
    } else if (presetName === 'KILL_SWITCH') {
      setInternalReportsCount(1);
      setInternalTypology('MULE_ACCOUNT');
      setInternalDaysAgo(1);
      setConsortiumOtherEntities(4);
      setConsortiumTypology('FRAUD_CONFIRMED');
      setConsortiumDaysAgo(1);
      setConsortiumAvgTrustWeight(1.0);
      setMismatchEnabled(true);
      setVelocityLookups1h(28);
      setDeviceFarmEnabled(true);
      setDeviceLinkedCuits(9);
      setEmailStatus('DISPOSABLE');
      setDomainAgeDays(3);
    }
  };

  // Guardar configuración en la plataforma
  const handleSaveConfig = () => {
    updateScoringConfig(editingConfig);
    setSaveSuccessMsg('¡Parámetros de scoring guardados! Aplicados exitosamente en toda la plataforma.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Restablecer configuración
  const handleResetConfig = () => {
    resetScoringConfig();
    setEditingConfig(DEFAULT_SCORING_CONFIG);
    setSaveSuccessMsg('Parámetros restablecidos a los valores estándar de fábrica.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Aplicar preset de motor (STRICT, BALANCED, PERMISSIVE)
  const handleApplyMotorPreset = (type: 'STRICT' | 'BALANCED' | 'PERMISSIVE') => {
    applyScoringPreset(type);
    if (type === 'STRICT') {
      setEditingConfig(prev => ({
        ...prev,
        highRiskThreshold: 60,
        mediumRiskThreshold: 25,
        mismatchPenalty: 55,
        velocityPenalty: 35,
        deviceFarmFloor: 90,
        multiEntityMultipliers: { two: 1.40, three: 1.70, fourOrMore: 2.0 },
      }));
    } else if (type === 'PERMISSIVE') {
      setEditingConfig(prev => ({
        ...prev,
        highRiskThreshold: 80,
        mediumRiskThreshold: 40,
        mismatchPenalty: 30,
        velocityPenalty: 15,
        deviceFarmFloor: 75,
        multiEntityMultipliers: { two: 1.15, three: 1.30, fourOrMore: 1.50 },
      }));
    } else {
      setEditingConfig(prev => ({
        ...prev,
        highRiskThreshold: 70,
        mediumRiskThreshold: 30,
        mismatchPenalty: 45,
        velocityPenalty: 25,
        deviceFarmFloor: 85,
        multiEntityMultipliers: { two: 1.25, three: 1.50, fourOrMore: 1.80 },
      }));
    }
    setSaveSuccessMsg(`Perfil de calibración [${type}] aplicado.`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Ejecutar prueba en el Sandbox
  const handleRunSandbox = async () => {
    if (!sandboxValue.trim()) return;
    setIsSandboxRunning(true);
    try {
      const payload: any = {};
      if (sandboxIdentifierType === 'EMAIL') payload.email = sandboxValue.trim();
      if (sandboxIdentifierType === 'DNI') payload.dni = sandboxValue.trim();
      if (sandboxIdentifierType === 'CUIT') payload.cuit = sandboxValue.trim();
      if (sandboxIdentifierType === 'CBU') payload.cbu = sandboxValue.trim();

      const res = await lookupIdentity(payload);
      setSandboxResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  const getBadgeClass = (level: 'BAJO' | 'MEDIO' | 'ALTO') => {
    if (level === 'ALTO') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (level === 'MEDIO') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header con Resumen ── */}
      <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white shadow-lg border border-blue-400/40">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Centro de Control & Modificación de Scores de Fraude
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                  Dual Score Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Live Control
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Panel exclusivo de Gobernanza para <strong>controlar, simular y modificar los 2 scores de fraude</strong> creados por la plataforma: Score de la Entidad (Interno) y Score del Consorcio (Federal).
              </p>
            </div>
          </div>
        </div>

        {/* Notificación de guardado */}
        {saveSuccessMsg && (
          <div className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ── SUB-TABS PRINCIPALES DEL CENTRO DE CONTROL ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#17253d] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMainTab('monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMainTab === 'monitoring'
                ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>1. Monitoreo & Rendimiento (KPIs)</span>
          </button>

          <button
            onClick={() => setActiveMainTab('engine-params')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMainTab === 'engine-params'
                ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
            <span>2. Ajustes de Umbrales & Reglas</span>
          </button>

          <button
            onClick={() => setActiveMainTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMainTab === 'simulator'
                ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 text-blue-400" />
            <span>3. Simulador Dual en Vivo</span>
          </button>

          <button
            onClick={() => setActiveMainTab('sandbox')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMainTab === 'sandbox'
                ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
            }`}
          >
            <Search className="h-3.5 w-3.5 text-purple-400" />
            <span>4. Banco de Pruebas (Identificadores)</span>
          </button>

          <button
            onClick={() => setActiveMainTab('algorithms')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMainTab === 'algorithms'
                ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
            }`}
          >
            <FileCode className="h-3.5 w-3.5 text-amber-400" />
            <span>5. Especificación Matemática BCRA</span>
          </button>
        </div>

        {/* Modo Override Manual Rápido */}
        <div className="flex items-center gap-2 bg-[#091322] px-3 py-1.5 rounded-xl border border-[#1b345f]">
          <span className="text-[11px] text-[#94a3b8]">Modo Sliders Directos (Override):</span>
          <button
            onClick={() => setManualOverrideActive(!manualOverrideActive)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              manualOverrideActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-[#13233e] text-[#64748b] border border-[#203c68]'
            }`}
          >
            {manualOverrideActive ? (
              <>
                <ToggleRight className="h-4 w-4 text-rose-400" /> Desbloqueado (Manual)
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 text-slate-500" /> Por Algoritmo (Auto)
              </>
            )}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: MONITOREO & RENDIMIENTO EN TIEMPO REAL (KPIs) ───── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'monitoring' && (
        <div className="space-y-6">
          {/* ── 4 KPIs Clave de Rendimiento en Tiempo Real ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Transacciones Analizadas
                </span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Activity className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">
                  {(fintechs.reduce((sum, f) => sum + (f.queriesCount || 0), 0) + (scoringAuditRecords?.length || 0) * 18).toLocaleString('es-AR')}
                </span>
                <span className="text-xs font-semibold text-emerald-400 font-mono">
                  +14.8% hoy
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-1">
                Evaluadas en tiempo real &lt; 15ms
              </p>
            </div>

            <div className="p-5 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Tasa Falsos Positivos
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  0.78%
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  Salud Óptima (&lt;1.5%)
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-1">
                Ajustado por reputación interbancaria
              </p>
            </div>

            <div className="p-5 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Distribución de Scores
                </span>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Layers className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-400 font-bold">64% B</span>
                <span className="text-slate-600">/</span>
                <span className="text-amber-400 font-bold">24% M</span>
                <span className="text-slate-600">/</span>
                <span className="text-rose-400 font-bold">12% A</span>
              </div>
              <div className="mt-2 w-full h-2 bg-[#091222] rounded-full overflow-hidden flex border border-white/5">
                <div style={{ width: '64%' }} className="bg-emerald-500 h-full" title="Riesgo Bajo: 64%" />
                <div style={{ width: '24%' }} className="bg-amber-500 h-full" title="Riesgo Medio: 24%" />
                <div style={{ width: '12%' }} className="bg-rose-500 h-full" title="Riesgo Alto: 12%" />
              </div>
            </div>

            <div className="p-5 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Alertas Recientes
                </span>
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-400">
                  {networkAlerts?.length || 2}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  activas en red federal
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-1">
                Superan umbral de corte ({editingConfig.highRiskThreshold} pts)
              </p>
            </div>
          </div>

          {/* ── Gráfico Visual de Distribución Histórica de Scores ── */}
          <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#17253d] pb-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <span>Distribución de Frecuencia de Puntajes de Riesgo (Deciles de 0 a 100)</span>
                </h3>
                <p className="text-[11px] text-[#94a3b8] mt-0.5">
                  Curva de calibración algorítmica: concentración masiva en riesgo bajo y filtrado preciso de amenazas críticas.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &lt; {editingConfig.mediumRiskThreshold} (Aprobado)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {editingConfig.mediumRiskThreshold} - {editingConfig.highRiskThreshold - 1} (2FA)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &ge; {editingConfig.highRiskThreshold} (Bloqueo)
                </span>
              </div>
            </div>

            {/* Barras de Deciles */}
            <div className="pt-4 pb-2">
              <div className="grid grid-cols-10 gap-2 items-end h-44 border-b border-[#17253d] px-2">
                {[
                  { range: '0-10', pct: 42, count: 620, risk: 'BAJO' },
                  { range: '11-20', pct: 28, count: 415, risk: 'BAJO' },
                  { range: '21-30', pct: 14, count: 208, risk: 'BAJO' },
                  { range: '31-40', pct: 8, count: 118, risk: 'MEDIO' },
                  { range: '41-50', pct: 6, count: 89, risk: 'MEDIO' },
                  { range: '51-60', pct: 5, count: 74, risk: 'MEDIO' },
                  { range: '61-70', pct: 4, count: 59, risk: 'MEDIO' },
                  { range: '71-80', pct: 3, count: 44, risk: 'ALTO' },
                  { range: '81-90', pct: 5, count: 74, risk: 'ALTO' },
                  { range: '91-100', pct: 4, count: 58, risk: 'ALTO' },
                ].map((decile, i) => {
                  const isHigh = decile.risk === 'ALTO';
                  const isMed = decile.risk === 'MEDIO';
                  const barColor = isHigh
                    ? 'bg-gradient-to-t from-rose-600 to-rose-400 border-rose-400/50'
                    : isMed
                    ? 'bg-gradient-to-t from-amber-600 to-amber-400 border-amber-400/50'
                    : 'bg-gradient-to-t from-emerald-600 to-emerald-400 border-emerald-400/50';

                  return (
                    <div key={i} className="flex flex-col items-center h-full justify-end group">
                      <span className="text-[10px] font-mono text-[#94a3b8] opacity-0 group-hover:opacity-100 transition mb-1 font-bold">
                        {decile.count}
                      </span>
                      <div
                        style={{ height: `${Math.max(12, decile.pct * 2.8)}%` }}
                        className={`w-full rounded-t-lg transition-all group-hover:brightness-125 border-t border-x shadow-md ${barColor}`}
                      />
                      <span className="text-[10px] font-mono text-[#64748b] group-hover:text-white transition mt-2">
                        {decile.range}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Tabla de Auditoría Histórica de Puntajes Asignados ── */}
          <div className="bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl overflow-hidden space-y-3">
            <div className="p-5 border-b border-[#17253d] bg-[#091222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-blue-400" />
                  <span>Auditoría Histórica de Puntajes de Riesgo Asignados</span>
                </h3>
                <p className="text-[11px] text-[#94a3b8] mt-0.5">
                  Registro detallado de transacciones evaluadas por el motor con sus dos puntajes (Entidad vs Consorcio) y la regla aplicada.
                </p>
              </div>

              {/* Filtros de la tabla histórica */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-48 sm:w-64">
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={e => setHistorySearchQuery(e.target.value)}
                    placeholder="Filtrar por ID, entidad o regla..."
                    className="w-full px-3 py-1.5 pl-8 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
                </div>

                <select
                  value={historyRiskFilter}
                  onChange={e => setHistoryRiskFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="ALL">Todos los Niveles</option>
                  <option value="ALTO">Alto Riesgo (&ge; {editingConfig.highRiskThreshold})</option>
                  <option value="MEDIO">Medio Riesgo</option>
                  <option value="BAJO">Bajo Riesgo</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#081223] text-[#94a3b8] uppercase text-[11px] font-semibold border-b border-[#17253d]">
                  <tr>
                    <th className="px-5 py-3">Operación ID / Hora</th>
                    <th className="px-5 py-3">Entidad</th>
                    <th className="px-5 py-3">Identificador Hash</th>
                    <th className="px-5 py-3 text-center">Score Entidad</th>
                    <th className="px-5 py-3 text-center">Score Consorcio</th>
                    <th className="px-5 py-3 text-center">Nivel</th>
                    <th className="px-5 py-3 text-center">Acción</th>
                    <th className="px-5 py-3">Regla Disparada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17253d] text-[#cbd5e1] font-mono text-[11px]">
                  {(scoringAuditRecords || [])
                    .filter(rec => {
                      const matchesSearch =
                        !historySearchQuery.trim() ||
                        rec.operationId.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                        rec.entityName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                        (rec.triggeredRule || '').toLowerCase().includes(historySearchQuery.toLowerCase());
                      const matchesRisk =
                        historyRiskFilter === 'ALL' || rec.riskLevel === historyRiskFilter;
                      return matchesSearch && matchesRisk;
                    })
                    .map(rec => (
                      <tr key={rec.id} className="hover:bg-[#0a162b] transition">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="font-semibold text-white block">
                            {rec.operationId}
                          </span>
                          <span className="text-[10px] text-[#64748b]">
                            {new Date(rec.timestamp).toLocaleTimeString('es-AR')}
                          </span>
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap font-sans font-medium text-slate-300">
                          {rec.entityName}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap text-[#93c5fd]">
                          {rec.identifierPreview}
                        </td>

                        <td className="px-5 py-3 text-center font-bold">
                          <span className={rec.internalScore >= editingConfig.highRiskThreshold ? 'text-rose-400' : rec.internalScore >= editingConfig.mediumRiskThreshold ? 'text-amber-400' : 'text-emerald-400'}>
                            {rec.internalScore}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-center font-bold">
                          <span className={rec.consortiumScore >= editingConfig.highRiskThreshold ? 'text-rose-400' : rec.consortiumScore >= editingConfig.mediumRiskThreshold ? 'text-amber-400' : 'text-emerald-400'}>
                            {rec.consortiumScore}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeClass(rec.riskLevel)}`}>
                            {rec.riskLevel}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                            rec.recommendation === 'BLOQUEAR'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-600/40'
                              : rec.recommendation === 'DESAFIO_2FA'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                          }`}>
                            {rec.recommendation}
                          </span>
                        </td>

                        <td className="px-5 py-3 font-sans text-xs text-[#94a3b8]">
                          {rec.triggeredRule || 'Evaluación normal'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: SIMULADOR & AJUSTE DUAL EN VIVO ─────────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'simulator' && (
        <div className="space-y-6">
          {/* Presets Rápidos */}
          <div className="p-4 bg-[#0a1528] border border-[#1e365b] rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Presets de Prueba para Jugar en Vivo:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyPreset('CLEAN')}
                className="px-3 py-1.5 rounded-lg bg-[#0f213e] hover:bg-[#162e54] text-slate-300 hover:text-white text-xs font-medium border border-[#203c68] transition"
              >
                🟢 Identidad Limpia (0/0)
              </button>
              <button
                onClick={() => applyPreset('CROSS_BANK_ATTACK')}
                className="px-3 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/50 text-blue-300 text-xs font-bold border border-blue-700/50 transition flex items-center gap-1"
              >
                <Shield className="h-3.5 w-3.5" /> 🛡️ Ataque Cruzado (0 vs 95)
              </button>
              <button
                onClick={() => applyPreset('PHISHING_NEW_DOMAIN')}
                className="px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/50 text-amber-300 text-xs font-bold border border-amber-700/50 transition flex items-center gap-1"
              >
                <Mail className="h-3.5 w-3.5" /> 📧 Phishing + Dominio Nuevo
              </button>
              <button
                onClick={() => applyPreset('DEVICE_FARM')}
                className="px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/50 text-purple-300 text-xs font-bold border border-purple-700/50 transition flex items-center gap-1"
              >
                <Smartphone className="h-3.5 w-3.5" /> 📱 Granja de Emuladores
              </button>
              <button
                onClick={() => applyPreset('AGED_MULE')}
                className="px-3 py-1.5 rounded-lg bg-[#12233f] hover:bg-[#1a335a] text-slate-300 text-xs font-medium border border-[#203c68] transition flex items-center gap-1"
              >
                <Clock className="h-3.5 w-3.5" /> ⏳ Mula Decaída (Decay)
              </button>
              <button
                onClick={() => applyPreset('KILL_SWITCH')}
                className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 text-xs font-black border border-rose-700/50 transition flex items-center gap-1"
              >
                <Flame className="h-3.5 w-3.5" /> 🚨 Kill-Switch (&gt;90)
              </button>
            </div>
          </div>

          {/* ── PANEL DE GAUGES DE LOS 2 SCORES LADO A LADO ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SCORE 1: ENTIDAD (INTERNO) */}
            <div className="p-6 bg-[#0d182e] border-2 border-blue-500/40 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#17253d] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      1. Score de la Entidad (Interno)
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {internalMath.isManualOverride ? 'Modo Manual' : 'Historial Propio'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#94a3b8]">Visión aislada: antecedentes registrados por esa misma institución.</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${getBadgeClass(internalMath.level)}`}>
                  {internalMath.level} RIESGO
                </span>
              </div>

              <div className="flex items-center justify-between my-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#64748b] block font-mono font-bold">Puntaje Interno Calculado</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-5xl font-mono font-black ${
                      internalMath.finalScore >= editingConfig.highRiskThreshold ? 'text-rose-400' : internalMath.finalScore >= editingConfig.mediumRiskThreshold ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {internalMath.finalScore}
                    </span>
                    <span className="text-sm text-[#64748b] font-mono">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-[#64748b] block font-mono font-bold">Recomendación Sugerida</span>
                  <span className={`inline-block px-3.5 py-1.5 rounded-xl text-xs font-black border mt-1 shadow-sm ${
                    internalMath.recommendation === 'BLOQUEAR'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : internalMath.recommendation === 'DESAFIO_2FA'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {internalMath.recommendation}
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-[#060c17] rounded-full h-2.5 overflow-hidden border border-[#1e365b] mb-4">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    internalMath.finalScore >= editingConfig.highRiskThreshold ? 'bg-gradient-to-r from-amber-500 to-rose-500' : internalMath.finalScore >= editingConfig.mediumRiskThreshold ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, internalMath.finalScore)}%` }}
                />
              </div>

              {/* Slider directo en caso de Override */}
              {manualOverrideActive ? (
                <div className="p-3 bg-[#081223] border border-blue-500/30 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs text-blue-200">
                    <span className="font-bold">Ajuste Forzado Score Entidad:</span>
                    <span className="font-mono font-bold text-white">{forcedEntityScore} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={forcedEntityScore}
                    onChange={e => setForcedEntityScore(Number(e.target.value))}
                    className="w-full accent-blue-500 h-2 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>
              ) : (
                <div className="pt-3 border-t border-[#17253d] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-[#cbd5e1]">
                    <span className="text-[#94a3b8]">Severidad Base ({internalTypology}):</span>
                    <span className="font-semibold text-white">+{internalMath.baseScore} pts</span>
                  </div>
                  <div className="flex justify-between text-[#cbd5e1]">
                    <span className="text-[#94a3b8]">Atenuación Temporal ({internalDaysAgo}d):</span>
                    <span className="text-amber-300">{(internalMath.decayFactor * 100).toFixed(0)}% retención ({internalMath.decayedScore} pts)</span>
                  </div>
                  <div className="flex justify-between text-[#cbd5e1]">
                    <span className="text-[#94a3b8]">Penalidad Email Intelligence:</span>
                    <span className={internalMath.emailPenalty > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      +{internalMath.emailPenalty} pts
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* SCORE 2: CONSORCIO (RED FEDERAL) */}
            <div className="p-6 bg-gradient-to-b from-[#0e1d38] to-[#0a1528] border-2 border-[#2563eb] rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#1e3a6a] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      2. Score del Consorcio (Red Federal)
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {consortiumMath.isManualOverride ? 'Modo Manual' : 'Inteligencia Colectiva'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-cyan-200/70">Consenso comunitario entre múltiples bancos y cruce zero-knowledge.</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${getBadgeClass(consortiumMath.level)}`}>
                  {consortiumMath.level} RIESGO
                </span>
              </div>

              <div className="flex items-center justify-between my-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#64748b] block font-mono font-bold">Puntaje Red Consorcio</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-5xl font-mono font-black ${
                      consortiumMath.finalScore >= editingConfig.highRiskThreshold ? 'text-rose-400' : consortiumMath.finalScore >= editingConfig.mediumRiskThreshold ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {consortiumMath.finalScore}
                    </span>
                    <span className="text-sm text-[#64748b] font-mono">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-[#64748b] block font-mono font-bold">Recomendación Red</span>
                  <span className={`inline-block px-3.5 py-1.5 rounded-xl text-xs font-black border mt-1 shadow-sm ${
                    consortiumMath.recommendation === 'BLOQUEAR'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : consortiumMath.recommendation === 'DESAFIO_2FA'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {consortiumMath.recommendation}
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-[#060c17] rounded-full h-2.5 overflow-hidden border border-[#1e365b] mb-4">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    consortiumMath.finalScore >= editingConfig.highRiskThreshold ? 'bg-gradient-to-r from-amber-500 to-rose-500' : consortiumMath.finalScore >= editingConfig.mediumRiskThreshold ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, consortiumMath.finalScore)}%` }}
                />
              </div>

              {/* Slider directo en caso de Override */}
              {manualOverrideActive ? (
                <div className="p-3 bg-[#081223] border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs text-cyan-200">
                    <span className="font-bold">Ajuste Forzado Score Consorcio:</span>
                    <span className="font-mono font-bold text-white">{forcedConsortiumScore} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={forcedConsortiumScore}
                    onChange={e => setForcedConsortiumScore(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-2 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>
              ) : (
                <div className="pt-3 border-t border-[#1e3a6a] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-[#cbd5e1]">
                    <span className="text-[#94a3b8]">Multi-Entidad ({consortiumMath.totalEntities} bancos):</span>
                    <span className="font-semibold text-cyan-300">{consortiumMath.multiEntityMultiplier.toFixed(2)}x Multiplicador</span>
                  </div>
                  <div className="flex justify-between text-[#cbd5e1]">
                    <span className="text-[#94a3b8]">Aporte Red Externa (Trust Weight):</span>
                    <span className="text-white">+{consortiumMath.otherContrib} pts</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#071329] border border-[#1b3b6e] text-[11px] text-cyan-200 flex items-center justify-between">
                    <span><strong>Delta Federal:</strong> {deltaScore > 0 ? `+${deltaScore} pts prevenidos por Consorcio` : 'Sin divergencia con interno'}</span>
                    {consortiumMath.deviceFarmTriggered && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                        📱 Granja PISO 85
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── PARÁMETROS INTERACTIVOS PARA JUGAR CON AMBOS SCORES ── */}
          <div className="p-6 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#17253d] pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Controles de Simulación & Ajuste Paramétrico en Vivo
                </h3>
              </div>
              <span className="text-[11px] text-[#94a3b8]">Mueve los controles para ver el recalculo instantáneo en ambos tacómetros.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* GRUPO 1: HISTORIAL INTERNO */}
              <div className="p-4 bg-[#081223] border border-[#172b4d] rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5" /> Entidad Propia
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                    {internalReportsCount} reportes
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Reportes propios:</span>
                    <span className="font-mono text-white">{internalReportsCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={internalReportsCount}
                    onChange={e => setInternalReportsCount(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Tipología propia:</label>
                  <select
                    value={internalTypology}
                    onChange={e => setInternalTypology(e.target.value as IncidentCategory)}
                    className="w-full bg-[#0d182e] border border-[#1e365b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {TYPOLOGIES.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({editingConfig.severityBase?.[t.id] ?? t.baseScore} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Días desde el reporte:</span>
                    <span className="font-mono text-amber-300">{internalDaysAgo} días</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="365"
                    step="5"
                    value={internalDaysAgo}
                    onChange={e => setInternalDaysAgo(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* GRUPO 2: CONSORCIO Y CONFIANZA */}
              <div className="p-4 bg-[#081223] border border-[#172b4d] rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Red Consorcio
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                    {consortiumOtherEntities} otras entidades
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Otras entidades que reportaron:</span>
                    <span className="font-mono text-white">{consortiumOtherEntities}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="1"
                    value={consortiumOtherEntities}
                    onChange={e => setConsortiumOtherEntities(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Tipología en consorcio:</label>
                  <select
                    value={consortiumTypology}
                    onChange={e => setConsortiumTypology(e.target.value as IncidentCategory)}
                    className="w-full bg-[#0d182e] border border-[#1e365b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {TYPOLOGIES.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({editingConfig.severityBase?.[t.id] ?? t.baseScore} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Trust Weight promedio:</span>
                    <span className="font-mono text-cyan-300">{(consortiumAvgTrustWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={consortiumAvgTrustWeight}
                    onChange={e => setConsortiumAvgTrustWeight(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* GRUPO 3: DISCORDANCIAS Y VELOCIDAD */}
              <div className="p-4 bg-[#081223] border border-[#172b4d] rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Anomalías & Velocidad
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#14233c]">
                  <span className="text-[11px] text-[#cbd5e1]">Identity Mismatch (+{editingConfig.mismatchPenalty}):</span>
                  <button
                    onClick={() => setMismatchEnabled(!mismatchEnabled)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                      mismatchEnabled
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-[#13233e] text-[#64748b] border border-[#203c68]'
                    }`}
                  >
                    {mismatchEnabled ? 'ACTIVADO' : 'NORMAL'}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Consultas en última 1 hora:</span>
                    <span className="font-mono text-purple-300">{velocityLookups1h} req/h</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={velocityLookups1h}
                    onChange={e => setVelocityLookups1h(Number(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>CUITs vinculados a dispositivo:</span>
                    <span className="font-mono text-rose-300">{deviceLinkedCuits} CUITs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={deviceLinkedCuits}
                    onChange={e => setDeviceLinkedCuits(Number(e.target.value))}
                    className="w-full accent-rose-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                  {deviceLinkedCuits >= (editingConfig.deviceFarmThreshold ?? 3) && (
                    <span className="text-[10px] text-rose-400 block mt-1 font-bold">
                      ⚠️ Cluster de Granja detectado (Piso forzado a {editingConfig.deviceFarmFloor} pts)
                    </span>
                  )}
                </div>
              </div>

              {/* GRUPO 4: EMAIL INTELLIGENCE */}
              <div className="p-4 bg-[#081223] border border-[#172b4d] rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email Intelligence
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    País + Edad
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Estado de Entregabilidad:</label>
                  <select
                    value={emailStatus}
                    onChange={e => setEmailStatus(e.target.value as any)}
                    className="w-full bg-[#0d182e] border border-[#1e365b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="EXISTING">✅ Existente y Válido (0 pts)</option>
                    <option value="NON_EXISTENT">❌ Inexistente / DNS Fallido (+{editingConfig.emailPenalties?.nonExistent} pts)</option>
                    <option value="DISPOSABLE">⚠️ Correo Temporal / Descartable (+{editingConfig.emailPenalties?.disposable} pts)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94a3b8] mb-1">
                    <span>Antigüedad del Dominio:</span>
                    <span className="font-mono text-emerald-300">
                      {domainAgeDays < 30 ? `${domainAgeDays}d (NUEVO +${editingConfig.emailPenalties?.newDomain})` : domainAgeDays < 365 ? `${Math.round(domainAgeDays/30)} meses (+${editingConfig.emailPenalties?.mediumDomain})` : `${Math.round(domainAgeDays/365)} años (Maduro)`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2000"
                    step="10"
                    value={domainAgeDays}
                    onChange={e => setDomainAgeDays(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">País detectado (ccTLD / MX):</label>
                  <select
                    value={emailCountryCode}
                    onChange={e => setEmailCountryCode(e.target.value)}
                    className="w-full bg-[#0d182e] border border-[#1e365b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="AR">🇦🇷 Argentina (.com.ar / .ar)</option>
                    <option value="BR">🇧🇷 Brasil (.com.br)</option>
                    <option value="MX">🇲🇽 México (.com.mx)</option>
                    <option value="CL">🇨🇱 Chile (.cl)</option>
                    <option value="US">🇺🇸 Estados Unidos (.us / .com)</option>
                    <option value="GLOBAL">🌐 Global / No Determinado</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: MODIFICACIÓN DE REGLAS GLOBALES DEL MOTOR ───────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'engine-params' && (
        <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#17253d] pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                Configuración del Motor Antifraude de la Plataforma
              </h3>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Modifica los pesos, multiplicadores y umbrales que controlan el cálculo en vivo de ambos scores en toda la red.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyMotorPreset('BALANCED')}
                className="px-3 py-1.5 rounded-lg bg-[#0f213e] text-slate-300 hover:text-white text-xs font-medium border border-[#203c68]"
              >
                Perfil Balanceado
              </button>
              <button
                onClick={() => handleApplyMotorPreset('STRICT')}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 text-rose-300 text-xs font-bold border border-rose-800/40"
              >
                Tolerancia Cero
              </button>
              <button
                onClick={() => handleApplyMotorPreset('PERMISSIVE')}
                className="px-3 py-1.5 rounded-lg bg-amber-950/40 text-amber-300 text-xs font-medium border border-amber-800/40"
              >
                Baja Fricción
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Umbrales de Corte */}
            <div className="p-4 bg-[#081223] border border-[#1e365b] rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-[#152544] pb-2">
                <Target className="h-4 w-4 text-cyan-400" />
                Umbrales de Nivel de Riesgo
              </h4>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Umbral ALTO RIESGO (Bloqueo):</span>
                  <span className="font-mono text-rose-400 font-bold">{editingConfig.highRiskThreshold} pts</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={editingConfig.highRiskThreshold}
                  onChange={e => setEditingConfig({ ...editingConfig, highRiskThreshold: Number(e.target.value) })}
                  className="w-full accent-rose-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Umbral MEDIO RIESGO (Desafío 2FA):</span>
                  <span className="font-mono text-amber-400 font-bold">{editingConfig.mediumRiskThreshold} pts</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="50"
                  value={editingConfig.mediumRiskThreshold}
                  onChange={e => setEditingConfig({ ...editingConfig, mediumRiskThreshold: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Vida Media de Decaimiento (Días):</span>
                  <span className="font-mono text-cyan-300 font-bold">{editingConfig.decayHalfLifeDays || 180} días</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="365"
                  step="15"
                  value={editingConfig.decayHalfLifeDays || 180}
                  onChange={e => setEditingConfig({ ...editingConfig, decayHalfLifeDays: Number(e.target.value) })}
                  className="w-full accent-cyan-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 2. Penalidades de Anomalías */}
            <div className="p-4 bg-[#081223] border border-[#1e365b] rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-[#152544] pb-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Penalidades de Red & Granjas
              </h4>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Penalidad Identity Mismatch:</span>
                  <span className="font-mono text-white font-bold">+{editingConfig.mismatchPenalty} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  value={editingConfig.mismatchPenalty}
                  onChange={e => setEditingConfig({ ...editingConfig, mismatchPenalty: Number(e.target.value) })}
                  className="w-full accent-blue-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Penalidad Ráfaga de Consultas (Velocidad):</span>
                  <span className="font-mono text-white font-bold">+{editingConfig.velocityPenalty} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={editingConfig.velocityPenalty}
                  onChange={e => setEditingConfig({ ...editingConfig, velocityPenalty: Number(e.target.value) })}
                  className="w-full accent-purple-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Piso Score Granja de Emuladores:</span>
                  <span className="font-mono text-rose-400 font-bold">{editingConfig.deviceFarmFloor} pts</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={editingConfig.deviceFarmFloor}
                  onChange={e => setEditingConfig({ ...editingConfig, deviceFarmFloor: Number(e.target.value) })}
                  className="w-full accent-rose-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Multiplicadores de Red Consorcio */}
            <div className="p-4 bg-[#081223] border border-[#1e365b] rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-[#152544] pb-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                Multiplicadores Multi-Entidad
              </h4>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Multiplicador 2 Entidades:</span>
                  <span className="font-mono text-emerald-400 font-bold">{editingConfig.multiEntityMultipliers?.two}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.6"
                  step="0.05"
                  value={editingConfig.multiEntityMultipliers?.two ?? 1.25}
                  onChange={e => setEditingConfig({
                    ...editingConfig,
                    multiEntityMultipliers: {
                      ...editingConfig.multiEntityMultipliers,
                      two: Number(e.target.value),
                    },
                  })}
                  className="w-full accent-emerald-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Multiplicador 3 Entidades:</span>
                  <span className="font-mono text-emerald-400 font-bold">{editingConfig.multiEntityMultipliers?.three}x</span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="1.9"
                  step="0.05"
                  value={editingConfig.multiEntityMultipliers?.three ?? 1.50}
                  onChange={e => setEditingConfig({
                    ...editingConfig,
                    multiEntityMultipliers: {
                      ...editingConfig.multiEntityMultipliers,
                      three: Number(e.target.value),
                    },
                  })}
                  className="w-full accent-emerald-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                  <span>Multiplicador 4+ Entidades:</span>
                  <span className="font-mono text-emerald-400 font-bold">{editingConfig.multiEntityMultipliers?.fourOrMore}x</span>
                </div>
                <input
                  type="range"
                  min="1.4"
                  max="2.5"
                  step="0.05"
                  value={editingConfig.multiEntityMultipliers?.fourOrMore ?? 1.80}
                  onChange={e => setEditingConfig({
                    ...editingConfig,
                    multiEntityMultipliers: {
                      ...editingConfig.multiEntityMultipliers,
                      fourOrMore: Number(e.target.value),
                    },
                  })}
                  className="w-full accent-emerald-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 4. Pesos Base de Tipologías */}
          <div className="p-5 bg-[#081223] border border-[#1e365b] rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-[#152544] pb-2">
              <Layers className="h-4 w-4 text-purple-400" />
              Pesos Base por Tipología de Delito (Severidad 0-100)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TYPOLOGIES.map(t => (
                <div key={t.id} className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">{t.label}</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {editingConfig.severityBase?.[t.id] ?? t.baseScore} pts
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={editingConfig.severityBase?.[t.id] ?? t.baseScore}
                    onChange={e => setEditingConfig({
                      ...editingConfig,
                      severityBase: {
                        ...editingConfig.severityBase,
                        [t.id]: Number(e.target.value),
                      },
                    })}
                    className="w-full accent-cyan-500 h-1.5 bg-[#17253d] rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-[#64748b] block">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de Guardado y Restablecer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#17253d]">
            <button
              onClick={handleResetConfig}
              className="px-4 py-2.5 rounded-xl bg-[#13233e] hover:bg-[#1a3052] text-[#94a3b8] hover:text-white text-xs font-semibold border border-[#203c68] transition flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer Valores Recomendados
            </button>

            <button
              onClick={handleSaveConfig}
              className="px-6 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-bold shadow-[0_0_20px_rgba(29,78,216,0.4)] border border-[#3b82f6]/60 transition flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Guardar Configuración en la Plataforma
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: BANCO DE PRUEBAS DE IDENTIDADES (SANDBOX) ───────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'sandbox' && (
        <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl space-y-6">
          <div className="border-b border-[#17253d] pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-400" />
              Banco de Pruebas de Identidades (Simulación con la Configuración Activa)
            </h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Prueba cualquier identificador real o de prueba para verificar cómo responden los 2 scores con los parámetros que configuraste.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sandboxIdentifierType}
              onChange={e => setSandboxIdentifierType(e.target.value as any)}
              className="bg-[#081223] border border-[#1e365b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="EMAIL">EMAIL</option>
              <option value="DNI">DNI</option>
              <option value="CUIT">CUIT</option>
              <option value="CBU">CBU / CVU</option>
            </select>

            <input
              type="text"
              value={sandboxValue}
              onChange={e => setSandboxValue(e.target.value)}
              placeholder="Ingresa valor a evaluar..."
              className="flex-1 min-w-[280px] bg-[#081223] border border-[#1e365b] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />

            <button
              onClick={handleRunSandbox}
              disabled={isSandboxRunning}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              {isSandboxRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Evaluar Identidad
            </button>
          </div>

          {/* Ejemplos predefinidos */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#64748b]">Ejemplos rápidos:</span>
            <button
              onClick={() => { setSandboxIdentifierType('EMAIL'); setSandboxValue('estafador.red@gmail.com'); }}
              className="px-2.5 py-1 rounded bg-[#0f213e] text-blue-300 hover:text-white border border-[#203c68]"
            >
              estafador.red@gmail.com (Email de red)
            </button>
            <button
              onClick={() => { setSandboxIdentifierType('DNI'); setSandboxValue('30111222'); }}
              className="px-2.5 py-1 rounded bg-[#0f213e] text-blue-300 hover:text-white border border-[#203c68]"
            >
              DNI 30111222 (Cuenta Mula)
            </button>
            <button
              onClick={() => { setSandboxIdentifierType('EMAIL'); setSandboxValue('usuario.limpio@empresa.com'); }}
              className="px-2.5 py-1 rounded bg-[#0f213e] text-emerald-300 hover:text-white border border-[#203c68]"
            >
              usuario.limpio@empresa.com (Limpio)
            </button>
          </div>

          {/* Resultado de la evaluación */}
          {sandboxResult && (
            <div className="p-5 bg-[#081223] border border-[#1e365b] rounded-xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#14233c] pb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-cyan-400" />
                  Resultado de Evaluación con Motor Activo
                </span>
                <span className="font-mono text-xs text-[#94a3b8]">Latencia: {sandboxResult.latencyMs}ms</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#0a1528] border border-blue-500/30 rounded-xl">
                  <span className="text-[11px] text-[#94a3b8] font-bold block">1. Score de la Entidad:</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-mono font-black text-blue-400">
                      {sandboxResult.internalRiskScore ?? 0}
                    </span>
                    <span className="text-xs text-[#64748b]">/ 100</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(sandboxResult.internalRiskLevel ?? 'BAJO')}`}>
                      {sandboxResult.internalRiskLevel ?? 'BAJO'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[#0a1528] border border-cyan-500/30 rounded-xl">
                  <span className="text-[11px] text-[#94a3b8] font-bold block">2. Score del Consorcio (Federal):</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-mono font-black text-cyan-400">
                      {sandboxResult.consortiumRiskScore ?? sandboxResult.riskScore}
                    </span>
                    <span className="text-xs text-[#64748b]">/ 100</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(sandboxResult.consortiumRiskLevel ?? sandboxResult.riskLevel)}`}>
                      {sandboxResult.consortiumRiskLevel ?? sandboxResult.riskLevel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#060c17] rounded-lg font-mono text-[11px] text-slate-300 flex justify-between">
                <span>Blind Hash ZK: {sandboxResult.blindHash.slice(0, 16)}...{sandboxResult.blindHash.slice(-8)}</span>
                <span className="text-cyan-400 font-bold">Recomendación: {sandboxResult.recommendation}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 4: ESPECIFICACIÓN MATEMÁTICA & ALGORITMOS ─────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'algorithms' && (
        <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#17253d] pb-4">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Arquitectura de Algoritmos & Fórmulas Matemáticas del Motor Antifraude
              </h3>
            </div>
            <span className="text-[11px] text-[#94a3b8]">Especificación técnica auditable bajo estándares BCRA A7370.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveAlgorithmTab('decay')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAlgorithmTab === 'decay' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#13233e] text-[#94a3b8] hover:text-white border border-[#203c68]'
              }`}
            >
              1. Time Decay (Vida Media)
            </button>
            <button
              onClick={() => setActiveAlgorithmTab('consensus')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAlgorithmTab === 'consensus' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#13233e] text-[#94a3b8] hover:text-white border border-[#203c68]'
              }`}
            >
              2. Multi-Entity Synergy
            </button>
            <button
              onClick={() => setActiveAlgorithmTab('trust')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAlgorithmTab === 'trust' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#13233e] text-[#94a3b8] hover:text-white border border-[#203c68]'
              }`}
            >
              3. Ponderación Trust Weight
            </button>
            <button
              onClick={() => setActiveAlgorithmTab('email')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAlgorithmTab === 'email' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#13233e] text-[#94a3b8] hover:text-white border border-[#203c68]'
              }`}
            >
              4. Email Intelligence & Aging
            </button>
            <button
              onClick={() => setActiveAlgorithmTab('override')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAlgorithmTab === 'override' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#13233e] text-[#94a3b8] hover:text-white border border-[#203c68]'
              }`}
            >
              5. Critical Override & Kill-Switch
            </button>
          </div>

          <div className="p-5 bg-[#070e1c] border border-[#162746] rounded-xl text-xs space-y-3">
            {activeAlgorithmTab === 'decay' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Clock className="h-4 w-4" />
                  <span>Algoritmo de Atenuación Temporal (Decaimiento Exponencial con Piso de Seguridad)</span>
                </div>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Los incidentes pierden severidad progresivamente a medida que transcurren los meses sin reincidencia, modelando la rehabilitación crediticia/financiera.
                </p>
                <div className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg font-mono text-[11px] text-cyan-300">
                  Fórmula: FactorDecay = Math.max(Piso, Math.pow(0.5, diasTranscurridos / {editingConfig.decayHalfLifeDays || 180}))
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[#94a3b8]">
                  <li><strong>Vida Media Calibrada:</strong> {editingConfig.decayHalfLifeDays || 180} días.</li>
                  <li><strong>Piso Cuentas Mula:</strong> {editingConfig.decayFloor?.MULE_ACCOUNT ?? 40}% retención mínima.</li>
                  <li><strong>Piso Phishing / Otras:</strong> {editingConfig.decayFloor?.PHISHING ?? 10}% retención mínima.</li>
                </ul>
              </div>
            )}

            {activeAlgorithmTab === 'consensus' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Shield className="h-4 w-4" />
                  <span>Algoritmo de Sinergia y Consenso Multi-Entidad</span>
                </div>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Cuando el mismo DNI, CBU o Email es denunciado por múltiples entidades independientes de la red, se aplica un multiplicador de correlación cruzada.
                </p>
                <div className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg font-mono text-[11px] text-cyan-300">
                  1 Entidad = 1.00x | 2 Entidades = {editingConfig.multiEntityMultipliers?.two}x | 3 Entidades = {editingConfig.multiEntityMultipliers?.three}x | 4+ Entidades = {editingConfig.multiEntityMultipliers?.fourOrMore}x
                </div>
              </div>
            )}

            {activeAlgorithmTab === 'trust' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-300 font-bold">
                  <Building className="h-4 w-4" />
                  <span>Ponderación por Índice de Reputación y Confianza (Trust Weight)</span>
                </div>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Cada entidad bancaria o fintech participante posee un factor de fiabilidad gestionado por la Gobernanza. Si una entidad tiene reportes no contrastados, su peso se atenúa para no generar falsos positivos en el consorcio.
                </p>
                <div className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg font-mono text-[11px] text-cyan-300">
                  PuntajeRed = SeveridadBase * TrustWeight_Entidad * FactorDecay
                </div>
              </div>
            )}

            {activeAlgorithmTab === 'email' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <Mail className="h-4 w-4" />
                  <span>Algoritmo de Inteligencia de Correo: Detección Geográfica & Madurez de Dominio</span>
                </div>
                <div className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg font-mono text-[11px] text-emerald-300">
                  PenalidadEmail = Inexistente(+{editingConfig.emailPenalties?.nonExistent}) + Descartable(+{editingConfig.emailPenalties?.disposable}) + DominioNuevo(+{editingConfig.emailPenalties?.newDomain})
                </div>
              </div>
            )}

            {activeAlgorithmTab === 'override' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-rose-300 font-bold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Critical Override & Protocolo de Kill-Switch Inmediato</span>
                </div>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Evita que un promedio atenúe un factor concluyente de extrema gravedad:
                </p>
                <div className="p-3 bg-[#0a1528] border border-[#1b345f] rounded-lg font-mono text-[11px] text-rose-300">
                  Critical Override: Si max(IndividualScore_i) &gt;= {editingConfig.criticalOverrideThreshold} =&gt; ScoreFinal = max(ScoreGlobal, maxScore * 1.05)
                </div>
                <p className="text-[#94a3b8]">
                  <strong>Kill-Switch (&gt;= 90 pts):</strong> Intercepción automática en &lt;15ms con auto-pausa temporal preventiva de fondos.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
