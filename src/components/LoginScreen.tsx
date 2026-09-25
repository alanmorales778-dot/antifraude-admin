'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Crown,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  Network,
  Smartphone,
  CheckCircle,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

type PortalChoice = 'admin' | 'entity';
type LoginStep = 'CREDENTIALS' | '2FA' | 'SUCCESS';

interface Props {
  onEnterAdmin: () => void;
  onEnterEntity: (fintechId: string) => void;
}

export default function LoginScreen({ onEnterAdmin, onEnterEntity }: Props) {
  const { fintechs } = useConsortiumStore();
  const [choice, setChoice] = useState<PortalChoice | null>(null);
  const [step, setStep] = useState<LoginStep>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [fintechId, setFintechId] = useState(fintechs[0]?.id || 'fintech-alpha');
  const [loading, setLoading] = useState(false);

  // 2FA State
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer para TOTP
  useEffect(() => {
    if (step !== '2FA') return;
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleSelect = (p: PortalChoice) => {
    setChoice(p);
    setStep('CREDENTIALS');
    setEmail(p === 'admin' ? 'superadmin@consorcio.ar' : 'analista.fraude@banco.com.ar');
    setPassword('••••••••••••');
    setShowPw(false);
    setOtpCode(['', '', '', '', '', '']);
    setOtpError('');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    // Simular verificación de credenciales inicial
    await new Promise(r => setTimeout(r, 450));
    setLoading(false);
    setStep('2FA');
    setCountdown(30);
    setOtpError('');
    // Auto-focus primer input de OTP en el próximo tick
    setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 100);
  };

  const handleOtpChange = (index: number, val: string) => {
    setOtpError('');

    // Manejo de pegado (Paste)
    if (val.length > 1) {
      const cleanDigits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      cleanDigits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtpCode(newOtp);
      const nextFocusIdx = Math.min(cleanDigits.length, 5);
      otpInputsRef.current[nextFocusIdx]?.focus();
      return;
    }

    const digit = val.replace(/\D/g, '');
    const newOtp = [...otpCode];
    newOtp[index] = digit;
    setOtpCode(newOtp);

    // Auto-focus al siguiente input
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleFillDemoCode = () => {
    setOtpCode(['1', '2', '3', '4', '5', '6']);
    setOtpError('');
    otpInputsRef.current[5]?.focus();
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpCode.join('');
    if (code.length < 6) {
      setOtpError('Por favor ingresá los 6 dígitos del código de seguridad.');
      return;
    }

    setLoading(true);
    setOtpError('');

    // Simular validación criptográfica del TOTP HMAC
    await new Promise(r => setTimeout(r, 650));
    setLoading(false);
    setStep('SUCCESS');

    // Transición suave al portal
    setTimeout(() => {
      if (choice === 'admin') {
        onEnterAdmin();
      } else {
        onEnterEntity(fintechId);
      }
    }, 1100);
  };

  const activeEntityName =
    fintechs.find(f => f.id === fintechId)?.name || 'Entidad Financiera';

  return (
    <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo con gradiente radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/25 flex items-center justify-center shadow-lg shadow-cyan-900/20">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
                CONSORCIO ANTIFRAUDE
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Zero-Knowledge Threat Intelligence · BCRA Com. A 7724
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Red Federal Activa
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-slate-500" />
              P99 &lt; 50ms
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-slate-500" />
              SHA-256 ZK + 2FA
            </span>
          </div>
        </div>

        {/* Selección inicial de portal */}
        {!choice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card SuperAdmin */}
            <button
              onClick={() => handleSelect('admin')}
              className="group flex flex-col gap-5 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] hover:border-amber-500/30 p-6 text-left transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">SuperAdmin</p>
                <p className="text-[11px] font-mono text-amber-500/50 mt-0.5">
                  admin.antifraude.com
                </p>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Gestión de entidades, trust weights, reglas globales y gobernanza del consorcio.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-500/60 group-hover:text-amber-400 transition font-medium">
                Acceder con 2FA <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>

            {/* Card Entidades */}
            <button
              onClick={() => handleSelect('entity')}
              className="group flex flex-col gap-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] hover:border-cyan-500/30 p-6 text-left transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-xl bg-cyan-500/12 border border-cyan-500/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Portal de Entidades</p>
                <p className="text-[11px] font-mono text-cyan-500/50 mt-0.5">
                  app.antifraude.com
                </p>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Consultas de riesgo preventivo, reporte federado, CBU/CVU y telemetría de cuentas mula.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-cyan-500/60 group-hover:text-cyan-400 transition font-medium">
                Acceder con 2FA <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>
        )}

        {/* Modal / Card de Acceso con Pasos */}
        {choice && (
          <div
            className={`rounded-2xl border p-6 shadow-2xl transition-all ${
              choice === 'admin'
                ? 'border-amber-500/20 bg-amber-500/[0.03] shadow-amber-950/20'
                : 'border-cyan-500/20 bg-cyan-500/[0.03] shadow-cyan-950/20'
            }`}
          >
            {/* Header del formulario */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                    choice === 'admin'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                  }`}
                >
                  {choice === 'admin' ? (
                    <Crown className="h-5 w-5" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {choice === 'admin' ? 'SuperAdmin Consorcio' : activeEntityName}
                  </p>
                  <p
                    className={`text-[11px] font-mono ${
                      choice === 'admin' ? 'text-amber-500/60' : 'text-cyan-500/60'
                    }`}
                  >
                    {step === 'CREDENTIALS' && 'Paso 1 de 2: Credenciales de Acceso'}
                    {step === '2FA' && 'Paso 2 de 2: Verificación Multifactor (2FA)'}
                    {step === 'SUCCESS' && 'Autenticación Criptográfica Exitosa'}
                  </p>
                </div>
              </div>

              {/* Indicador de pasos visual */}
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    step === 'CREDENTIALS'
                      ? 'bg-white/10 border-white/20 text-white font-bold'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}
                >
                  1. Login
                </span>
                <span className="text-slate-600">→</span>
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    step === '2FA'
                      ? choice === 'admin'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold'
                        : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-bold'
                      : step === 'SUCCESS'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold'
                      : 'border-white/5 text-slate-600'
                  }`}
                >
                  2. 2FA
                </span>
              </div>
            </div>

            {/* ── PASO 1: CREDENCIALES ──────────────────────────────── */}
            {step === 'CREDENTIALS' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                {/* Selector de entidad si es portal de entidades */}
                {choice === 'entity' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Entidad Financiera o Fintech Participante
                    </label>
                    <select
                      value={fintechId}
                      onChange={e => setFintechId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 text-xs font-medium text-white focus:border-cyan-500/50 focus:outline-none transition"
                    >
                      {fintechs.length > 0 ? (
                        fintechs.map(f => (
                          <option
                            key={f.id}
                            value={f.id}
                            disabled={f.status === 'SUSPENDED'}
                            className="bg-slate-900 text-white"
                          >
                            {f.name} {f.status === 'SUSPENDED' ? '(Suspendida)' : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="fintech-alpha">Fintech Alpha</option>
                          <option value="banco-beta">Banco Beta</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Usuario / Email Institucional
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition font-mono"
                    placeholder="analista@banco.com.ar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Nota informativa de seguridad 2FA */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-slate-400 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    El acceso a la red de Threat Intelligence requiere verificación obligatoria de dos factores (2FA / TOTP) según normativa BCRA.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg ${
                    choice === 'admin'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                      : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                  }`}
                >
                  {loading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      Continuar a Verificación 2FA
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── PASO 2: VERIFICACIÓN 2FA ──────────────────────────── */}
            {step === '2FA' && (
              <form onSubmit={handleVerify2FA} className="space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 mb-1">
                    <Smartphone className="h-3.5 w-3.5" /> Token TOTP Requerido
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Código de Autenticación
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Ingresá los 6 dígitos generados por tu aplicación autenticadora (Google Authenticator, Microsoft Authenticator o llave física FIDO2).
                  </p>
                </div>

                {/* 6 Casilleros para OTP */}
                <div className="flex justify-center gap-2 sm:gap-2.5 py-1">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      className={`h-12 w-11 sm:h-13 sm:w-12 rounded-xl border text-center font-mono text-xl font-bold transition shadow-inner ${
                        digit
                          ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200'
                          : 'border-white/10 bg-slate-900/90 text-white focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Contador y Helper de Código Demo */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                    Renovación en: <strong className="text-cyan-300 font-mono">{countdown}s</strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleFillDemoCode}
                    className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 transition"
                  >
                    <KeyRound className="h-3 w-3" />
                    Autocompletar demo (123456)
                  </button>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('CREDENTIALS')}
                    className="w-1/3 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition"
                  >
                    ← Volver
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg ${
                      choice === 'admin'
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                        : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                    }`}
                  >
                    {loading ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        Verificar & Establecer Sesión
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── PASO 3: ÉXITO Y CONEXIÓN ZERO-KNOWLEDGE ───────────── */}
            {step === 'SUCCESS' && (
              <div className="py-8 text-center space-y-4 animate-fade-in">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/40">
                  <ShieldCheck className="h-9 w-9 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    ¡Autenticación 2FA Exitosa!
                  </h4>
                  <p className="text-xs text-slate-400">
                    Estableciendo túnel Zero-Knowledge mTLS cifrado...
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-cyan-400">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  Token de Sesión Firmado por el Consorcio
                </div>
              </div>
            )}

            {/* Link para volver a seleccionar portal */}
            {step !== 'SUCCESS' && (
              <button
                onClick={() => {
                  setChoice(null);
                  setStep('CREDENTIALS');
                }}
                className="mt-5 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition"
              >
                ← Cambiar portal
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-slate-600">
          Consorcio Antifraude ARG · Protocolo Zero-Knowledge · Ley 25.326 · BCRA Com. A 7724
        </p>
      </div>
    </div>
  );
}
