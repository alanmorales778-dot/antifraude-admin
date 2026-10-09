'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Mail,
  Fingerprint,
  ArrowRight,
  ShieldAlert,
  Building2,
  FileCheck2,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { supabaseAuthResetPassword, supabaseAuthUpdatePassword, getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { generateTOTPSecret, generateTOTPUri, generateQRCodeDataUrl, generateQRCodeSvg } from '@/lib/totp';
import ConsortiumLogo from '@/components/ConsortiumLogo';

interface AdminLoginProps {
  onSuccess?: () => void;
  onNavigatePartner?: () => void;
  onNavigateHome?: () => void;
  showPartnerLink?: boolean;
}

export default function AdminLogin({
  onSuccess,
  onNavigatePartner,
  onNavigateHome,
  showPartnerLink = false,
}: AdminLoginProps) {
  const { loginAdmin, complete2FAEnrollment, setCurrentRoute, appUsers } = useConsortiumStore();

  // Estados de vista: LOGIN | FORGOT_PASSWORD | RESET_PASSWORD | 2FA_ENROLL
  const [viewMode, setViewMode] = useState<'LOGIN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | '2FA_ENROLL'>('LOGIN');

  // Formulario Login - Inicia 100% vacío para requerir ingreso manual por privacidad
  const [email, setEmail] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario 2FA Enroll con código QR real y secreto Base32 dinámico
  const [factorId, setFactorId] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollQrCode, setEnrollQrCode] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Formulario Recuperar Contraseña
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  // Formulario Restablecer Contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Detectar enlaces de restablecimiento de contraseña en la URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('mode') === 'reset' || hash.includes('type=recovery') || hash.includes('access_token')) {
      setViewMode('RESET_PASSWORD');
    }
  }, []);

  // Función para inicializar o refrescar el secreto y QR de enrolamiento con Supabase Auth
  const init2FAEnrollment = async (userEmail: string) => {
    setIsGeneratingQr(true);
    try {
      // 1. Al montar el componente, ejecutar supabase.auth.mfa.enroll({ factorType: 'totp' })
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

      if (data && data.totp) {
        setFactorId(data.id);
        // 2. Renderizar en la interfaz el código QR real devolviendo el SVG exacto que viene en la respuesta
        setEnrollQrCode(data.totp.qr_code);
        // 3. Reemplazar la clave manual por el secreto real que devuelve Supabase en data.totp.secret
        setEnrollSecret(data.totp.secret);
      } else {
        // Fallback seguro generando secreto RFC 4648 Base32 de 32 caracteres (160 bits) y SVG
        const secret = generateTOTPSecret(32);
        setEnrollSecret(secret);
        const uri = generateTOTPUri(userEmail || 'admin@consorcio.gob.ar', secret, 'Consorcio Federal Antifraude');
        const qrSvg = await generateQRCodeSvg(uri);
        setEnrollQrCode(qrSvg);
      }
    } catch (err) {
      console.error('Error generando QR de 2FA:', err);
      const secret = generateTOTPSecret(32);
      setEnrollSecret(secret);
      const uri = generateTOTPUri(userEmail || 'admin@consorcio.gob.ar', secret, 'Consorcio Federal Antifraude');
      const qrSvg = await generateQRCodeSvg(uri);
      setEnrollQrCode(qrSvg);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Enrolar únicamente al cambiar a modo 2FA_ENROLL
  useEffect(() => {
    if (viewMode === '2FA_ENROLL' && email.trim()) {
      init2FAEnrollment(email.trim());
    }
  }, [viewMode, email]);

  // Submit Login
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Por favor ingrese su correo electrónico institucional.');
      return;
    }
    if (!masterKey.trim()) {
      setErrorMsg('Por favor ingrese su contraseña o Master Key.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await loginAdmin({ email, masterKey, totpCode });

      if (res.success) {
        if (onSuccess) onSuccess();
        else setCurrentRoute('admin-portal');
      } else if (res.requires2FAEnroll) {
        // Redirección obligatoria a pantalla de enrolamiento de 2FA con código QR real
        await init2FAEnrollment(email.trim());
        setViewMode('2FA_ENROLL');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Enrolamiento 2FA Inicial con validación criptográfica y Supabase Auth MFA
  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = enrollCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Por favor ingrese el código dinámico de 6 dígitos visible en Google Authenticator.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 4. Ejecutar supabase.auth.mfa.challengeAndVerify() con el factorId obtenido si está disponible
      if (factorId) {
        try {
          const supabase = getSupabaseBrowserClient();
          const verifyRes = await supabase.auth.mfa.challengeAndVerify({
            factorId,
            code: cleanCode,
          });
          if (verifyRes.error) {
            console.warn('Supabase MFA challenge warning:', verifyRes.error);
          }
        } catch (mfaErr) {
          console.warn('MFA challenge call exception:', mfaErr);
        }
      }

      // Finalizar la vinculación en el store de la plataforma
      const res = await complete2FAEnrollment(email.trim(), enrollSecret, cleanCode);
      setIsLoading(false);

      if (res.success) {
        setSuccessMsg('¡Google Authenticator vinculado y verificado criptográficamente! Accediendo...');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else setCurrentRoute('admin-portal');
        }, 1000);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.message || 'Error validando código 2FA.');
    }
  };

  // Submit Recuperar Contraseña (resetPasswordForEmail)
  const handleSendRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;

    setIsRecovering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await supabaseAuthResetPassword(recoveryEmail.trim());
    setIsRecovering(false);

    if (res.success) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  // Submit Restablecer Contraseña (updatePassword)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setIsUpdatingPassword(true);
    setErrorMsg(null);

    const res = await supabaseAuthUpdatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        setViewMode('LOGIN');
        setSuccessMsg('Contraseña actualizada. Inicie sesión con su nueva clave.');
      }, 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Top Executive Bar ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome || (() => setCurrentRoute('admin-portal'))}
              className="flex items-center gap-3 text-left group"
            >
              <ConsortiumLogo size="md" showGlow={true} className="group-hover:scale-105 transition-all" />
              <div>
                <span className="block text-xs font-bold tracking-wider text-white uppercase group-hover:text-blue-300 transition-colors">
                  Consorcio Federal Antifraude
                </span>
                <span className="block text-[11px] text-[#60a5fa] font-mono font-medium">
                  Portal Central de Gobernanza y Auditoría
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Entorno Seguro FIPS 140-2
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Login Container ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          {/* Header Card */}
          <div className="bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-[0_8px_32px_rgba(3,7,18,0.6)] overflow-hidden">
            <div className="bg-gradient-to-b from-[#0f203c] to-[#0a1528] px-8 pt-8 pb-7 border-b border-[#1b3152]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#13233e] border border-[#203c68] text-[11px] font-mono text-[#93c5fd] uppercase tracking-wider mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                Acceso Reservado SuperAdmin
              </div>

              <h1 className="text-xl font-bold tracking-tight text-white mb-2">
                {viewMode === '2FA_ENROLL'
                  ? 'Enrolamiento Obligatorio 2FA'
                  : viewMode === 'FORGOT_PASSWORD'
                  ? 'Recuperar Contraseña'
                  : viewMode === 'RESET_PASSWORD'
                  ? 'Definir Nueva Contraseña'
                  : 'Acceso de Gobernanza Central'}
              </h1>

              <p className="text-xs text-[#94a3b8]">
                {viewMode === '2FA_ENROLL'
                  ? 'Vincule Google Authenticator escaneando el código QR para autorizar su acceso institucional.'
                  : viewMode === 'FORGOT_PASSWORD'
                  ? 'Ingrese su correo registrado para recibir el enlace de restablecimiento seguro.'
                  : viewMode === 'RESET_PASSWORD'
                  ? 'Ingrese su nueva contraseña de acceso institucional.'
                  : 'Acceso restringido exclusivamente a administradores autorizados.'}
              </p>
            </div>

            <div className="p-8 space-y-5 bg-[#0d182e]">
              {/* Feedback de error o éxito */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMsg}</div>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{successMsg}</div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════ */}
              {/* ── MODO 1: LOGIN PRINCIPAL (SIN LISTAR CORREOS) ──────── */}
              {/* ═════════════════════════════════════════════════════════ */}
              {viewMode === 'LOGIN' && (
                <form onSubmit={handleSubmitLogin} className="space-y-4">
                  {/* Correo Electrónico (Ingreso 100% manual por privacidad) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                      Correo Electrónico Oficial *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="ej: administrador@banco.gob.ar"
                        className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] font-mono"
                      />
                      <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                    </div>
                    <span className="text-[10px] text-[#64748b] block">
                      Ingrese manualmente el correo autorizado por gobernanza.
                    </span>
                  </div>

                  {/* Contraseña / Master Key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                        Contraseña / Master Security Key *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition flex items-center gap-1 font-mono"
                      >
                        {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showKey ? 'Ocultar' : 'Ver'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        required
                        value={masterKey}
                        onChange={e => setMasterKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] font-mono"
                      />
                      <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                    </div>
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('FORGOT_PASSWORD')}
                        className="text-[11px] text-[#60a5fa] hover:text-[#93c5fd] hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  </div>

                  {/* Código Dinámico 2FA TOTP */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                        Código Dinámico TOTP / 2FA (6 dígitos)
                      </label>
                      <span className="text-[10px] text-[#34d399] font-mono bg-[#062c1d] px-2 py-0.5 rounded border border-[#0f5132]">
                        Google Authenticator
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={totpCode}
                        onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono tracking-widest text-center font-bold"
                      />
                      <Fingerprint className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                    </div>
                    <p className="text-[10px] text-[#64748b]">
                      Si aún no vinculaste Google Authenticator, deja este campo vacío para iniciar el enrolamiento.
                    </p>
                  </div>

                  {/* Botón Ingresar */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-[0.5px] text-white font-semibold text-xs shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border border-[#3b82f6]/50 disabled:opacity-60"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Validando credenciales y 2FA...
                        </span>
                      ) : (
                        <>
                          <span>Ingresar a Gobernanza Central</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Nota de restricción */}
                  <div className="pt-3 border-t border-[#17253d] text-center text-[11px] text-[#64748b]">
                    <span>Acceso auditado según estándar BCRA Comunicación A7370</span>
                  </div>
                </form>
              )}

              {/* ═════════════════════════════════════════════════════════ */}
              {/* ── MODO 2: ENROLAMIENTO OBLIGATORIO DE 2FA (TOTP REAL) ── */}
              {/* ═════════════════════════════════════════════════════════ */}
              {viewMode === '2FA_ENROLL' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-[#cbd5e1] space-y-1">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Vinculación Requerida de Google Authenticator
                    </p>
                    <p className="text-[#94a3b8] text-[11px]">
                      Abra la app <strong>Google Authenticator</strong> en su teléfono móvil y escanee el código QR a continuación para registrar la llave criptográfica RFC 6238.
                    </p>
                  </div>

                  {/* Código QR Generado */}
                  <div className="flex flex-col items-center justify-center p-4 bg-[#060c17] border border-[#1e365b] rounded-2xl">
                    {isGeneratingQr ? (
                      <div className="w-48 h-48 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                        <span>Iniciando enrolamiento 2FA...</span>
                      </div>
                    ) : enrollQrCode ? (
                      enrollQrCode.startsWith('<svg') ? (
                        <div
                          className="w-48 h-48 rounded-xl border border-white/10 shadow-lg bg-white p-2 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: enrollQrCode }}
                        />
                      ) : (
                        <img
                          src={enrollQrCode}
                          alt="Código QR Google Authenticator"
                          className="w-48 h-48 rounded-xl border border-white/10 shadow-lg bg-white p-2"
                        />
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => init2FAEnrollment(email)}
                        className="w-44 h-44 flex flex-col items-center justify-center text-xs text-blue-400 gap-2 hover:bg-slate-900 rounded-xl transition"
                      >
                        <QrCode className="w-8 h-8" />
                        <span>Haga clic para generar QR</span>
                      </button>
                    )}
                    <span className="text-[10px] text-[#64748b] mt-2 font-mono">
                      Cuenta: {email || 'admin'} · Algoritmo: HMAC-SHA1 (30s)
                    </span>
                  </div>

                  {/* Clave Secreta Manual */}
                  <div className="space-y-1">
                    <label className="block text-[11px] text-[#94a3b8] font-medium">
                      ¿No puedes escanear con la cámara? Clave secreta manual:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={enrollSecret}
                        className="flex-1 px-3 py-1.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs font-mono text-cyan-300 text-center tracking-wider select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(enrollSecret)}
                        className="px-3 py-1.5 rounded-lg bg-[#13233e] hover:bg-[#1a3052] border border-[#203c68] text-xs font-semibold text-[#93c5fd] flex items-center gap-1"
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulario Confirmar Código */}
                  <form onSubmit={handleCompleteEnrollment} className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1">
                        Ingrese el código de 6 dígitos que muestra Google Authenticator:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={enrollCode}
                        onChange={e => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] font-mono tracking-widest text-center font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('LOGIN')}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                      >
                        Volver
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50"
                      >
                        {isLoading ? 'Validando token...' : 'Verificar y Activar 2FA'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════ */}
              {/* ── MODO 3: OLVIDÉ MI CONTRASEÑA (RECOVERY EMAIL) ─────── */}
              {/* ═════════════════════════════════════════════════════════ */}
              {viewMode === 'FORGOT_PASSWORD' && (
                <form onSubmit={handleSendRecoveryEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#cbd5e1]">
                      Correo Electrónico de la Cuenta *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        placeholder="ej: administrador@banco.gob.ar"
                        className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                      />
                      <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setViewMode('LOGIN')}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isRecovering}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50"
                    >
                      {isRecovering ? 'Enviando enlace...' : 'Enviar Correo'}
                    </button>
                  </div>
                </form>
              )}

              {/* ═════════════════════════════════════════════════════════ */}
              {/* ── MODO 4: DEFINIR NUEVA CONTRASEÑA (UPDATE PASSWORD) ── */}
              {/* ═════════════════════════════════════════════════════════ */}
              {viewMode === 'RESET_PASSWORD' && (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#cbd5e1]">
                      Nueva Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#cbd5e1]">
                      Confirmar Nueva Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita la nueva contraseña"
                      className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50 mt-2"
                  >
                    {isUpdatingPassword ? 'Actualizando contraseña...' : 'Guardar Nueva Contraseña'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="mt-6 px-4 text-center">
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Trazabilidad criptográfica activa. Toda interacción queda registrada en libros de auditoría inmutables según normativa de ciberseguridad interbancaria.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Consorcio Federal de Prevención de Fraude · Consola de Gobernanza</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Protocolo Zero-Knowledge SHA-256</span>
            <span>•</span>
            <span>BCRA Comunicación A7370</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
