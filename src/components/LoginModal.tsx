'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Smartphone, CheckCircle, ArrowRight, X, KeyRound, Building2 } from 'lucide-react';
import { Tenant } from '@/lib/types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  currentTenant: Tenant;
  onSuccess: (tenant: Tenant) => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  tenants,
  currentTenant,
  onSuccess,
}: LoginModalProps) {
  const [step, setStep] = useState<'CREDENTIALS' | '2FA' | 'SUCCESS'>('CREDENTIALS');
  const [selectedTenantId, setSelectedTenantId] = useState(currentTenant.id);
  const [email, setEmail] = useState('analista.fraude@consorcio-demo.ar');
  const [password, setPassword] = useState('••••••••••••');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(28);

  // Countdown timer for TOTP simulation
  useEffect(() => {
    if (step !== '2FA') return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  if (!isOpen) return null;

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStep('2FA');
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      // Paste handling
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtpCode(newOtp);
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = val.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerify2FA = () => {
    const code = otpCode.join('');
    // Aceptamos cualquier código de 6 dígitos o demo 123456
    if (code.length === 6) {
      setStep('SUCCESS');
      const tenant = tenants.find(t => t.id === selectedTenantId) || currentTenant;
      setTimeout(() => {
        onSuccess(tenant);
        onClose();
        setStep('CREDENTIALS');
      }, 1200);
    } else {
      setErrorMsg('Ingresa los 6 dígitos del token de autenticación.');
    }
  };

  const fillDemoCode = () => {
    setOtpCode(['1', '2', '3', '4', '5', '6']);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d121f] p-6 shadow-2xl shadow-indigo-950/50">
        {/* Glow accent */}
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0d121f]">
              {step === 'CREDENTIALS' && <Building2 className="h-6 w-6 text-indigo-400" />}
              {step === '2FA' && <Smartphone className="h-6 w-6 text-cyan-400 animate-pulse" />}
              {step === 'SUCCESS' && <CheckCircle className="h-6 w-6 text-emerald-400" />}
            </div>
          </div>
          <h3 className="text-lg font-bold text-white">
            {step === 'CREDENTIALS' && 'Acceso al Consorcio Antifraude B2B'}
            {step === '2FA' && 'Verificación en Dos Pasos (2FA)'}
            {step === 'SUCCESS' && '¡Sesión Criptográfica Establecida!'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {step === 'CREDENTIALS' && 'Portal seguro para analistas de riesgo y prevención de fraude'}
            {step === '2FA' && 'Autenticación obligatoria mediante token temporal TOTP'}
            {step === 'SUCCESS' && 'Conectando al clúster de Threat Intelligence...'}
          </p>
        </div>

        {/* Step 1: Credentials */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Entidad Financiera o Fintech Participante
              </label>
              <select
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.logo} {t.name} ({t.subscriptionTier})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Usuario / Analista de Riesgo
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                placeholder="analista@banco.com.ar"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-[11px] text-cyan-300">
              <span className="font-semibold">Modo Demo Activo:</span> Puedes ingresar directamente seleccionando cualquier entidad de la red bancaria y fintech argentina.
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98]"
            >
              Continuar a Verificación 2FA <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Step 2: 2FA TOTP */}
        {step === '2FA' && (
          <div className="space-y-4">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                <Lock className="h-3 w-3" /> Token de Seguridad Requerido
              </span>
              <p className="mt-2 text-xs text-slate-300">
                Ingresa el código de 6 dígitos generado por tu aplicación autenticadora (Google Authenticator, Microsoft Authenticator o llave física).
              </p>
            </div>

            {/* OTP 6 Digits */}
            <div className="flex justify-center gap-2 py-2">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  className="h-12 w-11 rounded-xl border border-white/15 bg-slate-900 text-center font-mono text-lg font-bold text-white shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              ))}
            </div>

            {errorMsg && (
              <p className="text-center text-xs font-medium text-rose-400">{errorMsg}</p>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>El código renueva en: <strong className="text-cyan-400">{countdown}s</strong></span>
              <button
                type="button"
                onClick={fillDemoCode}
                className="font-medium text-indigo-400 hover:underline hover:text-indigo-300"
              >
                Copiar código demo: 123456
              </button>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setStep('CREDENTIALS')}
                className="w-1/3 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleVerify2FA}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-90 active:scale-[0.98]"
              >
                Verificar & Autenticar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success state */}
        {step === 'SUCCESS' && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold text-white">Sesión Autenticada con 2FA</h4>
            <p className="text-xs text-slate-400">
              Canal criptográfico mTLS simulado establecido exitosamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
