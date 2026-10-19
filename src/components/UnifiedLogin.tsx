'use client';

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Check,
  ArrowRight,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  HelpCircle,
  QrCode,
  Sparkles,
  Building2,
  Clock,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { generateTOTPSecret, generateTOTPUri, generateQRCodeSvg } from '@/lib/totp';
import ConsortiumLogo from '@/components/ConsortiumLogo';

interface UnifiedLoginProps {
  portalType?: 'partner' | 'admin';
  onSuccess?: () => void;
  onNavigateHome?: () => void;
  onNavigateAdmin?: () => void;
}

export default function UnifiedLogin({
  portalType = 'partner',
  onSuccess,
  onNavigateHome,
  onNavigateAdmin,
}: UnifiedLoginProps) {
  const { loginUnified, complete2FAEnrollment, setCurrentRoute, appUsers, fintechs } = useConsortiumStore();
  const isPartner = portalType === 'partner';
  const [selectedEntityId, setSelectedEntityId] = useState<string>(fintechs[0]?.id || '');

  React.useEffect(() => {
    if (!selectedEntityId && fintechs.length > 0) {
      setSelectedEntityId(fintechs[0].id);
    }
  }, [fintechs, selectedEntityId]);

  // Estados de flujo de pantalla: LOGIN | 2FA_CODE | 2FA_ENROLL | FORGOT_PASSWORD
  const [viewMode, setViewMode] = useState<'LOGIN' | '2FA_CODE' | '2FA_ENROLL' | 'FORGOT_PASSWORD'>('LOGIN');

  // Formulario Primario (Solo Email y Contraseña)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados de proceso
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);

  // Comprobar si hubo un timeout por inactividad previo
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const msg = sessionStorage.getItem('session_timeout_message');
        if (msg) {
          setTimeoutNotice(msg);
          sessionStorage.removeItem('session_timeout_message');
        }
      } catch {}
    }
  }, []);

  // 2FA Enrollment con Supabase MFA / TOTP
  const [factorId, setFactorId] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollQrCode, setEnrollQrCode] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Inicializar QR y secreto de 2FA
  const init2FAEnrollment = async (userEmail: string) => {
    setIsGeneratingQr(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

      if (data && data.totp) {
        setFactorId(data.id);
        setEnrollQrCode(data.totp.qr_code);
        setEnrollSecret(data.totp.secret);
      } else {
        const secret = generateTOTPSecret(32);
        setEnrollSecret(secret);
        const uri = generateTOTPUri(userEmail || 'analista@consorcio.ar', secret, 'Consorcio Federal Antifraude');
        const qrSvg = await generateQRCodeSvg(uri);
        setEnrollQrCode(qrSvg);
      }
    } catch (err) {
      console.warn('Fallback a generación local de TOTP QR:', err);
      const secret = generateTOTPSecret(32);
      setEnrollSecret(secret);
      const uri = generateTOTPUri(userEmail || 'analista@consorcio.ar', secret, 'Consorcio Federal Antifraude');
      const qrSvg = await generateQRCodeSvg(uri);
      setEnrollQrCode(qrSvg);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    }
  };

  // ── PASO 1: Validar Credenciales (Email + Contraseña) ──
  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await loginUnified({
        email: cleanEmail,
        password: password.trim(),
        totpCode: '',
        targetPortal: portalType,
        selectedEntityId: isPartner ? selectedEntityId : undefined,
      });

      if (res.requires2FAEnroll) {
        // Usuario no enrolado: abrir pantalla de enrolamiento con QR
        await init2FAEnrollment(cleanEmail);
        setViewMode('2FA_ENROLL');
      } else if (res.requires2FACode) {
        // Usuario ya enrolado: exigir código de 6 dígitos
        setViewMode('2FA_CODE');
      } else if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          if (res.targetRoute) setCurrentRoute(res.targetRoute);
          if (onSuccess) onSuccess();
        }, 600);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error validando credenciales de acceso.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PASO 2: Verificar Código Dinámico 2FA (TOTP de 6 dígitos) ──
  const handleVerify2FACode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = totpCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Ingrese el código numérico de 6 dígitos de Google Authenticator.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await loginUnified({
        email: cleanEmail,
        password: password.trim(),
        totpCode: cleanCode,
        targetPortal: portalType,
        selectedEntityId: isPartner ? selectedEntityId : undefined,
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          if (res.targetRoute) setCurrentRoute(res.targetRoute);
          if (onSuccess) onSuccess();
        }, 600);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error validando código 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PASO 3: Completar Enrolamiento Inicial 2FA ──
  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = enrollCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Por favor ingrese el código dinámico de 6 dígitos generado en Google Authenticator.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (factorId) {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.mfa.challengeAndVerify({
            factorId,
            code: cleanCode,
          });
        } catch (mfaErr) {
          console.warn('Supabase MFA challenge warning:', mfaErr);
        }
      }

      const cleanEmail = email.trim().toLowerCase();
      const res = await complete2FAEnrollment(cleanEmail, enrollSecret, cleanCode, portalType, isPartner ? selectedEntityId : undefined);
      setIsLoading(false);

      if (res.success) {
        setSuccessMsg('¡Google Authenticator vinculado y verificado! Redirigiendo a su panel...');
        setTimeout(() => {
          const nextRoute = res.targetRoute || (isPartner ? 'partner-portal' : 'admin-portal');
          setCurrentRoute(nextRoute);
          if (onSuccess) onSuccess();
        }, 800);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.message || 'Error validando el código de enrolamiento 2FA.');
    }
  };

  // ── PASO 4: Olvidé mi Contraseña (Recuperación) ──
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Ingrese un correo institucional válido.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });
      setSuccessMsg(`Se han enviado las instrucciones de restablecimiento de contraseña a ${cleanEmail}.`);
    } catch (err) {
      // Fallback amigable
      setSuccessMsg(`Solicitud registrada. Si el correo ${cleanEmail} está autorizado en la red, recibirá las instrucciones del Administrador.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Barra Superior ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onNavigateHome || (() => setCurrentRoute('partner-login'))}
            className="flex items-center gap-3 text-left group"
          >
            <ConsortiumLogo size="sm" showGlow={true} className="group-hover:scale-105 transition-transform" />
            <div>
              <span className="block text-xs font-bold tracking-wider text-white uppercase group-hover:text-cyan-300 transition-colors">
                {isPartner ? 'Portal de Entidades Financieras' : 'Consorcio Federal de Prevención de Fraude'}
              </span>
              <span className="block text-[11px] text-[#60a5fa] font-mono">
                {isPartner ? 'Acceso Bancos, Fintechs y Empresas · Prevención ZK' : 'Consola Central de Gobernanza · SuperAdmin'}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Red Federal Activa
            </span>
          </div>
        </div>
      </header>

      {/* ── Cuerpo Principal de Autenticación ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[460px]">
          <div className={`rounded-2xl overflow-hidden transition-all ${
            isPartner
              ? 'bg-[#0d182e] border border-[#1e365b] shadow-[0_12px_40px_rgba(3,7,18,0.7)]'
              : 'bg-[#14080d] border border-rose-900/60 shadow-[0_12px_45px_rgba(225,29,72,0.25)]'
          }`}>
            {/* Cabecera con Identidad Institucional */}
            <div className={`px-8 pt-8 pb-7 flex flex-col items-center text-center border-b ${
              isPartner
                ? 'bg-gradient-to-b from-[#0f203c] to-[#0a1528] border-[#1b3152]'
                : 'bg-gradient-to-b from-[#250a12] to-[#120509] border-rose-900/50'
            }`}>
              <ConsortiumLogo size="md" showGlow={true} className="mb-3 hover:scale-105 transition-transform" />

              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider mb-2.5 ${
                isPartner
                  ? 'bg-[#13233e] border border-[#203c68] text-[#93c5fd]'
                  : 'bg-rose-950/80 border border-rose-600/50 text-rose-300'
              }`}>
                <ShieldCheck className={`w-3.5 h-3.5 ${isPartner ? 'text-cyan-400' : 'text-rose-400'}`} />
                {isPartner ? 'Acceso Bancario RBAC + 2FA' : 'Mando Central SuperAdmin · BCRA Com. A7370'}
              </div>

              <h1 className="text-xl font-bold tracking-tight text-white">
                {viewMode === 'LOGIN' && (isPartner ? 'Ingreso para Bancos & Fintechs' : 'Mando Central de Gobernanza')}
                {viewMode === '2FA_CODE' && 'Verificación de Seguridad 2FA'}
                {viewMode === '2FA_ENROLL' && 'Enrolamiento Google Authenticator'}
                {viewMode === 'FORGOT_PASSWORD' && 'Recuperar Contraseña'}
              </h1>

              <p className="text-xs text-[#94a3b8] mt-1.5 max-w-sm leading-relaxed">
                {viewMode === 'LOGIN' && (isPartner
                  ? 'Acceso exclusivo para Bancos, Fintechs y Empresas. Ingrese con sus credenciales institucionales para acceder a la mesa de riesgo de su entidad.'
                  : 'Consola de alta seguridad reservada exclusivamente para administradores de red, calibración de pesos heurísticos y auditoría regulatoria.')}
                {viewMode === '2FA_CODE' && `Ingrese el código dinámico de 6 dígitos para la cuenta ${email}.`}
                {viewMode === '2FA_ENROLL' && 'Para cumplir la normativa BCRA Com. A7370, vincule Google Authenticator escaneando el código QR.'}
                {viewMode === 'FORGOT_PASSWORD' && 'Ingrese su correo institucional para recibir el enlace de restablecimiento seguro.'}
              </p>
            </div>

            {/* Mensajes de Estado */}
            {timeoutNotice && (
              <div className="m-6 mb-0 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-fade-in shadow-lg shadow-amber-950/30">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-amber-300">Sesión Expirada por Inactividad</span>
                  <span className="leading-snug text-amber-200/90">{timeoutNotice}</span>
                </div>
              </div>
            )}
            {errorMsg && (
              <div className="m-6 mb-0 p-3.5 rounded-xl bg-[#2e0909] border border-[#661616] text-[#fca5a5] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ef4444]" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="m-6 mb-0 p-3.5 rounded-xl bg-[#062c1d] border border-[#0f5132] text-[#86efac] text-xs flex items-start gap-2.5">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#22c55e]" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            {/* ── MODO 1: LOGIN (EMAIL + PASSWORD + OLVIDÉ CONTRASEÑA) ── */}
            {viewMode === 'LOGIN' && (
              <form onSubmit={handlePrimarySubmit} className="p-8 space-y-4">
                {/* Selector de Entidad / Banco si estamos en modo Partner */}
                {isPartner && fintechs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                      Entidad Financiera Adherida
                    </label>
                    <div className="relative">
                      <select
                        value={selectedEntityId}
                        onChange={e => setSelectedEntityId(e.target.value)}
                        className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-sans cursor-pointer appearance-none"
                      >
                        {fintechs.map(f => (
                          <option key={f.id} value={f.id} className="bg-[#0d182e] text-white">
                            {f.name} {f.status === 'SUSPENDED' ? '· [Cuarentena]' : '· [Entidad Activa]'}
                          </option>
                        ))}
                      </select>
                      <Building2 className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Campo Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    {isPartner ? 'Email Corporativo / Autorizado' : 'Email de Administrador Central'}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={isPartner ? 'analista@bancoprueba.com.ar' : 'superadmin@consorcio-antifraude.org'}
                      className={`w-full px-3.5 py-2.5 pl-10 bg-[#060c17] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none transition-all font-mono ${
                        isPartner ? 'border border-[#1e365b] focus:border-cyan-500' : 'border border-rose-900/60 focus:border-rose-500'
                      }`}
                    />
                    <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                  </div>
                </div>

                {/* Campo Contraseña */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                      {isPartner ? 'Contraseña Institucional' : 'Master Key / Contraseña de Gobernanza'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`text-[11px] transition flex items-center gap-1 font-mono ${
                        isPartner ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-rose-400 hover:text-rose-300'
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full px-3.5 py-2.5 pl-10 bg-[#060c17] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none transition-all font-mono ${
                        isPartner ? 'border border-[#1e365b] focus:border-cyan-500' : 'border border-rose-900/60 focus:border-rose-500'
                      }`}
                    />
                    <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                  </div>
                </div>

                {/* Enlace Olvidé mi Contraseña */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setViewMode('FORGOT_PASSWORD');
                    }}
                    className={`text-xs transition-colors ${
                      isPartner ? 'text-[#60a5fa] hover:text-white' : 'text-rose-400 hover:text-white'
                    }`}
                  >
                    ¿Olvidé mi contraseña?
                  </button>
                </div>

                {/* Botón Principal */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 group disabled:opacity-50 ${
                      isPartner
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-950/50'
                        : 'bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white shadow-lg shadow-rose-950/60'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando credenciales...</span>
                      </>
                    ) : (
                      <>
                        <span>{isPartner ? 'Ingresar a Mesa de Riesgo Bancaria' : 'Ingresar a Consola de Gobernanza'}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>

                {/* Pie con opciones y enlaces de rol */}
                <div className="pt-4 border-t border-[#162744] flex flex-col items-center gap-2 text-center">
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    🔒 <strong className="text-[#94a3b8]">Acceso Restringido:</strong> Solo ingresan cuentas autorizadas dadas de alta por la Gobernanza Central.
                  </p>
                  {isPartner ? (
                    <button
                      type="button"
                      onClick={onNavigateAdmin || (() => setCurrentRoute('admin-login'))}
                      className="text-[11px] text-[#60a5fa]/70 hover:text-cyan-300 transition-colors underline underline-offset-4 font-mono mt-1"
                    >
                      ¿Administrador de Gobernanza? Ingreso SuperAdmin
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onNavigateHome || (() => setCurrentRoute('partner-login'))}
                      className="text-[11px] text-[#60a5fa] hover:text-white transition-colors font-mono mt-1"
                    >
                      ← Volver al Portal de Bancos y Fintechs
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ── MODO 2: VERIFICACIÓN DE CÓDIGO 2FA TOTP (6 DÍGITOS) ── */}
            {viewMode === '2FA_CODE' && (
              <form onSubmit={handleVerify2FACode} className="p-8 space-y-5">
                <div className="p-3 rounded-xl bg-[#060c17] border border-[#17253d] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#94a3b8] truncate">{email}</span>
                  <span className="text-cyan-400 font-bold shrink-0">TOTP Activo</span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide text-center">
                    Código de 6 Dígitos de Google Authenticator
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 bg-[#060c17] border border-[#1e365b] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-all font-bold"
                  />
                  <p className="text-[11px] text-[#64748b] text-center">
                    Abra la app Google Authenticator en su teléfono e ingrese el código actual.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando 2FA en Supabase...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verificar Código & Acceder</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTotpCode('');
                      setErrorMsg(null);
                      setViewMode('LOGIN');
                    }}
                    className="w-full py-2.5 text-xs text-[#94a3b8] hover:text-white transition-colors"
                  >
                    ← Volver a ingresar contraseña
                  </button>
                </div>
              </form>
            )}

            {/* ── MODO 3: ENROLAMIENTO OBLIGATORIO 2FA CON CÓDIGO QR ── */}
            {viewMode === '2FA_ENROLL' && (
              <form onSubmit={handleCompleteEnrollment} className="p-8 space-y-5">
                <div className="flex flex-col items-center space-y-3">
                  <span className="text-xs font-bold text-white text-center">
                    Escanee este código con Google Authenticator:
                  </span>

                  {isGeneratingQr ? (
                    <div className="w-44 h-44 bg-white rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-slate-800 animate-spin" />
                    </div>
                  ) : enrollQrCode ? (
                    <div
                      className="p-3 bg-white rounded-xl shadow-lg"
                      dangerouslySetInnerHTML={{ __html: enrollQrCode }}
                    />
                  ) : null}

                  {/* Secreto Base32 para ingreso manual */}
                  {enrollSecret && (
                    <div className="w-full space-y-1">
                      <span className="text-[10px] text-[#94a3b8] block text-center">
                        O ingrese esta clave manualmente en su app:
                      </span>
                      <div className="flex items-center gap-2 bg-[#060c17] p-2 rounded-lg border border-[#1e365b]">
                        <span className="font-mono text-xs text-cyan-300 tracking-wider truncate flex-1 text-center">
                          {enrollSecret}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(enrollSecret)}
                          className="p-1 rounded bg-[#13233e] text-[#93c5fd] hover:bg-[#1e365b] transition shrink-0"
                          title="Copiar Secreto"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#162744]">
                  <label className="block text-xs font-semibold text-[#cbd5e1] text-center">
                    Ingrese el código de 6 dígitos que muestra su app:
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={enrollCode}
                    onChange={e => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.5em] text-xl font-mono py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading || enrollCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Confirmando vinculación...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Vincular y Continuar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('LOGIN');
                      setErrorMsg(null);
                    }}
                    className="w-full py-2 text-xs text-[#94a3b8] hover:text-white transition-colors"
                  >
                    ← Volver al login
                  </button>
                </div>
              </form>
            )}

            {/* ── MODO 4: OLVIDÉ MI CONTRASEÑA ── */}
            {viewMode === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleForgotPassword} className="p-8 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    Email Corporativo Registrado
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="analista@banco.com.ar"
                      className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-all font-mono"
                    />
                    <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[11px] text-[#64748b]">
                    Se enviará un enlace institucional de recuperación auditado por el consorcio.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enviando solicitud...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Enviar Instrucciones de Recuperación</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('LOGIN');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full py-2 text-xs text-[#94a3b8] hover:text-white transition-colors"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer Institucional ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628]/80 px-6 py-4 text-center text-[11px] text-[#64748b]">
        <p>Consorcio Federal de Prevención de Fraude · Infraestructura ZK con Cumplimiento BCRA Com. A7370 & FIPS 140-2</p>
      </footer>
    </div>
  );
}
